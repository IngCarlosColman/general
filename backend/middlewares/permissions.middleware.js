const { pool } = require('../db/db');

/**
 * Middleware para verificar si el usuario tiene permiso sobre un registro.
 * La lógica es la misma para editar y eliminar, ya que los administradores
 * siempre tienen permiso y los demás roles pueden tener restricciones de propiedad.
 * @param {string} mainTable - La tabla principal del registro.
 * @param {string} [idField='id'] - El campo ID del registro.
 * @param {string} [permissionType='edit'] - El tipo de permiso a verificar ('edit' o 'delete').
 * @param {string} [creatorField='created_by'] - El nombre de la columna que almacena el ID del creador.
 * @param {string|null} [joinTable=null] - La tabla para JOIN si es necesario.
 * @param {string|null} [joinIdField=null] - El campo de unión entre tablas.
 * @returns {function} Middleware de Express.
 */
const canAccessRecord = (mainTable, idField = 'id', permissionType = 'edit', creatorField = 'created_by', joinTable = null, joinIdField = null) => async (req, res, next) => {
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const { id } = req.params;

    // Los administradores tienen permiso total.
    if (rol_usuario === 'administrador') {
        return next();
    }

    // Si el permiso es solo de edición y el usuario es un editor,
    // se le permite continuar sin verificar propiedad.
    if (permissionType === 'edit' && rol_usuario === 'editor') {
        return next();
    }
    
    // Si el usuario no es un administrador, verificamos la propiedad del registro.
    // Solo permitimos que los 'editores' (o cualquier otro rol)
    // modifiquen/eliminen sus propios registros.
    try {
        let query;
        let queryParams;

        if (joinTable && joinIdField) {
            // Caso para tablas con JOIN
            query = `
                SELECT T2.${creatorField}
                FROM ${mainTable} AS T1
                JOIN ${joinTable} AS T2 ON T1.${joinIdField} = T2.${joinIdField}
                WHERE T1.${idField} = $1;
            `;
            queryParams = [id];
        } else {
            // Caso para una sola tabla
            query = `SELECT ${creatorField} FROM ${mainTable} WHERE ${idField} = $1;`;
            queryParams = [id];
        }

        const result = await pool.query(query, queryParams);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado.' });
        }

        const recordOwnerId = result.rows[0][creatorField];
        if (recordOwnerId !== id_usuario) {
            return res.status(403).json({ error: 'No tienes permiso para ' + (permissionType === 'delete' ? 'eliminar este registro.' : 'modificar este registro.') });
        }
        
        // El usuario es el creador del registro, se le permite continuar.
        next();

    } catch (err) {
        console.error(`Error en el middleware de permisos para la tabla ${mainTable}:`, err);
        return res.status(500).json({ error: 'Error del servidor al verificar permisos.' });
    }
};

module.exports = {
    canAccessRecord,
};