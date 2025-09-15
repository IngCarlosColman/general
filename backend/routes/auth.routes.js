const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Login de usuario
router.post('/login', authController.login);

// Refresh token
router.post('/refresh', authController.refreshToken);

// Logout
router.post('/logout', authController.logout);

module.exports = router;