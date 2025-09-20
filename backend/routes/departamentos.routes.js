const express = require('express');
const router = express.Router();
const departamentosController = require('../controllers/departamentos.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/departamentos', checkRoles(allowedRoles), departamentosController.getDepartamentosData);
router.post('/departamentos', checkRoles(allowedRoles), departamentosController.createDepartamento);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/departamentos/:id',
    checkRoles(allowedRoles),
    canAccessRecord('departamentos', 'id', 'edit'),
    departamentosController.updateDepartamento
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/departamentos/:id',
    checkRoles(allowedRoles),
    canAccessRecord('departamentos', 'id', 'delete'),
    departamentosController.deleteDepartamento
);

module.exports = router;