// despachantes.controller.js
const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller'); 

/**
 * Obtiene los datos de la tabla de despachantes.
 * (getDespachantesData se mantiene igual, no necesita verificación de rol de lectura)
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
                g.completo AS nom_completo,
                g.created_by
            FROM
                despachantes AS d
            JOIN
                general AS g ON d.cedula = g.cedula
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY
                d.id, d.cedula, g.nombres, g.apellidos, g.completo, g.created_by
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

// ------------------------------------
//          FUNCIONES CUD BLINDADAS
// ------------------------------------

/**
 * Crea un nuevo registro de despachante.
 * 🚨 MEJORA DE SEGURIDAD: Se propaga el rol a upsertGeneral.
 */
const createDespachante = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos } = req.body;
    // Capturar el rol del usuario
    const { id: id_usuario, rol: rol_usuario } = req.user; 
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Propagar el rol a la función centralizada
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);

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
 * 🚨 IMPLEMENTACIÓN DE BLINDAJE DE SEGURIDAD CRÍTICO 🚨
 * Se añade la verificación de propiedad y la restricción de cédula para editores.
 */
const updateDespachante = async (req, res) => {
    const { id } = req.params;
    // La cédula aquí es la *nueva* cédula propuesta.
    const { nombres, apellidos, cedula: new_cedula, telefonos } = req.body;
    // Capturar ID y rol del usuario
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const client = await pool.connect();
    
    if (!new_cedula || !nombres) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (cédula, nombres).' });
    }
    
    try {
        await client.query('BEGIN');
        
        // 1. OBTENER CÉDULA ORIGINAL y created_by
        const checkQuery = `
            SELECT d.cedula AS original_cedula, g.created_by 
            FROM despachantes AS d
            JOIN general AS g ON d.cedula = g.cedula
            WHERE d.id = $1 FOR UPDATE;
        `;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro de despachante no encontrado' });
        }
        
        const { original_cedula, created_by: record_owner_id } = checkResult.rows[0];
        const isOwner = record_owner_id === id_usuario;
        let final_cedula = new_cedula;

        // 2. RESTRICCIÓN DE CÉDULA para EDITORES
        if (rol_usuario === 'editor' && !isOwner) {
            // Si el editor intenta cambiar la cédula de un registro ajeno, se bloquea.
            if (original_cedula !== new_cedula) {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    error: 'Acceso prohibido. No puedes modificar la cédula de un registro creado por otro usuario.' 
                });
            }
            // Si no modificó la cédula, puede continuar con la actualización.
        }

        // 3. Ejecutar UPSERT en la tabla `general`, PROPAGANDO EL ROL
        await upsertGeneral(final_cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client, rol_usuario);

        // 4. Si la cédula CAMBIÓ, actualizar la tabla `despachantes` 
        if (original_cedula !== final_cedula) {
            const updateDespachanteCedulaQuery = `UPDATE despachantes SET cedula = $1 WHERE id = $2;`;
            await client.query(updateDespachanteCedulaQuery, [final_cedula, id]);
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
 * (Se mantiene igual, la restricción de borrado debe estar en un middleware o capa de permisos superior).
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