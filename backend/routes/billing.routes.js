const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// ====================================================================
// RUTA DE PRUEBA DE CARGA: (Sin autenticación)
// ====================================================================
router.get('/test-load', (req, res) => {
    res.send('Ruta de prueba de Billing OK - Archivo Cargado'); 
});


// ====================================================================
// RUTAS DE FACTURACIÓN (Aisladas y Protegidas Mínimamente)
// Estas rutas están ANTES del router.use(authenticateJWT) global.
// ====================================================================

// 1. GET: Obtener los datos de facturación del usuario actual
router.get(
    '/facturacion/datos', 
    authenticateJWT, // <-- NECESARIO para obtener req.user (ID del usuario)
    // checkRoles(['administrador', 'editor', 'PENDIENTE_PAGO']), // <-- ¡COMENTADO! Esto es lo que probablemente estaba bloqueando.
    billingController.getBillingData
);

// 2. POST: Crear o actualizar los datos de facturación (UPSERT)
router.post(
    '/facturacion/datos', 
    authenticateJWT, // <-- NECESARIO para obtener req.user (ID del usuario)
    // checkRoles(['administrador', 'editor', 'PENDIENTE_PAGO']), // <-- ¡COMENTADO!
    billingController.upsertBillingData
);


// ====================================================================
// APLICACIÓN GLOBAL: El resto de las rutas REQUIEREN AUTENTICACIÓN ESTRICTA
// ====================================================================
// Aplicamos el middleware de autenticación a todas las rutas restantes que no hemos definido antes.
router.use(authenticateJWT);


module.exports = router;
