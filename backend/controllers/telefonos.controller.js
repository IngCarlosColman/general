// src/controllers/telefonos.controller.js

const { pool } = require('../db/db');

/**
 * Obtiene los números de teléfono asociados a una lista de cédulas.
 */
const getTelefonosByCedulas = async (req, res) => {
    // La verificación de rol ya es redundante si se usa checkRoles en el router, 
    // pero la mantendremos como defensa en profundidad.
    const { rol: rol_usuario } = req.user;
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const { cedulas } = req.query;

    if (!cedulas) {
        return res.json({});
    }

    const cedulaArray = cedulas.split(',').filter(Boolean);

    try {
        const query = `
            SELECT id, cedula_persona, numero, tipo FROM telefonos 
            WHERE cedula_persona = ANY($1::text[])
        `;
        const result = await pool.query(query, [cedulaArray]);

        const telefonosPorCedula = {};
        result.rows.forEach(row => {
            if (!telefonosPorCedula[row.cedula_persona]) {
                telefonosPorCedula[row.cedula_persona] = [];
            }
            // Incluimos el ID para futuras operaciones de modificación/eliminación
            telefonosPorCedula[row.cedula_persona].push({
                id: row.id,
                numero: row.numero,
                tipo: row.tipo,
            });
        });

        res.json(telefonosPorCedula);
    } catch (err) {
        console.error('Error al obtener los teléfonos:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Función para crear un nuevo registro de teléfono.
 * (Restricto a Administradores para uso directo)
 */
const createTelefono = async (req, res) => {
    const { rol: rol_usuario, id: id_usuario } = req.user;
    
    if (rol_usuario !== 'administrador') {
        return res.status(403).json({ 
            error: 'Acceso denegado. Solo los administradores pueden crear teléfonos directamente.' 
        });
    }
    
    const { cedula_persona, numero, tipo } = req.body;
    
    if (!cedula_persona || !numero) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (cedula_persona, numero).' });
    }

    try {
        const insertQuery = `
            INSERT INTO telefonos (cedula_persona, numero, tipo, id_usuario)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [cedula_persona, numero, tipo || 'Principal', id_usuario]);
        
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

// 🚨 FUNCIÓN FALTANTE 1: Actualizar Teléfono
/**
 * Actualiza un número de teléfono. 
 * El middleware canAccessRecord ya verifica que el usuario sea dueño o admin.
 */
const updateTelefono = async (req, res) => {
    // El ID del registro se extrae de la URL
    const { id } = req.params; 
    const { numero, tipo } = req.body;
    
    // Validar al menos un campo para actualizar
    if (!numero && !tipo) {
        return res.status(400).json({ error: 'Debe proporcionar el número o el tipo para actualizar.' });
    }
    
    // Construir la consulta de forma dinámica para evitar errores de sintaxis con valores NULL
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (numero) {
        updates.push(`numero = $${paramIndex++}`);
        values.push(numero);
    }
    if (tipo) {
        updates.push(`tipo = $${paramIndex++}`);
        values.push(tipo);
    }

    // El último valor es el ID del registro que se actualiza
    values.push(id); 

    try {
        const updateQuery = `
            UPDATE telefonos SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Teléfono no encontrado o no autorizado para actualizar.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar el teléfono:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe otro teléfono con ese número para esa persona.' });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

// 🚨 FUNCIÓN FALTANTE 2: Eliminar Teléfono
/**
 * Elimina un número de teléfono por su ID.
 * El middleware canAccessRecord ya verifica que el usuario sea dueño o admin.
 */
const deleteTelefono = async (req, res) => {
    const { id } = req.params;

    try {
        const deleteQuery = `
            DELETE FROM telefonos WHERE id = $1 RETURNING id;
        `;
        const result = await pool.query(deleteQuery, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Teléfono no encontrado o no autorizado para eliminar.' });
        }

        // 204 No Content indica éxito sin cuerpo de respuesta.
        res.status(204).send(); 
    } catch (err) {
        console.error('Error al eliminar el teléfono:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};


module.exports = {
    getTelefonosByCedulas,
    createTelefono,
    // 🚨 Exportaciones Faltantes: ¡Esto soluciona el TypeError!
    updateTelefono, 
    deleteTelefono,
};