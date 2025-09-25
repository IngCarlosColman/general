// abogados.controller.js
const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller'); 

const getAbogadosData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
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
                'cedula': 'a.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

        const countQuery = `
            SELECT COUNT(*) 
            FROM abogados AS a 
            JOIN general AS g ON a.cedula = g.cedula 
            ${whereClause} 
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQueryParamIndex = paramIndex;
        
        const dataQuery = `
            SELECT 
                a.id, 
                a.cedula, 
                g.nombres, 
                g.apellidos, 
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                g.completo AS nom_completo,
                g.created_by
            FROM 
                abogados AS a 
            JOIN 
                general AS g ON a.cedula = g.cedula 
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY 
                a.id, a.cedula, g.nombres, g.apellidos, g.completo, g.created_by
            ${orderByClause} 
            LIMIT $${dataQueryParamIndex} OFFSET $${dataQueryParamIndex + 1};
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
        console.error('Error al obtener los datos de abogados:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const createAbogado = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos } = req.body;
    const { id: id_usuario, rol: rol_usuario } = req.user; 
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);

        const insertAbogadoQuery = `
            INSERT INTO abogados (cedula)
            VALUES ($1)
            RETURNING *;
        `;
        const resultAbogado = await client.query(insertAbogadoQuery, [cedula]);

        await client.query('COMMIT');
        res.status(201).json(resultAbogado.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de abogado:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe un registro con esa cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

const updateAbogado = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula: new_cedula, telefonos } = req.body; 
    const { id: id_usuario, rol: rol_usuario } = req.user; 
    const client = await pool.connect();

    if (!new_cedula || !nombres) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (cédula, nombres).' });
    }
    
    try {
        await client.query('BEGIN');
        const checkQuery = `
            SELECT a.cedula AS original_cedula 
            FROM abogados AS a
            WHERE a.id = $1 FOR UPDATE;
        `;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de abogado no encontrado' });
        }
        
        const { original_cedula } = checkResult.rows[0];
        const final_cedula = new_cedula;
        await upsertGeneral(final_cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);
        
        if (original_cedula !== final_cedula) {
            const updateAbogadoCedulaQuery = `
                UPDATE abogados SET cedula = $1 WHERE id = $2;
            `;
            await client.query(updateAbogadoCedulaQuery, [final_cedula, id]);
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de abogado:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe otro registro con esa cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

const deleteAbogado = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const deleteAbogadoQuery = `
            DELETE FROM abogados WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteAbogadoQuery, [id]);
        
        await client.query('COMMIT');
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro de abogado no encontrado.' });
        }
        res.json({ message: 'Registro de abogado eliminado exitosamente.', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de abogado:', err);
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
    getAbogadosData,
    createAbogado,
    updateAbogado,
    deleteAbogado
};