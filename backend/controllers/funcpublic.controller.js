const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

/**
 * Función para obtener datos de funcpublic con paginación, búsqueda y ordenamiento.
 */
const getFuncPublicData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, sortBy = [], search = '' } = req.query;
        let parsedSortBy = [];
        if (typeof sortBy === 'string') {
            try {
                parsedSortBy = JSON.parse(sortBy);
            } catch (error) {
                console.error("Error al parsear el parámetro sortBy:", error);
            }
        } else if (Array.isArray(sortBy)) {
            parsedSortBy = sortBy;
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
        if (parsedSortBy.length) {
            const sortKey = parsedSortBy[0].key;
            const sortOrder = parsedSortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'cedula': 'g.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'salario': 'fp.salario'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

        // Consulta para el conteo de registros (no necesita el join completo)
        const countQuery = `
            SELECT COUNT(*) 
            FROM funcpublic AS fp
            JOIN general AS g ON fp.cedula = g.cedula
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        // --- INICIO DE LA CORRECCIÓN EN LA CONSULTA DE DATOS ---
        const dataQuery = `
            SELECT
                fp.id,
                fp.salario,
                g.cedula,
                g.nombres,
                g.apellidos,
                g.completo AS nom_completo,
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos
            FROM
                funcpublic AS fp
            JOIN
                general AS g ON fp.cedula = g.cedula
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                fp.id, fp.salario, g.cedula, g.nombres, g.apellidos, g.completo
            ${orderByClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        queryParams.push(limit);
        queryParams.push(offset);
        const dataResult = await pool.query(dataQuery, queryParams);
        const items = dataResult.rows;
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener los datos de funcpublic:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Función para crear un nuevo registro, insertando en las tablas general y funcpublic.
 */
const createFuncPublic = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);
        
        const insertFuncPublicQuery = `
            INSERT INTO funcpublic (cedula, salario, created_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (cedula) DO NOTHING
            RETURNING *;
        `;
        const resultFuncPublic = await client.query(insertFuncPublicQuery, [cedula, salario, id_usuario]);
        
        if (resultFuncPublic.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un registro con esa cédula en Funcionario Público.' });
        }
        
        await client.query('COMMIT');
        res.status(201).json(resultFuncPublic.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de funcionario público:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};


/**
 * Función para actualizar un registro, en las tablas general y funcpublic.
 */
const updateFuncPublic = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const oldCedulaQuery = 'SELECT cedula FROM funcpublic WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de funcionario público no encontrado' });
        }
        const oldCedula = oldCedulaResult.rows[0].cedula;
        
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, oldCedula);

        const updateFuncPublicQuery = `
            UPDATE funcpublic
            SET cedula = $1, salario = $2, updated_by = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING *;
        `;
        const resultFuncPublic = await client.query(updateFuncPublicQuery, [cedula, salario, id_usuario, id]);

        await client.query('COMMIT');
        
        if (resultFuncPublic.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado en la tabla funcpublic.' });
        }
        
        res.json({ message: 'Registro actualizado correctamente.', updatedRecord: resultFuncPublic.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de funcionario público:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe otro registro con esa cédula en la tabla funcpublic.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Función para eliminar un registro.
 */
const deleteFuncPublic = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const deleteFuncPublicQuery = `
            DELETE FROM funcpublic WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteFuncPublicQuery, [id]);
        
        await client.query('COMMIT');
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado en la base de datos.' });
        }
        res.json({ message: 'Registro eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de funcionario:', err);
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
    getFuncPublicData,
    createFuncPublic,
    updateFuncPublic,
    deleteFuncPublic
};