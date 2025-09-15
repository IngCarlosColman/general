const { pool } = require('../db/db');
const { upsertTelefonos } = require('./general.controller');

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
                ARRAY_AGG(t.numero) AS telefonos,
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
 * The permission validation is now handled by middleware.
 */
const createFuncBnf = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const completo = `${nombres} ${apellidos}`;
        const insertGeneralQuery = `
            INSERT INTO general (nombres, apellidos, cedula, completo, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (cedula) DO NOTHING 
            RETURNING *;
        `;
        const resultGeneral = await client.query(insertGeneralQuery, [nombres, apellidos, cedula, completo, id_usuario]);
        if (resultGeneral.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un registro con esa cédula.' });
        }
        if (Array.isArray(telefonos) && telefonos.length > 0) {
            await upsertTelefonos(cedula, telefonos, client);
        }
        const insertFuncBnfQuery = `
            INSERT INTO func_bnf (cedula, salario, created_by)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const resultFuncBnf = await client.query(insertFuncBnfQuery, [cedula, salario, id_usuario]);
        await client.query('COMMIT');
        const combinedResult = {
            ...resultGeneral.rows[0],
            ...resultFuncBnf.rows[0]
        };
        res.status(201).json(combinedResult);
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
 * The permission validation is now handled by middleware.
 */
const updateFuncBnf = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const oldCedulaQuery = 'SELECT cedula, created_by FROM func_bnf WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Func BNF no encontrado' });
        }
        const oldCedula = oldCedulaResult.rows[0].cedula;
        const completo = `${nombres} ${apellidos}`;
        if (cedula !== oldCedula) {
            const checkQuery = 'SELECT id FROM general WHERE cedula = $1';
            const checkResult = await client.query(checkQuery, [cedula]);
            if (checkResult.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Ya existe otro registro con esa cédula.' });
            }
            const updateGeneralQuery = `
                UPDATE general
                SET nombres = $1, apellidos = $2, completo = $3, cedula = $4, updated_by = $5, updated_at = NOW()
                WHERE cedula = $6
                RETURNING *;
            `;
            await client.query(updateGeneralQuery, [nombres, apellidos, completo, cedula, id_usuario, oldCedula]);
            const updateFuncBnfCedulaQuery = `
                UPDATE func_bnf SET cedula = $1, updated_by = $2, updated_at = NOW() WHERE id = $3;
            `;
            await client.query(updateFuncBnfCedulaQuery, [cedula, id_usuario, id]);
        } else {
            const updateGeneralQuery = `
                UPDATE general
                SET nombres = $1, apellidos = $2, completo = $3, updated_by = $4, updated_at = NOW()
                WHERE cedula = $5
                RETURNING *;
            `;
            await client.query(updateGeneralQuery, [nombres, apellidos, completo, id_usuario, cedula]);
            const updateFuncBnfAuditQuery = `
                UPDATE func_bnf
                SET updated_by = $1, updated_at = NOW()
                WHERE id = $2;
            `;
            await client.query(updateFuncBnfAuditQuery, [id_usuario, id]);
        }
        if (telefonos) {
            await upsertTelefonos(cedula, telefonos, client);
        }
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
        res.json({ message: 'Registro actualizado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de Func BNF:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Deletes a record from func_bnf and general within a transaction, with permission verification.
 * The permission validation is now handled by middleware.
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