const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const authController = require('../controllers/auth.controller');

// Importamos los middlewares de autenticación y de verificación de roles
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a las rutas de gestión de usuarios
const adminRole = ['administrador'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// ==========================================================
// --- Rutas Protegidas por Roles ---
// ==========================================================

// Ruta para que solo los administradores puedan registrar nuevos usuarios
router.post('/register-user', checkRoles(adminRole), authController.register);

// Ruta para obtener todos los usuarios (solo administradores)
router.get('/users', checkRoles(adminRole), usersController.getAllUsers);


// ==========================================================
// --- Rutas de Perfil (Solo requieren Autenticación) ---
// ==========================================================

// 1. Obtener los datos del usuario autenticado
router.get('/me', usersController.getAuthenticatedUser);

// 2. 🔑 RUTA RECOMENDADA: Actualización de Perfil Propio
// Usamos '/me/profile' para indicar que se actualiza el recurso propio.
// El controlador usa req.user.id, lo que garantiza que solo el usuario se actualice a sí mismo.
router.put('/me/profile', usersController.updateUserProfile); 

module.exports = router;
