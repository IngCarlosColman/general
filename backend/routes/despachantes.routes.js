const express = require('express');
const router = express.Router();
const despachantesController = require('../controllers/despachantes.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa los middlewares específicos para editar y eliminar
const { canEditRecord, canDeleteRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/despachantes', checkRoles(allowedRoles), despachantesController.getDespachantesData);
router.post('/despachantes', checkRoles(allowedRoles), despachantesController.createDespachante);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canEditRecord, que permite la edición
// a todos los roles.
router.put(
    '/despachantes/:id',
    checkRoles(allowedRoles),
    canEditRecord('despachantes'),
    despachantesController.updateDespachante
);

// La ruta DELETE usa el middleware canDeleteRecord, que se encarga
// de que solo el creador o un administrador pueda eliminar el registro.
router.delete(
    '/despachantes/:id',
    checkRoles(allowedRoles),
    canDeleteRecord('despachantes'),
    despachantesController.deleteDespachante
);

module.exports = router;
