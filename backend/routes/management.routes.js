const express = require('express');
const router = express.Router();
const managementController = require('../controllers/management.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);

// ====================================================================
// RUTAS DE GESTIÓN DE LICENCIAS (Solo para Administradores de Plan - Rol 'editor')
// ====================================================================

// 1. GET: Obtener el estado actual de las licencias y la lista de invitados
router.get(
    '/licencias/estado', 
    checkRoles(['editor', 'administrador']), 
    managementController.getManagementStatus
);

// 2. POST: Crear una invitación/asignación de licencia (solo si hay cupo disponible)
router.post(
    '/licencias/invitar', 
    checkRoles(['editor', 'administrador']), 
    managementController.createInvitation
);

// 3. DELETE/PUT: Revocar una licencia asignada (liberar un cupo)
// Usamos DELETE porque es una anulación de asignación
router.delete(
    '/licencias/revocar/:id_registro', 
    checkRoles(['editor', 'administrador']), 
    managementController.revokeLicense
);


// ====================================================================
// RUTAS DE FLUJO DE USUARIO INVITADO
// ====================================================================

// 4. POST: El usuario invitado acepta la invitación (se usa el ID del usuario logueado/registrado)
// Esta ruta se llamaría después de que el usuario secundario se autentica.
router.post(
    '/invitacion/aceptar', 
    checkRoles(['PENDIENTE_PAGO', 'visualizador']), // Roles que podrían tener los usuarios invitados al iniciar sesión
    managementController.acceptInvitation
);


module.exports = router;
