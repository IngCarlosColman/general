const express = require('express');
const router = express.Router();
const generalController = require('../controllers/general.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Se usa el nuevo middleware de permisos unificado.
const { canAccessRecord } = require('../middlewares/permissions.middleware'); 

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/general', checkRoles(allowedRoles), generalController.getGeneralData);
router.get('/general/:cedula', checkRoles(allowedRoles), generalController.getGeneralById);
router.post('/general', checkRoles(allowedRoles), generalController.createGeneral);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/general/:id',
    checkRoles(allowedRoles),
    canAccessRecord('general', 'id', 'edit'),
    generalController.updateGeneral
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/general/:id',
    checkRoles(allowedRoles),
    canAccessRecord('general', 'id', 'delete'),
    generalController.deleteGeneral
);

module.exports = router;