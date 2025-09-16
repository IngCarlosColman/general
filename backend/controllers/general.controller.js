const { pool } = require('../db/db');

/**
 * Función auxiliar para manejar la inserción/actualización de teléfonos.
 * Se corrigió el nombre de la columna en la consulta INSERT de 'created_by' a 'id_usuario'.
 */
async function upsertTelefonos(client, cedula_persona, telefonos, id_usuario) {
    await client.query('DELETE FROM telefonos WHERE cedula_persona = $1', [cedula_persona]);
    if (telefonos && Array.isArray(telefonos) && telefonos.length > 0) {
        for (let i = 0; i < telefonos.length; i++) {
            const numero = telefonos[i];
            const tipo = (i === 0) ? 'Principal' : 'Secundario';
            await client.query(
                `INSERT INTO telefonos(cedula_persona, numero, tipo, id_usuario) VALUES($1, $2, $3, $4)`,
                [cedula_persona, numero, tipo, id_usuario]
            );
        }
    }
}

// Esta es la versión final y corregida de la función upsertGeneral.
const upsertGeneral = async (cedula, nombre, tel, id_usuario, client) => {
    // === ÚNICA CORRECCIÓN ===
    // Si la cédula no se proporciona, no hay nada que hacer en la tabla general.
    if (!cedula) {
        return; // Termina la ejecución de la función aquí.
    }
    // ========================

    try {
        const checkQuery = 'SELECT COUNT(*) FROM general WHERE cedula = $1';
        const checkResult = await client.query(checkQuery, [cedula]);
        const exists = parseInt(checkResult.rows[0].count) > 0;

        let nombres = nombre;
        let apellidos = null;

        // Si el nombre completo contiene una coma, se asume el formato 'APELLIDOS, NOMBRES'
        if (nombre && nombre.includes(',')) {
            const parts = nombre.split(',').map(part => part.trim());
            apellidos = parts[0];
            nombres = parts[1];
        }

        if (exists) {
            const updateQuery = `
                UPDATE general
                SET nombres = $1, apellidos = $2, completo = $3, updated_by = $4, updated_at = NOW()
                WHERE cedula = $5;
            `;
            await client.query(updateQuery, [nombres, apellidos, nombre, id_usuario, cedula]);
        } else {
            const insertQuery = `
                INSERT INTO general (nombres, apellidos, cedula, completo, created_by)
                VALUES ($1, $2, $3, $4, $5);
            `;
            await client.query(insertQuery, [nombres, apellidos, cedula, nombre, id_usuario]);
        }
        
        // Si hay teléfonos, maneja el upsert de ellos también.
        if (tel) {
            await upsertTelefonos(client, cedula, tel, id_usuario);
        }
    } catch (error) {
        // No manejamos el error aquí, lo dejamos para el controlador principal para que pueda hacer un ROLLBACK
        throw error;
    }
};

/**
 * Función principal para obtener datos.
 */
const getGeneralData = async (req, res) => {
    const { rol: rol_usuario } = req.user;
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para ver esta información.' });
    }
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
                whereClause = `WHERE search_vector @@ to_tsquery('spanish', $${paramIndex})`;
                queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
                paramIndex++;
            }
        }
        
        let orderByClause = 'ORDER BY nombres ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            
            const validSortFields = ['id', 'nombres', 'apellidos', 'cedula'];
            if (validSortFields.includes(sortKey)) {
                orderByClause = `ORDER BY ${sortKey} ${sortOrder}`;
            }
        }

        const countQuery = `SELECT COUNT(*) FROM general ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                g.id,
                g.nombres,
                g.apellidos,
                g.cedula,
                g.completo,
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                g.created_by
            FROM
                general g
            LEFT JOIN
                telefonos t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                g.id, g.nombres, g.apellidos, g.cedula, g.completo, g.created_by
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
        console.error('Error al obtener datos de la tabla general:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Función para obtener un registro por cédula.
 */
const getGeneralById = async (req, res) => {
    const { rol: rol_usuario } = req.user;
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para ver esta información.' });
    }
    
    const { cedula } = req.params;
    try {
        const query = `
            SELECT
                g.id,
                g.nombres,
                g.apellidos,
                g.cedula,
                g.completo,
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos
            FROM
                general g
            LEFT JOIN
                telefonos t ON g.cedula = t.cedula_persona
            WHERE g.cedula = $1
            GROUP BY
                g.id, g.nombres, g.apellidos, g.cedula, g.completo;
        `;
        const result = await pool.query(query, [cedula]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener registro por ID:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Función para crear un nuevo registro.
 */
const createGeneral = async (req, res) => {
    const { rol: rol_usuario, id: id_usuario } = req.user;
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para crear registros.' });
    }
    
    const { nombres, apellidos, cedula, telefonos } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const newApellidos = apellidos || null;
        const completo = `${nombres || ''} ${newApellidos || ''}`.trim();

        const insertQuery = `
            INSERT INTO general (nombres, apellidos, cedula, completo, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [nombres, newApellidos, cedula, completo, id_usuario]);
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
            res.status(409).json({ error: 'Ya existe un registro con esta cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Función para actualizar un registro.
 * La verificación de permisos ahora se maneja en el middleware.
 */
const updateGeneral = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, telefonos } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const oldCedulaQuery = 'SELECT cedula FROM general WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        const oldCedula = oldCedulaResult.rows[0].cedula;

        if (cedula !== oldCedula) {
            const checkQuery = 'SELECT id FROM general WHERE cedula = $1';
            const checkResult = await client.query(checkQuery, [cedula]);
            if (checkResult.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Ya existe otro registro con esa cédula.' });
            }
        }

        const completo = `${nombres || ''} ${apellidos || ''}`.trim();

        const updateQuery = `
            UPDATE general
            SET nombres = $1, apellidos = $2, cedula = $3, completo = $4
            WHERE id = $5
            RETURNING *;
        `;
        const result = await client.query(updateQuery, [nombres, apellidos, cedula, completo, id]);
        
        if (telefonos) {
            await upsertTelefonos(client, cedula, telefonos, req.user.id);
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.', updatedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro:', err);
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
 * Función para eliminar un registro.
 * La verificación de permisos ahora se maneja en el middleware.
 */
const deleteGeneral = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // La validación de permisos se movió al middleware.
        
        const deleteQuery = `
            DELETE FROM general WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id]);

        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json({ message: 'Registro eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro:', err);
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
    getGeneralData,
    getGeneralById,
    createGeneral,
    updateGeneral,
    deleteGeneral,
    upsertGeneral // *** Aquí está la corrección: exportar la función.
};