const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

/**
 * Obtiene los datos de la tabla de itaipu con paginación, búsqueda y ordenamiento.
 */
const getItaipuData = async (req, res) => {
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
                'id': 'i.id',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'cedula': 'g.cedula',
                'ubicacion': 'i.ubicacion',
                'salario': 'i.salario'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

        const countQuery = `SELECT COUNT(*) FROM itaipu i INNER JOIN general g ON i.cedula = g.cedula ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        
        const dataQuery = `
            SELECT
                i.id,
                g.nombres,
                g.apellidos,
                g.cedula,
                g.completo,
                i.ubicacion,
                i.salario,
                g.created_by, -- 🚨 AÑADIDO: Campo necesario para validación de propiedad
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos
            FROM
                itaipu i
            INNER JOIN
                general g ON i.cedula = g.cedula
            LEFT JOIN
                telefonos t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                i.id, g.nombres, g.apellidos, g.cedula, g.completo, i.ubicacion, i.salario, g.created_by
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
        console.log('Error al obtener datos de la tabla itaipu:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};


/**
 * Obtiene un registro de la tabla itaipu por su cédula, uniendo con la tabla general.
 */
const getItaipuById = async (req, res) => {
    const { cedula } = req.params;
    try {
        const query = `
            SELECT
                i.id,
                g.nombres,
                g.apellidos,
                g.cedula,
                g.completo,
                i.ubicacion,
                i.salario,
                g.created_by, -- 🚨 AÑADIDO: Campo necesario para validación de propiedad
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos
            FROM
                itaipu i
            INNER JOIN
                general g ON i.cedula = g.cedula
            LEFT JOIN
                telefonos t ON g.cedula = t.cedula_persona
            WHERE g.cedula = $1
            GROUP BY
                i.id, g.nombres, g.apellidos, g.cedula, g.completo, i.ubicacion, i.salario, g.created_by;
        `;
        const result = await pool.query(query, [cedula]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener registro por cédula:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};


/**
 * Crea un nuevo registro en la tabla itaipu.
 * 🚨 MEJORA DE SEGURIDAD: Se propaga el rol a upsertGeneral.
 */
const createItaipu = async (req, res) => {
    const { nombres, apellidos, cedula, ubicacion, salario, telefonos } = req.body;
    // Capturamos ID y ROL
    const { id: id_usuario, rol: rol_usuario } = req.user;
    
    if (!cedula || !nombres || !apellidos || ubicacion === undefined || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para crear un funcionario de Itaipu.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Usar la función centralizada, PROPAGANDO EL ROL
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);
        
        // 2. Insertar en itaipu
        const insertItaipuQuery = `
            INSERT INTO itaipu (cedula, ubicacion, salario, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cedula) DO NOTHING
            RETURNING *;
        `;
        const result = await client.query(insertItaipuQuery, [cedula, ubicacion, salario, id_usuario]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un registro con esa cédula en Itaipu.' });
        }

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar el registro:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};


/**
 * Actualiza un registro en la tabla itaipu y la tabla general.
 * 🚨 IMPLEMENTACIÓN DE BLINDAJE DE SEGURIDAD CRÍTICO 🚨
 * Se añade la verificación de propiedad y la restricción de cédula para editores.
 */
const updateItaipu = async (req, res) => {
    const { id } = req.params;
    // Cédula propuesta (nueva_cedula)
    const { nombres, apellidos, cedula: new_cedula, ubicacion, salario, telefonos } = req.body;
    // Capturamos ID y ROL
    const { id: id_usuario, rol: rol_usuario } = req.user;

    if (!new_cedula || !nombres || !apellidos || ubicacion === undefined || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar un funcionario de Itaipu.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. OBTENER CÉDULA ORIGINAL y created_by de la tabla general
        const checkQuery = `
            SELECT i.cedula AS original_cedula, g.created_by 
            FROM itaipu AS i
            JOIN general AS g ON i.cedula = g.cedula
            WHERE i.id = $1 FOR UPDATE;
        `;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Itaipu no encontrado' });
        }
        
        const { original_cedula, created_by: record_owner_id } = checkResult.rows[0];
        const isOwner = record_owner_id === id_usuario;
        let final_cedula = new_cedula;

        // 2. RESTRICCIÓN DE CÉDULA para EDITORES
        if (rol_usuario === 'editor' && !isOwner) {
            if (original_cedula !== new_cedula) {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    error: 'Acceso prohibido. No puedes modificar la cédula de un registro creado por otro usuario.' 
                });
            }
        }
        
        // 3. Ejecutar UPSERT en la tabla `general`, PROPAGANDO EL ROL
        await upsertGeneral(final_cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);
        
        // 4. Actualizar itaipu (cédula, ubicación y salario)
        const updateItaipuQuery = `
            UPDATE itaipu
            SET cedula = $1, ubicacion = $2, salario = $3, updated_by = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *;
        `;
        const result = await client.query(updateItaipuQuery, [final_cedula, ubicacion, salario, id_usuario, id]);
        
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.', updatedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe otro registro de Itaipu con esa cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Elimina un registro de la tabla itaipu.
 */
const deleteItaipu = async (req, res) => {
    const { id } = req.params;
    // La restricción de eliminación por rol/propiedad debería estar en un middleware de seguridad o una capa superior.
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const deleteQuery = `
            DELETE FROM itaipu WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id]);
        
        await client.query('COMMIT');
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json({ message: 'Registro de Itaipu eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro:', err);
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
    getItaipuData,
    getItaipuById,
    createItaipu,
    updateItaipu,
    deleteItaipu,
};