const express = require('express');
const router = express.Router();
const telefonosController = require('../controllers/telefonos.controller');

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);

// Ruta protegida para obtener teléfonos por cédula
// El endpoint es `/telefonos` y espera un query param `?cedulas=...`
router.get('/telefonos', checkRoles(allowedRoles), telefonosController.getTelefonosByCedulas);

// Ruta protegida para crear un nuevo teléfono
router.post('/telefonos', checkRoles(allowedRoles), telefonosController.createTelefono);

module.exports = router;