// controllers/userTelefonos.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene todos los teléfonos personales de un contacto específico.
 */
const getUserTelefonosData = async (req, res) => {
    try {
        const { contact_cedula } = req.params;
        const { id: id_usuario } = req.user;
        
        const query = `
            SELECT id, numero, tipo
            FROM user_telefonos
            WHERE user_id = $1 AND contact_cedula = $2
            ORDER BY id ASC;
        `;
        const result = await pool.query(query, [id_usuario, contact_cedula]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener los teléfonos personales:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Obtiene un teléfono personal específico por su ID.
 */
const getTelefonoById = async (req, res) => {
    const { id } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const query = `
            SELECT id, numero, tipo
            FROM user_telefonos
            WHERE id = $1 AND user_id = $2;
        `;
        const result = await pool.query(query, [id, id_usuario]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Teléfono personal no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener teléfono por ID:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Agrega uno o varios teléfonos personales a un contacto.
 */
const createUserTelefonos = async (req, res) => {
    const { contact_cedula, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    
    if (!Array.isArray(telefonos) || telefonos.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de teléfonos válido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Verificar si el contacto existe en la agenda del usuario antes de crear los teléfonos
        const agendaCheckQuery = 'SELECT 1 FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2';
        const agendaResult = await client.query(agendaCheckQuery, [id_usuario, contact_cedula]);
        if (agendaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'El contacto no está en tu agenda, no se pueden agregar teléfonos personales.' });
        }

        const insertQuery = `
            INSERT INTO user_telefonos (user_id, contact_cedula, numero, tipo)
            VALUES ($1, $2, $3, $4)
            RETURNING id, numero, tipo;
        `;

        const insertedTelefonos = [];
        for (const tel of telefonos) {
            const { numero, tipo } = tel;
            const result = await client.query(insertQuery, [id_usuario, contact_cedula, numero, tipo]);
            insertedTelefonos.push(result.rows[0]);
        }
        
        await client.query('COMMIT');
        res.status(201).json(insertedTelefonos);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al agregar teléfonos personales:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * Actualiza un teléfono personal específico por su ID.
 */
const updateUserTelefono = async (req, res) => {
    const { id } = req.params;
    const { numero, tipo } = req.body;
    const { id: id_usuario } = req.user;
    try {
        const updateQuery = `
            UPDATE user_telefonos
            SET numero = $1, tipo = $2
            WHERE id = $3 AND user_id = $4
            RETURNING id, numero, tipo;
        `;
        const result = await pool.query(updateQuery, [numero, tipo, id, id_usuario]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Teléfono personal no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al actualizar el teléfono personal:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Elimina un teléfono personal específico por su ID.
 */
const deleteUserTelefono = async (req, res) => {
    const { id } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const deleteQuery = `
            DELETE FROM user_telefonos
            WHERE id = $1 AND user_id = $2
            RETURNING id, numero, tipo;
        `;
        const result = await pool.query(deleteQuery, [id, id_usuario]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Teléfono personal no encontrado' });
        }
        res.json({ deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar el teléfono personal:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getUserTelefonosData,
    getTelefonoById,
    createUserTelefonos,
    updateUserTelefono,
    deleteUserTelefono,
};