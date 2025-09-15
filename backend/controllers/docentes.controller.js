// docentes.controller.js
const { pool } = require('../db/db');
const { upsertTelefonos } = require('./general.controller');

/**
 * Obtiene los datos de la tabla de docentes.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getDocentesData = async (req, res) => {
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
        let orderByClause = '';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'cedula': 'd.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'salario': 'f.salario'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        } else {
            orderByClause = `ORDER BY g.completo ASC`;
        }
        const countQuery = `
            SELECT COUNT(*) 
            FROM docentes AS d
            JOIN general AS g ON d.cedula = g.cedula
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT
                d.id,
                d.cedula,
                COALESCE(g.nombres, g.completo) AS nombres,
                COALESCE(g.apellidos, '') AS apellidos,
                f.salario,
                ARRAY_AGG(t.numero) AS telefonos,
                g.completo
            FROM
                docentes AS d
            JOIN
                general AS g ON d.cedula = g.cedula
            LEFT JOIN
                funcpublic AS f ON d.cedula = f.cedula
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                d.id, d.cedula, g.nombres, g.apellidos, g.completo, f.salario
            ${orderByClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        queryParams.push(limit);
        queryParams.push(offset);
        const dataResult = await pool.query(dataQuery, queryParams);
        const items = dataResult.rows;
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener datos de docentes:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Crea un nuevo registro de docente.
 * La validación de permisos ahora se realiza en el middleware.
 */
const createDocente = async (req, res) => {
    const { cedula, nombres, apellidos, salario, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    if (!cedula || !nombres || !apellidos || !salario) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const completo = `${nombres} ${apellidos}`.trim();
        const generalQuery = `
            INSERT INTO general (cedula, nombres, apellidos, completo, created_by) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (cedula) DO NOTHING
            RETURNING id;
        `;
        const generalResult = await client.query(generalQuery, [cedula, nombres, apellidos, completo, id_usuario]);
        if (generalResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un registro con esa cédula.' });
        }
        if (Array.isArray(telefonos) && telefonos.length > 0) {
            await upsertTelefonos(cedula, telefonos, client);
        }
        const funcpublicQuery = `
            INSERT INTO funcpublic (cedula, salario, created_by) 
            VALUES ($1, $2, $3) 
            RETURNING id;
        `;
        await client.query(funcpublicQuery, [cedula, salario, id_usuario]);
        const docentesQuery = `
            INSERT INTO docentes (cedula, created_by) 
            VALUES ($1, $2) 
            RETURNING *;
        `;
        const docentesResult = await client.query(docentesQuery, [cedula, id_usuario]);
        await client.query('COMMIT');
        res.status(201).json({ message: 'Docente creado correctamente.', newRecord: docentesResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de docente:', err);
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
 * Actualiza un registro de docente.
 * La validación de permisos ahora se realiza en el middleware.
 */
const updateDocente = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, salario, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    if (!nombres || !apellidos || !salario) {
        return res.status(400).json({ error: 'Nombres, apellidos y salario son requeridos.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cedulaQuery = 'SELECT cedula FROM docentes WHERE id = $1;';
        const cedulaResult = await client.query(cedulaQuery, [id]);
        if (cedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de docente no encontrado.' });
        }
        const cedula = cedulaResult.rows[0].cedula;
        const updateGeneralQuery = `
            UPDATE general
            SET nombres = $1, apellidos = $2, completo = $3, updated_by = $4, updated_at = NOW()
            WHERE cedula = $5
            RETURNING *;
        `;
        const completo = `${nombres} ${apellidos}`.trim();
        const resultGeneral = await client.query(updateGeneralQuery, [nombres, apellidos, completo, id_usuario, cedula]);
        if (telefonos) {
            await upsertTelefonos(cedula, telefonos, client);
        }
        const updateFuncPublicQuery = `
            UPDATE funcpublic
            SET salario = $1, updated_by = $2, updated_at = NOW()
            WHERE cedula = $3
            RETURNING *;
        `;
        const resultFuncPublic = await client.query(updateFuncPublicQuery, [salario, id_usuario, cedula]);
        const updateDocentesQuery = `
            UPDATE docentes
            SET updated_by = $1, updated_at = NOW()
            WHERE id = $2;
        `;
        await client.query(updateDocentesQuery, [id_usuario, id]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Registro de docente actualizado correctamente.', updatedRecord: resultGeneral.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de docente:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Elimina un registro de docente.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deleteDocente = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteDocenteQuery = 'DELETE FROM docentes WHERE id = $1 RETURNING *;';
        const result = await client.query(deleteDocenteQuery, [id]);
        await client.query('COMMIT');
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado en la base de datos.' });
        }
        res.json({ message: 'Registro de docente eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de docente:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

module.exports = {
    getDocentesData,
    createDocente,
    updateDocente,
    deleteDocente,
};