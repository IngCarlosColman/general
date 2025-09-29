const { pool } = require('../db/db');

// ===================================================================
// UTILITY: Calculates the expiration date based on plan recurrence
// ===================================================================
function calculateExpirationDate(recurrence, activationDate) {
    const date = new Date(activationDate);
    const dateCopy = new Date(date.getTime());

    switch (recurrence.toLowerCase()) {
        case 'mensual':
            dateCopy.setMonth(date.getMonth() + 1);
            break;
        case 'semestral':
            dateCopy.setMonth(date.getMonth() + 6);
            break;
        case 'anual':
            dateCopy.setFullYear(date.getFullYear() + 1);
            break;
        default:
            // Should not happen if data is checked
            throw new Error("Recurrencia de plan inválida.");
    }
    // Return date in YYYY-MM-DD format for PostgreSQL DATE column
    return dateCopy.toISOString().split('T')[0];
}


// ===================================================================
// 1. OBTENER PAGOS PENDIENTES DE VERIFICACIÓN (O LISTA DE SUSCRIPCIONES)
// ===================================================================
const getPendingSubscriptions = async (req, res) => {
    try {
        // Asumiendo que esta función lista suscripciones ya registradas que necesitan ser
        // revisadas/activadas por el administrador, que puede ser la entidad corporativa.
        const query = `
            SELECT 
                us.id_suscripcion, 
                us.monto_transferido, 
                us.fecha_pago_reportada, 
                us.comprobante_adjunto, 
                us.estado_suscripcion, 
                us.fecha_vencimiento,
                u.username AS usuario_principal,
                u.email AS email_principal
            FROM suscripciones us
            JOIN users u ON us.id_usuario_principal = u.id
            WHERE us.estado_suscripcion = 'PENDIENTE_ACTIVACION'
            ORDER BY us.fecha_pago_reportada ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error al obtener suscripciones pendientes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ===================================================================
// 2. ADMINISTRACIÓN: Activar Suscripción Corporativa/Grupal
// ===================================================================
const activateSubscription = async (req, res) => {
    const client = await pool.connect();
    const { id: id_suscripcion } = req.params;
    const adminId = req.user.id; // Asume que el admin está autenticado
    const activationDate = new Date().toISOString().split('T')[0]; // Fecha de activación de hoy

    try {
        await client.query('BEGIN');

        // 1. Obtener detalles de la suscripción
        const detailQuery = `
            SELECT id_usuario_principal, recurrencia_plan
            FROM suscripciones
            WHERE id_suscripcion = $1 AND estado_suscripcion = 'PENDIENTE_ACTIVACION'
            FOR UPDATE;
        `;
        const detailResult = await client.query(detailQuery, [id_suscripcion]);

        if (detailResult.rows.length === 0) {
            await client.query('COMMIT');
            return res.status(404).json({ error: 'Suscripción no encontrada o ya activada.' });
        }

        const { id_usuario_principal, recurrencia_plan } = detailResult.rows[0];

        // 2. Calcular fecha de vencimiento
        const expirationDate = calculateExpirationDate(recurrencia_plan, activationDate);

        // 3. Actualizar la suscripción a ACTIVA
        const updateSubscriptionQuery = `
            UPDATE suscripciones
            SET 
                estado_suscripcion = 'ACTIVA', 
                fecha_activacion = $1, 
                fecha_vencimiento = $2,
                fecha_ultima_gestion = NOW(),
                gestionado_por = $3
            WHERE 
                id_suscripcion = $4
            RETURNING *;
        `;
        await client.query(updateSubscriptionQuery, [
            activationDate,
            expirationDate,
            adminId,
            id_suscripcion
        ]);

        // 4. Actualizar el rol del usuario principal a 'editor'
        // Esto solo aplica al usuario que es el "dueño" de la suscripción corporativa.
        const updateUserRoleQuery = `
            UPDATE users
            SET 
                rol = 'editor', 
                suscripcion_vence = $1, -- Usamos la misma fecha de vencimiento
                updated_at = NOW()
            WHERE 
                id = $2
            RETURNING id, rol;
        `;
        const userUpdateResult = await client.query(updateUserRoleQuery, [expirationDate, id_usuario_principal]);

        await client.query('COMMIT');
        
        console.log(`[LOG ADMIN] Suscripción ID ${id_suscripcion} activada. Usuario ${userUpdateResult.rows[0].id} ahora es 'editor'.`);

        res.status(200).json({ 
            message: 'Suscripción activada con éxito. Usuario habilitado como editor.',
            suscripcion_id: id_suscripcion,
            rol_actualizado: userUpdateResult.rows[0].rol,
            fecha_vencimiento: expirationDate
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al activar la suscripción:', err);
        res.status(500).json({ error: 'Error del servidor al procesar la activación.', details: err.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getPendingSubscriptions,
    activateSubscription,
    // La utilidad calculateExpirationDate no se exporta si solo se usa internamente.
};
