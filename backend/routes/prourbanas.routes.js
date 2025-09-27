const express = require('express');
const router = express.Router();
const prourbanasController = require('../controllers/prourbanas.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/prourbanas', checkRoles(allowedRoles), prourbanasController.getProurbanasData);
router.get(
    '/propiedades/count/urbana', // 👈 Ruta que consume el Pinia store
    checkRoles(allowedRoles),
    prourbanasController.countProurbanas // 👈 Nueva función
);
router.post('/prourbanas', checkRoles(allowedRoles), prourbanasController.createProurbana);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/prourbanas/:id',
    checkRoles(allowedRoles),
    canAccessRecord('prourbanas', 'id', 'edit'),
    prourbanasController.updateProurbana
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/prourbanas/:id',
    checkRoles(allowedRoles),
    canAccessRecord('prourbanas', 'id', 'delete'),
    prourbanasController.deleteProurbana
);

module.exports = router;