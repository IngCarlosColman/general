const { pool } = require('../db/db');

// ===================================================================
// UTILITY: Get the active subscription for a given user (admin of the plan)
// ===================================================================
async function getActiveSubscriptionDetails(userId, client) {
    const query = `
        SELECT 
            us.id_suscripcion, 
            p.max_cuentas,
            COUNT(e.id_registro) AS cuentas_usadas
        FROM 
            usuarios_suscripciones us
        JOIN 
            planes p ON us.id_plan = p.id_plan
        LEFT JOIN
            suscripcion_cuentas_gestion e ON us.id_suscripcion = e.id_suscripcion AND e.estado_invitacion = 'ACEPTADA'
        WHERE 
            us.id_usuario_principal = $1 AND us.estado = 'ACTIVO'
        GROUP BY 
            us.id_suscripcion, p.max_cuentas;
    `;
    const result = await client.query(query, [userId]);
    return result.rows[0];
}


// ===================================================================
// 1. OBTENER ESTADO DE CUENTAS ASIGNADAS
// ===================================================================
// Muestra al editor cuántas de sus licencias están usadas y cuáles están libres.
const getManagementStatus = async (req, res) => {
    const userId = req.user.id; // ID del editor (admin del plan)
    const client = await pool.connect();
    
    try {
        // 1. Obtener detalles de la suscripción ACTIVA
        const subscriptionDetails = await getActiveSubscriptionDetails(userId, client);

        if (!subscriptionDetails) {
            return res.status(403).json({ 
                error: 'No hay una suscripción ACTIVA para gestionar cuentas.' 
            });
        }
        
        const { id_suscripcion, max_cuentas, cuentas_usadas } = subscriptionDetails;
        const cuentas_disponibles = max_cuentas - parseInt(cuentas_usadas);

        // 2. Obtener la lista de cuentas gestionadas (pendientes o aceptadas)
        const managedAccountsQuery = `
            SELECT
                e.id_registro,
                e.email_invitado,
                e.nombre_completo,
                e.estado_invitacion,
                u.first_name,
                u.last_name
            FROM
                suscripcion_cuentas_gestion e
            LEFT JOIN 
                users u ON e.id_usuario_secundario = u.id
            WHERE
                e.id_suscripcion = $1
            ORDER BY
                e.created_at ASC;
        `;
        const accountsResult = await client.query(managedAccountsQuery, [id_suscripcion]);
        
        res.json({
            max_cuentas: parseInt(max_cuentas),
            cuentas_usadas: parseInt(cuentas_usadas),
            cuentas_disponibles: cuentas_disponibles,
            cuentas_gestionadas: accountsResult.rows
        });

    } catch (err) {
        console.error('Error al obtener el estado de la gestión de cuentas:', err);
        res.status(500).json({ error: 'Error del servidor al obtener el estado de cuentas.' });
    } finally {
        client.release();
    }
};

// ===================================================================
// 2. CREAR UNA INVITACIÓN (ASIGNAR LICENCIA)
// ===================================================================
const createInvitation = async (req, res) => {
    const userId = req.user.id; // ID del editor (admin del plan)
    const { email_invitado, nombre_completo } = req.body;
    
    if (!email_invitado || !nombre_completo) {
        return res.status(400).json({ error: 'El email del invitado y el nombre son obligatorios.' });
    }
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Verificar suscripción ACTIVA y límite de cuentas
        const subscriptionDetails = await getActiveSubscriptionDetails(userId, client);

        if (!subscriptionDetails) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Debe tener una suscripción ACTIVA para invitar.' });
        }
        
        const { id_suscripcion, max_cuentas, cuentas_usadas } = subscriptionDetails;
        const cuentas_disponibles = max_cuentas - parseInt(cuentas_usadas);

        if (cuentas_disponibles <= 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({ 
                error: 'Ha excedido el límite de cuentas asignables (' + max_cuentas + ').',
                max_cuentas, 
                cuentas_usadas 
            });
        }
        
        // 2. Crear el registro de la invitación
        const insertQuery = `
            INSERT INTO suscripcion_cuentas_gestion 
                (id_suscripcion, created_by, email_invitado, nombre_completo, estado_invitacion)
            VALUES 
                ($1, $2, $3, $4, 'PENDIENTE_INVITACION')
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [
            id_suscripcion,
            userId,
            email_invitado.toLowerCase(),
            nombre_completo
        ]);

        await client.query('COMMIT');
        
        // En una aplicación real, aquí se enviaría un correo electrónico
        console.log(`[LOG MULTI-CUENTA] Invitación creada para ${email_invitado} bajo suscripción ${id_suscripcion}.`);
        
        res.status(201).json({ 
            message: 'Invitación creada con éxito. El usuario debe registrarse/loguearse con este email.',
            invitacion: result.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear la invitación:', err);
        if (err.code === '23505') {
             return res.status(409).json({ error: 'Ya existe una invitación pendiente o activa con este email.', details: err.detail });
        }
        res.status(500).json({ error: 'Error del servidor al crear la invitación.', details: err.message });
    } finally {
        client.release();
    }
};

// ===================================================================
// 3. ACEPTAR INVITACIÓN (Cuando el usuario secundario se registra/loguea)
// ===================================================================
// Esto se llamaría desde la ruta de Login/Registro del sistema.
// Si un usuario se loguea/registra con un email que está en estado 'PENDIENTE_INVITACION',
// esta función debe ser llamada.
const acceptInvitation = async (req, res) => {
    const invitedEmail = req.user.email; // Email del usuario que se acaba de autenticar
    const invitedUserId = req.user.id;   // ID del usuario que se acaba de autenticar

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Buscar la invitación pendiente por el email del usuario
        const invitationQuery = `
            SELECT 
                e.id_registro, 
                us.id_usuario_principal, 
                e.estado_invitacion
            FROM 
                suscripcion_cuentas_gestion e
            JOIN
                usuarios_suscripciones us ON e.id_suscripcion = us.id_suscripcion
            WHERE 
                e.email_invitado = $1 AND e.estado_invitacion = 'PENDIENTE_INVITACION'
            FOR UPDATE; -- Bloquea la fila de la invitación
        `;
        const invitationResult = await client.query(invitationQuery, [invitedEmail.toLowerCase()]);

        if (invitationResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No se encontró una invitación pendiente para este correo.' });
        }
        
        const invitation = invitationResult.rows[0];

        // 2. Actualizar la invitación a ACEPTADA y vincular con el ID del usuario
        const updateInvitationQuery = `
            UPDATE suscripcion_cuentas_gestion
            SET 
                estado_invitacion = 'ACEPTADA',
                id_usuario_secundario = $1,
                updated_at = NOW()
            WHERE 
                id_registro = $2
            RETURNING *;
        `;
        await client.query(updateInvitationQuery, [invitedUserId, invitation.id_registro]);

        // 3. Actualizar el rol del usuario invitado a 'editor'
        const updateUserRoleQuery = `
            UPDATE users
            SET 
                rol = 'editor', 
                updated_at = NOW()
            WHERE 
                id = $1
            RETURNING rol;
        `;
        const userUpdateResult = await client.query(updateUserRoleQuery, [invitedUserId]);

        await client.query('COMMIT');
        
        console.log(`[LOG MULTI-CUENTA] Usuario ID ${invitedUserId} aceptó invitación. Rol: ${userUpdateResult.rows[0].rol}.`);

        res.status(200).json({ 
            message: 'Invitación aceptada con éxito. Su cuenta ha sido habilitada como editor.',
            rol_actualizado: userUpdateResult.rows[0].rol,
            invitacion_id: invitation.id_registro
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al aceptar la invitación:', err);
        res.status(500).json({ error: 'Error del servidor al aceptar la invitación.', details: err.message });
    } finally {
        client.release();
    }
};

// ===================================================================
// 4. REVOCAR LICENCIA (Por el admin del plan)
// ===================================================================
const revokeLicense = async (req, res) => {
    const userId = req.user.id; // ID del editor (admin del plan)
    const { id_registro } = req.params; // ID de la fila en suscripcion_cuentas_gestion
    
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        // 1. Obtener registro y verificar que el solicitante sea el creador (created_by)
        const recordQuery = `
            SELECT 
                id_usuario_secundario 
            FROM 
                suscripcion_cuentas_gestion 
            WHERE 
                id_registro = $1 AND created_by = $2 AND estado_invitacion = 'ACEPTADA'
            FOR UPDATE;
        `;
        const recordResult = await client.query(recordQuery, [id_registro, userId]);

        if (recordResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                error: 'Registro no encontrado o no autorizado para revocar, o la licencia no está ACTIVA.' 
            });
        }
        
        const { id_usuario_secundario } = recordResult.rows[0];

        // 2. Actualizar la invitación a CANCELADA y desvincular el usuario secundario
        const updateInvitationQuery = `
            UPDATE suscripcion_cuentas_gestion
            SET 
                estado_invitacion = 'EXPIRADA', -- Usamos EXPIRADA para indicar que ya no se usa
                id_usuario_secundario = NULL,
                updated_at = NOW()
            WHERE 
                id_registro = $1
            RETURNING *;
        `;
        await client.query(updateInvitationQuery, [id_registro]);

        // 3. Revertir el rol del usuario secundario a 'visualizador' o 'PENDIENTE_PAGO'
        // El rol 'visualizador' puede ser más apropiado si desea que el usuario mantenga el acceso, pero con límites.
        const updateUserRoleQuery = `
            UPDATE users
            SET 
                rol = 'visualizador', 
                updated_at = NOW()
            WHERE 
                id = $1
            RETURNING rol;
        `;
        const userUpdateResult = await client.query(updateUserRoleQuery, [id_usuario_secundario]);

        await client.query('COMMIT');
        
        console.log(`[LOG MULTI-CUENTA] Licencia revocada. Usuario ${id_usuario_secundario} regresó a rol '${userUpdateResult.rows[0].rol}'.`);

        res.status(200).json({ 
            message: 'Licencia revocada con éxito. La cuenta ha sido liberada para una nueva invitación.',
            usuario_afectado: id_usuario_secundario,
            nuevo_rol: userUpdateResult.rows[0].rol
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al revocar la licencia:', err);
        res.status(500).json({ error: 'Error del servidor al revocar la licencia.', details: err.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getManagementStatus,
    createInvitation,
    acceptInvitation,
    revokeLicense,
};
