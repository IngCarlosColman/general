// ciudades.controller.js
const { pool } = require('../db/db');

const getCiudadesData = async (req, res) => {
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

const createCiudad = async (req, res) => {
    const { cod_dep, cod_ciu, ciudad } = req.body;
    const { id: id_usuario } = req.user;

    if (!cod_dep || cod_ciu === undefined || !ciudad) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para crear una ciudad.' });
    }

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

const updateCiudad = async (req, res) => {
    const { id } = req.params;
    const { cod_dep, cod_ciu, ciudad } = req.body;
    const { id: id_usuario } = req.user; 
    
    if (!cod_dep || cod_ciu === undefined || !ciudad) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar la ciudad.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // El middleware (canAccessRecord) ya validó el rol y la propiedad.
        // Solo verificamos si el registro existe (o bloqueamos la fila para la transacción).
        const checkQuery = `
            SELECT id FROM ciudades 
            WHERE id = $1 FOR UPDATE;
        `;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Ciudad no encontrada' });
        }
        
        // ❌ Eliminada la lógica de RESTRICCIÓN DE CAMBIO DE CLAVES para EDITORES
        
        const updateQuery = `
            UPDATE ciudades
            SET cod_dep = $1, cod_ciu = $2, ciudad = $3, updated_by = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [cod_dep, cod_ciu, ciudad, id_usuario, id]);
        
        await client.query('COMMIT');
        
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar la ciudad:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'La combinación de código de departamento y código de ciudad ya existe.' });
        } else if (err.code === '23503') {
            res.status(409).json({ error: 'El código de departamento especificado no existe.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

const deleteCiudad = async (req, res) => {
    const { id } = req.params;
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // El middleware (canAccessRecord) ya validó el rol y la propiedad.
        // Solo verificamos si el registro existe (o bloqueamos la fila para la transacción).
        const checkQuery = 'SELECT id FROM ciudades WHERE id = $1 FOR UPDATE;';
        const checkResult = await client.query(checkQuery, [id]);
        
        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Ciudad no encontrada' });
        }
        
        // ❌ Eliminada la lógica de RESTRICCIÓN DE ELIMINACIÓN para EDITORES
        
        const deleteQuery = `
            DELETE FROM ciudades WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id]);
        
        await client.query('COMMIT');

        res.json({ message: 'Ciudad eliminada exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar la ciudad:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar esta ciudad porque está vinculada a otra tabla.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

module.exports = {
    getCiudadesData,
    createCiudad,
    updateCiudad,
    deleteCiudad
};