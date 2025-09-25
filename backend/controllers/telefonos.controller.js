// src/controllers/telefonos.controller.js

const { pool } = require('../db/db');
const getTelefonosByCedulas = async (req, res) => {
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

const createTelefono = async (req, res) => {

    const { id: id_usuario } = req.user;
    
    const { cedula_persona, numero, tipo } = req.body;
    
    if (!cedula_persona || !numero) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (cedula_persona, numero).' });
    }

    try {
        const insertQuery = `
            INSERT INTO telefonos (cedula_persona, numero, tipo, created_by)
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

const updateTelefono = async (req, res) => {
    const { id } = req.params; 
    const { numero, tipo } = req.body;
    
    if (!numero && !tipo) {
        return res.status(400).json({ error: 'Debe proporcionar el número o el tipo para actualizar.' });
    }
    
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

    values.push(id); 

    try {
        const updateQuery = `
            UPDATE telefonos SET ${updates.join(', ')}, updated_at = NOW()
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

        res.status(204).send(); 
    } catch (err) {
        console.error('Error al eliminar el teléfono:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};


module.exports = {
    getTelefonosByCedulas,
    createTelefono,
    updateTelefono, 
    deleteTelefono,
};