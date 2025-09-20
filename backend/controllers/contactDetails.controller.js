// controllers/contactDetails.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene los detalles de contacto con paginación, búsqueda y ordenamiento.
 * La búsqueda se realiza sobre los campos de la tabla `general` a través del campo `search_vector`.
 */
const getContactDetailsData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
        const { id: id_usuario } = req.user;
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

        let whereClause = `WHERE cd.user_id = $1`;
        const queryParams = [id_usuario];
        let paramIndex = 2;

        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            if (searchTerms.length > 0) {
                whereClause += ` AND cd.cedula IN (
                    SELECT cedula FROM mv_general_busqueda 
                    WHERE search_vector @@ to_tsquery('spanish', $${paramIndex})
                )`;
                queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
                paramIndex++;
            }
        }

        let orderByClause = 'ORDER BY cd.created_at DESC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            
            const validSortFields = {
                'cedula': 'cd.cedula',
                'area_negocio': 'cd.area_negocio',
                'created_at': 'cd.created_at',
                'updated_at': 'cd.updated_at'
            };

            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }

        const countQuery = `SELECT COUNT(*) FROM contact_details cd ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                cd.*,
                g.nombres,
                g.apellidos,
                g.completo
            FROM
                contact_details cd
            JOIN 
                general g ON cd.cedula = g.cedula
            ${whereClause}
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
        console.error('Error al obtener datos de contact_details:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Obtiene un registro de la tabla contact_details por su cédula y el ID de usuario.
 */
const getContactDetail = async (req, res) => {
    const { cedula } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const query = `
            SELECT
                cd.*,
                g.nombres,
                g.apellidos,
                g.completo
            FROM contact_details cd
            JOIN general g ON cd.cedula = g.cedula
            WHERE cd.cedula = $1 AND cd.user_id = $2;
        `;
        const result = await pool.query(query, [cedula, id_usuario]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener registro de contact_details:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Crea un nuevo registro en la tabla contact_details.
 */
const createContactDetail = async (req, res) => {
    const { cedula, cargo, empresa, direccion, notas, fecha_nacimiento, es_padre, es_madre, perfil_linkedin, area_negocio } = req.body;
    const { id: id_usuario } = req.user;
    try {
        const insertQuery = `
            INSERT INTO contact_details (cedula, user_id, cargo, empresa, direccion, notas, fecha_nacimiento, es_padre, es_madre, perfil_linkedin, area_negocio)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [cedula, id_usuario, cargo, empresa, direccion, notas, fecha_nacimiento, es_padre, es_madre, perfil_linkedin, area_negocio]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al insertar el registro de contact_details:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe un registro con esa cédula para este usuario.' });
        } else if (err.code === '23503') {
            res.status(400).json({ error: 'La cédula no está registrada en la guía general.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Actualiza un registro en la tabla contact_details.
 */
const updateContactDetail = async (req, res) => {
    const { cedula } = req.params;
    const { cargo, empresa, direccion, notas, fecha_nacimiento, es_padre, es_madre, perfil_linkedin, area_negocio } = req.body;
    const { id: id_usuario } = req.user;
    try {
        const updateQuery = `
            UPDATE contact_details
            SET 
                cargo = $1,
                empresa = $2,
                direccion = $3,
                notas = $4,
                fecha_nacimiento = $5,
                es_padre = $6,
                es_madre = $7,
                perfil_linkedin = $8,
                area_negocio = $9,
                updated_at = NOW()
            WHERE cedula = $10 AND user_id = $11
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [
            cargo,
            empresa,
            direccion,
            notas,
            fecha_nacimiento,
            es_padre,
            es_madre,
            perfil_linkedin,
            area_negocio,
            cedula,
            id_usuario
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar el registro de contact_details:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Elimina un registro de la tabla contact_details.
 */
const deleteContactDetail = async (req, res) => {
    const { cedula } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const deleteQuery = `
            DELETE FROM contact_details
            WHERE cedula = $1 AND user_id = $2
            RETURNING *;
        `;
        const result = await pool.query(deleteQuery, [cedula, id_usuario]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json({ deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar el registro de contact_details:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getContactDetailsData,
    getContactDetail,
    createContactDetail,
    updateContactDetail,
    deleteContactDetail,
};