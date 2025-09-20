const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller'); 

/**
 * Agrega un contacto a la agenda privada del usuario.
 */
const addContactToAgenda = async (req, res) => {
    const { id: userId } = req.user;
    const { contactCedula } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // [CORRECCIÓN] Se ha eliminado la validación redundante.
        // El frontend (general.vue) solo envía la cédula de un contacto
        // que ya existe en la base de datos general.
        // La validación `contactCheck` y el `return res.status(404)`
        // eran la causa del error.

        // Insertar el contacto en la agenda del usuario
        const insertQuery = `
            INSERT INTO user_agendas (user_id, contact_cedula)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [userId, contactCedula]);
        await client.query('COMMIT');
        res.status(201).json({ message: 'Contacto agregado a la agenda privada.', contact: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al agregar contacto a la agenda privada:', err);
        if (err.code === '23505') { // Error de clave duplicada
            res.status(409).json({ error: 'El contacto ya está en tu agenda privada.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor.', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Obtiene solo la lista de cédulas de la agenda privada del usuario.
 */
const getPrivateAgendaCedulas = async (req, res) => {
    const { id: userId } = req.user;

    try {
        const query = `
            SELECT contact_cedula
            FROM user_agendas
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [userId]);
        const cedulas = result.rows.map(row => row.contact_cedula);
        res.json(cedulas);
    } catch (err) {
        console.error('Error al obtener las cédulas de la agenda privada:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Obtiene la lista completa de contactos de la agenda privada del usuario.
 */
const getPrivateAgenda = async (req, res) => {
    const { id: userId } = req.user;
    const { page = 1, itemsPerPage = 10, search = '' } = req.query;
    const limit = Math.min(parseInt(itemsPerPage), 100);
    const offset = (parseInt(page) - 1) * limit;

    let whereClause = `WHERE ua.user_id = $1`;
    const queryParams = [userId];
    let paramIndex = 2;

    if (search) {
        const searchTerms = search.split(/\s+/).filter(term => term);
        if (searchTerms.length > 0) {
            whereClause += ` AND g.search_vector @@ to_tsquery('spanish', $${paramIndex})`;
            queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
            paramIndex++;
        }
    }

    try {
        const countQuery = `SELECT COUNT(*) FROM user_agendas ua JOIN general g ON ua.contact_cedula = g.cedula ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                ua.contact_cedula AS cedula,
                g.nombres,
                g.apellidos,
                g.completo,
                cd.cargo,
                cd.empresa,
                cd.direccion,
                cd.notas,
                cd.fecha_nacimiento,
                cd.es_padre,
                cd.es_madre,
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos
            FROM
                user_agendas ua
            JOIN
                general g ON ua.contact_cedula = g.cedula
            LEFT JOIN
                contact_details cd ON ua.contact_cedula = cd.cedula
            LEFT JOIN
                telefonos t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                ua.contact_cedula, g.nombres, g.apellidos, g.completo, cd.cedula
            ORDER BY
                g.nombres ASC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        queryParams.push(limit);
        queryParams.push(offset);
        const dataResult = await pool.query(dataQuery, queryParams);
        const items = dataResult.rows;

        res.json({ items, totalItems });

    } catch (err) {
        console.error('Error al obtener la agenda privada:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Actualiza los detalles de un contacto en la tabla 'contact_details'.
 */
const updateContactDetails = async (req, res) => {
    const { contactCedula } = req.params;
    const { cargo, empresa, direccion, notas, fechaNacimiento, esPadre, esMadre } = req.body;
    
    try {
        // Verificar si el contacto existe en la agenda del usuario
        const agendaCheck = await pool.query('SELECT user_id FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2', [req.user.id, contactCedula]);
        if (agendaCheck.rowCount === 0) {
            return res.status(403).json({ error: 'No tienes permiso para editar este contacto o no existe en tu agenda.' });
        }

        const query = `
            INSERT INTO contact_details (
                cedula, cargo, empresa, direccion, notas, fecha_nacimiento, es_padre, es_madre, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, NOW()
            )
            ON CONFLICT (cedula) DO UPDATE SET
                cargo = EXCLUDED.cargo,
                empresa = EXCLUDED.empresa,
                direccion = EXCLUDED.direccion,
                notas = EXCLUDED.notas,
                fecha_nacimiento = EXCLUDED.fecha_nacimiento,
                es_padre = EXCLUDED.es_padre,
                es_madre = EXCLUDED.es_madre,
                updated_at = NOW()
            RETURNING *;
        `;
        const values = [contactCedula, cargo, empresa, direccion, notas, fechaNacimiento, esPadre, esMadre];
        const result = await pool.query(query, values);
        
        res.json({ message: 'Detalles del contacto actualizados.', updatedRecord: result.rows[0] });

    } catch (err) {
        console.error('Error al actualizar detalles del contacto:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Elimina un contacto de la agenda privada de un usuario.
 * También limpia los detalles del contacto si ya no está en la agenda de ningún otro usuario.
 */
const deleteContactFromAgenda = async (req, res) => {
    const { contactCedula } = req.params;
    const { id: userId } = req.user;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Paso 1: Eliminar el contacto de la agenda privada del usuario
        const deleteAgendaQuery = `
            DELETE FROM user_agendas
            WHERE user_id = $1 AND contact_cedula = $2
            RETURNING *;
        `;
        const result = await client.query(deleteAgendaQuery, [userId, contactCedula]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'El contacto no se encontró en tu agenda privada.' });
        }

        // Paso 2: Verificar si el contacto aún existe en la agenda de otro usuario
        const checkOthersQuery = `
            SELECT 1
            FROM user_agendas
            WHERE contact_cedula = $1
            LIMIT 1;
        `;
        const othersResult = await client.query(checkOthersQuery, [contactCedula]);

        // Si no se encontraron otros registros, es seguro eliminar los detalles del contacto
        if (othersResult.rowCount === 0) {
            const deleteDetailsQuery = `
                DELETE FROM contact_details
                WHERE cedula = $1
                RETURNING *;
            `;
            await client.query(deleteDetailsQuery, [contactCedula]);
            console.log(`Detalles del contacto ${contactCedula} eliminados porque ya no está en la agenda de ningún usuario.`);
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Contacto eliminado de la agenda exitosamente.', deletedRecord: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar contacto de la agenda:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

module.exports = {
    addContactToAgenda,
    getPrivateAgenda,
    getPrivateAgendaCedulas,
    updateContactDetails,
    deleteContactFromAgenda,
};