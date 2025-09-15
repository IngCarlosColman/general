const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const authController = require('../controllers/auth.controller'); // Importamos el controlador de autenticación

// Importamos los middlewares de autenticación y de verificación de roles
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a las rutas de gestión de usuarios
const adminRole = ['administrador'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// --- Rutas protegidas por Roles ---

// Ruta para que solo los administradores puedan registrar nuevos usuarios
router.post('/register-user', checkRoles(adminRole), authController.register);

// Ruta para obtener todos los usuarios (solo administradores)
router.get('/users', checkRoles(adminRole), usersController.getAllUsers);

// --- Rutas que solo requieren Autenticación ---

// Ruta para obtener los datos del usuario autenticado
router.get('/user', usersController.getAuthenticatedUser);

// NUEVA RUTA: Ruta PUT para actualizar el perfil de un usuario autenticado
router.put('/users', usersController.updateUserProfile);

module.exports = router;
