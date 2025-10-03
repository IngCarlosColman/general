const express = require('express');
const router = express.Router();

// 💡 userSubscriptionController: Maneja las solicitudes de PAGO del USUARIO (la subida del comprobante y su revisión).
const userSubscriptionController = require('../controllers/subscription.controller');
// 💡 corporateSubscriptionController: Maneja la GESTIÓN de las entidades de suscripción (activación, listados corporativos).
const corporateSubscriptionController = require('../controllers/subscriptions.controller'); 

const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
const { uploadProof } = require('../middlewares/upload.middleware');
// NOTA: Se asume que el middleware 'uploadProof' está correctamente configurado con Multer.

// Roles permitidos para las rutas de Administración
const adminRole = ['administrador']; 
// Roles permitidos para realizar la subida de comprobante (PENDIENTE_PAGO es crucial aquí).
const allowedRoles = ['administrador', 'editor', 'visualizador', 'PENDIENTE_PAGO', 'PENDIENTE_REVISION']; 


// Aplicamos el middleware de autenticación a todas las rutas de suscripción
router.use(authenticateJWT);


// ==========================================================
// --- Rutas de USUARIO (Solicitud Individual/Inicial) ---
// Usan userSubscriptionController
// ==========================================================

// 1. POST: Ruta para subir el comprobante de pago y registrar la solicitud.
// RUTA FINAL: /api/subscription/upload-proof
router.post(
    '/upload-proof', 
    checkRoles(allowedRoles), 
    // CORRECCIÓN CLAVE: Usamos 'uploadProof' directamente. 
    // Este ya fue configurado en upload.middleware.js como .single('comprobante').
    uploadProof, 
    userSubscriptionController.uploadPaymentProof
);


// ==========================================================
// --- Rutas de ADMINISTRACIÓN (Revisión de Solicitudes) ---
// Usan userSubscriptionController (Revisión de comprobantes)
// ==========================================================

// 2. GET: Obtener todas las solicitudes pendientes de revisión.
// RUTA FINAL: /api/subscription/admin/pending-requests
router.get(
    '/admin/pending-requests', 
    checkRoles(adminRole), 
    userSubscriptionController.getPendingRequests
);

// 3. POST: Manejo de acción de solicitud (Aprobar o Rechazar).
// ⚠️ RUTA UNIFICADA: Se eliminan las rutas separadas /approve/:id y /reject/:id.
// El frontend debe enviar un body con { action: 'APPROVE' } o { action: 'REJECT' }.
// RUTA FINAL: /api/subscription/admin/request-action/:id
router.post(
    '/admin/request-action/:id', 
    checkRoles(adminRole), 
    userSubscriptionController.handleRequestAction
);


// ==========================================================
// --- Rutas de ADMINISTRACIÓN (Gestión de Suscripciones Corporativas) ---
// Usan corporateSubscriptionController (Gestión de la tabla principal de suscripciones)
// Estas rutas son más para la gestión de entidades de suscripción ya existentes/activadas.
// ==========================================================

// 4. GET: Obtener lista de suscripciones corporativas o activas.
// RUTA FINAL: /api/subscription/admin/list-subscriptions
router.get(
    '/admin/list-subscriptions', 
    checkRoles(adminRole), 
    corporateSubscriptionController.getPendingSubscriptions // La función genérica de listado
);

// 5. POST: Activar una suscripción corporativa específica (Ej: para renovaciones manuales).
// RUTA FINAL: /api/subscription/admin/activate-subscription/:id
router.post(
    '/admin/activate-subscription/:id', 
    checkRoles(adminRole), 
    corporateSubscriptionController.activateSubscription
);


module.exports = router;