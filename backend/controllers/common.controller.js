// common.controller.js

const { pool } = require('../db/db');

/**
 * Inserta, actualiza o elimina teléfonos asociados a una cédula,
 * aplicando la lógica de permisos del rol.
 * * @param {object} client - Cliente de PG para transacciones.
 * @param {string} cedula_persona - Cédula de la persona.
 * @param {string[]} telefonos - Array de strings con los números a procesar.
 * @param {number} id_usuario - ID del usuario que realiza la acción (para auditoría).
 * @param {string} rol - Rol del usuario ('administrador', 'editor', etc.). 👈 NUEVO PARÁMETRO
 */
async function upsertTelefonos(client, cedula_persona, telefonos, id_usuario, rol) {
    // 1. LÓGICA DE ELIMINACIÓN (SOLO ADMINISTRADOR)
    // Solo el administrador puede borrar teléfonos existentes (comportamiento de reemplazo total).
    if (rol === 'administrador') {
        await client.query('DELETE FROM telefonos WHERE cedula_persona = $1', [cedula_persona]);
    }
    // NOTA: Si el rol es 'editor', el DELETE es omitido, preservando los números existentes.

    // 2. LÓGICA DE INSERCIÓN
    if (telefonos && Array.isArray(telefonos) && telefonos.length > 0) {
        
        // La consulta de inserción utiliza un UPSERT (ON CONFLICT) para manejar duplicados de manera segura.
        // Esto es crucial para el rol 'editor', ya que garantiza que solo se añaden los números nuevos.
        
        // Preparamos los valores para la inserción masiva: (cedula, numero, tipo, id_usuario)
        const values = telefonos.map((numero, index) => 
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(', ');
        
        const params = telefonos.flatMap((numero, index) => {
            const tipo = (index === 0) ? 'Principal' : 'Secundario';
            return [cedula_persona, numero, tipo, id_usuario];
        });

        const insertQuery = `
            INSERT INTO telefonos(cedula_persona, numero, tipo, created_by) 
            VALUES ${values}
            ON CONFLICT (cedula_persona, numero) 
            DO NOTHING;  -- Crucial: Solo inserta si la combinación (cédula, número) NO existe.
        `;
        
        // Ejecutamos la inserción masiva
        await client.query(insertQuery, params);
    }
}

module.exports = {
    upsertTelefonos,
};