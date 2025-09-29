const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
const { uploadProof } = require('../middlewares/upload.middleware');

// Roles permitidos para ver las solicitudes pendientes
const adminRole = ['administrador']; 
// Roles permitidos para realizar la subida de comprobante
const allowedRoles = ['administrador', 'editor', 'visualizador', 'PENDIENTE_PAGO', 'PENDIENTE_REVISION']; 


// Aplicamos el middleware de autenticación a todas las rutas de suscripción
router.use(authenticateJWT);


// ==========================================================
// --- Rutas de Usuario (Subida de Comprobante) ---
// ==========================================================

// 1. POST: Ruta para subir el comprobante de pago y registrar la solicitud.
router.post(
    '/upload-proof', 
    checkRoles(allowedRoles), 
    uploadProof, 
    subscriptionController.uploadPaymentProof
);


// ==========================================================
// --- Rutas de Administración (Revisión) ---
// Estas rutas requieren el rol 'administrador'
// ==========================================================

// 2. GET: Obtener todas las solicitudes pendientes de revisión.
// RUTA FINAL: /api/subscription/admin/pending-requests
router.get('/admin/pending-requests', checkRoles(adminRole), subscriptionController.getPendingRequests);

// 3. POST: Aprobar una solicitud específica.
// RUTA FINAL: /api/subscription/admin/approve/:id
router.post('/admin/approve/:id', checkRoles(adminRole), (req, res) => {
    // Reutilizamos el controlador general de acción, forzando la acción 'APPROVE'
    req.body.action = 'APPROVE'; 
    subscriptionController.handleRequestAction(req, res);
});

// 4. POST: Rechazar una solicitud específica.
// RUTA FINAL: /api/subscription/admin/reject/:id
router.post('/admin/reject/:id', checkRoles(adminRole), (req, res) => {
    // Reutilizamos el controlador general de acción, forzando la acción 'REJECT'
    req.body.action = 'REJECT'; 
    subscriptionController.handleRequestAction(req, res);
});


module.exports = router;
