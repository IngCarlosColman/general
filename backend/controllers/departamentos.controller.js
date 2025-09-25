// departamentos.controller.js
const { pool } = require('../db/db');

const getDepartamentosData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
        const limit = Math.min(parseInt(itemsPerPage), 100);
        const offset = (parseInt(page) - 1) * limit;
        let sortBy = [];
        if (req.query.sortBy) {
            try {
                sortBy = JSON.parse(req.query.sortBy);
            } catch (error) {
                console.error("Error al parsear el parámetro sortBy:", error);
            }
        }
        let whereClause = '';
        const queryParams = [];
        let paramIndex = 1;
        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            if (searchTerms.length > 0) {
                const searchPattern = `%${searchTerms.join('%')}%`;
                whereClause = `WHERE cod_dep ILIKE $${paramIndex} OR depart ILIKE $${paramIndex}`;
                queryParams.push(searchPattern);
                paramIndex++;
            }
        }
        let orderByClause = 'ORDER BY depart ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = ['id', 'cod_dep', 'depart'];
            if (validSortFields.includes(sortKey)) {
                orderByClause = `ORDER BY "${sortKey}" ${sortOrder}`;
            }
        }
        const countQuery = `SELECT COUNT(*) FROM departamentos ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        
        const dataQuery = `
            SELECT
                id,
                cod_dep,
                depart,
                created_by
            FROM
                departamentos
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
        console.error('Error al obtener datos de la tabla de departamentos:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const createDepartamento = async (req, res) => {
    const { cod_dep, depart } = req.body;
    const { id: id_usuario } = req.user; 

    if (!cod_dep || !depart) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (código y nombre) para crear un departamento.' });
    }

    try {
        const insertQuery = `
            INSERT INTO departamentos (cod_dep, depart, created_by)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [cod_dep, depart, id_usuario]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al insertar el departamento:', err);
        if (err.code === '23505') { 
            res.status(409).json({ error: 'El código de departamento ya existe.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

const updateDepartamento = async (req, res) => {
    const { id } = req.params;
    const { cod_dep, depart } = req.body;
    const { id: id_usuario } = req.user; 
    
    if (!cod_dep || !depart) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (código y nombre) para actualizar el departamento.' });
    }
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // El middleware ya verificó la autorización. Solo confirmamos que el registro exista.
        const checkQuery = `
            SELECT id FROM departamentos 
            WHERE id = $1 FOR UPDATE;
        `;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Departamento no encontrado' });
        }
        
        // ❌ Eliminada la RESTRICCIÓN DE CAMBIO DE CÓDIGO para EDITORES
        
        const updateQuery = `
            UPDATE departamentos
            SET cod_dep = $1, depart = $2, updated_by = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [cod_dep, depart, id_usuario, id]);
        
        await client.query('COMMIT');
        
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el departamento:', err);
        if (err.code === '23505') { 
            res.status(409).json({ error: 'El código de departamento ya existe.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

const deleteDepartamento = async (req, res) => {
    const { id } = req.params;
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // El middleware ya verificó la autorización. Solo confirmamos que el registro exista.
        const checkQuery = 'SELECT id FROM departamentos WHERE id = $1 FOR UPDATE;';
        const checkResult = await client.query(checkQuery, [id]);
        
        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Departamento no encontrado' });
        }
        
        // ❌ Eliminada la RESTRICCIÓN DE ELIMINACIÓN para EDITORES
        
        const deleteQuery = `
            DELETE FROM departamentos WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id]);
        
        await client.query('COMMIT');

        res.json({ message: 'Departamento eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el departamento:', err);
        if (err.code === '23503') { 
            res.status(409).json({ error: 'No se puede eliminar este departamento porque está vinculado a otra tabla.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

module.exports = {
    getDepartamentosData,
    createDepartamento,
    updateDepartamento,
    deleteDepartamento
};