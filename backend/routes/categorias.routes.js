// routes/categorias.routes.js

const express = require('express');
const router = express.Router();

// ... Importaciones ...
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
const {
    getCategorias,
    createCategoria,
    updateCategoria,
    deleteCategoria,
} = require('../controllers/categorias.controller');


// Aplicamos el middleware de autenticación a todas las rutas
router.use(authenticateJWT);
//---------------------------------------------------------

// Ruta para obtener todas las categorías (Acceso: readonly, editor, administrador)
router.get('/', getCategorias); // No necesita checkRoles si la intención es que todos las vean

// Si quieres asegurar que solo usuarios logueados pueden verlas, la línea `router.use(authenticateJWT)` es suficiente.

// Rutas CUD: Requieren roles que pueden modificar datos ('editor', 'administrador')
const CUD_ROLES = ['administrador', 'editor'];

// Ruta para crear una nueva categoría
router.post('/', checkRoles(CUD_ROLES), createCategoria);

// Ruta para actualizar una categoría por su ID
router.put('/:id', checkRoles(CUD_ROLES), updateCategoria);

// Ruta para eliminar una categoría por su ID
router.delete('/:id', checkRoles(CUD_ROLES), deleteCategoria);

module.exports = router;