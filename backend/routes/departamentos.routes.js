const express = require('express');
const router = express.Router();
const departamentosController = require('../controllers/departamentos.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa los middlewares específicos para editar y eliminar
const { canEditRecord, canDeleteRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/departamentos', checkRoles(allowedRoles), departamentosController.getDepartamentosData);
router.post('/departamentos', checkRoles(allowedRoles), departamentosController.createDepartamento);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canEditRecord, que permite la edición
// a todos los roles.
router.put(
    '/departamentos/:id',
    checkRoles(allowedRoles),
    canEditRecord('departamentos'),
    departamentosController.updateDepartamento
);

// La ruta DELETE usa el middleware canDeleteRecord, que se encarga
// de que solo el creador o un administrador pueda eliminar el registro.
router.delete(
    '/departamentos/:id',
    checkRoles(allowedRoles),
    canDeleteRecord('departamentos'),
    departamentosController.deleteDepartamento
);

module.exports = router;
