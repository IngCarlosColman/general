const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// ==========================================================
// RUTAS DE ACCESO PÚBLICO (No requieren JWT)
// ==========================================================

// 1. Registro de nuevo usuario. Asigna rol PENDIENTE_PAGO.
router.post('/register', authController.register); // <-- ¡ESTA ES LA LÍNEA CLAVE!

// 2. Login de usuario
router.post('/login', authController.login);

// 3. Refresh token
router.post('/refresh', authController.refreshToken);

// 4. Logout
router.post('/logout', authController.logout);


module.exports = router;