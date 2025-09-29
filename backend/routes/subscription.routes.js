const express = require('express');
const router = express.Router();

// 💡 userSubscriptionController: Maneja las solicitudes de PAGO del USUARIO (la subida del comprobante).
const userSubscriptionController = require('../controllers/subscription.controller');
// 💡 corporateSubscriptionController: Maneja la GESTIÓN de las entidades de suscripción (activación, listados).
const corporateSubscriptionController = require('../controllers/subscriptions.controller'); 

const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
const { uploadProof } = require('../middlewares/upload.middleware');

// Roles permitidos para ver las solicitudes pendientes
const adminRole = ['administrador']; 
// Roles permitidos para realizar la subida de comprobante
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
    uploadProof, 
    userSubscriptionController.uploadPaymentProof
);


// ==========================================================
// --- Rutas de ADMINISTRACIÓN (Revisión de Solicitudes) ---
// Usan userSubscriptionController (Revisión de comprobantes de pago)
// ==========================================================

// 2. GET: Obtener todas las solicitudes pendientes de revisión.
// RUTA FINAL: /api/subscription/admin/pending-requests
router.get('/admin/pending-requests', checkRoles(adminRole), userSubscriptionController.getPendingRequests);

// 3. POST: Aprobar una solicitud específica (y actualizar el rol del usuario).
// RUTA FINAL: /api/subscription/admin/approve/:id
router.post('/admin/approve/:id', checkRoles(adminRole), (req, res) => {
    // Reutilizamos el controlador general de acción, forzando la acción 'APPROVE'
    req.body.action = 'APPROVE'; 
    userSubscriptionController.handleRequestAction(req, res);
});

// 4. POST: Rechazar una solicitud específica.
// RUTA FINAL: /api/subscription/admin/reject/:id
router.post('/admin/reject/:id', checkRoles(adminRole), (req, res) => {
    // Reutilizamos el controlador general de acción, forzando la acción 'REJECT'
    req.body.action = 'REJECT'; 
    userSubscriptionController.handleRequestAction(req, res);
});


// ==========================================================
// --- Rutas de ADMINISTRACIÓN (Gestión de Suscripciones Corporativas) ---
// Usan corporateSubscriptionController (Gestión de la tabla principal de suscripciones)
// ==========================================================

// 5. GET: Obtener lista de suscripciones corporativas o activas (asume que el admin las necesita).
// RUTA FINAL: /api/subscription/admin/list-subscriptions
router.get(
    '/admin/list-subscriptions', 
    checkRoles(adminRole), 
    corporateSubscriptionController.getPendingSubscriptions // Este endpoint ya existe en subscriptions.controller.js
);

// 6. POST: Activar una suscripción corporativa específica.
// RUTA FINAL: /api/subscription/admin/activate-subscription/:id
router.post(
    '/admin/activate-subscription/:id', 
    checkRoles(adminRole), 
    corporateSubscriptionController.activateSubscription // Este endpoint ya existe en subscriptions.controller.js
);


module.exports = router;
