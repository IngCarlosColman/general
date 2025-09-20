const express = require('express');
const router = express.Router();
const funcbnfController = require('../controllers/funcbnf.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/funcbnf', checkRoles(allowedRoles), funcbnfController.getFuncBnfData);
router.post('/funcbnf', checkRoles(allowedRoles), funcbnfController.createFuncBnf);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/funcbnf/:id',
    checkRoles(allowedRoles),
    canAccessRecord('func_bnf', 'id', 'edit'),
    funcbnfController.updateFuncBnf
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/funcbnf/:id',
    checkRoles(allowedRoles),
    canAccessRecord('func_bnf', 'id', 'delete'),
    funcbnfController.deleteFuncBnf
);

module.exports = router;