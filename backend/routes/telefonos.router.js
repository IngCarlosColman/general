const express = require('express');
const router = express.Router();
const telefonosController = require('../controllers/telefonos.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// 🚨 Importa el middleware de permisos
const { canAccessRecord } = require('../middlewares/permissions.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.get('/telefonos', checkRoles(allowedRoles), telefonosController.getTelefonosByCedulas);
router.post('/telefonos', checkRoles(allowedRoles), telefonosController.createTelefono);

// 🚨 RUTA NUEVA BLINDADA: ACTUALIZACIÓN (PUT)
router.put(
    '/telefonos/:id',
    checkRoles(allowedRoles),
    // Aplica la restricción de propiedad (solo el creador o un admin puede editar)
    canAccessRecord('telefonos', 'id', 'edit'), 
    telefonosController.updateTelefono
);

// 🚨 RUTA NUEVA BLINDADA: ELIMINACIÓN (DELETE)
router.delete(
    '/telefonos/:id',
    checkRoles(allowedRoles),
    // Aplica la restricción de propiedad (solo el creador o un admin puede eliminar)
    canAccessRecord('telefonos', 'id', 'delete'), 
    telefonosController.deleteTelefono
);


module.exports = router;