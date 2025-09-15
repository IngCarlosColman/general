const { pool } = require('../db/db');
const { upsertTelefonos } = require('./general.controller');

/**
 * Función auxiliar para manejar la inserción/actualización de teléfonos dentro de una transacción.
 * Se asume que el 'client' de la pool y el 'id_usuario' ya están disponibles.
 */
async function upsertTelefonosForItaipu(client, cedula_persona, telefonos, id_usuario) {
    // 1. Eliminar todos los teléfonos existentes para esta persona
    // Esto asegura que la lista de teléfonos se sincronice con la nueva.
    await client.query('DELETE FROM telefonos WHERE cedula_persona = $1', [cedula_persona]);
    // 2. Insertar los nuevos teléfonos, si se proporcionan.
    if (telefonos && Array.isArray(telefonos) && telefonos.length > 0) {
        for (let i = 0; i < telefonos.length; i++) {
            const numero = telefonos[i];
            const tipo = (i === 0) ? 'Principal' : 'Secundario';
            await client.query(
                `INSERT INTO telefonos(cedula_persona, numero, tipo, created_by) VALUES($1, $2, $3, $4)`,
                [cedula_persona, numero, tipo, id_usuario]
            );
        }
    }
}
/**
 * Función principal para obtener datos de la tabla itaipu con paginación, búsqueda y ordenamiento.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getItaipuData = async (req, res) => {
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
            const validSortFields = ['id', 'nombres', 'apellidos', 'cedula'];
            if (validSortFields.includes(sortKey)) {
                orderByClause = `ORDER BY g.${sortKey} ${sortOrder}`;
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
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos
            FROM
                itaipu i
            INNER JOIN
                general g ON i.cedula = g.cedula
            LEFT JOIN
                telefonos t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                i.id, g.nombres, g.apellidos, g.cedula, g.completo, i.ubicacion, i.salario
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
        console.error('Error al obtener datos de la tabla itaipu:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
/**
 * Obtiene un registro de la tabla itaipu por su cédula, uniendo con la tabla general.
 * La validación de permisos ahora se realiza en el middleware.
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
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos
            FROM
                itaipu i
            INNER JOIN
                general g ON i.cedula = g.cedula
            LEFT JOIN
                telefonos t ON g.cedula = t.cedula_persona
            WHERE g.cedula = $1
            GROUP BY
                i.id, g.nombres, g.apellidos, g.cedula, g.completo, i.ubicacion, i.salario;
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
 * Crea un nuevo registro en la tabla general y en la tabla itaipu dentro de una transacción.
 * La validación de permisos ahora se realiza en el middleware.
 */
const createItaipu = async (req, res) => {
    const { nombres, apellidos, cedula, ubicacion, salario, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const checkPersonQuery = 'SELECT cedula FROM general WHERE cedula = $1';
        const personResult = await client.query(checkPersonQuery, [cedula]);
        if (personResult.rowCount === 0) {
            const newApellidos = apellidos || null;
            const completo = `${nombres || ''} ${newApellidos || ''}`.trim();
            const insertGeneralQuery = `
                INSERT INTO general (nombres, apellidos, cedula, completo, created_by)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING cedula;
            `;
            await client.query(insertGeneralQuery, [nombres, newApellidos, cedula, completo, id_usuario]);
        }
        const insertItaipuQuery = `
            INSERT INTO itaipu (cedula, ubicacion, salario, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await client.query(insertItaipuQuery, [cedula, ubicacion, salario, id_usuario]);
        const newRecord = result.rows[0];
        if (telefonos && Array.isArray(telefonos) && telefonos.length > 0) {
            await upsertTelefonos(client, cedula, telefonos, id_usuario);
        }
        await client.query('COMMIT');
        res.status(201).json(newRecord);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar el registro:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe un registro con esta cédula en Itaipu.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};
/**
 * Actualiza un registro en la tabla itaipu y la tabla general, dentro de una transacción.
 * La validación de permisos ahora se realiza en el middleware.
 */
const updateItaipu = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, ubicacion, salario, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const oldCedulaQuery = 'SELECT cedula FROM itaipu WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Itaipu no encontrado' });
        }
        const oldCedula = oldCedulaResult.rows[0].cedula;
        if (cedula !== oldCedula) {
            const checkQuery = 'SELECT cedula FROM general WHERE cedula = $1';
            const checkResult = await client.query(checkQuery, [cedula]);
            if (checkResult.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Ya existe otro registro de persona con esa cédula.' });
            }
        }
        const updateGeneralQuery = `
            UPDATE general
            SET nombres = $1, apellidos = $2, cedula = $3, updated_by = $4
            WHERE cedula = $5
            RETURNING *;
        `;
        await client.query(updateGeneralQuery, [nombres, apellidos, cedula, id_usuario, oldCedula]);
        const updateItaipuQuery = `
            UPDATE itaipu
            SET cedula = $1, ubicacion = $2, salario = $3, updated_by = $4
            WHERE id = $5
            RETURNING *;
        `;
        const result = await client.query(updateItaipuQuery, [cedula, ubicacion, salario, id_usuario, id]);
        if (telefonos) {
            await upsertTelefonos(client, cedula, telefonos, id_usuario);
        }
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
 * Elimina un registro de la tabla itaipu. No elimina el registro de la persona en la tabla general.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deleteItaipu = async (req, res) => {
    const { id } = req.params;
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
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
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