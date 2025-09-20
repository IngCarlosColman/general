// despachantes.controller.js
const { pool } = require('../db/db');
// Se importa la función principal de gestión de registros generales.
// upsertTelefonos ya no se necesita aquí porque se llama desde upsertGeneral.
const { upsertGeneral } = require('./general.controller'); 

/**
 * Obtiene los datos de la tabla de despachantes.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getDespachantesData = async (req, res) => {
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
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
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
 * OPTIMIZADO: Ahora usa la función upsertGeneral para mantener la consistencia.
 */
const createDespachante = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Se usa la función centralizada para manejar la inserción/actualización en la tabla general
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);

        const insertDespachanteQuery = `
            INSERT INTO despachantes (cedula)
            VALUES ($1)
            RETURNING *;
        `;
        const resultDespachante = await client.query(insertDespachanteQuery, [cedula]);

        await client.query('COMMIT');
        res.status(201).json(resultDespachante.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de despachante:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe un registro con esa cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro de despachante.
 * OPTIMIZADO: Ahora usa la función upsertGeneral para mantener la consistencia.
 */
const updateDespachante = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Primero, se obtiene la cédula del registro actual de despachante para verificar si ha cambiado.
        const oldCedulaQuery = 'SELECT cedula FROM despachantes WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de despachante no encontrado' });
        }
        
        // Se usa la función centralizada para manejar la actualización en la tabla general y los teléfonos.
        // upsertGeneral maneja la lógica de si la cédula ha cambiado o no.
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);

        // Si la cédula del despachante ha cambiado, actualizamos su registro.
        if (cedula !== oldCedulaResult.rows[0].cedula) {
            const updateDespachanteCedulaQuery = `UPDATE despachantes SET cedula = $1 WHERE id = $2;`;
            await client.query(updateDespachanteCedulaQuery, [cedula, id]);
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de despachante:', err);
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
 * Elimina un registro de despachante.
 * Esta lógica es correcta y no necesita cambios.
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
        
        await client.query('COMMIT');
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro de despachante no encontrado.' });
        }
        res.json({ message: 'Registro de despachante eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de despachante:', err);
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
    getDespachantesData,
    createDespachante,
    updateDespachante,
    deleteDespachante
};