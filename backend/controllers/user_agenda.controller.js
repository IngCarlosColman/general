const { pool } = require('../db/db');
// 🚨 IMPORTACIÓN NECESARIA: Importar upsertGeneral para manejar la creación/actualización en la tabla 'general'.
const { upsertGeneral } = require('./general.controller'); 

const getUserAgenda = async (req, res) => {
    const { id: userId } = req.user;
    try {
        const query = `
            SELECT
                g.cedula,
                g.nombres,
                g.apellidos,
                g.completo,
                t.telefonos,
                ua.categoria_id,
                c.nombre_categoria,
                cn.cuerpo AS notas
            FROM user_agendas AS ua
            JOIN general AS g ON ua.contact_cedula = g.cedula
            LEFT JOIN categorias AS c ON ua.categoria_id = c.id
            LEFT JOIN mv_telefonos_agregados AS t ON g.cedula = t.cedula
            LEFT JOIN contact_notes AS cn ON ua.user_id = cn.user_id AND ua.contact_cedula = cn.contact_cedula
            WHERE ua.user_id = $1
            ORDER BY g.nombres ASC;
        `;
        const result = await pool.query(query, [userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener la agenda del usuario:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const addContactToUserAgenda = async (req, res) => {
    // 🚨 AJUSTE DE DESTRUCTURING: Esperamos todos los campos necesarios para 'general' y 'user_agendas'
    const { 
        cedula, nombres, apellidos, telefonos, // Campos para crear/actualizar en la tabla 'general'
        categoria_id, notas                   // Campos para la tabla 'user_agendas'
    } = req.body;
    
    // Obtener datos del usuario autenticado
    const { id: userId, rol: rol_usuario } = req.user;
    const client = await pool.connect();

    if (!cedula) {
        return res.status(400).json({ error: 'La cédula del contacto es obligatoria.' });
    }

    try {
        await client.query('BEGIN');
        
        // 1. VERIFICAR/CREAR/ACTUALIZAR CONTACTO EN LA TABLA GENERAL
        
        // Verificamos si la cédula ya existe en la tabla GENERAL.
        const checkGeneralQuery = `SELECT cedula FROM general WHERE cedula = $1`;
        const generalResult = await client.query(checkGeneralQuery, [cedula]);
        
        if (generalResult.rows.length === 0) {
            // La cédula NO existe en 'general'. Lo creamos usando upsertGeneral.
            
            // Reconstruimos el formato de 'nombre' que upsertGeneral espera (ej: Apellido, Nombre)
            const nombreCompleto = (apellidos && nombres) ? `${apellidos}, ${nombres}` : (nombres || cedula);

            // Llamamos a la función modular para crear el registro y sus teléfonos
            const generalRecord = await upsertGeneral(cedula, nombreCompleto, telefonos, userId, client, rol_usuario);

            if (!generalRecord) {
                 await client.query('ROLLBACK');
                 // Esto es un error de lógica, pero se deja para evitar que falle silenciosamente
                 return res.status(400).json({ error: 'Fallo al crear el registro general. (Cédula o nombre incompleto en el payload).' });
            }
        }
        
        // 2. AGREGAR CONTACTO A LA AGENDA DEL USUARIO (user_agendas)

        const checkAgendaQuery = `SELECT 1 FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2`;
        const checkAgendaResult = await client.query(checkAgendaQuery, [userId, cedula]);

        if (checkAgendaResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Este contacto ya existe en tu agenda privada.' });
        }
        
        const insertAgendaQuery = `
            INSERT INTO user_agendas (user_id, contact_cedula, categoria_id)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const agendaResult = await client.query(insertAgendaQuery, [userId, cedula, categoria_id]);

        // 3. INSERTAR NOTAS (si existen)
        if (notas) {
            const insertNotesQuery = `
                INSERT INTO contact_notes (user_id, contact_cedula, titulo, cuerpo)
                VALUES ($1, $2, 'Notas de la agenda', $3)
                RETURNING *;
            `;
            await client.query(insertNotesQuery, [userId, cedula, notas]);
        }
        
        await client.query('COMMIT');
        res.status(201).json({ 
            message: 'Contacto procesado (creado en general si fue necesario) y agregado a la agenda con éxito.', 
            newEntry: agendaResult.rows[0] 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al agregar contacto a la agenda:', err);
        
        // Manejo de errores de llave foránea o base de datos
        if (err.code === '23503') { 
            // Esto sucede si la cédula no existe en 'general' (y falló la creación) o si la 'categoria_id' es inválida.
            return res.status(400).json({ error: 'La cédula o categoría proporcionada no es válida (o falló la creación en tabla general).', details: err.detail });
        }
        
        // Manejo de error de restricción UNIQUE de la tabla general (23505) si upsertGeneral falla por conflicto.
        if (err.code === '23505') { 
             return res.status(409).json({ error: 'Ya existe un registro en la base de datos general con esa cédula.', details: err.detail });
        }
        
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};


const removeContactFromUserAgenda = async (req, res) => {
    const { contact_cedula } = req.params;
    const { id: userId } = req.user;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        await client.query(`DELETE FROM contact_notes WHERE user_id = $1 AND contact_cedula = $2;`, [userId, contact_cedula]);

        const deleteAgendaQuery = `
            DELETE FROM user_agendas 
            WHERE user_id = $1 AND contact_cedula = $2 
            RETURNING *;
        `;
        const result = await client.query(deleteAgendaQuery, [userId, contact_cedula]);
        
        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Contacto no encontrado en tu agenda' });
        }

        res.status(200).json({ message: 'Contacto eliminado de la agenda con éxito' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar contacto de la agenda:', err);
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
};

const updateContactInUserAgenda = async (req, res) => {
    const { contact_cedula } = req.params;
    const { categoria_id, notas } = req.body;
    const { id: userId } = req.user;
    const client = await pool.connect();

    if (categoria_id === undefined && notas === undefined) {
        return res.status(400).json({ error: 'Debe proporcionar al menos categoria_id o notas para actualizar.' });
    }

    try {
        await client.query('BEGIN');

        let agendaResult = { rowCount: 0 };
        if (categoria_id !== undefined) {
            const updateAgendaQuery = `
                UPDATE user_agendas 
                SET categoria_id = $1 
                WHERE user_id = $2 AND contact_cedula = $3
                RETURNING *;
            `;
            agendaResult = await client.query(updateAgendaQuery, [categoria_id, userId, contact_cedula]);

            if (agendaResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Contacto no encontrado en tu agenda para actualizar.' });
            }
        }

        if (notas !== undefined) {
             if (notas && notas.trim() !== '') {
                const upsertNotesQuery = `
                    INSERT INTO contact_notes (user_id, contact_cedula, titulo, cuerpo) 
                    VALUES ($1, $2, 'Notas de la agenda', $3)
                    ON CONFLICT (user_id, contact_cedula) DO UPDATE SET
                    cuerpo = EXCLUDED.cuerpo,
                    updated_at = NOW(); 
                `;
                await client.query(upsertNotesQuery, [userId, contact_cedula, notas]);
            } else {

                await client.query(`DELETE FROM contact_notes WHERE user_id = $1 AND contact_cedula = $2;`, [userId, contact_cedula]);
            }
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Contacto actualizado con éxito', updatedEntry: agendaResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar contacto en la agenda:', err);
        if (err.code === '23503') { 
             return res.status(400).json({ error: 'La categoría proporcionada no es válida.' });
        }
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
};

module.exports = {
    getUserAgenda,
    addContactToUserAgenda,
    removeContactFromUserAgenda,
    updateContactInUserAgenda,
};