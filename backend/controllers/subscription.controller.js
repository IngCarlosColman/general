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
            return 365; // 1 año (la duración es la misma, solo varía el cupo de usuarios/características)
        
        case 'basic': // Casos heredados o simplificados del front-end
        case 'standard':
        case 'pro':
             // Usaremos una lógica simple si el plan ID no es detallado
             if (planOptionId === 'basic') return 30;
             if (planOptionId === 'standard') return 90;
             if (planOptionId === 'pro') return 365;

        default:
            console.warn(`[PlanDuration] Plan ID no reconocido: ${planOptionId}`);
            return 30; // 1 mes por defecto si no se reconoce
    }
};


/**
 * 🔑 Actualiza el rol del usuario a 'editor' y establece la fecha de expiración.
 * Esta función es crítica para el proceso de aprobación de pagos.
 * @param {object} client - Cliente de DB (usar dentro de una transacción).
 * @param {number} userId - ID del usuario a actualizar.
 * @param {string} planOptionId - ID del plan seleccionado (ej: 'agente_mensual').
 * @returns {object} { expirationDate, updatedUser } - Fecha de expiración calculada y datos de usuario actualizados.
 */
const updateUserRoleAndExpiration = async (client, userId, planOptionId) => {
    const daysToAdd = getPlanDurationDays(planOptionId);
    
    // Calcula la fecha de expiración
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd);

    // Formato YYYY-MM-DD para PostgreSQL DATE column
    const formattedExpirationDate = expirationDate.toISOString().split('T')[0];

    // Actualiza el rol y la fecha de vencimiento en la tabla de usuarios
    const updateQuery = `
        UPDATE users 
        SET rol = 'editor', 
            suscripcion_vence = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, rol, first_name, last_name, email, telefono, direccion, suscripcion_vence;
    `;
    const userUpdateResult = await client.query(updateQuery, [formattedExpirationDate, userId]);

    if (userUpdateResult.rowCount === 0) {
        throw new Error(`Usuario con ID ${userId} no encontrado.`);
    }

    return { 
        expirationDate: expirationDate, // Devuelve el objeto Date original
        updatedUser: userUpdateResult.rows[0] // Devuelve los datos actualizados del usuario
    };
};


// ==========================================================
// 1. POST: Subir Comprobante de Pago (Endpoint de Usuario)
// ==========================================================
const uploadPaymentProof = async (req, res) => {
    // Esta función asume que `req.file` contiene el archivo subido
    const planId = req.body.plan_id; 
    const userId = req.user.id; // Asume que el middleware auth.middleware adjunta el user en req.user
    const comprobantePath = req.file ? req.file.path : null; 

    if (!planId || !comprobantePath) {
        // Si el archivo no se subió o el plan no se envió, borramos el archivo si existe
        if (comprobantePath) {
            await fs.unlink(comprobantePath).catch(err => console.error('Error al borrar el archivo:', err));
        }
        return res.status(400).json({ error: 'Debe seleccionar un plan y adjuntar un comprobante.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insertar la solicitud de activación
        const insertQuery = `
            INSERT INTO solicitudes_activacion (
                usuario_id, 
                plan_id, 
                comprobante_path, 
                estado
            )
            VALUES ($1, $2, $3, 'PENDIENTE_REVISION')
            RETURNING *;
        `;
        const result = await client.query(insertQuery, [userId, planId, comprobantePath]);

        // 2. Actualizar el rol del usuario a PENDIENTE_REVISION
        const updateUserRoleQuery = `
            UPDATE users 
            SET rol = 'PENDIENTE_REVISION', 
                updated_at = NOW()
            WHERE id = $1;
        `;
        await client.query(updateUserRoleQuery, [userId]);

        await client.query('COMMIT');

        res.status(201).json({ 
            message: 'Comprobante subido y solicitud registrada con éxito. Su cuenta está ahora PENDIENTE DE REVISIÓN.',
            solicitud: result.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[FAIL] Error en uploadPaymentProof:', err);
        // Si falló la DB, intentamos borrar el archivo subido
        if (comprobantePath) {
            await fs.unlink(comprobantePath).catch(unlinkErr => console.warn(`No se pudo eliminar el archivo ${comprobantePath} tras error DB.`, unlinkErr));
        }
        res.status(500).json({ error: 'Error interno del servidor al registrar la solicitud.' });
    } finally {
        client.release();
    }
};


// ==========================================================
// 2. GET: Obtener Solicitudes Pendientes (Endpoint de Admin)
// ==========================================================
const getPendingRequests = async (req, res) => {
    try {
        // Solo administradores pueden acceder (protegido por middleware)
        const query = `
            SELECT 
                sa.id, 
                sa.usuario_id, 
                u.username,
                u.email,
                u.first_name,
                u.last_name,
                sa.plan_id, 
                sa.comprobante_path,
                sa.fecha_creacion,
                sa.estado
            FROM solicitudes_activacion sa
            JOIN users u ON sa.usuario_id = u.id
            WHERE sa.estado = 'PENDIENTE_REVISION'
            ORDER BY sa.fecha_creacion ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('[FAIL] Error en getPendingRequests:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener las solicitudes.' });
    }
};


// ==========================================================
// 3. GET: Servir Archivo Comprobante (Endpoint de Admin)
// ==========================================================
// NOTA: Es crucial que esta ruta esté protegida por middleware de autenticación y roles de administrador.
const serveProofFile = async (req, res) => {
    try {
        const { id } = req.params; // ID de la solicitud, no del archivo
        
        // 1. Buscar la ruta del archivo en la DB
        const result = await pool.query(
            'SELECT comprobante_path FROM solicitudes_activacion WHERE id = $1',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }

        const filePath = result.rows[0].comprobante_path;
        
        if (!filePath) {
            return res.status(404).json({ error: 'Ruta de comprobante no disponible.' });
        }

        // 2. Enviar el archivo
        // Usamos path.resolve para asegurar que la ruta sea absoluta y segura
        const absolutePath = path.resolve(filePath);
        
        // Verificación de seguridad básica (evitar Path Traversal)
        if (!absolutePath.startsWith(path.resolve('uploads/proofs'))) {
            console.error(`[SECURITY ALERT] Intento de acceso fuera del directorio de uploads: ${absolutePath}`);
            return res.status(403).json({ error: 'Acceso al archivo denegado.' });
        }
        
        // Usamos path.basename para determinar el nombre de archivo a descargar
        const fileName = path.basename(filePath);

        // Envía el archivo con el nombre original como sugerencia de descarga
        res.download(absolutePath, fileName, (err) => {
            if (err) {
                // Si ocurre un error (ej: archivo no encontrado en disco)
                console.error(`[FAIL] Error al servir el archivo ${absolutePath}:`, err);
                // Si el error es ENOENT (No such file or directory)
                if (err.code === 'ENOENT') {
                    res.status(404).send('El archivo comprobante no fue encontrado en el servidor.');
                } else if (!res.headersSent) {
                    // Si el error es otro y no hemos enviado headers aún
                    res.status(500).send('Error interno del servidor al servir el archivo.');
                }
            }
        });

    } catch (err) {
        console.error('[FAIL] Error en serveProofFile:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ==========================================================
// 4. POST: Manejar Aprobación/Rechazo de Solicitud (Endpoint de Admin)
// ==========================================================
const handleRequestAction = async (req, res) => {
    const { id: solicitudId } = req.params;
    const { action } = req.body; // 'APPROVE' o 'REJECT'
    const adminId = req.user.id; // ID del administrador logueado

    if (!['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Acción no válida.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicia la transacción

        // 1. Obtener la solicitud actual
        const requestQuery = `
            SELECT usuario_id, plan_id, comprobante_path, estado 
            FROM solicitudes_activacion 
            WHERE id = $1 FOR UPDATE;
        `;
        const requestResult = await client.query(requestQuery, [solicitudId]);

        if (requestResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Solicitud no encontrada.' });
        }

        const { usuario_id, plan_id, comprobante_path, estado } = requestResult.rows[0];

        if (estado !== 'PENDIENTE_REVISION') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `La solicitud ya fue ${estado}.` });
        }

        let newStatus;
        let responseMessage;
        let expirationDate = null;
        let updatedUser = null;

        // 2. Lógica de Aprobación/Rechazo
        if (action === 'APPROVE') {
            newStatus = 'APROBADO';
            responseMessage = 'Solicitud aprobada. El usuario ha sido actualizado a editor.';
            
            // 2a. Actualizar el rol del usuario y la fecha de expiración.
            const userUpdate = await updateUserRoleAndExpiration(client, usuario_id, plan_id);
            expirationDate = userUpdate.expirationDate;
            updatedUser = userUpdate.updatedUser;

            // 2b. Opcional: Registrar una entrada en la tabla de 'suscripciones_corporativas'
            // Esto es necesario si el plan es corporativo y requiere gestión de cupos, 
            // pero para esta implementación inicial, solo actualizamos el rol del usuario
            // y la fecha de vencimiento. Si se necesita la tabla corporativa, se implementaría aquí.
            
        } else { // action === 'REJECT'
            newStatus = 'RECHAZADO';
            responseMessage = 'Solicitud rechazada.';

            // 2c. Revertir el rol del usuario a 'PENDIENTE_PAGO' si fue rechazado
            const revertRoleQuery = `
                UPDATE users
                SET rol = 'PENDIENTE_PAGO',
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, rol;
            `;
            const revertResult = await client.query(revertRoleQuery, [usuario_id]);
            if (revertResult.rowCount > 0) {
                updatedUser = revertResult.rows[0];
            }
        }
        
        // 3. Limpieza de Archivo si se aprueba o se rechaza (es opcional, pero buena práctica si no se requiere el historial completo)
        // NOTA: Para auditoría, es mejor mantener el archivo. Solo se eliminará el registro de la DB si se implementa un control de versiones de solicitudes.
        if (action === 'REJECT' || action === 'APROVE') {
            if (comprobante_path) {
                try {
                    await fs.unlink(path.resolve(comprobante_path));
                    console.log(`[LOG] Archivo comprobante eliminado: ${comprobante_path}`);
                } catch (unlinkErr) {
                    // Solo advertir si falla la eliminación, no abortar la transacción DB
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
            // Adjuntamos los datos actualizados del usuario para que el frontend pueda recargar el store
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
    serveProofFile,
    handleRequestAction,
};
