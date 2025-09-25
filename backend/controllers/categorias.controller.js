// src/controllers/categorias.controller.js
const { pool } = require('../db/db');

const getCategorias = async (req, res) => {
    try {
        const query = 'SELECT id, nombre_categoria FROM categorias ORDER BY nombre_categoria ASC;';
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener las categorías:', err);
        res.status(500).json({ error: 'Error del servidor al obtener las categorías' });
    }
};

const createCategoria = async (req, res) => {
    // ❌ Eliminada la verificación de rol.
    const { nombre_categoria } = req.body;
    
    try {
        const query = 'INSERT INTO categorias (nombre_categoria) VALUES ($1) RETURNING *;';
        const result = await pool.query(query, [nombre_categoria]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al crear la categoría:', err);
        if (err.code === '23505') { // Código de error de unicidad
            return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.', details: err.detail });
        }
        res.status(500).json({ error: 'Error del servidor.', details: err.detail });
    }
};

const updateCategoria = async (req, res) => {
    // ❌ Eliminada la verificación de rol.
    
    const { id } = req.params;
    const { nombre_categoria } = req.body;
    
    try {
        const query = 'UPDATE categorias SET nombre_categoria = $1 WHERE id = $2 RETURNING *;';
        const result = await pool.query(query, [nombre_categoria, id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar la categoría:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.', details: err.detail });
        }
        res.status(500).json({ error: 'Error del servidor.', details: err.detail });
    }
};

const deleteCategoria = async (req, res) => {
    // ❌ Eliminada la verificación de rol.

    const { id } = req.params;
    
    try {
        const query = 'DELETE FROM categorias WHERE id = $1 RETURNING *;';
        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }
        res.json({ message: 'Categoría eliminada correctamente.' });
    } catch (err) {
        console.error('Error al eliminar la categoría:', err);
        if (err.code === '23503') { // Código de error de clave foránea
            return res.status(409).json({ error: 'No se puede eliminar la categoría porque está asignada a uno o más contactos.', details: err.detail });
        }
        res.status(500).json({ error: 'Error del servidor.', details: err.detail });
    }
};

module.exports = {
    getCategorias,
    createCategoria,
    updateCategoria,
    deleteCategoria,
};