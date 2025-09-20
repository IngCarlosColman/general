const { pool } = require('../db/db');

/**
 * Obtiene los números de teléfono asociados a una lista de cédulas.
 * El formato de la respuesta se adapta a lo que espera el frontend.
 * @param {object} req - Objeto de la solicitud Express.
 * @param {object} res - Objeto de la respuesta Express.
 */
const getTelefonosByCedulas = async (req, res) => {
    const { rol: rol_usuario } = req.user;
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para ver esta información.' });
    }

    const { cedulas } = req.query;

    if (!cedulas) {
        return res.json({});
    }

    // Convertir la cadena de cédulas separada por comas en un array
    const cedulaArray = cedulas.split(',').filter(Boolean); // Filtrar valores vacíos

    try {
        // Consultar la tabla `telefonos` por todas las cédulas en un solo query
        const query = `
            SELECT cedula_persona, numero FROM telefonos 
            WHERE cedula_persona = ANY($1::text[])
        `;
        const result = await pool.query(query, [cedulaArray]);

        // Formatear el resultado como un objeto, agrupando los números por cédula
        const telefonosPorCedula = {};
        result.rows.forEach(row => {
            if (!telefonosPorCedula[row.cedula_persona]) {
                telefonosPorCedula[row.cedula_persona] = [];
            }
            telefonosPorCedula[row.cedula_persona].push(row.numero);
        });

        res.json(telefonosPorCedula);
    } catch (err) {
        console.error('Error al obtener los teléfonos:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Función para crear un nuevo registro de teléfono.
 * Esta función es opcional, ya que el upsertGeneral ya maneja la creación de teléfonos.
 */
const createTelefono = async (req, res) => {
    const { rol: rol_usuario, id: id_usuario } = req.user;
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para crear registros.' });
    }
    
    const { cedula_persona, numero, tipo } = req.body;
    
    try {
        const insertQuery = `
            INSERT INTO telefonos (cedula_persona, numero, tipo, id_usuario)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [cedula_persona, numero, tipo || 'Principal', id_usuario]);
        
        // No refrescamos la vista materializada aquí. El cron job se encargará de esto.
        
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Error al insertar el teléfono:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe un teléfono con ese número para esa persona.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};


module.exports = {
    getTelefonosByCedulas,
    createTelefono,
};