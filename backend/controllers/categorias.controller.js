// src/controllers/categorias.controller.js

const { pool } = require('../db/db');

// Función auxiliar para verificar si el usuario es administrador.
// Esto centraliza el chequeo para las funciones CUD.
const checkAdminRole = (rol_usuario, res) => {
    if (rol_usuario !== 'administrador') {
        res.status(403).json({ error: 'Acceso denegado. Solo los administradores pueden modificar categorías.' });
        return false;
    }
    return true;
};

/**
 * Obtiene todas las categorías de la tabla 'categorias'.
 * (Lectura permitida para todos los roles autenticados)
 */
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

/**
 * Crea una nueva categoría.
 * 🚨 RESTRICCIÓN: Solo administradores.
 */
const createCategoria = async (req, res) => {
    const { rol: rol_usuario } = req.user;
    if (!checkAdminRole(rol_usuario, res)) return;

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

/**
 * Actualiza una categoría existente.
 * 🚨 RESTRICCIÓN: Solo administradores.
 */
const updateCategoria = async (req, res) => {
    const { rol: rol_usuario } = req.user;
    if (!checkAdminRole(rol_usuario, res)) return;
    
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

/**
 * Elimina una categoría.
 * 🚨 RESTRICCIÓN: Solo administradores.
 */
const deleteCategoria = async (req, res) => {
    const { rol: rol_usuario } = req.user;
    if (!checkAdminRole(rol_usuario, res)) return;

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