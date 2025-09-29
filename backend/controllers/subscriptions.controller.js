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
// 1. OBTENER PAGOS PENDIENTES DE VERIFICACIÓN
// ===================================================================
const getPendingSubscriptions = async (req, res) => {
    try {
        const query = `
            SELECT 
                us.id_suscripcion, 
                us.monto_transferido, 
                us.fecha_pago_reportada, 
                us.comprobante_url,
                us.created_at AS fecha_solicitud,
                p.nombre_plan,
                p.recurrencia,
                p.max_cuentas,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.telefono
            FROM 
                usuarios_suscripciones us
            JOIN 
                users u ON us.id_usuario_principal = u.id
            JOIN
                planes p ON us.id_plan = p.id_plan
            WHERE 
                us.estado = 'PENDIENTE_VERIFICACION'
            ORDER BY 
                us.created_at ASC;
        `;
        const result = await pool.query(query);
        
        console.log(`[LOG ADMIN] ${result.rowCount} suscripciones pendientes encontradas.`);
        res.json(result.rows);

    } catch (err) {
        console.error('Error al obtener suscripciones pendientes:', err);
        res.status(500).json({ error: 'Error del servidor al consultar pagos pendientes.' });
    }
};

// ===================================================================
// 2. ACTIVAR SUSCRIPCIÓN (APROBAR PAGO)
// Solo para usuarios con rol 'administrador'
// ===================================================================
const activateSubscription = async (req, res) => {
    // El ID del administrador proviene del token JWT (asumido en el middleware de autenticación)
    const adminId = req.user.id; // Asume que 'req.user' contiene los datos del usuario autenticado
    const { id_suscripcion } = req.params; 

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Obtener detalles de la suscripción y el plan
        const detailQuery = `
            SELECT 
                us.id_usuario_principal, 
                p.recurrencia
            FROM 
                usuarios_suscripciones us
            JOIN 
                planes p ON us.id_plan = p.id_plan
            WHERE 
                us.id_suscripcion = $1 AND us.estado = 'PENDIENTE_VERIFICACION'
            FOR UPDATE; -- Bloquea la fila para evitar doble procesamiento
        `;
        const detailResult = await client.query(detailQuery, [id_suscripcion]);

        if (detailResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Suscripción pendiente no encontrada o ya procesada.' });
        }

        const { id_usuario_principal, recurrencia } = detailResult.rows[0];

        // 2. Calcular la fecha de vencimiento
        const activationDate = new Date();
        const expirationDate = calculateExpirationDate(recurrencia, activationDate);
        
        // 3. Actualizar la tabla usuarios_suscripciones
        const updateSubscriptionQuery = `
            UPDATE usuarios_suscripciones
            SET 
                estado = 'ACTIVO',
                fecha_habilitacion = $1,
                fecha_vencimiento = $2,
                id_admin_verificador = $3,
                updated_at = NOW()
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
        const updateUserRoleQuery = `
            UPDATE users
            SET 
                rol = 'editor', 
                updated_at = NOW()
            WHERE 
                id = $1
            RETURNING id, rol;
        `;
        const userUpdateResult = await client.query(updateUserRoleQuery, [id_usuario_principal]);

        await client.query('COMMIT');
        
        console.log(`[LOG ADMIN] Suscripción ID ${id_suscripcion} activada. Usuario ${userUpdateResult.rows[0].id} ahora es 'editor'.`);

        res.status(200).json({ 
            message: 'Suscripción activada con éxito. Usuario habilitado como editor.',
            suscripcion: detailResult.rows[0],
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
};
