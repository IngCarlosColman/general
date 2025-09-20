// controllers/userNombres.controller.js
const { pool } = require('../db/db');

/**
 * Obtiene el nombre personalizado de un contacto específico.
 */
const getUserNombre = async (req, res) => {
    const { contact_cedula } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const query = `
            SELECT nombre_personalizado
            FROM user_nombres
            WHERE user_id = $1 AND contact_cedula = $2;
        `;
        const result = await pool.query(query, [id_usuario, contact_cedula]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nombre personalizado no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener el nombre personalizado:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

/**
 * Crea o actualiza un nombre personalizado para un contacto.
 * Utiliza un upsert (INSERT ON CONFLICT) para simplificar la lógica.
 */
const upsertUserNombre = async (req, res) => {
    const { contact_cedula } = req.params;
    const { nombre_personalizado } = req.body;
    const { id: id_usuario } = req.user;
    try {
        // Verificar si el contacto existe en la agenda del usuario antes de proceder
        const agendaCheckQuery = 'SELECT 1 FROM user_agendas WHERE user_id = $1 AND contact_cedula = $2';
        const agendaResult = await pool.query(agendaCheckQuery, [id_usuario, contact_cedula]);
        if (agendaResult.rowCount === 0) {
            return res.status(404).json({ error: 'El contacto no está en tu agenda, no se puede asignar un nombre personalizado.' });
        }

        const upsertQuery = `
            INSERT INTO user_nombres (user_id, contact_cedula, nombre_personalizado)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, contact_cedula) DO UPDATE SET
                nombre_personalizado = EXCLUDED.nombre_personalizado
            RETURNING *;
        `;
        const result = await pool.query(upsertQuery, [id_usuario, contact_cedula, nombre_personalizado]);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error al guardar el nombre personalizado:', err);
        if (err.code === '23503') {
            res.status(400).json({ error: 'La cédula de contacto no es válida o no está en tu agenda.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    }
};

/**
 * Elimina el nombre personalizado de un contacto.
 */
const deleteUserNombre = async (req, res) => {
    const { contact_cedula } = req.params;
    const { id: id_usuario } = req.user;
    try {
        const deleteQuery = `
            DELETE FROM user_nombres
            WHERE user_id = $1 AND contact_cedula = $2
            RETURNING *;
        `;
        const result = await pool.query(deleteQuery, [id_usuario, contact_cedula]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Nombre personalizado no encontrado' });
        }
        res.json({ deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar el nombre personalizado:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    }
};

module.exports = {
    getUserNombre,
    upsertUserNombre,
    deleteUserNombre
};