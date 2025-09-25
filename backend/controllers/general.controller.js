// src/controllers/general.controller.js

const { pool } = require('../db/db');
const { upsertTelefonos } = require('./common.controller'); // La ruta se mantiene

/**
 * Función auxiliar para actualizar o insertar datos de una persona en la tabla 'general'.
 * AHORA RECIBE Y PROPAGA EL ROL DEL USUARIO.
 * * @param {string} cedula - La cédula de la persona.
 * @param {string} nombre - El nombre completo de la persona ('APELLIDOS, NOMBRES' o solo NOMBRES).
 * @param {string[]} tel - Un array de números de teléfono.
 * @param {number} id_usuario - El ID del usuario que realiza la operación.
 * @param {object} client - El cliente de la base de datos de una transacción activa.
 * @param {string} rol_usuario - El rol del usuario que realiza la operación. 👈 NUEVO PARÁMETRO
 */
const upsertGeneral = async (cedula, nombre, tel, id_usuario, client, rol_usuario) => {
    // Si la cédula no se proporciona, no hay nada que hacer en la tabla general.
    if (!cedula) {
        return;
    }
    try {
        const completo = `${nombre || ''}`.trim();
        let nombres = nombre;
        let apellidos = null;
        // Si el nombre completo contiene una coma, se asume el formato 'APELLIDOS, NOMBRES'
        if (nombre && nombre.includes(',')) {
            const parts = nombre.split(',').map(part => part.trim());
            apellidos = parts[0];
            nombres = parts[1];
        }
        
        // Usamos ON CONFLICT (UPSERT) para simplificar la lógica.
        const upsertQuery = `
            INSERT INTO general (nombres, apellidos, cedula, completo, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (cedula) DO UPDATE SET
                nombres = EXCLUDED.nombres,
                apellidos = EXCLUDED.apellidos,
                completo = EXCLUDED.completo,
                updated_by = EXCLUDED.created_by,
                updated_at = NOW()
            RETURNING *;
        `;
        // En una inserción/upsert, 'created_by' y 'updated_by' son el mismo usuario que ejecuta.
        const result = await client.query(upsertQuery, [nombres, apellidos, cedula, completo, id_usuario]);

        // Si hay teléfonos, maneja el upsert de ellos también.
        if (tel && Array.isArray(tel)) {
            // Se pasa el rol_usuario real. Si es 'editor', upsertTelefonos
            // aplicará la restricción de SOLO ADICIÓN.
            await upsertTelefonos(client, cedula, tel, id_usuario, rol_usuario); 
        }
        return result.rows[0];
    } catch (error) {
        // Propagamos el error para que el controlador principal maneje el rollback.
        throw error;
    }
};

/**
 * Obtiene los datos de la tabla general con paginación, búsqueda y ordenamiento.
 */
const getGeneralData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
        // Obtenemos el ID del usuario desde el token JWT.
        const { id: userId } = req.user;

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

        let orderByClause = 'ORDER BY g.cedula ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'id': 'g.id',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'cedula': 'g.cedula',
                'created_by': 'g.created_by',
                'created_at': 'g.created_at',
                'updated_by': 'g.updated_by',
                'updated_at': 'g.updated_at'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        
        // Ajustamos el índice de los parámetros de paginación y el userId
        const userIdParamIndex = paramIndex; 
        const limitParamIndex = paramIndex + 1;
        const offsetParamIndex = paramIndex + 2;

        const countQuery = `SELECT COUNT(*) FROM mv_general_busqueda g ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                g.id,
                g.nombres,
                g.apellidos,
                g.cedula,
                g.completo,
                g.created_by,
                g.created_at,
                g.updated_by,
                g.updated_at,
                t.telefonos,
                (SELECT COUNT(*) FROM user_agendas WHERE user_id = $${userIdParamIndex} AND contact_cedula = g.cedula) > 0 AS is_in_agenda
            FROM
                mv_general_busqueda g
            LEFT JOIN
                mv_telefonos_agregados t ON g.cedula = t.cedula
            ${whereClause}
            ${orderByClause}
            LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex};
        `;
        
        // Se añade el ID del usuario, y luego los parámetros de paginación
        queryParams.push(userId);
        queryParams.push(limit);
        queryParams.push(offset);

        const dataResult = await pool.query(dataQuery, queryParams);
        const items = dataResult.rows;

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener datos de la vista mv_general_busqueda:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Obtiene un registro de la tabla general por su cédula.
 */
const getGeneralById = async (req, res) => {
    const { cedula } = req.params;
    // Obtenemos el ID del usuario desde el token JWT.
    const { id: userId } = req.user;
    try {
        const query = `
            SELECT
                g.id,
                g.nombres,
                g.apellidos,
                g.cedula,
                g.completo,
                g.created_by,
                g.created_at,
                g.updated_by,
                g.updated_at,
                t.telefonos,
                (SELECT COUNT(*) FROM user_agendas WHERE user_id = $2 AND contact_cedula = g.cedula) > 0 AS is_in_agenda
            FROM mv_general_busqueda g
            LEFT JOIN mv_telefonos_agregados t ON g.cedula = t.cedula
            WHERE g.cedula = $1;
        `;
        const result = await pool.query(query, [cedula, userId]);
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
 * Crea un nuevo registro en la tabla general.
 */
const createGeneral = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos } = req.body;
    // Capturamos el rol, aunque para la creación inicial forzamos el permiso.
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const completo = `${nombres || ''} ${apellidos || ''}`.trim();
        const insertQuery = `
            INSERT INTO general (nombres, apellidos, cedula, completo, created_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (cedula) DO UPDATE SET
                nombres = EXCLUDED.nombres,
                apellidos = EXCLUDED.apellidos,
                completo = EXCLUDED.completo,
                updated_by = EXCLUDED.created_by,
                updated_at = NOW()
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [nombres, apellidos, cedula, completo, id_usuario]);
        const newRecord = result.rows[0];
        
        if (Array.isArray(telefonos) && telefonos.length > 0) {
            // En la creación, el usuario tiene permiso total sobre su nuevo registro.
            // Para garantizar esto, mantenemos el rol de 'administrador' aquí.
            await upsertTelefonos(client, cedula, telefonos, id_usuario, 'administrador'); 
        }
        await client.query('COMMIT');
        res.status(201).json(newRecord);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar el registro:', err);
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
 * Actualiza un registro en la tabla general.
 * 🚨 ESTA ES LA FUNCIÓN CRÍTICA CON LAS RESTRICCIONES DE SEGURIDAD 🚨
 */
const updateGeneral = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula: new_cedula, telefonos } = req.body;
    const { id: id_usuario, rol: rol_usuario } = req.user;
    
    // --- Validación inicial ---
    if (!new_cedula || !nombres) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (cédula, nombres).' });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. OBTENER DATOS ORIGINALES y VERIFICAR PROPIEDAD
        const checkQuery = `SELECT cedula, created_by FROM general WHERE id = $1 FOR UPDATE;`;
        const checkResult = await client.query(checkQuery, [id]);
        
        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        
        const { cedula: original_cedula, created_by: record_owner_id } = checkResult.rows[0];
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
            // Si el editor está editando un registro ajeno, pero NO modificó la cédula (original_cedula === new_cedula), puede continuar.
        }

        // 3. ACTUALIZACIÓN de la tabla principal 'general'
        const completo = `${nombres || ''} ${apellidos || ''}`.trim();
        const updateQuery = `
            UPDATE general
            SET nombres = $1,
                apellidos = $2,
                cedula = $3,
                completo = $4,
                updated_by = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING *;
        `;
        const result = await client.query(updateQuery, [nombres, apellidos, final_cedula, completo, id_usuario, id]);
        
        // 4. LÓGICA DE TELÉFONOS (La restricción de SOLO ADICIÓN se delega a upsertTelefonos)
        if (Array.isArray(telefonos)) {
            // Pasamos el rol REAL para que upsertTelefonos aplique la lógica de filtrado/adición
            await upsertTelefonos(client, final_cedula, telefonos, id_usuario, rol_usuario);
        }

        await client.query('COMMIT');
        res.json({ updatedRecord: result.rows[0] });

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
 * Elimina un registro de la tabla general.
 * NOTA: La restricción de 'solo eliminar si es dueño' está en el middleware canAccessRecord.
 */
const deleteGeneral = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteQuery = `
            DELETE FROM general
            WHERE id = $1
            RETURNING *;
        `;
        const result = await client.query(deleteQuery, [id]);
        await client.query('COMMIT');
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json({ deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro:', err);
        if (err.code === '23503') {
            res.status(409).json({
                error: 'No se puede eliminar este registro porque está vinculado a otra tabla.',
                details: err.detail
            });
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
    upsertGeneral,
};