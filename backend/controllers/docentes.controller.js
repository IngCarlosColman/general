// docentes.controller.js
const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

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
                g.completo AS nom_completo,
                g.created_by
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
                d.id, d.cedula, g.nombres, g.apellidos, g.completo, f.salario, g.created_by
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

const createDocente = async (req, res) => {
    const { cedula, nombres, apellidos, salario, telefonos } = req.body;
    const { id: id_usuario, rol: rol_usuario } = req.user; 

    if (!cedula || !nombres || !apellidos || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para crear un docente.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);

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

const updateDocente = async (req, res) => {
    const { id } = req.params;
    const { cedula: new_cedula, nombres, apellidos, salario, telefonos } = req.body;
    const { id: id_usuario, rol: rol_usuario } = req.user;
    
    if (!new_cedula || !nombres || !apellidos || salario === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios para actualizar un docente.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. OBTENER CÉDULA ORIGINAL (necesario para el potencial UPDATE de la tabla 'docentes')
        const checkQuery = `
            SELECT d.cedula AS original_cedula
            FROM docentes AS d
            WHERE d.id = $1 FOR UPDATE;
        `;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de docente no encontrado' });
        }
        
        const { original_cedula } = checkResult.rows[0];
        const final_cedula = new_cedula;

        // ❌ Eliminada la RESTRICCIÓN DE CÉDULA para EDITORES (Delegada al middleware)
        
        // 2. Ejecutar UPSERT en la tabla `general`
        await upsertGeneral(final_cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);

        // 3. Actualizar funcpublic (Salario)
        const updateFuncPublicQuery = `
            UPDATE funcpublic
            SET salario = $1, updated_by = $2, updated_at = NOW()
            WHERE cedula = $3
            RETURNING *;
        `;
        await client.query(updateFuncPublicQuery, [salario, id_usuario, final_cedula]);
        
        // 4. Si la cédula CAMBIÓ, actualizar la tabla `docentes`
        if (original_cedula !== final_cedula) {
            const updateDocenteCedulaQuery = 'UPDATE docentes SET cedula = $1 WHERE id = $2;';
            await client.query(updateDocenteCedulaQuery, [final_cedula, id]);
        }
        
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

const deleteDocente = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Asumiendo que el middleware manejó la restricción de borrado.
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