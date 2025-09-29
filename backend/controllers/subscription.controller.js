const { pool } = require('../db/db');
const fs = require('fs/promises');
const path = require('path');

// ==========================================================
// Funciones Internas de Lógica de Negocio
// ==========================================================

/**
 * 🔑 Actualiza el rol del usuario a 'editor' y establece la fecha de expiración.
 * @param {object} client - Cliente de DB (usar dentro de una transacción).
 * @param {number} userId - ID del usuario a actualizar.
 * @param {string} planId - ID del plan ('basic', 'standard', 'pro').
 * @returns {Date} - Fecha de expiración calculada.
 */
const updateUserRoleAndExpiration = async (client, userId, planId) => {
    // Lógica para determinar la duración del plan
    let daysToAdd;
    switch (planId) {
        case 'basic':
            daysToAdd = 30; // 1 mes
            break;
        case 'standard':
            daysToAdd = 90; // 3 meses
            break;
        case 'pro':
            daysToAdd = 365; // 1 año
            break;
        default:
            daysToAdd = 30; // Por defecto 1 mes
    }

    // Calcula la fecha de expiración
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd);

    const updateQuery = `
        UPDATE users 
        SET rol = 'editor', 
            suscripcion_expira_el = $2
        WHERE id = $1;
    `;
    await client.query(updateQuery, [userId, expirationDate]);
    
    return expirationDate;
};


// ==========================================================
// 1. Manejar Subida de Comprobante de Pago
// ==========================================================
const uploadPaymentProof = async (req, res) => {
    
    const { plan_id } = req.body;
    const userId = req.user.id;
    const uploadedFile = req.file;

    if (!plan_id || !uploadedFile) {
        if (uploadedFile) {
            // Si el plan falta, pero el archivo subió, lo eliminamos por limpieza
            const UPLOADS_DIR = path.join(__dirname, '../../uploads');
            await fs.unlink(uploadedFile.path).catch(console.error);
        }
        return res.status(400).json({ error: 'Faltan datos (plan o comprobante).' });
    }

    const comprobantePath = uploadedFile.path;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicia la transacción

        // 1. Registrar la solicitud en la base de datos
        // Usamos ON CONFLICT para prevenir duplicados si el usuario intenta subir varias veces
        const insertQuery = `
            INSERT INTO solicitudes_activacion 
                (id_usuario, plan_solicitado, ruta_comprobante, estado, created_by)
            VALUES ($1, $2, $3, 'PENDIENTE', $1)
            ON CONFLICT (id_usuario) DO UPDATE
            SET plan_solicitado = EXCLUDED.plan_solicitado,
                ruta_comprobante = EXCLUDED.ruta_comprobante,
                estado = 'PENDIENTE',
                fecha_solicitud = NOW(),
                revisado_por = NULL,
                fecha_revision = NULL
            WHERE solicitudes_activacion.estado != 'APROBADO' 
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [userId, plan_id, comprobantePath]);

        // 2. Actualizar el rol del usuario a PENDIENTE_REVISION
        const updateRoleQuery = `
            UPDATE users SET rol = 'PENDIENTE_REVISION' WHERE id = $1 AND rol != 'administrador';
        `;
        await client.query(updateRoleQuery, [userId]);

        await client.query('COMMIT'); // Confirma la transacción
        
        console.log(`[SUBSCRIPTION LOG] Solicitud registrada para user: ${userId}, plan: ${plan_id}. Archivo: ${uploadedFile.filename}`);
        
        res.status(200).json({ 
            message: 'Comprobante subido y solicitud registrada/actualizada con éxito. Pendiente de revisión.',
            solicitud: result.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK'); // Revierte si algo falla
        console.error('[🔥 FAIL] Error al registrar la solicitud de suscripción:', err);
        
        // Eliminación del archivo en caso de fallo de DB
        try {
            await fs.unlink(comprobantePath);
            console.log(`[CLEANUP] Archivo eliminado con éxito tras fallo en DB: ${comprobantePath}`);
        } catch (unlinkError) {
            console.error(`[CLEANUP FAIL] No se pudo eliminar el archivo: ${comprobantePath}`, unlinkError);
        }

        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud.' });
    } finally {
        client.release();
    }
};

// ==========================================================
// 2. Obtener Solicitudes Pendientes (Solo Admin)
// ==========================================================
const getPendingRequests = async (req, res) => {
    try {
        const query = `
            SELECT sa.id, sa.plan_solicitado, sa.ruta_comprobante, sa.estado, sa.fecha_solicitud,
                   u.id AS id_usuario, u.email, u.first_name, u.last_name, u.rol AS current_rol
            FROM solicitudes_activacion sa
            JOIN users u ON sa.id_usuario = u.id
            WHERE sa.estado = 'PENDIENTE'
            ORDER BY sa.fecha_solicitud ASC;
        `;
        const result = await pool.query(query);

        res.status(200).json({ items: result.rows });
    } catch (err) {
        console.error('Error al obtener solicitudes pendientes:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ==========================================================
// 3. Manejar Aprobación o Rechazo (Solo Admin)
// ==========================================================
const handleRequestAction = async (req, res) => {
    const { id: solicitudId } = req.params;
    const { action } = req.body; // 'APPROVE' o 'REJECT'
    const adminId = req.user.id;
    
    if (!['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Acción no válida. Debe ser APPROVE o REJECT.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicia la transacción

        // 1. Obtener la solicitud actual
        const getRequestQuery = 'SELECT id_usuario, plan_solicitado, estado, ruta_comprobante FROM solicitudes_activacion WHERE id = $1 FOR UPDATE;';
        const requestResult = await client.query(getRequestQuery, [solicitudId]);

        if (requestResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }

        const { id_usuario, plan_solicitado, estado, ruta_comprobante } = requestResult.rows[0];

        if (estado !== 'PENDIENTE') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `La solicitud ya fue ${estado}.` });
        }

        let newStatus = action === 'APPROVE' ? 'APROBADO' : 'RECHAZADO';
        let responseMessage = action === 'APPROVE' ? 'Solicitud aprobada.' : 'Solicitud rechazada.';
        let expirationDate = null;
        
        // 2. Ejecutar la lógica de acción
        if (action === 'APPROVE') {
            // 2a. Si se aprueba, actualizar rol y expiración del usuario
            expirationDate = await updateUserRoleAndExpiration(client, id_usuario, plan_solicitado);
            
        } else if (action === 'REJECT') {
            // 2b. Si se rechaza, podemos opcionalmente cambiar el rol de vuelta a PENDIENTE_PAGO
            const downgradeQuery = `UPDATE users SET rol = 'PENDIENTE_PAGO' WHERE id = $1 AND rol = 'PENDIENTE_REVISION';`;
            await client.query(downgradeQuery, [id_usuario]);
        }
        
        // 3. Actualizar el estado de la solicitud
        const updateRequestQuery = `
            UPDATE solicitudes_activacion 
            SET estado = $1, 
                fecha_revision = NOW(), 
                revisado_por = $2
            WHERE id = $3
            RETURNING *;
        `;
        const updatedRequestResult = await client.query(updateRequestQuery, [newStatus, adminId, solicitudId]);

        // 4. (Opcional) Limpieza de Archivo si se aprueba o se rechaza (para evitar almacenamiento innecesario)
        // NOTA: Es común mantener el archivo por motivos de auditoría. Aquí lo mantendremos a menos que el estado sea 'CERRADO'.

        await client.query('COMMIT'); // Confirma la transacción

        const responseData = {
            message: responseMessage,
            solicitud: updatedRequestResult.rows[0]
        };
        if (expirationDate) {
            responseData.message += ` Rol actualizado a 'editor' hasta el ${expirationDate.toISOString().split('T')[0]}.`;
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
