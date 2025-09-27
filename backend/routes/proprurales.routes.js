const express = require('express');
const router = express.Router();
const propruralesController = require('../controllers/proprurales.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// Importa el nuevo middleware unificado para permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/proprurales', checkRoles(allowedRoles), propruralesController.getPropruralesData);
router.get(
    '/propiedades/count/rural', // 👈 Ruta que consume el Pinia store
    checkRoles(allowedRoles),
    propruralesController.countProprurales // 👈 Nueva función
);
router.post('/proprurales', checkRoles(allowedRoles), propruralesController.createProprural);

// Rutas protegidas con validación de roles y de propiedad del registro
// La ruta PUT usa el middleware canAccessRecord con la acción 'edit'
router.put(
    '/proprurales/:id',
    checkRoles(allowedRoles),
    canAccessRecord('proprurales', 'id', 'edit'),
    propruralesController.updateProprural
);

// La ruta DELETE usa el middleware canAccessRecord con la acción 'delete'
router.delete(
    '/proprurales/:id',
    checkRoles(allowedRoles),
    canAccessRecord('proprurales', 'id', 'delete'),
    propruralesController.deleteProprural
);

module.exports = router;