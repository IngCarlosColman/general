const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

/**
 * Obtiene los datos de la tabla de vínculos entre propiedades y propietarios, con paginación, búsqueda y ordenamiento.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getPropiedadesPropietariosData = async (req, res) => {
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
            whereClause = `
                WHERE
                    pp.padron_ccc ILIKE $${paramIndex} OR
                    g.search_vector @@ to_tsquery('spanish', $${paramIndex + 1})
            `;
            queryParams.push(`%${search}%`);
            queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
            paramIndex += queryParams.length;
        }
        let orderByClause = 'ORDER BY pp.fecha_consulta DESC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'id_vinculo': 'pp.id_vinculo',
                'cod_dep': 'pp.cod_dep',
                'cod_ciu': 'pp.cod_ciu',
                'tipo_propiedad': 'pp.tipo_propiedad',
                'padron_ccc': 'pp.padron_ccc',
                'cedula_propietario': 'pp.cedula_propietario',
                'nombre_propietario': 'g.completo',
                'fecha_consulta': 'pp.fecha_consulta'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        const countQuery = `
            SELECT COUNT(*)
            FROM propiedades_propietarios AS pp
            LEFT JOIN general AS g ON pp.cedula_propietario = g.cedula
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT
                pp.id_vinculo,
                pp.cod_dep,
                pp.cod_ciu,
                pp.tipo_propiedad,
                pp.padron_ccc,
                pp.cedula_propietario,
                COALESCE(g.completo, 'No identificado') AS nombre_propietario,
                pp.fecha_consulta,
                pp.created_by
            FROM
                propiedades_propietarios AS pp
            LEFT JOIN
                general AS g ON pp.cedula_propietario = g.cedula
            ${whereClause}
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
        console.error('Error al obtener datos de la tabla de vínculos:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Crea un nuevo vínculo entre una propiedad y un propietario.
 * La validación de permisos ahora se realiza en el middleware.
 */
const createPropiedadPropietario = async (req, res) => {
    console.log('Datos recibidos del frontend:', req.body);
    const { id: id_usuario } = req.user;
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, nombre_propietario } = req.body;
    if (!padron_ccc || !cedula_propietario) {
        return res.status(400).json({ error: 'El padrón y la cédula del propietario son requeridos.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await upsertGeneral(cedula_propietario, nombre_propietario, null, id_usuario, client);
        const insertQuery = `
            INSERT INTO propiedades_propietarios (cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, id_usuario]);
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar el vínculo:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'El vínculo entre esta propiedad y propietario ya existe.' });
        }
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Actualiza un vínculo existente entre una propiedad y un propietario.
 * La validación de permisos ahora se realiza en el middleware.
 */
const updatePropiedadPropietario = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { id_vinculo } = req.params;
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, nombre_propietario } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (cedula_propietario && nombre_propietario) {
            await upsertGeneral(cedula_propietario, nombre_propietario, null, id_usuario, client);
        }
        const updateQuery = `
            UPDATE propiedades_propietarios
            SET cod_dep = $1, cod_ciu = $2, tipo_propiedad = $3, padron_ccc = $4, cedula_propietario = $5, updated_by = $6, updated_at = NOW()
            WHERE id_vinculo = $7
            RETURNING *;
        `;
        const result = await client.query(updateQuery, [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, id_usuario, id_vinculo]);
        await client.query('COMMIT');
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vínculo no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el vínculo:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'El vínculo actualizado ya existe para otra propiedad y propietario.' });
        }
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Elimina un vínculo entre una propiedad y un propietario.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deletePropiedadPropietario = async (req, res) => {
    const { id_vinculo } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteQuery = `DELETE FROM propiedades_propietarios WHERE id_vinculo = $1 RETURNING *;`;
        const result = await client.query(deleteQuery, [id_vinculo]);
        await client.query('COMMIT');
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vínculo no encontrado' });
        }
        res.json({ message: 'Vínculo eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el vínculo:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar este registro porque está vinculado a otra tabla.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Función para insertar un lote de vínculos en la base de datos.
 * @param {Array} req.body Array de objetos con los datos de los vínculos.
 */
const createProprietorsBatch = async (req, res) => {
    const { id: id_usuario } = req.user;
    const batchData = req.body;

    // Verificar si el cuerpo de la solicitud es un array y no está vacío
    if (!Array.isArray(batchData) || batchData.length === 0) {
        return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un array no vacío de registros.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const record of batchData) {
            const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, nombre_propietario } = record;

            // VALIDACIÓN: Aseguramos que el padrón siempre esté presente.
            // Si falta, es un Bad Request.
            if (!padron_ccc) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Falta el padrón en un registro. Registro: ${JSON.stringify(record)}` });
            }

            // NUEVA LÓGICA: Realiza el upsert en la tabla 'general' SOLO si el registro tiene una cédula.
            if (cedula_propietario) {
                await upsertGeneral(cedula_propietario, nombre_propietario, null, id_usuario, client);
            }
            // Si cedula_propietario es nulo, este paso se salta.
            
            // Insertar el vínculo en la tabla de propiedades_propietarios
            const insertQuery = `
                INSERT INTO propiedades_propietarios (cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, created_by)
                VALUES ($1, $2, $3, $4, $5, $6);
            `;
            await client.query(insertQuery, [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, id_usuario]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Lote de registros creado exitosamente.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar el lote de registros:', err);
        // Si hay un error de clave duplicada, puedes manejarlo aquí
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Uno o más vínculos en el lote ya existen.' });
        }
        res.status(500).json({ error: 'Error del servidor al procesar el lote.', details: err.detail });
    } finally {
        client.release();
    }
};

module.exports = {
    getPropiedadesPropietariosData,
    createPropiedadPropietario,
    updatePropiedadPropietario,
    deletePropiedadPropietario,
    createProprietorsBatch,
};