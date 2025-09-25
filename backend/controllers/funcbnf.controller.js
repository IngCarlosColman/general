// func_bnf.controller.js
const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

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
                g.completo AS nom_completo,
                g.created_by
            FROM 
                func_bnf AS bnf 
            JOIN 
                general AS g ON bnf.cedula = g.cedula 
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause} 
            GROUP BY
                bnf.id, bnf.salario, g.cedula, g.nombres, g.apellidos, g.completo, g.created_by
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

const createFuncBnf = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const { id: id_usuario, rol: rol_usuario } = req.user; 
    const client = await pool.connect();

    if (!cedula || !nombres || !apellidos || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para crear un Funcionario BNF.' });
    }

    try {
        await client.query('BEGIN');
        
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);
        
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

const updateFuncBnf = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula: new_cedula, telefonos, salario } = req.body;
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const client = await pool.connect();

    if (!new_cedula || !nombres || !apellidos || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar un Funcionario BNF.' });
    }
    
    try {
        await client.query('BEGIN');
        
        // 1. OBTENER CÉDULA ORIGINAL 
        const checkQuery = `
            SELECT bnf.cedula AS original_cedula
            FROM func_bnf AS bnf
            WHERE bnf.id = $1 FOR UPDATE;
        `;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Func BNF no encontrado' });
        }
        
        const { original_cedula } = checkResult.rows[0];
        const final_cedula = new_cedula;

        // ❌ Eliminada la RESTRICCIÓN DE CÉDULA para EDITORES (Delegada al middleware)
        
        // 2. Ejecutar UPSERT en la tabla `general`
        await upsertGeneral(final_cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);

        // 3. Actualizar func_bnf (salario y cédula si cambió)
        if (original_cedula !== final_cedula) {
            const updateFuncBnfCedulaQuery = `
                UPDATE func_bnf
                SET cedula = $1, salario = $2, updated_by = $3, updated_at = NOW()
                WHERE id = $4
                RETURNING *;
            `;
            await client.query(updateFuncBnfCedulaQuery, [final_cedula, salario, id_usuario, id]);
        } else {
            const updateFuncBnfSalarioQuery = `
                UPDATE func_bnf
                SET salario = $1, updated_by = $2, updated_at = NOW()
                WHERE id = $3
                RETURNING *;
            `;
            await client.query(updateFuncBnfSalarioQuery, [salario, id_usuario, id]);
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.' });
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