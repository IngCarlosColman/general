const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);

// ====================================================================
// RUTAS DE GESTIÓN DE DATOS DE FACTURACIÓN
// ====================================================================

// 1. GET: Obtener los datos de facturación del usuario actual
router.get(
    '/facturacion/datos', 
    checkRoles(['administrador', 'editor', 'PENDIENTE_PAGO']), // Permite ver incluso si está PENDIENTE
    billingController.getBillingData
);

// 2. POST: Crear o actualizar los datos de facturación (UPSERT)
router.post(
    '/facturacion/datos', 
    checkRoles(['administrador', 'editor', 'PENDIENTE_PAGO']), // Permite a los usuarios llenar esto antes de pagar
    billingController.upsertBillingData
);

module.exports = router;
