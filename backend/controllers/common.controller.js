// common.controller.js
const { pool } = require('../db/db');

async function upsertTelefonos(client, cedula_persona, telefonos, id_usuario) {

    if (telefonos && Array.isArray(telefonos) && telefonos.length > 0) {
        
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
            DO NOTHING;
        `;
        
        await client.query(insertQuery, params);
    }
}

module.exports = {
    upsertTelefonos,
};