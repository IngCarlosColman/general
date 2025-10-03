const { pool } = require('../db/db');
// Se mantiene la importación de upsertGeneral, aunque no se usa directamente aquí,
// pero podría ser útil si el rol del usuario permitiera actualizar otros datos.
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
            // ⚠️ CORRECCIÓN: Agregamos suscripcion_vence, cedula y ruc
            'SELECT id, username, email, rol, first_name, last_name, telefono, direccion, cedula, ruc, suscripcion_vence FROM users WHERE id = $1',
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
            // Permite buscar por username o email
            whereClauses.push(`
                (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1})
            `);
            queryParams.push(`%${search}%`);
            queryParams.push(`%${search}%`);
            paramIndex += 2;
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        // Consulta para el conteo total de elementos
        const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        // Consulta para obtener los datos paginados
        const dataQuery = `
            SELECT id, username, email, rol, first_name, last_name, telefono, direccion, cedula, ruc, suscripcion_vence, created_at 
            FROM users 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        const dataParams = [...queryParams, limit, offset];
        const dataResult = await pool.query(dataQuery, dataParams);
        const items = dataResult.rows;

        // NOTA: El frontend espera 'users' o 'items'. Usamos 'users' para mayor compatibilidad
        // con el código inicial del frontend que usa `response.data.users`
        res.json({ users: items, totalItems }); 
    } catch (err) {
        console.error('Error al obtener la lista de usuarios:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Controlador para actualizar el perfil del usuario autenticado (propio).
 * Permite al usuario actualizar sus propios campos de información personal.
 * @param {object} req - Objeto de solicitud de Express.
 * @param {object} res - Objeto de respuesta de Express.
 */
const updateUserProfile = async (req, res) => {
    try {
        const { id: userId } = req.user; // Obtiene el ID del usuario autenticado
        
        // Campos que el usuario puede actualizar
        const { first_name, last_name, telefono, direccion } = req.body;

        // Validar si al menos un campo relevante está presente para evitar un UPDATE vacío
        if (!first_name && !last_name && !telefono && !direccion) {
            return res.status(400).json({ error: 'Debe proporcionar al menos un campo (first_name, last_name, telefono, o direccion) para actualizar.' });
        }

        // Construir la consulta de forma dinámica
        const fieldsToUpdate = [];
        const values = [];
        let paramIndex = 1;

        if (first_name !== undefined) {
            fieldsToUpdate.push(`first_name = $${paramIndex++}`);
            values.push(first_name);
        }
        if (last_name !== undefined) {
            fieldsToUpdate.push(`last_name = $${paramIndex++}`);
            values.push(last_name);
        }
        if (telefono !== undefined) {
            fieldsToUpdate.push(`telefono = $${paramIndex++}`);
            values.push(telefono);
        }
        if (direccion !== undefined) {
            fieldsToUpdate.push(`direccion = $${paramIndex++}`);
            values.push(direccion);
        }
        
        // Agregar el ID del usuario al final de los valores
        values.push(userId);
        const userIdParam = paramIndex;

        const updateQuery = `
             UPDATE users 
             SET ${fieldsToUpdate.join(', ')}, updated_at = NOW() 
             WHERE id = $${userIdParam} 
             RETURNING id, username, email, first_name, last_name, rol, telefono, direccion, suscripcion_vence;
        `;

        const result = await pool.query(updateQuery, values);

        if (result.rowCount === 0) {
            // Debería ser muy raro dado que el ID viene del token JWT
            return res.status(404).json({ error: 'Usuario no encontrado para la actualización.' });
        }

        res.status(200).json({ 
            message: 'Perfil actualizado con éxito.',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error al actualizar el perfil del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar el perfil.' });
    }
};

// -------------------------------------------------------------
// 🔑 FUNCIÓN ADMINISTRATIVA CLAVE AÑADIDA
// -------------------------------------------------------------

/**
 * Función exclusiva para Administradores. Actualiza el perfil y el rol
 * de cualquier usuario por su ID.
 * Este controlador será usado por la ruta PUT /api/admin/users/:id
 * @param {object} req - Objeto de solicitud de Express (contiene req.params.id).
 * @param {object} res - Objeto de respuesta de Express.
 */
const updateUserByAdmin = async (req, res) => {
    try {
        // 1. Obtener el ID del usuario a modificar desde los parámetros de la ruta
        const { id: targetUserId } = req.params; 
        
        // Campos que el ADMIN puede actualizar (incluyendo 'rol' y 'cedula/ruc')
        const { first_name, last_name, telefono, direccion, rol, cedula, ruc } = req.body;

        // Validar si al menos un campo relevante está presente
        if (!first_name && !last_name && !telefono && !direccion && !rol && !cedula && !ruc) {
            return res.status(400).json({ 
                error: 'Debe proporcionar al menos un campo para actualizar.' 
            });
        }

        // 2. Construir la consulta de forma dinámica para la actualización
        const fieldsToUpdate = [];
        const values = [];
        let paramIndex = 1;

        // Lógica de actualización de campos personales
        if (first_name !== undefined) {
            fieldsToUpdate.push(`first_name = $${paramIndex++}`);
            values.push(first_name);
        }
        if (last_name !== undefined) {
            fieldsToUpdate.push(`last_name = $${paramIndex++}`);
            values.push(last_name);
        }
        if (telefono !== undefined) {
            fieldsToUpdate.push(`telefono = $${paramIndex++}`);
            values.push(telefono);
        }
        if (direccion !== undefined) {
            fieldsToUpdate.push(`direccion = $${paramIndex++}`);
            values.push(direccion);
        }
        // CAMBIO CLAVE: Permitir la actualización del rol
        if (rol !== undefined) {
            fieldsToUpdate.push(`rol = $${paramIndex++}`);
            values.push(rol); 
        }
        // ⚠️ CORRECCIÓN: Permitir la actualización de cedula y ruc por Admin
        if (cedula !== undefined) {
            fieldsToUpdate.push(`cedula = $${paramIndex++}`);
            values.push(cedula); 
        }
        if (ruc !== undefined) {
            fieldsToUpdate.push(`ruc = $${paramIndex++}`);
            values.push(ruc); 
        }

        // Agregar el ID del usuario al final de los valores para la cláusula WHERE
        values.push(targetUserId);
        const userIdParam = paramIndex;

        const updateQuery = `
             UPDATE users 
             SET ${fieldsToUpdate.join(', ')}, updated_at = NOW() 
             WHERE id = $${userIdParam} 
             RETURNING id, username, email, first_name, last_name, rol, telefono, direccion, suscripcion_vence;
        `;

        const result = await pool.query(updateQuery, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado para la actualización.' });
        }

        res.status(200).json({ 
            message: 'Usuario actualizado por administrador con éxito.',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Error al actualizar usuario por Admin:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar el usuario.' });
    }
};
module.exports = { 
    getAuthenticatedUser, 
    getAllUsers, 
    updateUserProfile, 
    updateUserByAdmin // ⬅️ NUEVA FUNCIÓN EXPORTADA
};