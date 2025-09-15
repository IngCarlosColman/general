// despachantes.controller.js
const { pool } = require('../db/db');
const { upsertTelefonos } = require('./general.controller');

/**
 * Obtiene los datos de la tabla de despachantes.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getDespachantesData = async (req, res) => {
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
                'cedula': 'd.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        const countQuery = `
            SELECT COUNT(*)
            FROM despachantes AS d
            JOIN general AS g ON d.cedula = g.cedula
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT
                d.id,
                d.cedula,
                g.nombres,
                g.apellidos,
                ARRAY_AGG(t.numero) AS telefonos,
                g.completo AS nom_completo
            FROM
                despachantes AS d
            JOIN
                general AS g ON d.cedula = g.cedula
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                d.id, d.cedula, g.nombres, g.apellidos, g.completo
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
        console.error('Error al obtener los datos de despachantes:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Crea un nuevo registro de despachante.
 * La validación de permisos ahora se realiza en el middleware.
 */
const createDespachante = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos } = req.body;
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
        const insertDespachanteQuery = `
            INSERT INTO despachantes (cedula, created_by)
            VALUES ($1, $2)
            RETURNING *;
        `;
        await client.query(insertDespachanteQuery, [cedula, id_usuario]);
        await client.query('COMMIT');
        res.status(201).json(resultGeneral.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de despachante:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro de despachante.
 * La validación de permisos ahora se realiza en el middleware.
 */
const updateDespachante = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const oldCedulaQuery = 'SELECT cedula FROM despachantes WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de despachante no encontrado' });
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
            const updateDespachanteCedulaQuery = `
                UPDATE despachantes SET cedula = $1, updated_by = $2, updated_at = NOW() WHERE id = $3;
            `;
            await client.query(updateDespachanteCedulaQuery, [cedula, id_usuario, id]);
        } else {
            const updateGeneralQuery = `
                UPDATE general
                SET nombres = $1, apellidos = $2, completo = $3, updated_by = $4, updated_at = NOW()
                WHERE cedula = $5
                RETURNING *;
            `;
            await client.query(updateGeneralQuery, [nombres, apellidos, completo, id_usuario, cedula]);
            const updateDespachanteQuery = `
                UPDATE despachantes SET updated_by = $1, updated_at = NOW() WHERE id = $2;
            `;
            await client.query(updateDespachanteQuery, [id_usuario, id]);
        }
        if (telefonos) {
            await upsertTelefonos(cedula, telefonos, client);
        }
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de despachante:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Elimina un registro de despachante.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deleteDespachante = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteDespachanteQuery = `
            DELETE FROM despachantes WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteDespachanteQuery, [id]);
        if (result.rowCount === 0) {
             await client.query('ROLLBACK');
             return res.status(404).json({ error: 'Registro no encontrado en la base de datos.' });
        }
        await client.query('COMMIT');
        res.json({ message: 'Registro de despachante eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de despachante:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

module.exports = {
    getDespachantesData,
    createDespachante,
    updateDespachante,
    deleteDespachante
};