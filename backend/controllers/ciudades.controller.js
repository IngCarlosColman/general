// ciudades.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene los datos de la tabla de ciudades.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getCiudadesData = async (req, res) => {
    // La validación de rol se ha movido al middleware
    try {
        const { page = 1, itemsPerPage = 10, search = '', cod_dep = null } = req.query;
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
        let whereClauseParts = [];
        const queryParams = [];
        let paramIndex = 1;
        if (cod_dep) {
            whereClauseParts.push(`"cod_dep" = $${paramIndex}`);
            queryParams.push(cod_dep);
            paramIndex++;
        }
        if (search) {
            const searchPattern = `%${search}%`;
            whereClauseParts.push(`(cod_dep ILIKE $${paramIndex} OR CAST(cod_ciu AS TEXT) ILIKE $${paramIndex} OR ciudad ILIKE $${paramIndex})`);
            queryParams.push(searchPattern);
            paramIndex++;
        }
        let whereClause = whereClauseParts.length > 0 ? `WHERE ${whereClauseParts.join(' AND ')}` : '';
        let orderByClause = 'ORDER BY ciudad ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = ['id', 'cod_dep', 'cod_ciu', 'ciudad'];
            if (validSortFields.includes(sortKey)) {
                orderByClause = `ORDER BY "${sortKey}" ${sortOrder}`;
            }
        }
        const countQuery = `SELECT COUNT(*) FROM ciudades ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT
                id,
                cod_dep,
                cod_ciu,
                ciudad,
                created_by
            FROM
                ciudades
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
        console.error('Error al obtener datos de la tabla de ciudades:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Crea un nuevo registro de ciudad.
 * La validación de permisos ahora se realiza en el middleware.
 */
const createCiudad = async (req, res) => {
    // La validación de rol se ha movido al middleware
    const { cod_dep, cod_ciu, ciudad } = req.body;
    const { id: id_usuario } = req.user;
    try {
        const insertQuery = `
            INSERT INTO ciudades (cod_dep, cod_ciu, ciudad, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [cod_dep, cod_ciu, ciudad, id_usuario]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al insertar la ciudad:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'La combinación de código de departamento y código de ciudad ya existe.' });
        } else if (err.code === '23503') {
            res.status(409).json({ error: 'El código de departamento especificado no existe.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Actualiza un registro de ciudad.
 * La validación de permisos ahora se realiza en el middleware.
 */
const updateCiudad = async (req, res) => {
    // La validación de rol se ha movido al middleware
    const { id } = req.params;
    const { cod_dep, cod_ciu, ciudad } = req.body;
    const { id: id_usuario } = req.user;
    try {
        const updateQuery = `
            UPDATE ciudades
            SET cod_dep = $1, cod_ciu = $2, ciudad = $3, updated_by = $4
            WHERE id = $5
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [cod_dep, cod_ciu, ciudad, id_usuario, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ciudad no encontrada' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar la ciudad:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'La combinación de código de departamento y código de ciudad ya existe.' });
        } else if (err.code === '23503') {
            res.status(409).json({ error: 'El código de departamento especificado no existe.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Elimina un registro de ciudad.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deleteCiudad = async (req, res) => {
    const { id } = req.params;
    try {
        // La validación de permisos se ha movido al middleware
        const deleteQuery = `
            DELETE FROM ciudades WHERE id = $1 RETURNING *;
        `;
        const result = await pool.query(deleteQuery, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Ciudad no encontrada' });
        }
        res.json({ message: 'Ciudad eliminada exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar la ciudad:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar esta ciudad porque está vinculada a otra tabla.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

module.exports = {
    getCiudadesData,
    createCiudad,
    updateCiudad,
    deleteCiudad
};