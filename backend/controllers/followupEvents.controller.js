// controllers/followUpEvents.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene todos los eventos de seguimiento de un contacto específico, con paginación,
 * búsqueda y ordenamiento.
 */
const getFollowUpEventsData = async (req, res) => {
    try {
        const { contact_cedula } = req.params;
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

        let whereClause = `WHERE fe.user_id = $1 AND fe.contact_cedula = $2`;
        const queryParams = [id_usuario, contact_cedula];
        let paramIndex = 3;

        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            if (searchTerms.length > 0) {
                // Búsqueda simple en los campos relevantes
                whereClause += ` AND (fe.title ILIKE $${paramIndex} OR fe.description ILIKE $${paramIndex})`;
                queryParams.push(`%${searchTerms.join('%')}%`);
                paramIndex++;
            }
        }

        let orderByClause = 'ORDER BY fe.date DESC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            
            const validSortFields = {
                'title': 'fe.title',
                'date': 'fe.date',
                'created_at': 'fe.created_at'
            };

            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

        const countQuery = `SELECT COUNT(*) FROM follow_up_events fe ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                fe.*
            FROM
                follow_up_events fe
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
        console.error('Error al obtener eventos de seguimiento:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Obtiene un evento de seguimiento específico por su ID.
 */
const getEventById = async (req, res) => {
    const { id } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const query = `
            SELECT *
            FROM follow_up_events
            WHERE id = $1 AND user_id = $2;
        `;
        const result = await pool.query(query, [id, id_usuario]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener evento por ID:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Crea un nuevo evento de seguimiento.
 */
const createEvent = async (req, res) => {
    const { contact_cedula, title, description, date, color, icon, event_key, contexto_interaccion, es_recordatorio } = req.body;
    const { id: id_usuario } = req.user;
    try {
        // Verificar si el contacto existe en la agenda del usuario.
        const agendaCheckQuery = 'SELECT 1 FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2';
        const agendaResult = await pool.query(agendaCheckQuery, [id_usuario, contact_cedula]);
        if (agendaResult.rowCount === 0) {
            return res.status(404).json({ error: 'El contacto no está en tu agenda, no se puede crear un evento.' });
        }

        const insertQuery = `
            INSERT INTO follow_up_events (user_id, contact_cedula, title, description, date, color, icon, event_key, contexto_interaccion, es_recordatorio)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [id_usuario, contact_cedula, title, description, date, color, icon, event_key, contexto_interaccion, es_recordatorio]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al crear el evento:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'La clave del evento ya existe. Por favor, use otra.', details: err.detail });
        } else if (err.code === '23503') {
            res.status(400).json({ error: 'La cédula de contacto no es válida o no está en tu agenda.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Actualiza un evento de seguimiento específico por su ID.
 */
const updateEvent = async (req, res) => {
    const { id } = req.params;
    const { title, description, date, color, icon, event_key, contexto_interaccion, es_recordatorio } = req.body;
    const { id: id_usuario } = req.user;
    try {
        const updateQuery = `
            UPDATE follow_up_events
            SET 
                title = $1,
                description = $2,
                date = $3,
                color = $4,
                icon = $5,
                event_key = $6,
                contexto_interaccion = $7,
                es_recordatorio = $8
            WHERE id = $9 AND user_id = $10
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [
            title, description, date, color, icon, event_key, contexto_interaccion, es_recordatorio, id, id_usuario
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar el evento:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'La clave del evento ya existe. Por favor, use otra.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Elimina un evento de seguimiento específico por su ID.
 */
const deleteEvent = async (req, res) => {
    const { id } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const deleteQuery = `
            DELETE FROM follow_up_events
            WHERE id = $1 AND user_id = $2
            RETURNING *;
        `;
        const result = await pool.query(deleteQuery, [id, id_usuario]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }
        res.json({ deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar el evento:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getFollowUpEventsData,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
};