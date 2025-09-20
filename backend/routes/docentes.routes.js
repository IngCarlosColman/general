const express = require('express');
const router = express.Router();
const docentesController = require('../controllers/docentes.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/docentes', checkRoles(allowedRoles), docentesController.getDocentesData);
router.post('/docentes', checkRoles(allowedRoles), docentesController.createDocente);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/docentes/:id',
    checkRoles(allowedRoles),
    canAccessRecord('docentes', 'id', 'edit'),
    docentesController.updateDocente
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/docentes/:id',
    checkRoles(allowedRoles),
    canAccessRecord('docentes', 'id', 'delete'),
    docentesController.deleteDocente
);

module.exports = router;