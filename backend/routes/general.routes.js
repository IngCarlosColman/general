const express = require('express');
const router = express.Router();
const generalController = require('../controllers/general.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Asegúrate de que la ruta sea correcta y que importes los nuevos middlewares
const { canEditRecord, canDeleteRecord } = require('../middlewares/permissions.middleware'); 

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/general', checkRoles(allowedRoles), generalController.getGeneralData);
router.get('/general/:id', checkRoles(allowedRoles), generalController.getGeneralById);
router.post('/general', checkRoles(allowedRoles), generalController.createGeneral);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canEditRecord, que permite la edición
// a todos los roles, excepto a los no-administradores, que serán redirigidos
router.put(
    '/general/:id',
    checkRoles(allowedRoles),
    canEditRecord('general'),
    generalController.updateGeneral
);

// La ruta DELETE usa el middleware canDeleteRecord, que se encarga
// de que solo el creador o un administrador pueda eliminar el registro
router.delete(
    '/general/:id',
    checkRoles(allowedRoles),
    canDeleteRecord('general'),
    generalController.deleteGeneral
);

module.exports = router;
