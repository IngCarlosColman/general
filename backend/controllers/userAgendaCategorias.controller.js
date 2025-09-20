// controllers/userAgendaCategorias.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene todas las categorías asignadas a un contacto específico.
 */
const getContactCategories = async (req, res) => {
    try {
        const { contact_cedula } = req.params;
        const { id: id_usuario } = req.user;
        
        const query = `
            SELECT 
                uac.categoria_id, 
                c.nombre_categoria
            FROM user_agenda_categorias uac
            JOIN categorias c ON uac.categoria_id = c.id
            WHERE uac.user_id = $1 AND uac.contact_cedula = $2
            ORDER BY c.nombre_categoria ASC;
        `;
        const result = await pool.query(query, [id_usuario, contact_cedula]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener las categorías del contacto:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Asigna una nueva categoría a un contacto.
 */
const assignCategoryToContact = async (req, res) => {
    const { contact_cedula } = req.params;
    const { categoria_id } = req.body;
    const { id: id_usuario } = req.user;
    
    try {
        // Verificar si el contacto existe en la agenda del usuario
        const agendaCheckQuery = 'SELECT 1 FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2';
        const agendaResult = await pool.query(agendaCheckQuery, [id_usuario, contact_cedula]);
        if (agendaResult.rowCount === 0) {
            return res.status(404).json({ error: 'El contacto no está en tu agenda, no se le puede asignar una categoría.' });
        }

        const insertQuery = `
            INSERT INTO user_agenda_categorias (user_id, contact_cedula, categoria_id)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [id_usuario, contact_cedula, categoria_id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al asignar la categoría:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'La categoría ya está asignada a este contacto.' });
        } else if (err.code === '23503') {
            res.status(400).json({ error: 'La categoría o el contacto no son válidos.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Elimina una categoría asignada a un contacto.
 */
const removeCategoryFromContact = async (req, res) => {
    const { contact_cedula, categoria_id } = req.params;
    const { id: id_usuario } = req.user;
    
    try {
        const deleteQuery = `
            DELETE FROM user_agenda_categorias
            WHERE user_id = $1 AND contact_cedula = $2 AND categoria_id = $3
            RETURNING *;
        `;
        const result = await pool.query(deleteQuery, [id_usuario, contact_cedula, categoria_id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no asignada o no encontrada.' });
        }
        res.json({ deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar la categoría asignada:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getContactCategories,
    assignCategoryToContact,
    removeCategoryFromContact,
};