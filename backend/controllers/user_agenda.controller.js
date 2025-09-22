const { pool } = require('../db/db');

// Obtiene los contactos de la agenda privada para el usuario autenticado
const getUserAgenda = async (req, res) => {
    console.log('Se ha llamado a la ruta GET /api/agenda');
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
        console.log('Datos de la agenda:', result.rows);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener la agenda del usuario:', err);
        console.log('Datos de la agenda:', result.rows);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Agrega un contacto de la tabla general a la agenda privada del usuario
const addContactToUserAgenda = async (req, res) => {
    const { contact_cedula, categoria_id, notas } = req.body;
    const { id: userId } = req.user;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verificar si el contacto ya existe en la agenda del usuario
        const checkQuery = `SELECT * FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2`;
        const checkResult = await client.query(checkQuery, [userId, contact_cedula]);

        if (checkResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Este contacto ya existe en tu agenda privada.' });
        }

        // 2. Insertar el registro en user_agendas
        const insertAgendaQuery = `
            INSERT INTO user_agendas (user_id, contact_cedula, categoria_id)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const agendaResult = await client.query(insertAgendaQuery, [userId, contact_cedula, categoria_id]);

        // 3. Insertar notas, si se proporcionan
        if (notas) {
            const insertNotesQuery = `
                INSERT INTO contact_notes (user_id, contact_cedula, titulo, cuerpo)
                VALUES ($1, $2, 'Notas de la agenda', $3)
                RETURNING *;
            `;
            await client.query(insertNotesQuery, [userId, contact_cedula, notas]);
        }
        
        await client.query('COMMIT');
        res.status(201).json({ message: 'Contacto agregado a la agenda con éxito', newEntry: agendaResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al agregar contacto a la agenda:', err);
        if (err.code === '23503') { // Violación de clave foránea
             return res.status(400).json({ error: 'La cédula o categoría proporcionada no es válida.' });
        }
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
};

// Elimina un contacto de la agenda privada del usuario
const removeContactFromUserAgenda = async (req, res) => {
    const { contact_cedula } = req.params;
    const { id: userId } = req.user;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Eliminar de la tabla contact_notes (si existe)
        await client.query(`DELETE FROM contact_notes WHERE user_id = $1 AND contact_cedula = $2;`, [userId, contact_cedula]);

        // 2. Eliminar de la tabla user_agendas
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

    try {
        await client.query('BEGIN');

        // 1. Actualizar la tabla user_agendas
        const updateAgendaQuery = `
            UPDATE user_agendas 
            SET categoria_id = $1 
            WHERE user_id = $2 AND contact_cedula = $3
            RETURNING *;
        `;
        const agendaResult = await client.query(updateAgendaQuery, [categoria_id, userId, contact_cedula]);

        if (agendaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Contacto no encontrado en tu agenda para actualizar.' });
        }

        // 2. Insertar o actualizar notas
        if (notas) {
            const upsertNotesQuery = `
                INSERT INTO contact_notes (user_id, contact_cedula, cuerpo)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, contact_cedula) DO UPDATE SET
                cuerpo = EXCLUDED.cuerpo;
            `;
            await client.query(upsertNotesQuery, [userId, contact_cedula, notas]);
        } else {
            // Si las notas se vaciaron, eliminarlas
            await client.query(`DELETE FROM contact_notes WHERE user_id = $1 AND contact_cedula = $2;`, [userId, contact_cedula]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Contacto actualizado con éxito', updatedEntry: agendaResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar contacto en la agenda:', err);
        res.status(500).json({ error: 'Error del servidor' });
    } finally {
        client.release();
    }
};

module.exports = {
    getUserAgenda,
    addContactToUserAgenda,
    removeContactFromUserAgenda,
    updateContactInUserAgenda, // ✅ Exporta el nuevo controlador
};