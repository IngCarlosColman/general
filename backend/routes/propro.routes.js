const express = require('express');
const router = express.Router();
const proproController = require('../controllers/propro.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa los middlewares específicos para editar y eliminar
const { canEditRecord, canDeleteRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/propiedades_propietarios', checkRoles(allowedRoles), proproController.getPropiedadesPropietariosData);

// --- La nueva ruta para el endpoint _batch ---
// CORREGIDO: Ahora esta ruta llama a la nueva función del controlador
router.post('/propiedades_propietarios_batch', checkRoles(allowedRoles), proproController.createProprietorsBatch);
// ----------------------------------------------------------

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canEditRecord, que permite la edición
// a todos los roles.
router.put(
    '/propiedades_propietarios/:id_vinculo',
    checkRoles(allowedRoles),
    canEditRecord('propiedades_propietarios', 'id_vinculo'),
    proproController.updatePropiedadPropietario
);

// La ruta DELETE usa el middleware canDeleteRecord, que se encarga
// de que solo el creador o un administrador pueda eliminar el registro.
router.delete(
    '/propiedades_propietarios/:id_vinculo',
    checkRoles(allowedRoles),
    canDeleteRecord('propiedades_propietarios', 'id_vinculo'),
    proproController.deletePropiedadPropietario
);

module.exports = router;