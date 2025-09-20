const express = require('express');
const router = express.Router();
const proproController = require('../controllers/propro.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

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
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/propiedades_propietarios/:id_vinculo',
    checkRoles(allowedRoles),
    canAccessRecord('propiedades_propietarios', 'id_vinculo', 'edit'),
    proproController.updatePropiedadPropietario
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/propiedades_propietarios/:id_vinculo',
    checkRoles(allowedRoles),
    canAccessRecord('propiedades_propietarios', 'id_vinculo', 'delete'),
    proproController.deletePropiedadPropietario
);

module.exports = router;