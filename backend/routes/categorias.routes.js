//routes/categorias.routes.js

const express = require('express');
const router = express.Router();

// Importamos todas las funciones del controlador 'categorias.controller.js'
const {
    getCategorias,
    createCategoria,
    updateCategoria,
    deleteCategoria,
} = require('../controllers/categorias.controller');

// Importamos los middlewares con la ruta correcta
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación y roles a todas las rutas
router.use(authenticateJWT);
router.use(checkRoles(allowedRoles));

// Ruta para obtener todas las categorías
router.get('/', getCategorias);

// Ruta para crear una nueva categoría
router.post('/', createCategoria);

// Ruta para actualizar una categoría por su ID
router.put('/:id', updateCategoria);

// Ruta para eliminar una categoría por su ID
router.delete('/:id', deleteCategoria);

module.exports = router;
