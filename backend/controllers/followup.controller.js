const { pool } = require('../db/db');

/**
 * GET - Obtener todos los eventos de seguimiento para el usuario actual.
 */
const getAllEvents = async (req, res) => {
    const { id: id_usuario, rol: rol_usuario } = req.user;

    // Puedes dejar la validación de rol aquí, aunque el middleware también lo hace
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para ver esta información.' });
    }

    try {
        const result = await pool.query('SELECT id, user_id, event_key, title, description, date, color, icon FROM follow_up_events WHERE user_id = $1 ORDER BY date ASC', [id_usuario]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener los eventos de seguimiento:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * POST - Crear un nuevo evento de seguimiento.
 */
const createEvent = async (req, res) => {
    const { id: id_usuario, rol: rol_usuario } = req.user;
    if (rol_usuario !== 'administrador' && rol_usuario !== 'editor') {
        return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para crear registros.' });
    }

    // CORRECCIÓN: Destructuramos `id` del cuerpo de la solicitud para usarlo como `event_key`
    const { id, title, description, date, color, icon } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicia la transacción

        const result = await client.query(
            `INSERT INTO follow_up_events (user_id, event_key, title, description, date, color, icon)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [id_usuario, id, title, description, date, color, icon]
        );
        
        await client.query('COMMIT'); // Confirma la transacción
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK'); // Deshace la transacción en caso de error
        console.error('Error al crear el evento de seguimiento:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release(); // Libera el cliente del pool
    }
};

/**
 * PUT - Actualizar un evento de seguimiento.
 */
const updateEvent = async (req, res) => {
    const { id: event_id_str } = req.params;
    const { id: id_usuario } = req.user;
    const { title, description, date, color, icon } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicia la transacción

        const result = await client.query(
            `UPDATE follow_up_events
             SET title = $1, description = $2, date = $3, color = $4, icon = $5, updated_at = CURRENT_TIMESTAMP
             WHERE event_key = $6 AND user_id = $7
             RETURNING *`,
            [title, description, date, color, icon, event_id_str, id_usuario]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Evento no encontrado o no tienes permiso para actualizarlo.' });
        }

        await client.query('COMMIT'); // Confirma la transacción
        res.status(200).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el evento de seguimiento:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

/**
 * DELETE - Eliminar un evento de seguimiento.
 */
const deleteEvent = async (req, res) => {
    const { id: event_id_str } = req.params;
    const { id: id_usuario } = req.user;

    // Ya no es necesario el parseInt. Ahora buscamos por el ID de cadena
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const result = await client.query(
            `DELETE FROM follow_up_events
             WHERE event_key = $1 AND user_id = $2
             RETURNING event_key`,
            [event_id_str, id_usuario]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Evento no encontrado o no tienes permiso para eliminarlo.' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Evento eliminado exitosamente', deletedEventKey: event_id_str });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el evento de seguimiento:', err);
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

module.exports = {
    getAllEvents,
    createEvent,
    updateEvent,
    deleteEvent
};