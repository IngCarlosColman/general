const { pool } = require('../db/db');
const { upsertTelefonos } = require('./general.controller');

/**
 * Obtiene los datos de la tabla de Yacyreta con paginación, búsqueda y ordenamiento.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getYacyretaData = async (req, res) => {
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
        let whereClauses = [];
        const queryParams = [];
        let paramIndex = 1;
        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            if (searchTerms.length > 0) {
                whereClauses.push(`g.search_vector @@ to_tsquery('spanish', $${paramIndex})`);
                queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
                paramIndex++;
            }
        }
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        let orderByClause = 'ORDER BY g.nombres ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'cedula': 'g.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'salario': 'y.salario'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        const countQuery = `
            SELECT COUNT(y.id)
            FROM yacyreta AS y
            JOIN general AS g ON y.cedula = g.cedula
            ${whereClause};
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT
                y.id,
                y.salario,
                g.cedula,
                g.nombres,
                g.apellidos,
                ARRAY_AGG(DISTINCT t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                g.completo AS nom_completo,
                y.created_by
            FROM
                yacyreta AS y
            JOIN
                general AS g ON y.cedula = g.cedula
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                y.id, y.salario, g.cedula, g.nombres, g.apellidos, g.completo
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
        console.error('Error al obtener los datos de Yacyreta:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Crea un nuevo registro de Yacyreta.
 * La validación de permisos ahora se realiza en el middleware.
 */
const createYacyreta = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const completo = `${nombres} ${apellidos}`;
        const insertGeneralQuery = `
            INSERT INTO general (nombres, apellidos, cedula, completo)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cedula) DO UPDATE SET nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos, completo = EXCLUDED.completo
            RETURNING *;
        `;
        await client.query(insertGeneralQuery, [nombres, apellidos, cedula, completo]);
        if (Array.isArray(telefonos) && telefonos.length > 0) {
            await upsertTelefonos(cedula, telefonos, client);
        }
        const insertYacyretaQuery = `
            INSERT INTO yacyreta (cedula, salario, created_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (cedula) DO NOTHING
            RETURNING *;
        `;
        const resultYacyreta = await client.query(insertYacyretaQuery, [cedula, salario, id_usuario]);
        if (resultYacyreta.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un registro de Yacyreta con esa cédula.' });
        }
        await client.query('COMMIT');
        const combinedResult = {
            ...resultYacyreta.rows[0],
            nombres,
            apellidos,
            completo,
            telefonos: telefonos || []
        };
        res.status(201).json(combinedResult);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de Yacyreta:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'La cédula proporcionada no existe en la tabla general.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro de Yacyreta.
 * La validación de permisos ahora se realiza en el middleware.
 */
const updateYacyreta = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'ID de registro no válido.' });
    }
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const oldCedulaQuery = 'SELECT cedula FROM yacyreta WHERE id = $1 FOR UPDATE;';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Yacyreta no encontrado' });
        }
        const oldCedula = oldCedulaResult.rows[0].cedula;
        const completo = `${nombres} ${apellidos}`;
        let targetCedula = cedula;
        if (cedula && cedula !== oldCedula) {
            const checkQuery = `SELECT 1 FROM general WHERE cedula = $1;`;
            const checkResult = await client.query(checkQuery, [cedula]);
            if (checkResult.rowCount > 0) {
                const updateGeneralQuery = `
                    UPDATE general SET nombres = $1, apellidos = $2, completo = $3 WHERE cedula = $4;
                `;
                await client.query(updateGeneralQuery, [nombres, apellidos, completo, cedula]);
            } else {
                const updateGeneralQuery = `
                    UPDATE general SET nombres = $1, apellidos = $2, completo = $3, cedula = $4 WHERE cedula = $5;
                `;
                await client.query(updateGeneralQuery, [nombres, apellidos, completo, cedula, oldCedula]);
            }
            const updateYacyretaCedulaQuery = `
                UPDATE yacyreta SET cedula = $1, updated_by = $2 WHERE id = $3;
            `;
            await client.query(updateYacyretaCedulaQuery, [cedula, id_usuario, id]);
            targetCedula = cedula;
        } else {
            const updateGeneralQuery = `
                UPDATE general SET nombres = $1, apellidos = $2, completo = $3 WHERE cedula = $4;
            `;
            await client.query(updateGeneralQuery, [nombres, apellidos, completo, oldCedula]);
            targetCedula = oldCedula;
        }
        if (Array.isArray(telefonos)) {
            await upsertTelefonos(targetCedula, telefonos, client);
        }
        const updateYacyretaQuery = `
            UPDATE yacyreta
            SET salario = $1, updated_by = $2
            WHERE id = $3
            RETURNING *;
        `;
        const resultYacyreta = await client.query(updateYacyretaQuery, [salario, id_usuario, id]);
        if (resultYacyreta.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado en la tabla yacyreta.' });
        }
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.', record: resultYacyreta.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de Yacyreta:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Conflicto de unicidad. La nueva cédula ya existe.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Elimina un registro de Yacyreta.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deleteYacyreta = async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'ID de registro no válido.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const oldRecordQuery = 'SELECT cedula FROM yacyreta WHERE id = $1 FOR UPDATE;';
        const oldRecordResult = await client.query(oldRecordQuery, [id]);
        if (oldRecordResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Yacyreta no encontrado' });
        }
        const oldCedula = oldRecordResult.rows[0].cedula;
        const checkOtherTablesQuery = `
            SELECT 1 FROM propiedades_propietarios WHERE cedula_propietario = $1 LIMIT 1;
        `;
        const checkOtherTablesResult = await client.query(checkOtherTablesQuery, [oldCedula]);
        if (checkOtherTablesResult.rowCount > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'No se puede eliminar este registro. La cédula está asociada a otra propiedad.' });
        }
        const deleteYacyretaQuery = 'DELETE FROM yacyreta WHERE id = $1 RETURNING *;';
        const resultYacyreta = await client.query(deleteYacyretaQuery, [id]);
        const deleteGeneralQuery = `
            DELETE FROM general WHERE cedula = $1 RETURNING *;
        `;
        const resultGeneral = await client.query(deleteGeneralQuery, [oldCedula]);
        if (resultGeneral.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado en la tabla general.' });
        }
        await client.query('COMMIT');
        res.json({
            message: 'Registro de Yacyreta eliminado exitosamente',
            deletedRecord: {
                ...resultYacyreta.rows[0],
                ...resultGeneral.rows[0]
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de Yacyreta:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

module.exports = {
    getYacyretaData,
    createYacyreta,
    updateYacyreta,
    deleteYacyreta
};