const express = require('express');
const router = express.Router();
const { getCategories } = require('../controllers/categories.controller');

// Importamos los middlewares con la ruta correcta
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación y roles a todas las rutas
router.use(authenticateJWT);
router.use(checkRoles(allowedRoles));

// Ruta para obtener las categorías
// Nota: La ruta '/' es suficiente ya que la ruta principal se maneja en server.js
router.get('/', getCategories);

module.exports = router;