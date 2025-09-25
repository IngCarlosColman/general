const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller'); 

/**
 * Obtiene los datos de la tabla de Yacyreta con paginación, búsqueda y ordenamiento.
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
                // Búsqueda Full-Text Search en la tabla 'general'
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
                y.created_by,
                g.cedula,
                g.nombres,
                g.apellidos,
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                g.completo AS nom_completo
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

// ------------------------------------
//          FUNCIONES CUD LIMPIAS
// ------------------------------------

/**
 * Crea un nuevo registro de Yacyreta.
 */
const createYacyreta = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;
    
    if (!cedula || !salario) {
        return res.status(400).json({ error: 'La cédula y el salario son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Usa la función centralizada para manejar la inserción/actualización de general y telefonos.
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);
        
        // 2. Inserta el registro en la tabla yacyreta.
        const insertYacyretaQuery = `
            INSERT INTO yacyreta (cedula, salario, created_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (cedula) DO NOTHING
            RETURNING *;
        `;
        const resultYacyreta = await client.query(insertYacyretaQuery, [cedula, salario, id_usuario]);
        
        if (resultYacyreta.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un registro con esa cédula en Yacyreta.' });
        }
        
        await client.query('COMMIT');
        res.status(201).json(resultYacyreta.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de Yacyreta:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro de Yacyreta.
 * La lógica de permisos/propiedad debe ser manejada en el middleware de ruta.
 */
const updateYacyreta = async (req, res) => {
    const { id: id_usuario } = req.user;
    const { id } = req.params;
    
    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'ID de registro no válido.' });
    }
    const { nombres, apellidos, cedula, telefonos, salario } = req.body;

    if (!cedula || !salario) {
        return res.status(400).json({ error: 'La cédula y el salario son obligatorios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Obtener la cédula original para el upsertGeneral y verificar existencia
        const checkQuery = 'SELECT cedula FROM yacyreta WHERE id = $1 FOR UPDATE;';
        const checkResult = await client.query(checkQuery, [id]);
        
        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Yacyreta no encontrado' });
        }
        
        const { cedula: oldCedula } = checkResult.rows[0];
        
        // 2. Usa la función centralizada para manejar la actualización de general y telefonos.
        // Se pasa la cédula original (oldCedula) para manejar el posible cambio de cédula.
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, oldCedula);

        // 3. Actualiza el registro de Yacyreta
        const updateYacyretaQuery = `
            UPDATE yacyreta
            SET cedula = $1, salario = $2, updated_by = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING *;
        `;
        const resultYacyreta = await client.query(updateYacyretaQuery, [cedula, salario, id_usuario, id]);
        
        // Esta verificación es solo por seguridad contra un fallo inesperado, no por la búsqueda inicial.
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
            res.status(409).json({ error: 'Conflicto de unicidad. La nueva cédula ya existe en la tabla yacyreta.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Elimina un registro de Yacyreta.
 * La lógica de permisos/propiedad debe ser manejada en el middleware de ruta.
 */
const deleteYacyreta = async (req, res) => {
    const { id } = req.params;
    // Se elimina { rol: userRole } ya que la verificación se hace en el middleware.

    if (isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'ID de registro no válido.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Verificar existencia del registro (la verificación de propiedad ya se hizo en el middleware)
        const checkQuery = 'SELECT 1 FROM yacyreta WHERE id = $1 FOR UPDATE;';
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de Yacyreta no encontrado' });
        }
        
        // 2. Eliminar el registro de Yacyreta
        const deleteYacyretaQuery = 'DELETE FROM yacyreta WHERE id = $1 RETURNING *;';
        const resultYacyreta = await client.query(deleteYacyretaQuery, [id]);
        
        await client.query('COMMIT');
        
        res.json({
            message: 'Registro de Yacyreta eliminado exitosamente',
            deletedRecord: resultYacyreta.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de Yacyreta:', err);
        // Manejo de error de clave foránea si el registro está referenciado por otra tabla
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar este registro porque está vinculado a otros datos.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
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