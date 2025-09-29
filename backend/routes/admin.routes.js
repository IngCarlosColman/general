const express = require('express');
const router = express.Router();
const subscriptionsController = require('../controllers/subscriptions.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos el rol que puede acceder a estas rutas
const adminRole = ['administrador']; 

// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);

// ====================================================================
// RUTAS DE GESTIÓN DE SUSCRIPCIONES (Solo para Administradores)
// ====================================================================

// 1. GET: Obtener todas las solicitudes de pago pendientes de verificación
router.get(
    '/suscripciones/pendientes', 
    checkRoles(adminRole), 
    subscriptionsController.getPendingSubscriptions
);

// 2. POST: Activar una suscripción después de la verificación del pago
router.post(
    '/suscripciones/activar/:id_suscripcion', 
    checkRoles(adminRole), 
    subscriptionsController.activateSubscription
);

module.exports = router;
