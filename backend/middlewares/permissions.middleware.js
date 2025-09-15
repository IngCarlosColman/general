const { pool } = require('../db/db');

/**
 * Middleware para verificar si el usuario puede editar un registro.
 * Permite a los administradores editar cualquier registro.
 * Permite a los editores (y otros roles) editar cualquier registro,
 * ya que la lógica de restricción de propiedad solo se aplica a la eliminación.
 * @param {string} mainTable - La tabla principal del registro.
 * @returns {function} Middleware de Express.
 */
const canEditRecord = (mainTable) => (req, res, next) => {
    const { rol: rol_usuario } = req.user;

    // Si el usuario es administrador, tiene control total.
    if (rol_usuario === 'administrador') {
        return next();
    }

    // Para todos los demás roles (como 'editor'), la edición está permitida
    // en cualquier registro. La restricción de propiedad es solo para la eliminación.
    next();
};

/**
 * Middleware para verificar si el usuario puede eliminar un registro.
 * Solo permite a los administradores o al creador del registro eliminarlo.
 * @param {string} mainTable - La tabla principal del registro.
 * @param {string} idField - El campo ID del registro.
 * @param {string|null} joinTable - La tabla para JOIN si es necesario.
 * @param {string|null} joinIdField - El campo de unión entre tablas.
 * @returns {function} Middleware de Express.
 */
const canDeleteRecord = (mainTable, idField = 'id', joinTable = null, joinIdField = null) => async (req, res, next) => {
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const { id } = req.params;

    // Los administradores tienen permiso para eliminar cualquier registro.
    if (rol_usuario === 'administrador') {
        return next();
    }

    try {
        let query;
        let queryParams;

        if (joinTable && joinIdField) {
            // Caso para tablas con JOIN (como abogados que se une a general)
            query = `
                SELECT T2.created_by
                FROM ${mainTable} AS T1
                JOIN ${joinTable} AS T2 ON T1.${joinIdField} = T2.${joinIdField}
                WHERE T1.${idField} = $1;
            `;
            queryParams = [id];
        } else {
            // Caso simple para una sola tabla
            query = `SELECT created_by FROM ${mainTable} WHERE ${idField} = $1;`;
            queryParams = [id];
        }

        const result = await pool.query(query, queryParams);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro no encontrado.' });
        }

        const recordOwnerId = result.rows[0].created_by;
        if (recordOwnerId !== id_usuario) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar este registro.' });
        }

        next();
    } catch (err) {
        console.error(`Error en el middleware de permisos para la tabla ${mainTable}:`, err);
        return res.status(500).json({ error: 'Error del servidor al verificar permisos.' });
    }
};

module.exports = {
    canEditRecord,
    canDeleteRecord,
};
