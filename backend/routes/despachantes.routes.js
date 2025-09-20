const express = require('express');
const router = express.Router();
const despachantesController = require('../controllers/despachantes.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/despachantes', checkRoles(allowedRoles), despachantesController.getDespachantesData);
router.post('/despachantes', checkRoles(allowedRoles), despachantesController.createDespachante);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/despachantes/:id',
    checkRoles(allowedRoles),
    canAccessRecord('despachantes', 'id', 'edit'),
    despachantesController.updateDespachante
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/despachantes/:id',
    checkRoles(allowedRoles),
    canAccessRecord('despachantes', 'id', 'delete'),
    despachantesController.deleteDespachante
);

module.exports = router;