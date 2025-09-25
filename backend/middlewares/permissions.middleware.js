// src/middlewares/permissions.middleware.js

const { pool } = require('../db/db');

const canAccessRecord = (mainTable, idField = 'id', permissionType = 'edit', creatorField = 'created_by') => async (req, res, next) => {
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const { id } = req.params;

    // 1. Regla: Administrador tiene permiso total
    if (rol_usuario === 'administrador') {
        return next();
    }

    // Si no es administrador, verificamos la propiedad
    try {
        // Consultamos el creador del registro
        const query = `SELECT ${creatorField} FROM ${mainTable} WHERE ${idField} = $1;`;
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            // No existe el registro, o el ID es incorrecto.
            return res.status(404).json({ error: 'Registro no encontrado.' });
        }

        const recordOwnerId = result.rows[0][creatorField];
        // Comparamos el ID del creador (BD) con el ID del usuario logueado (req.user).
        // Usamos la doble igualdad (==) por si uno es string y el otro number.
        const isOwner = recordOwnerId == id_usuario;

        // 2. Regla A: EDITAR (PUT)
        if (permissionType === 'edit') {
            if (isOwner) {
                // Si es el dueño, se permite editar.
                return next();
            } else {
                 // Si NO es el dueño, se bloquea la edición.
                 return res.status(403).json({ error: 'Acceso prohibido. Solo puedes editar los registros que has creado.' });
            }
        }

        // 3. Regla B: ELIMINAR (DELETE)
        if (permissionType === 'delete') {
            if (isOwner) {
                // Si es el dueño, se permite eliminar.
                return next();
            } else {
                // Si NO es el dueño, se bloquea la eliminación.
                return res.status(403).json({ error: 'Acceso prohibido. Solo puedes eliminar los registros que has creado.' });
            }
        }
        
        // Permiso no reconocido
        return res.status(403).json({ error: 'Acceso prohibido. Permiso no cubierto por las reglas de acceso.' });

    } catch (err) {
        console.error(`Error en el middleware de permisos para la tabla ${mainTable}:`, err);
        return res.status(500).json({ error: 'Error del servidor al verificar permisos.' });
    }
};

module.exports = {
    canAccessRecord,
};