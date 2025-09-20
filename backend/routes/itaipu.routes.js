const express = require('express');
const router = express.Router();
const itaipuController = require('../controllers/itaipu.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/itaipu', checkRoles(allowedRoles), itaipuController.getItaipuData);
router.post('/itaipu', checkRoles(allowedRoles), itaipuController.createItaipu);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/itaipu/:id',
    checkRoles(allowedRoles),
    canAccessRecord('itaipu', 'id', 'edit'),
    itaipuController.updateItaipu
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/itaipu/:id',
    checkRoles(allowedRoles),
    canAccessRecord('itaipu', 'id', 'delete'),
    itaipuController.deleteItaipu
);

module.exports = router;