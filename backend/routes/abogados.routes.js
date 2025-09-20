const express = require('express');
const router = express.Router();
const abogadosController = require('../controllers/abogados.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/abogados', checkRoles(allowedRoles), abogadosController.getAbogadosData);
// La función createAbogado ahora usa el nombre correcto
router.post('/abogados', checkRoles(allowedRoles), abogadosController.createAbogado);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/abogados/:id',
    checkRoles(allowedRoles),
    canAccessRecord('abogados', 'id', 'general', 'cedula', 'edit'),
    abogadosController.updateAbogado
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/abogados/:id',
    checkRoles(allowedRoles),
    canAccessRecord('abogados', 'id', 'general', 'cedula', 'delete'),
    abogadosController.deleteAbogado
);

module.exports = router;