const express = require('express');
const router = express.Router();
const ciudadesController = require('../controllers/ciudades.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/ciudades', checkRoles(allowedRoles), ciudadesController.getCiudadesData);
router.post('/ciudades', checkRoles(allowedRoles), ciudadesController.createCiudad);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/ciudades/:id',
    checkRoles(allowedRoles),
    canAccessRecord('ciudades', 'id', 'edit'),
    ciudadesController.updateCiudad
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/ciudades/:id',
    checkRoles(allowedRoles),
    canAccessRecord('ciudades', 'id', 'delete'),
    ciudadesController.deleteCiudad
);

module.exports = router;