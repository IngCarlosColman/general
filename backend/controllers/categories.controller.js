// controllers/categories.controller.js

const { pool } = require('../db/db');

/**
 * Obtiene todas las categorías de la tabla 'categorias'.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
const getCategories = async (req, res) => {
    try {
        const query = 'SELECT id, nombre_categoria FROM categorias ORDER BY nombre_categoria ASC';
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener las categorías:', err);
        res.status(500).json({ error: 'Error del servidor al obtener las categorías' });
    }
};

module.exports = {
    getCategories,
};