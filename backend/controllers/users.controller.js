const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller'); 

/**
 * Obtiene los datos del usuario autenticado.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
const getAuthenticatedUser = async (req, res) => {
    // El middleware de autenticación ya ha verificado el token y
    // ha guardado el payload del JWT en req.user
    const { id: userId } = req.user;
    try {
        const result = await pool.query(
            // ⚠️ CORRECCIÓN: Ahora seleccionamos también 'telefono' y 'direccion'
            'SELECT id, username, email, rol, first_name, last_name, telefono, direccion FROM users WHERE id = $1',
            [userId]
        );
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.json(user);
    } catch (err) {
        console.error('Error al obtener el usuario autenticado:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Obtiene la lista de todos los usuarios con paginación, búsqueda y ordenamiento.
 * La validación de permisos ahora se realiza en el middleware.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
        const limit = Math.min(parseInt(itemsPerPage), 100);
        const offset = (parseInt(page) - 1) * limit;
        let whereClauses = [];
        const queryParams = [];
        let paramIndex = 1;
        if (search) {
            whereClauses.push(`
                (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1})
            `);
            queryParams.push(`%${search}%`);
            queryParams.push(`%${search}%`);
            paramIndex += 2;
        }
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT id, username, email, rol, first_name, last_name, telefono, direccion, created_at 
            FROM users 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        const dataParams = [...queryParams, limit, offset];
        const dataResult = await pool.query(dataQuery, dataParams);
        const items = dataResult.rows;
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener la lista de usuarios:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * NUEVA FUNCIÓN: Controlador para actualizar el perfil del usuario autenticado.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
const updateUserProfile = async (req, res) => {
    try {
        const { id: userId } = req.user; // Obtiene el ID del usuario autenticado
        const { first_name, last_name, telefono, direccion } = req.body;

        const result = await pool.query(
            `UPDATE users 
             SET first_name = $1, last_name = $2, telefono = $3, direccion = $4 
             WHERE id = $5 
             RETURNING id, email, first_name, last_name, rol, telefono, direccion;`,
            [first_name, last_name, telefono, direccion, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.status(200).json({ 
            message: 'Perfil actualizado con éxito.',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error al actualizar el perfil del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

module.exports = { getAuthenticatedUser, getAllUsers, updateUserProfile };
