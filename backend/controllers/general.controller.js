// src/controllers/general.controller.js

const { pool } = require('../db/db');
const { upsertTelefonos } = require('./common.controller');

const upsertGeneral = async (cedula, nombre, tel, id_usuario, client, rol_usuario) => {
    if (!cedula) {
        return;
    }
    try {
        const completo = `${nombre || ''}`.trim();
        let nombres = nombre;
        let apellidos = null;

        if (nombre && nombre.includes(',')) {
            const parts = nombre.split(',').map(part => part.trim());
            apellidos = parts[0];
            nombres = parts[1];
        }

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
        const result = await client.query(upsertQuery, [nombres, apellidos, cedula, completo, id_usuario]);

        if (tel && Array.isArray(tel)) {
            await upsertTelefonos(client, cedula, tel, id_usuario, rol_usuario);
        }
        return result.rows[0];
    } catch (error) {
        throw error;
    }
};

const getGeneralData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
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

            // CAMBIOS AQUÍ: Agregando 'completo' e 'is_in_agenda' para ordenación eficiente
            const validSortFields = {
                'id': 'g.id',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
                'cedula': 'g.cedula',
                'completo': 'g.completo', // Usará el índice B-tree de la vista
                'is_in_agenda': 'is_in_agenda', // Usará el alias del campo calculado
                'created_by': 'g.created_by',
                'created_at': 'g.created_at',
                'updated_by': 'g.updated_by',
                'updated_at': 'g.updated_at'
            };

            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

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

const getGeneralById = async (req, res) => {
    const { cedula } = req.params;
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

const createGeneral = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos } = req.body;
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
            // Forzamos 'administrador' para asegurar que los teléfonos se puedan agregar inicialmente
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

const updateGeneral = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula: new_cedula, telefonos } = req.body;
    const { id: id_usuario, rol: rol_usuario } = req.user;

    if (!new_cedula || !nombres) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (cédula, nombres).' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. OBTENER DATOS ORIGINALES
        const checkQuery = `SELECT cedula FROM general WHERE id = $1 FOR UPDATE;`;
        const checkResult = await client.query(checkQuery, [id]);

        if (checkResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Registro no encontrado' });
        }

        // ❌ Eliminada la verificación de propiedad y la restricción de cédula
        const final_cedula = new_cedula;

        // 2. ACTUALIZACIÓN de la tabla principal 'general'
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

        // 3. LÓGICA DE TELÉFONOS
        if (Array.isArray(telefonos)) {
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
// src/controllers/general.controller.js

const addGeneralPhone = async (req, res) => {
    const { cedula } = req.params;
    const { telefono } = req.body;
    const { id: id_usuario } = req.user; // No necesitamos rol aquí

    if (!cedula || !telefono) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (cédula y teléfono).' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verificación básica de existencia del contacto (Tu código es correcto aquí)
        const checkContactQuery = 'SELECT 1 FROM general WHERE cedula = $1;';
        const contactExists = await client.query(checkContactQuery, [cedula]);

        if (contactExists.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Contacto no encontrado con la cédula proporcionada.' });
        }

        // 2. Insertar el nuevo teléfono con un TIPO genérico ('Secundario' o 'Telefono')
        const phoneType = 'Secundario'; // Usamos un tipo genérico para evitar conflictos con el principal

        const addPhoneQuery = `
            INSERT INTO telefonos (cedula_persona, numero, tipo, created_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cedula_persona, numero) DO NOTHING;
        `;
        // Pasamos 4 parámetros: [cedula, telefono, phoneType, id_usuario]
        await client.query(addPhoneQuery, [cedula, telefono, phoneType, id_usuario]);

        // 3. Obtener la lista COMPLETA de teléfonos actualizada
        const updatedPhonesQuery = `
            SELECT array_agg(numero) as telefonos
            FROM telefonos
            WHERE cedula_persona = $1;
        `;
        const updatedPhonesResult = await client.query(updatedPhonesQuery, [cedula]);
        const updatedTelefonos = updatedPhonesResult.rows[0]?.telefonos || [];

        await client.query('COMMIT');

        // Devolvemos el registro completo de teléfonos para que el frontend actualice
        return res.json({ cedula, telefonos: updatedTelefonos, message: 'Teléfono añadido con éxito.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al añadir teléfono al registro:', err);
        res.status(500).json({ error: 'Error del servidor al añadir teléfono', details: err.detail });
    } finally {
        client.release();
    }
};
// ... (exportar addGeneralPhone)

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
    addGeneralPhone,
    deleteGeneral,
    upsertGeneral,
};