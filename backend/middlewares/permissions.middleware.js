// src/middlewares/permissions.middleware.js
const { pool } = require('../db/db');

// ... (imports y SAFE_FIELDS si usas la versión auditada) ...

const canAccessRecord = (mainTable, idField = 'id', permissionType = 'edit', creatorField = 'created_by') => async (req, res, next) => {
    
    // ... (Validación de SAFE_FIELDS si usas la versión auditada) ...

    const { id: id_usuario, rol: rol_usuario } = req.user;
    const { id } = req.params;

    // REGLA 1: Administrador control total. (Excelente, ya está al inicio)
    if (rol_usuario === 'administrador') {
        return next();
    }
    
    // Si el usuario no es 'administrador', necesitamos verificar la propiedad.
    try {
        const query = `SELECT ${creatorField} FROM ${mainTable} WHERE ${idField} = $1;`;
        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado.' });
        }
        
        const recordOwnerId = result.rows[0][creatorField];
        // Usar igualdad estricta (===) si los tipos de ID son consistentes.
        const isOwner = recordOwnerId === id_usuario;
        
        // REGLA 2: Control total sobre sus registros.
        if (isOwner) {
            // El dueño siempre puede editar/eliminar su propio registro.
            return next(); 
        }

        // Si LLEGAMOS AQUÍ, el usuario NO es el dueño y NO es administrador.
        
        // Verificamos si el usuario es un 'editor' y la acción es 'delete' (restricción específica)
        // Aunque la restricción aplica a todos los roles no-admin, la ponemos explícitamente.
        if (permissionType === 'delete') {
            // No es dueño y no es admin, no puede eliminar.
            return res.status(403).json({ error: 'Acceso prohibido. Solo el dueño o un administrador pueden eliminar este registro.' });
        }
        
        if (permissionType === 'edit') {
            // No es dueño y no es admin, no puede editar.
            return res.status(403).json({ error: 'Acceso prohibido. Solo el dueño o un administrador pueden editar este registro.' });
        }
        
        // Si no es dueño ni administrador, y el permissionType no está cubierto
        return res.status(403).json({ error: 'Acceso prohibido. Permiso insuficiente.' });

    } catch (err) {
        console.error(`Error en el middleware de permisos para la tabla ${mainTable}:`, err);
        return res.status(500).json({ error: 'Error del servidor al verificar permisos.' });
    }
};

module.exports = {
    canAccessRecord,
};