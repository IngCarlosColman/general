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
// --- Rutas Protegidas por Roles (Administración) ---
// ==========================================================

// 1. POST: Ruta para que solo los administradores puedan registrar nuevos usuarios
router.post('/register-user', checkRoles(adminRole), authController.register);

// 2. GET: Obtener todos los usuarios (solo administradores). Coincide con el frontend: GET /admin/users
router.get('/admin/users', checkRoles(adminRole), usersController.getAllUsers);


// 3. PUT: Actualizar el perfil y rol de un usuario por ID (solo administradores). Coincide con el frontend: PUT /admin/users/:id
// 🔑 CORRECCIÓN: Se usa updateUserByAdmin para permitir la actualización de cualquier usuario, incluyendo el rol.
router.put('/admin/users/:id', checkRoles(adminRole), usersController.updateUserByAdmin);


// ==========================================================
// --- Rutas de Perfil (Solo requieren Autenticación) ---
// ==========================================================

// 4. Obtener los datos del usuario autenticado
router.get('/me', usersController.getAuthenticatedUser);

// 5. RUTA: Actualización de Perfil Propio (mantiene la ruta anterior para el endpoint de perfil propio)
// Se mantiene updateUserProfile, ya que aquí el ID viene del token (req.user), NO del parámetro :id
router.put('/me/profile', usersController.updateUserProfile); 

module.exports = router;