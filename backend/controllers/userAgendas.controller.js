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
                    WHERE search_vector @@ to_tsquery('spanish', $${paramIndex++})
                )`;
                queryParams.push(searchTerms.map(term => `${term}:*`).join(' & '));
            }
        }
        
        let orderClause = '';
        if (sortBy.length > 0) {
            const orderByColumns = sortBy.map(sort => {
                const column = sort.key === 'completo' ? 'g.completo' : `ua.${sort.key}`;
                return `${column} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`;
            });
            orderClause = `ORDER BY ${orderByColumns.join(', ')}`;
        }

        // Consulta para obtener los datos de la agenda
        const dataQuery = `
            SELECT 
                ua.contact_cedula,
                ua.tipo_relacion,
                ua.created_at,
                g.nombres,
                g.apellidos
            FROM user_agendas AS ua
            JOIN general AS g ON ua.contact_cedula = g.cedula
            ${whereClause}
            ${orderClause}
            LIMIT $${paramIndex++} OFFSET $${paramIndex++};
        `;
        queryParams.push(limit, offset);

        const dataResult = await pool.query(dataQuery, queryParams);
        
        // Consulta para obtener el total de registros sin paginación
        const countQuery = `
            SELECT COUNT(ua.contact_cedula)
            FROM user_agendas AS ua
            ${whereClause};
        `;
        const countResult = await pool.query(countQuery, [id_usuario]);
        const totalItems = parseInt(countResult.rows[0].count);

        res.json({
            items: dataResult.rows,
            totalItems: totalItems,
        });

    } catch (err) {
        console.error('Error al obtener los contactos de la agenda:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Añade un contacto de la tabla 'general' a la agenda del usuario.
 */
const addContactToAgenda = async (req, res) => {
    const { contact_cedula } = req.body;
    const { id: id_usuario } = req.user;
    
    // Verificamos si la cédula existe en la tabla general
    const generalContact = await pool.query('SELECT cedula FROM general WHERE cedula = $1', [contact_cedula]);
    if (generalContact.rowCount === 0) {
        return res.status(404).json({ error: 'El contacto no existe en la guía general.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Usamos ON CONFLICT para manejar duplicados de manera limpia
        const insertQuery = `
            INSERT INTO user_agendas (user_id, contact_cedula)
            VALUES ($1, $2)
            ON CONFLICT (user_id, contact_cedula) DO NOTHING
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [id_usuario, contact_cedula]);

        // Si se insertó el registro, retornamos el resultado
        if (result.rowCount > 0) {
             await client.query('COMMIT');
            res.status(201).json(result.rows[0]);
        } else {
            // Si el registro ya existe, retornamos un mensaje de error
            await client.query('ROLLBACK');
            res.status(409).json({ error: 'El contacto ya se encuentra en tu agenda.' });
        }

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al añadir contacto a la agenda:', err);
        // Si hay un error, el 'upsert' de la tabla 'general' debe capturarlo
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};


/**
 * Elimina un contacto de la agenda del usuario.
 */
const removeContactFromAgenda = async (req, res) => {
    const { contact_cedula } = req.params;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Se eliminan los registros relacionados antes de eliminar el contacto principal de la agenda.
        // Se corrige el nombre de la columna para 'contact_details'
        await client.query(`DELETE FROM contact_details WHERE cedula = $1 AND user_id = $2;`, [contact_cedula, id_usuario]);
        
        // Asumiendo que el resto de las tablas sí usan 'contact_cedula'
        await client.query(`DELETE FROM user_nombres WHERE contact_cedula = $1 AND user_id = $2;`, [contact_cedula, id_usuario]);
        await client.query(`DELETE FROM user_telefonos WHERE contact_cedula = $1 AND user_id = $2;`, [contact_cedula, id_usuario]);
        await client.query(`DELETE FROM contact_notes WHERE contact_cedula = $1 AND user_id = $2;`, [contact_cedula, id_usuario]);
        await client.query(`DELETE FROM follow_up_events WHERE contact_cedula = $1 AND user_id = $2;`, [contact_cedula, id_usuario]);
        await client.query(`DELETE FROM user_agenda_categorias WHERE contact_cedula = $1 AND user_id = $2;`, [contact_cedula, id_usuario]);
        
        const deleteQuery = `
            DELETE FROM user_agendas
            WHERE user_id = $1 AND contact_cedula = $2
            RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id_usuario, contact_cedula]);
        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'El contacto no se encontró en tu agenda' });
        }

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
        console.error('Error al actualizar el contacto:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getUserAgendaData,
    addContactToAgenda,
    removeContactFromAgenda,
    updateAgendaContact,
};