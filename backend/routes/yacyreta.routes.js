const express = require('express');
const router = express.Router();
const yacyretaController = require('../controllers/yacyreta.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/yacyreta', checkRoles(allowedRoles), yacyretaController.getYacyretaData);
router.post('/yacyreta', checkRoles(allowedRoles), yacyretaController.createYacyreta);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/yacyreta/:id',
    checkRoles(allowedRoles),
    canAccessRecord('yacyreta', 'id', 'edit'),
    yacyretaController.updateYacyreta
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/yacyreta/:id',
    checkRoles(allowedRoles),
    canAccessRecord('yacyreta', 'id', 'delete'),
    yacyretaController.deleteYacyreta
);

module.exports = router;