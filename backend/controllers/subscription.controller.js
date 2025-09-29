const { pool } = require('../db/db');
const fs = require('fs/promises');
const path = require('path');

// ==========================================================
// Funciones Internas de Lógica de Negocio
// ==========================================================

/**
 * 🔑 Determina la duración del plan basado en el ID del plan detallado.
 * @param {string} planOptionId - ID de la opción del plan (ej: 'agente_mensual', 'mb_anual_5').
 * @returns {number} daysToAdd - Número de días a añadir a la fecha actual.
 */
const getPlanDurationDays = (planOptionId) => {
    // Se mapean los días a la nueva estructura de planes:
    switch (planOptionId) {
        // --- PLAN AGENTES (Individuales) ---
        case 'agente_mensual':
            return 30; // 1 mes
        case 'agente_semestral':
            return 182; // 6 meses (aprox.)
        case 'agente_anual':
            return 365; // 1 año

        // --- PLANES MINI BROKER / INMOBILIARIAS (Todos son anuales) ---
        case 'mb_anual_5':
        case 'mb_anual_10':
        case 'mb_anual_15':
        case 'inm_anual_20':
        case 'inm_anual_30':
        case 'inm_anual_50':
            return 365; // 1 año
            
        default:
            console.warn(`[PlanDuration] Plan desconocido: ${planOptionId}. Usando 30 días por defecto.`);
            return 30; // Por defecto 1 mes
    }
};

/**
 * 🔑 Actualiza el rol del usuario a 'editor' y establece la fecha de expiración.
 * @param {object} client - Cliente de DB (usar dentro de una transacción).
 * @param {number} userId - ID del usuario a actualizar.
 * @param {string} planId - ID de la opción del plan (ej: 'agente_anual').
 * @returns {Date} - Fecha de expiración calculada.
 */
const updateUserRoleAndExpiration = async (client, userId, planId) => {
    // Lógica para determinar la duración del plan
    const daysToAdd = getPlanDurationDays(planId);

    // Calcula la fecha de expiración
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd);

    // Actualizamos el rol a 'editor' (o el rol final que corresponda)
    const updateQuery = `
        UPDATE users 
        SET rol = 'editor', 
            suscripcion_vence = $1, 
            updated_at = NOW()
        WHERE id = $2
        RETURNING rol, id, suscripcion_vence;
    `;
    // La fecha en formato ISO (YYYY-MM-DD) es ideal para PostgreSQL DATE
    const expirationDateStr = expirationDate.toISOString().split('T')[0];
    await client.query(updateQuery, [expirationDateStr, userId]);

    return expirationDate;
};


// ==========================================================
// 1. USUARIO: Subir Comprobante de Pago
// ==========================================================

const uploadPaymentProof = async (req, res) => {
    const client = await pool.connect();
    const userId = req.user.id; // Asumimos que el usuario está autenticado
    const { plan_id } = req.body; // El planId ahora es el option_id (ej: 'agente_mensual')
    const comprobanteFile = req.file; // Archivo subido (via Multer en el middleware)

    if (!comprobanteFile) {
        return res.status(400).json({ error: 'Comprobante de pago es obligatorio.' });
    }
    if (!plan_id) {
        // En una app real, verificaríamos que el plan_id sea uno de los válidos.
        return res.status(400).json({ error: 'Debe seleccionar un plan de suscripción.' });
    }

    try {
        await client.query('BEGIN');

        // 1. Guardar la solicitud en la tabla 'solicitudes_activacion'
        const insertQuery = `
            INSERT INTO solicitudes_activacion 
            (id_usuario, plan_id, comprobante_path, estado, fecha_solicitud)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *;
        `;
        // Guardamos la ruta relativa al servidor, Multer debería encargarse del path
        const comprobantePath = comprobanteFile.path; 

        await client.query(insertQuery, [
            userId, 
            plan_id, 
            comprobantePath, 
            'PENDIENTE_REVISION' // Estado inicial de la solicitud
        ]);

        // 2. Actualizar el rol del usuario a 'PENDIENTE_REVISION' para bloquear la UI
        const updateRoleQuery = `
            UPDATE users 
            SET rol = 'PENDIENTE_REVISION', 
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, username, rol, email, first_name, last_name, telefono, direccion;
        `;
        const updateResult = await client.query(updateRoleQuery, [userId]);
        const updatedUser = updateResult.rows[0];

        await client.query('COMMIT'); // Confirma la transacción

        res.status(200).json({
            message: 'Comprobante recibido con éxito. Su cuenta está PENDIENTE DE REVISIÓN.',
            user: updatedUser // Devolvemos el objeto de usuario actualizado para Pinia Store
        });

    } catch (err) {
        await client.query('ROLLBACK'); // Revierte si algo falla
        console.error('[🔥 FAIL] Error al subir el comprobante:', err);
        
        // 3. Limpieza de archivo en caso de fallo en DB
        try {
            if (comprobanteFile && comprobanteFile.path) {
                // path.resolve() es crucial si el path devuelto por Multer es relativo
                await fs.unlink(path.resolve(comprobanteFile.path)); 
            }
        } catch (unlinkErr) {
            console.error('Error al intentar eliminar el archivo tras fallo de DB:', unlinkErr);
        }

        res.status(500).json({ error: 'Error interno del servidor al registrar la solicitud.' });
    } finally {
        client.release();
    }
};

// ==========================================================
// 2. ADMIN: Obtener Solicitudes Pendientes
// ==========================================================

const getPendingRequests = async (req, res) => {
    try {
        const query = `
            SELECT 
                sa.id, 
                sa.plan_id, 
                sa.comprobante_path, 
                sa.fecha_solicitud,
                sa.estado,
                u.username,
                u.email,
                u.first_name,
                u.last_name
            FROM solicitudes_activacion sa
            JOIN users u ON sa.id_usuario = u.id
            WHERE sa.estado = 'PENDIENTE_REVISION'
            ORDER BY sa.fecha_solicitud ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('[FAIL] Error al obtener solicitudes pendientes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ==========================================================
// 3. ADMIN: Manejar Acción (Aprobar/Rechazar)
// ==========================================================

const handleRequestAction = async (req, res) => {
    const client = await pool.connect();
    const { id: solicitudId } = req.params;
    const { action } = req.body; // 'APPROVE' o 'REJECT'
    const adminId = req.user.id; // ID del administrador que realiza la acción
    
    if (!['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Acción inválida.' });
    }

    try {
        await client.query('BEGIN');

        // 1. Obtener los detalles de la solicitud antes de cambiar el estado
        const detailQuery = `
            SELECT id_usuario, plan_id, comprobante_path, estado 
            FROM solicitudes_activacion 
            WHERE id = $1 AND estado = 'PENDIENTE_REVISION'
            FOR UPDATE; -- Bloquea la fila
        `;
        const detailResult = await client.query(detailQuery, [solicitudId]);

        if (detailResult.rows.length === 0) {
            await client.query('COMMIT'); // Libera el bloqueo si no se encuentra/ya fue procesada
            return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada.' });
        }
        
        const { id_usuario, plan_id, comprobante_path } = detailResult.rows[0];

        let newStatus;
        let responseMessage;
        let expirationDate = null;
        let updatedUser = null;

        if (action === 'APPROVE') {
            newStatus = 'APROBADA';
            responseMessage = `Solicitud ${solicitudId} aprobada. Usuario activado.`;
            
            // 2. Actualizar el rol del usuario y la fecha de expiración
            expirationDate = await updateUserRoleAndExpiration(client, id_usuario, plan_id);
            
            // 3. Obtener el usuario actualizado para el frontend
            const userResult = await client.query(`
                SELECT id, username, rol, email, first_name, last_name, telefono, direccion, suscripcion_vence 
                FROM users 
                WHERE id = $1;
            `, [id_usuario]);
            updatedUser = userResult.rows[0];
            
        } else if (action === 'REJECT') {
            newStatus = 'RECHAZADA';
            responseMessage = `Solicitud ${solicitudId} rechazada.`;
            
            // Revertir el rol del usuario a 'visualizador' (o el rol que debe tener sin suscripción)
            const updateRoleQuery = `
                UPDATE users 
                SET rol = 'visualizador', 
                    updated_at = NOW(),
                    suscripcion_vence = NULL
                WHERE id = $1
                RETURNING id, username, rol, email, first_name, last_name, telefono, direccion;
            `;
            const updateResult = await client.query(updateRoleQuery, [id_usuario]);
            updatedUser = updateResult.rows[0];

            // Opcional: Eliminar el archivo comprobante
            if (comprobante_path) {
                try {
                    await fs.unlink(path.resolve(comprobante_path));
                    console.log(`Archivo ${comprobante_path} eliminado.`);
                } catch (unlinkErr) {
                    console.warn(`No se pudo eliminar el archivo ${comprobante_path}.`, unlinkErr);
                }
            }
        }

        // 4. Actualizar la solicitud
        const updateRequestQuery = `
            UPDATE solicitudes_activacion 
            SET estado = $1, 
                fecha_revision = NOW(), 
                revisado_por = $2
            WHERE id = $3
            RETURNING *;
        `;
        const updatedRequestResult = await client.query(updateRequestQuery, [newStatus, adminId, solicitudId]);


        await client.query('COMMIT'); // Confirma la transacción

        const responseData = {
            message: responseMessage,
            solicitud: updatedRequestResult.rows[0]
        };
        if (expirationDate) {
            responseData.message += ` Rol actualizado a 'editor' hasta el ${expirationDate.toISOString().split('T')[0]}.`;
        }
        if (updatedUser) {
            responseData.user = updatedUser;
        }

        res.status(200).json(responseData);

    } catch (err) {
        await client.query('ROLLBACK'); // Revierte si algo falla
        console.error(`[🔥 FAIL] Error al manejar la acción ${action} para solicitud ${solicitudId}:`, err);
        res.status(500).json({ error: 'Error interno del servidor al procesar la acción.' });
    } finally {
        client.release();
    }
};

module.exports = {
    uploadPaymentProof,
    getPendingRequests,
    handleRequestAction,
};
