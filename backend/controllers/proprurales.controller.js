const { pool } = require('../db/db');

/**
 * Obtiene los datos de la tabla de propiedades rurales con paginación, búsqueda,
 * ordenamiento y filtros.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getPropruralesData = async (req, res) => {
    try {
        const {
            page = 1,
            search = '',
            departamento,
            ciudad,
            padron_ccc,
            has_min,
            has_max,
            itemsPerPage = 10
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
            whereClauses.push(`pr.cod_dep = $${paramIndex++}`);
            queryParams.push(departamento);
        }
        if (ciudad) {
            whereClauses.push(`pr.cod_ciu = $${paramIndex++}`);
            queryParams.push(ciudad);
        }
        if (padron_ccc) {
            whereClauses.push(`pr.padron = $${paramIndex++}`);
            queryParams.push(padron_ccc);
        }
        if (has_min) {
            whereClauses.push(`pr.has >= $${paramIndex++}`);
            queryParams.push(parseFloat(has_min));
        }
        if (has_max) {
            whereClauses.push(`pr.has <= $${paramIndex++}`);
            queryParams.push(parseFloat(has_max));
        }
        if (search) {
            whereClauses.push(`
                (pr.padron ILIKE $${paramIndex} OR
                g.search_vector @@ to_tsquery('spanish', $${paramIndex + 1}))
            `);
            queryParams.push(`%${search}%`);
            queryParams.push(search.split(/\s+/).filter(term => term).map(t => `${t}:*`).join(' & '));
            paramIndex += 2;
        }
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        let orderByClause = 'ORDER BY pr.padron ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'id': 'pr.id',
                'cod_dep': 'pr.cod_dep',
                'cod_ciu': 'pr.cod_ciu',
                'padron': 'pr.padron',
                'has': 'pr.has',
                'mts2': 'pr.mts2',
                'cedula_propietario': 'pp.cedula_propietario',
                'propietario_completo': 'g.completo'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        const joinClause = `
            LEFT JOIN propiedades_propietarios pp ON pr.cod_dep = pp.cod_dep AND pr.cod_ciu = pp.cod_ciu AND pr.padron = pp.padron_ccc AND pp.tipo_propiedad = 'rural'
            LEFT JOIN general g ON pp.cedula_propietario = g.cedula
            LEFT JOIN telefonos t ON g.cedula = t.cedula_persona
        `;
        const countQuery = `
            SELECT COUNT(DISTINCT pr.id) FROM proprurales pr
            ${joinClause}
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT
                pr.id,
                pr.cod_dep,
                pr.cod_ciu,
                pr.padron,
                pr.has,
                pr.mts2,
                pp.cedula_propietario,
                COALESCE(g.completo, pp.nombre_propietario) AS propietario_completo,
                ARRAY_AGG(DISTINCT t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                pr.created_by
            FROM
                proprurales pr
            ${joinClause}
            ${whereClause}
            GROUP BY
                pr.id, pp.cedula_propietario, pp.nombre_propietario, g.completo
            ${orderByClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        const dataParams = [...queryParams, limit, offset];
        const dataResult = await pool.query(dataQuery, dataParams);
        const items = dataResult.rows;
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener datos de la tabla de propiedades rurales:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Crea un nuevo registro de propiedad rural.
 * La validación de permisos ahora se realiza en el middleware.
 */
const createProprural = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { cod_dep, cod_ciu, padron, has, mts2 } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertQuery = `
            INSERT INTO proprurales (cod_dep, cod_ciu, padron, has, mts2, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [cod_dep, cod_ciu, padron, has, mts2, id_usuario]);
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar la propiedad rural:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe una propiedad rural con este padrón.', details: err.detail });
        } else if (err.code === '23503') {
            res.status(409).json({ error: 'La combinación de código de departamento y código de ciudad no existe.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro de propiedad rural existente.
 * La validación de permisos ahora se realiza en el middleware.
 */
const updateProprural = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { id } = req.params;
    const { cod_dep, cod_ciu, padron, has, mts2 } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updateQuery = `
            UPDATE proprurales
            SET cod_dep = $1, cod_ciu = $2, padron = $3, has = $4, mts2 = $5, updated_by = $6
            WHERE id = $7
            RETURNING *;
        `;
        const result = await client.query(updateQuery, [cod_dep, cod_ciu, padron, has, mts2, id_usuario, id]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Propiedad rural no encontrada' });
        }
        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar la propiedad rural:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe una propiedad rural con este padrón.', details: err.detail });
        } else if (err.code === '23503') {
            res.status(409).json({ error: 'La combinación de código de departamento y código de ciudad no existe.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Elimina un registro de propiedad rural.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deleteProprural = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteQuery = `
            DELETE FROM proprurales WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Propiedad rural no encontrada' });
        }
        await client.query('COMMIT');
        res.json({ message: 'Propiedad rural eliminada exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar la propiedad rural:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar esta propiedad porque está vinculada a un propietario.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

module.exports = {
    getPropruralesData,
    createProprural,
    updateProprural,
    deleteProprural
};