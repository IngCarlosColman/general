const { pool } = require('../db/db');

const getProurbanasData = async (req, res) => {
    try {
        const {
            page = 1,
            itemsPerPage = 10,
            search = '',
            departamento,
            ciudad,
            padron_ccc,
            mts2_min,
            mts2_max
        } = req.query;
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
        let whereClauses = [];
        const queryParams = [];
        let paramIndex = 1;
        
        if (departamento) {
            whereClauses.push(`pu.cod_dep = $${paramIndex++}`);
            queryParams.push(departamento);
        }
        if (ciudad) {
            whereClauses.push(`pu.cod_ciu = $${paramIndex++}`);
            queryParams.push(ciudad);
        }

        if (padron_ccc) {
            const formattedCcc = padron_ccc.trim().toLowerCase();
            whereClauses.push(`(pu.zona || '-' || pu.manzana || '-' || pu.lote) LIKE $${paramIndex++}`);
            queryParams.push(`%${formattedCcc}%`);
        }
        
        if (mts2_min) {
            whereClauses.push(`pu.mts2 >= $${paramIndex++}`);
            queryParams.push(parseFloat(mts2_min));
        }
        if (mts2_max) {
            whereClauses.push(`pu.mts2 <= $${paramIndex++}`);
            queryParams.push(parseFloat(mts2_max));
        }
        
        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term).map(t => `${t}:*`).join(' & ');
            whereClauses.push(`(g.search_vector @@ to_tsquery('spanish', $${paramIndex++}) OR pp.padron_ccc ILIKE $${paramIndex++})`);
            queryParams.push(searchTerms, `%${search}%`);
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        let orderByClause = 'ORDER BY pu.cod_dep, pu.cod_ciu, pu.zona, pu.manzana, pu.lote ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'id': 'pu.id',
                'cod_dep': 'pu.cod_dep',
                'cod_ciu': 'pu.cod_ciu',
                'zona': 'pu.zona',
                'manzana': 'pu.manzana',
                'lote': 'pu.lote',
                'piso': 'pu.piso',
                'salon': 'pu.salon',
                'mts2': 'pu.mts2',
                'cedula_propietario': 'pp.cedula_propietario',
                'propietario_completo': 'propietario_completo'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        
        const joinClause = `
            LEFT JOIN propiedades_propietarios pp ON pu.cod_dep = pp.cod_dep AND pu.cod_ciu = pp.cod_ciu AND (pu.zona || '-' || pu.manzana || '-' || pu.lote) = pp.padron_ccc AND pp.tipo_propiedad = 'urbana'
            LEFT JOIN general g ON pp.cedula_propietario = g.cedula
            LEFT JOIN telefonos t ON g.cedula = t.cedula_persona
        `;
        
        const countQuery = `
            SELECT COUNT(DISTINCT pu.id) FROM prourbanas pu
            ${joinClause}
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        
        const dataQuery = `
            SELECT
                pu.id,
                pu.cod_dep,
                pu.cod_ciu,
                pu.zona,
                pu.manzana,
                pu.lote,
                pu.piso,
                pu.salon,
                pu.mts2,
                pp.cedula_propietario,
                COALESCE(g.completo, pp.nombre_propietario) AS propietario_completo,
                ARRAY_AGG(DISTINCT t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                pu.created_by
            FROM
                prourbanas pu
            ${joinClause}
            ${whereClause}
            GROUP BY
                pu.id, pp.cedula_propietario, pp.nombre_propietario, g.completo
            ${orderByClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        const dataParams = [...queryParams, limit, offset];
        const dataResult = await pool.query(dataQuery, dataParams);
        const items = dataResult.rows.map(row => ({
            ...row,
            telefonos: row.telefonos ? row.telefonos.join(', ') : ''
        }));

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener datos de la tabla de propiedades urbanas:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const createProurbana = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { cod_dep, cod_ciu, zona, manzana, lote, piso, salon, mts2 } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertQuery = `
            INSERT INTO prourbanas (cod_dep, cod_ciu, zona, manzana, lote, piso, salon, mts2, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [cod_dep, cod_ciu, zona, manzana, lote, piso, salon, mts2, id_usuario]);
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar la propiedad urbana:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe una propiedad urbana con esta combinación de datos.', details: err.detail });
        } else if (err.code === '23503') {
            res.status(409).json({ error: 'La combinación de código de departamento y código de ciudad no existe.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

const updateProurbana = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { id } = req.params;
    const { cod_dep, cod_ciu, zona, manzana, lote, piso, salon, mts2 } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updateQuery = `
            UPDATE prourbanas
            SET cod_dep = $1, cod_ciu = $2, zona = $3, manzana = $4, lote = $5, piso = $6, salon = $7, mts2 = $8, updated_by = $9
            WHERE id = $10
            RETURNING *;
        `;
        const result = await client.query(updateQuery, [cod_dep, cod_ciu, zona, manzana, lote, piso, salon, mts2, id_usuario, id]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Propiedad urbana no encontrada' });
        }
        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar la propiedad urbana:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe una propiedad urbana con esta combinación de datos.', details: err.detail });
        } else if (err.code === '23503') {
            res.status(409).json({ error: 'La combinación de código de departamento y código de ciudad no existe.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

const deleteProurbana = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteQuery = `
            DELETE FROM prourbanas WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Propiedad urbana no encontrada' });
        }
        await client.query('COMMIT');
        res.json({ message: 'Propiedad urbana eliminada exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar la propiedad urbana:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar esta propiedad porque está vinculada a un propietario.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};
const countProurbanas = async (req, res) => { // 👈 NUEVA FUNCIÓN
    try {
        const countQuery = `
            SELECT COUNT(*) FROM prourbanas;
        `;
        const countResult = await pool.query(countQuery);
        const count = parseInt(countResult.rows[0].count);

        // Respuesta esperada por Pinia: { count: N }
        res.setHeader('Cache-Control', 'no-cache');
        res.json({ count });
    } catch (err) {
        console.error('Error al contar propiedades urbanas:', err);
        res.status(500).json({ error: 'Error del servidor al contar propiedades urbanas' });
    }
};


module.exports = {
    getProurbanasData,
    createProurbana,
    updateProurbana,
    deleteProurbana,
    countProurbanas
};