const { pool } = require('../db/db');
const fs = require('fs/promises');
const path = require('path');


// ==========================================================
// Funciones Internas de Lógica de Negocio
// ==========================================================

/**
 * @function getPlanDurationDays
 * @description Mapea el ID de un plan a su duración en días.
 * @param {string} planOptionId - ID del plan (e.g., 'agente_mensual').
 * @returns {number} Duración del plan en días.
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
            return 365; // 1 año (la duración es la misma, solo varía el cupo de usuarios/características)
        
        default:
            console.error(`[WARN] Plan ID desconocido: ${planOptionId}`);
            return 30; // Valor por defecto para planes no mapeados
    }
};

/**
 * 🔑 Actualiza el rol del usuario y establece la fecha de expiración si el rol es 'editor'.
 * @param {object} client - Cliente de DB (usar dentro de una transacción).
 * @param {number} userId - ID del usuario a actualizar.
 * @param {string} newRole - Nuevo rol del usuario.
 * @param {string} [planOptionId] - ID del plan (solo necesario si newRole es 'editor').
 * @returns {{updatedUser: object|null, expirationDate: Date|null}} - Usuario actualizado y fecha de expiración.
 */
const updateUserRoleAndExpiration = async (client, userId, newRole, planOptionId = null) => {
    let expirationDate = null;
    let expirationQueryPart = '';

    // Si el rol es 'editor', calculamos la fecha de vencimiento.
    if (newRole === 'editor' && planOptionId) {
        const daysToAdd = getPlanDurationDays(planOptionId);
        expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + daysToAdd);
        
        // El $4 se usa en la consulta SQL para el campo suscripcion_vence
        expirationQueryPart = `, suscripcion_vence = $4`; 
    } else {
        // Si no es 'editor', aseguramos que la fecha de vencimiento sea NULL si la tabla lo requiere,
        // o simplemente omitimos la columna. Aquí omitiremos para simplificar ya que PENDIENTE_PAGO
        // y PENDIENTE_REVISION no necesitan fecha de vencimiento.
    }

    // Consulta que actualiza el rol
    const updateQuery = `
        UPDATE users 
        SET rol = $1, 
            updated_at = NOW()
            ${expirationQueryPart} 
        WHERE id = $2
        RETURNING id, rol, first_name, last_name, email, telefono, direccion, suscripcion_vence;
    `;

    const values = [newRole, userId];
    if (expirationQueryPart) {
        values.push(expirationDate); // Agregamos la fecha de expiración al array de valores para $4
    }

    const result = await client.query(updateQuery, values);
    return {
        updatedUser: result.rows[0] || null,
        expirationDate: expirationDate
    };
};


// ==========================================================
// 1. Subida de Comprobante (Usuario)
// ==========================================================

/**
 * @function uploadPaymentProof
 * @description Inserta una nueva solicitud de activación y actualiza el rol del usuario a 'PENDIENTE_REVISION'.
 * @param {object} req - Objeto de solicitud (debe contener req.user.id, req.body.plan_id, req.file.path).
 * @param {object} res - Objeto de respuesta.
 */
const uploadPaymentProof = async (req, res) => {
    const userId = req.user.id; 
    const { plan_id } = req.body;
    // req.file.path es la ruta relativa del archivo guardado por Multer
    const comprobante_path = req.file ? req.file.path : null; 

    if (!plan_id || !comprobante_path) {
        // Si falta plan_id o el archivo, intentamos limpiar el archivo por si acaso se subió
        if (comprobante_path) {
            await fs.unlink(path.join(process.cwd(), comprobante_path)).catch(err => {
                console.warn(`[WARN] No se pudo eliminar el archivo subido sin datos completos: ${comprobante_path}`, err);
            });
        }
        return res.status(400).json({ error: 'El ID del plan y el comprobante de pago son obligatorios.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Insertar la solicitud de activación con estado PENDIENTE_REVISION
        const insertQuery = `
            INSERT INTO solicitudes_activacion (
                id_usuario, 
                plan_id, 
                comprobante_path, 
                estado,
                fecha_solicitud
            ) VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, id_usuario, plan_id, comprobante_path, estado, fecha_solicitud;
        `;
        const solicitudResult = await client.query(insertQuery, [
            userId,
            plan_id,
            comprobante_path,
            'PENDIENTE_REVISION'
        ]);

        // 2. Actualizar el rol del usuario a PENDIENTE_REVISION
        const { updatedUser } = await updateUserRoleAndExpiration(
            client,
            userId,
            'PENDIENTE_REVISION',
            null // No se pasa planId
        );

        await client.query('COMMIT');

        // 3. Respuesta exitosa
        res.status(201).json({
            message: 'Comprobante de pago subido con éxito y solicitud registrada. Su cuenta está ahora PENDIENTE DE REVISIÓN.',
            solicitud: solicitudResult.rows[0],
            user: updatedUser // Devuelve el usuario para actualizar el estado en el frontend (rol)
        });

    } catch (err) {
        await client.query('ROLLBACK');

        // Intentar eliminar el archivo subido si falla la DB
        if (comprobante_path) {
            await fs.unlink(path.join(process.cwd(), comprobante_path)).catch(unlinkErr => {
                console.warn(`[WARN] No se pudo eliminar el archivo ${comprobante_path} tras error de DB.`, unlinkErr);
            });
        }

        console.error('[🔥 FAIL] Error al subir comprobante en transacción:', err);
        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud de pago.' });
    } finally {
        client.release();
    }
};


// ==========================================================
// 2. Obtener Solicitudes Pendientes (Admin)
// ==========================================================

/**
 * @function getPendingRequests
 * @description Obtiene todas las solicitudes con estado 'PENDIENTE_REVISION'.
 * @param {object} req - Objeto de solicitud.
 * @param {object} res - Objeto de respuesta.
 */
const getPendingRequests = async (req, res) => {
    try {
        const query = `
            SELECT 
                sa.id, 
                sa.plan_id, 
                sa.comprobante_path,
                sa.fecha_solicitud,
                sa.estado,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.telefono,
                u.direccion
            FROM solicitudes_activacion sa
            JOIN users u ON sa.id_usuario = u.id
            WHERE sa.estado = 'PENDIENTE_REVISION'
            ORDER BY sa.fecha_solicitud ASC;
        `;
        const result = await pool.query(query);

        res.status(200).json({
            message: 'Solicitudes pendientes de revisión obtenidas con éxito.',
            solicitudes: result.rows
        });

    } catch (err) {
        console.error('[🔥 FAIL] Error al obtener solicitudes pendientes:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener solicitudes.' });
    }
};


// ==========================================================
// 3. Manejo de Acción de Solicitud (Admin)
// ==========================================================

/**
 * @function handleRequestAction
 * @description Aprueba o rechaza una solicitud de activación, actualizando la solicitud y el rol del usuario.
 * @param {object} req - Objeto de solicitud (req.params.id, req.body.action, req.user.id).
 * @param {object} res - Objeto de respuesta.
 */
const handleRequestAction = async (req, res) => {
    const { id: solicitudId } = req.params;
    const { action } = req.body; // 'APPROVE' o 'REJECT'
    const adminId = req.user.id;

    if (!['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Acción inválida. Debe ser APPROVE o REJECT.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Obtener la solicitud actual y verificar el estado
        const getRequestQuery = `
            SELECT id_usuario, comprobante_path, plan_id, estado
            FROM solicitudes_activacion 
            WHERE id = $1 AND estado = 'PENDIENTE_REVISION';
        `;
        const requestResult = await client.query(getRequestQuery, [solicitudId]);

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Solicitud no encontrada o no está pendiente de revisión.' });
        }

        const { id_usuario: userId, comprobante_path, plan_id } = requestResult.rows[0];

        let newStatus;
        let responseMessage;
        let expirationDate = null;
        let updatedUser = null;

        // 2. Determinar el nuevo estado y actualizar el rol del usuario
        if (action === 'APPROVE') {
            newStatus = 'APROBADA';
            responseMessage = 'Solicitud de activación aprobada.';

            // CLAVE: Actualizar el rol a 'editor' y establecer la fecha de expiración
            const updateResult = await updateUserRoleAndExpiration(
                client,
                userId,
                'editor',
                plan_id // Pasamos el plan_id para calcular la expiración
            );
            updatedUser = updateResult.updatedUser;
            expirationDate = updateResult.expirationDate;

        } else if (action === 'REJECT') {
            newStatus = 'RECHAZADA';
            responseMessage = 'Solicitud de activación rechazada. El usuario ha sido revertido a rol "PENDIENTE_PAGO".';

            // CLAVE: Actualizar el rol a 'PENDIENTE_PAGO'
            const updateResult = await updateUserRoleAndExpiration(
                client,
                userId,
                'PENDIENTE_PAGO',
                null
            );
            updatedUser = updateResult.updatedUser;

            // 3. Eliminar el archivo de comprobante subido si es rechazado
            if (comprobante_path) {
                try {
                    await fs.unlink(path.join(process.cwd(), comprobante_path));
                    console.log(`[LOG] Archivo de comprobante eliminado: ${comprobante_path}`);
                } catch (unlinkErr) {
                    // Sólo advertir, no detener la transacción
                    console.warn(`[WARN] No se pudo eliminar el archivo ${comprobante_path}.`, unlinkErr);
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
            // Formatear la fecha para la respuesta del frontend
            const formattedExpiration = expirationDate.toISOString().split('T')[0];
            responseData.message += ` Rol actualizado a 'editor' hasta el ${formattedExpiration}.`;
        }
        if (updatedUser) {
            // Adjuntamos los datos actualizados del usuario (esencial para el frontend)
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
    handleRequestAction
};
