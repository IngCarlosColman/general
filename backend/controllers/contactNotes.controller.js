// controllers/contactNotes.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene todas las notas de un contacto específico, con paginación,
 * búsqueda y ordenamiento.
 */
const getContactNotesData = async (req, res) => {
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

        let whereClause = `WHERE cn.user_id = $1 AND cn.contact_cedula = $2`;
        const queryParams = [id_usuario, contact_cedula];
        let paramIndex = 3;

        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            if (searchTerms.length > 0) {
                // Búsqueda simple en los campos de la nota
                whereClause += ` AND (cn.titulo ILIKE $${paramIndex} OR cn.cuerpo ILIKE $${paramIndex})`;
                queryParams.push(`%${searchTerms.join('%')}%`);
                paramIndex++;
            }
        }

        let orderByClause = 'ORDER BY cn.fecha_nota DESC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            
            const validSortFields = {
                'fecha_nota': 'cn.fecha_nota',
                'titulo': 'cn.titulo',
                'created_at': 'cn.created_at'
            };

            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

        const countQuery = `SELECT COUNT(*) FROM contact_notes cn ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                cn.*
            FROM
                contact_notes cn
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
        console.error('Error al obtener notas del contacto:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Obtiene una nota específica por su ID.
 */
const getNoteById = async (req, res) => {
    const { id } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const query = `
            SELECT *
            FROM contact_notes
            WHERE id = $1 AND user_id = $2;
        `;
        const result = await pool.query(query, [id, id_usuario]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener nota por ID:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Crea una nueva nota para un contacto en la agenda del usuario.
 */
const createNote = async (req, res) => {
    const { contact_cedula, titulo, cuerpo, fecha_nota } = req.body;
    const { id: id_usuario } = req.user;
    try {
        // Verificar si el contacto existe en la agenda del usuario antes de crear la nota.
        const agendaCheckQuery = 'SELECT 1 FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2';
        const agendaResult = await pool.query(agendaCheckQuery, [id_usuario, contact_cedula]);
        if (agendaResult.rowCount === 0) {
            return res.status(404).json({ error: 'El contacto no está en tu agenda, no se puede crear una nota.' });
        }

        const insertQuery = `
            INSERT INTO contact_notes (user_id, contact_cedula, titulo, cuerpo, fecha_nota)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [id_usuario, contact_cedula, titulo, cuerpo, fecha_nota]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al crear la nota:', err);
        if (err.code === '23503') {
            res.status(400).json({ error: 'La cédula de contacto no es válida o no está en tu agenda.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Actualiza una nota específica por su ID.
 */
const updateNote = async (req, res) => {
    const { id } = req.params;
    const { titulo, cuerpo, fecha_nota } = req.body;
    const { id: id_usuario } = req.user;
    try {
        const updateQuery = `
            UPDATE contact_notes
            SET 
                titulo = $1,
                cuerpo = $2,
                fecha_nota = $3
            WHERE id = $4 AND user_id = $5
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [titulo, cuerpo, fecha_nota, id, id_usuario]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar la nota:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Elimina una nota específica por su ID.
 */
const deleteNote = async (req, res) => {
    const { id } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const deleteQuery = `
            DELETE FROM contact_notes
            WHERE id = $1 AND user_id = $2
            RETURNING *;
        `;
        const result = await pool.query(deleteQuery, [id, id_usuario]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }
        res.json({ deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar la nota:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getContactNotesData,
    getNoteById,
    createNote,
    updateNote,
    deleteNote,
};