// docentes.controller.js (Versión Mejorada)
const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

/**
 * Obtiene los datos de la tabla de docentes.
 */
const getDocentesData = async (req, res) => {
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
                'salario': 'f.salario'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
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
                g.nombres,
                g.apellidos,
                f.salario,
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                g.completo AS nom_completo
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
 * Se ha mejorado la validación para ser más precisa.
 */
const createDocente = async (req, res) => {
    const { cedula, nombres, apellidos, salario, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    if (!cedula || !nombres || !apellidos || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para crear un docente.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Se usa la función centralizada para manejar la inserción/actualización en la tabla general
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);

        const funcpublicQuery = `
            INSERT INTO funcpublic (cedula, salario, created_by) 
            VALUES ($1, $2, $3)
            ON CONFLICT (cedula) DO UPDATE SET salario = EXCLUDED.salario, updated_by = $3, updated_at = NOW()
            RETURNING id;
        `;
        await client.query(funcpublicQuery, [cedula, salario, id_usuario]);

        const docentesQuery = `
            INSERT INTO docentes (cedula) 
            VALUES ($1) 
            ON CONFLICT (cedula) DO NOTHING
            RETURNING *;
        `;
        const docentesResult = await client.query(docentesQuery, [cedula]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Docente creado o actualizado correctamente.', newRecord: docentesResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de docente:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro de docente.
 * La cédula ahora debe venir en el cuerpo de la solicitud para evitar una consulta innecesaria.
 */
const updateDocente = async (req, res) => {
    const { id } = req.params;
    // Se espera que la cedula venga en el cuerpo de la solicitud para mayor eficiencia
    const { cedula, nombres, apellidos, salario, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    
    // Se verifica que todos los campos requeridos estén presentes
    if (!cedula || !nombres || !apellidos || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar un docente.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Se usa la función centralizada para manejar la actualización en la tabla general y los teléfonos.
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);

        const updateFuncPublicQuery = `
            UPDATE funcpublic
            SET salario = $1, updated_by = $2, updated_at = NOW()
            WHERE cedula = $3
            RETURNING *;
        `;
        await client.query(updateFuncPublicQuery, [salario, id_usuario, cedula]);
        
        // Opcional: Si el ID de la tabla 'docentes' no coincide con la nueva cédula, se actualiza
        // Esto solo sería necesario si se permite cambiar la cédula
        const updateDocenteCedulaQuery = 'UPDATE docentes SET cedula = $1 WHERE id = $2;';
        await client.query(updateDocenteCedulaQuery, [cedula, id]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Registro de docente actualizado correctamente.' });
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
    getDocentesData,
    createDocente,
    updateDocente,
    deleteDocente,
};