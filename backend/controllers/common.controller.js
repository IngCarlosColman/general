// common.controller.js

const { pool } = require('../db/db');

// Esta es la función que se debe exportar.
async function upsertTelefonos(client, cedula_persona, telefonos, id_usuario) {
    // Elimina todos los teléfonos existentes para la cédula dada
    await client.query('DELETE FROM telefonos WHERE cedula_persona = $1', [cedula_persona]);

    // Inserta los nuevos teléfonos si la lista no está vacía
    if (telefonos && Array.isArray(telefonos) && telefonos.length > 0) {
        for (let i = 0; i < telefonos.length; i++) {
            const numero = telefonos[i];
            const tipo = (i === 0) ? 'Principal' : 'Secundario';
            await client.query(
                `INSERT INTO telefonos(cedula_persona, numero, tipo, id_usuario) VALUES($1, $2, $3, $4)`,
                [cedula_persona, numero, tipo, id_usuario]
            );
        }
    }
}

module.exports = {
    upsertTelefonos,
};