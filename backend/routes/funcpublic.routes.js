const express = require('express');
const router = express.Router();
const funcpublicController = require('../controllers/funcpublic.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/funcpublic', checkRoles(allowedRoles), funcpublicController.getFuncPublicData);
router.post('/funcpublic', checkRoles(allowedRoles), funcpublicController.createFuncPublic);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/funcpublic/:id',
    checkRoles(allowedRoles),
    canAccessRecord('funcpublic', 'id', 'edit'),
    funcpublicController.updateFuncPublic
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/funcpublic/:id',
    checkRoles(allowedRoles),
    canAccessRecord('funcpublic', 'id', 'delete'),
    funcpublicController.deleteFuncPublic
);

module.exports = router;