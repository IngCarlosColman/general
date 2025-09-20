// controllers/userAgendas.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene los contactos de la agenda personal del usuario, con paginación,
 * búsqueda y ordenamiento.
 */
const getUserAgendaData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
        const { id: id_usuario } = req.user;
        let sortBy = [];
        if (req.query.sortBy) {
            try {
                sortBy = JSON.parse(req.query.sortBy);
            } catch (error) {
                console.error("Error al parsear el parámetro sortBy:", error);
            }
        }
        
        const limit = Math.min(parseInt(itemsPerPage), 100);
        const offset = (parseInt(page) - 1) * limit;

        let whereClause = `WHERE ua.user_id = $1`;
        const queryParams = [id_usuario];
        let paramIndex = 2;

        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            if (searchTerms.length > 0) {
                // La búsqueda se realiza en la tabla general que tiene el search_vector
                whereClause += ` AND ua.contact_cedula IN (
                    SELECT cedula FROM mv_general_busqueda 
                    WHERE search_vector @@ to_tsquery('spanish', $${paramIndex})
                )`;
                queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
                paramIndex++;
            }
        }

        let orderByClause = 'ORDER BY ua.created_at DESC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            
            // Las columnas a ordenar son de la tabla general o de la propia tabla
            const validSortFields = {
                'cedula': 'g.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'tipo_relacion': 'ua.tipo_relacion',
                'created_at': 'ua.created_at'
            };

            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

        const countQuery = `SELECT COUNT(*) FROM user_agendas ua ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                ua.*,
                g.nombres,
                g.apellidos,
                g.completo,
                g.id as general_id
            FROM
                user_agendas ua
            JOIN 
                general g ON ua.contact_cedula = g.cedula
            ${whereClause}
            ${orderByClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        queryParams.push(limit);
        queryParams.push(offset);
        const dataResult = await pool.query(dataQuery, queryParams);
        const items = dataResult.rows;

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener datos de la agenda del usuario:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Agrega un contacto a la agenda personal del usuario.
 * Nota: El contacto debe existir previamente en la tabla `general`.
 */
const addContactToAgenda = async (req, res) => {
    const { contact_cedula, tipo_relacion = 'contacto' } = req.body;
    const { id: id_usuario } = req.user;
    
    // Verificación de existencia en la tabla `general`
    try {
        const generalCheckQuery = 'SELECT cedula FROM general WHERE cedula = $1';
        const generalResult = await pool.query(generalCheckQuery, [contact_cedula]);
        if (generalResult.rowCount === 0) {
            return res.status(404).json({ error: 'La cédula no existe en la guía general.' });
        }

        const insertQuery = `
            INSERT INTO user_agendas (user_id, contact_cedula, tipo_relacion)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [id_usuario, contact_cedula, tipo_relacion]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Error al agregar contacto a la agenda:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'El contacto ya existe en tu agenda personal.' });
        } else if (err.code === '23503') {
            res.status(400).json({ error: 'La cédula de contacto no es válida.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Elimina un contacto de la agenda personal del usuario y todos los registros
 * asociados en las tablas `user_nombres`, `user_telefonos`, `contact_details`,
 * `contact_notes` y `follow_up_events`.
 */
const removeContactFromAgenda = async (req, res) => {
    const { contact_cedula } = req.params;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Eliminar registros de tablas relacionadas
        await client.query('DELETE FROM user_nombres WHERE user_id = $1 AND contact_cedula = $2', [id_usuario, contact_cedula]);
        await client.query('DELETE FROM user_telefonos WHERE user_id = $1 AND contact_cedula = $2', [id_usuario, contact_cedula]);
        await client.query('DELETE FROM contact_details WHERE user_id = $1 AND cedula = $2', [id_usuario, contact_cedula]);
        await client.query('DELETE FROM contact_notes WHERE user_id = $1 AND contact_cedula = $2', [id_usuario, contact_cedula]);
        await client.query('DELETE FROM follow_up_events WHERE user_id = $1 AND contact_cedula = $2', [id_usuario, contact_cedula]);
        await client.query('DELETE FROM user_agenda_categorias WHERE user_id = $1 AND contact_cedula = $2', [id_usuario, contact_cedula]);

        // Eliminar el registro principal de user_agendas
        const deleteQuery = `
            DELETE FROM user_agendas
            WHERE user_id = $1 AND contact_cedula = $2
            RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id_usuario, contact_cedula]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'El contacto no se encontró en tu agenda' });
        }

        await client.query('COMMIT');
        res.json({ deletedRecord: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar contacto de la agenda:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro en la tabla user_agendas.
 */
const updateAgendaContact = async (req, res) => {
    const { contact_cedula } = req.params;
    const { tipo_relacion } = req.body;
    const { id: id_usuario } = req.user;

    if (!tipo_relacion) {
        return res.status(400).json({ error: 'El campo tipo_relacion es requerido.' });
    }

    try {
        const updateQuery = `
            UPDATE user_agendas
            SET tipo_relacion = $1,
                updated_at = NOW()
            WHERE user_id = $2 AND contact_cedula = $3
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [tipo_relacion, id_usuario, contact_cedula]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El contacto no se encontró en tu agenda.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar el contacto en la agenda:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getUserAgendaData,
    addContactToAgenda,
    removeContactFromAgenda,
    updateAgendaContact
};