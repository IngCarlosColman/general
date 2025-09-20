// func_bnf.controller.js
const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

/**
 * Retrieves data from the func_bnf and general tables with pagination, search, and sorting.
 * The permission validation is now handled by middleware.
 */
const getFuncBnfData = async (req, res) => {
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
                whereClause = `WHERE g.search_vector @@ to_tsquery('spanish', $${paramIndex})`;
                queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
                paramIndex++;
            }
        }
        let orderByClause = 'ORDER BY g.nombres ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'cedula': 'g.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'salario': 'bnf.salario'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        const countQuery = `
            SELECT COUNT(*) 
            FROM func_bnf AS bnf 
            JOIN general AS g ON bnf.cedula = g.cedula 
            ${whereClause} 
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT 
                bnf.id,
                bnf.salario,
                g.cedula,
                g.nombres,
                g.apellidos,
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                g.completo AS nom_completo 
            FROM 
                func_bnf AS bnf 
            JOIN 
                general AS g ON bnf.cedula = g.cedula 
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause} 
            GROUP BY
                bnf.id, bnf.salario, g.cedula, g.nombres, g.apellidos, g.completo
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
        console.error('Error al obtener los datos de Func BNF:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Creates a new record in the general and func_bnf tables within a transaction.
 * OPTIMIZED: It now uses the upsertGeneral function to maintain consistency.
 */
const createFuncBnf = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Use the centralized function to handle the insertion/update of general and telefonos.
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);
        
        // Insert or update the record in the func_bnf table.
        const insertFuncBnfQuery = `
            INSERT INTO func_bnf (cedula, salario, created_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (cedula) DO NOTHING
            RETURNING *;
        `;
        const resultFuncBnf = await client.query(insertFuncBnfQuery, [cedula, salario, id_usuario]);
        
        if (resultFuncBnf.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un registro con esa cédula en Funcionario BNF.' });
        }
        
        await client.query('COMMIT');
        res.status(201).json(resultFuncBnf.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de Func BNF:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Updates a record in the general and func_bnf tables within a transaction.
 * OPTIMIZED: It now uses the upsertGeneral function to maintain consistency.
 */
const updateFuncBnf = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const oldCedulaQuery = 'SELECT cedula FROM func_bnf WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Func BNF no encontrado' });
        }
        const oldCedula = oldCedulaResult.rows[0].cedula;
        
        // Use the centralized function to handle the update of general and telefonos.
        await upsertGeneral(oldCedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);

        const updateFuncBnfQuery = `
            UPDATE func_bnf
            SET salario = $1, updated_by = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *;
        `;
        const resultFuncBnf = await client.query(updateFuncBnfQuery, [salario, id_usuario, id]);
        
        await client.query('COMMIT');
        
        if (resultFuncBnf.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado en la tabla func_bnf.' });
        }
        
        res.json({ message: 'Registro actualizado correctamente.', updatedRecord: resultFuncBnf.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de Func BNF:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe otro registro con esa cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Deletes a record from func_bnf.
 * This logic is correct and does not require changes.
 */
const deleteFuncBnf = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const deleteFuncBnfQuery = `
            DELETE FROM func_bnf WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteFuncBnfQuery, [id]);
        
        await client.query('COMMIT');
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado en la base de datos.' });
        }
        res.json({ message: 'Registro eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de Func BNF:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar este registro porque está vinculado a otra tabla.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

module.exports = {
    getFuncBnfData,
    createFuncBnf,
    updateFuncBnf,
    deleteFuncBnf
};