// src/routes/geo.routes.js
const express = require('express');
const router = express.Router();
const geoController = require('../controllers/geo.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles
router.post('/geo-data', checkRoles(allowedRoles), geoController.upsertGeoData);
router.get('/geo-data/:id', checkRoles(allowedRoles), geoController.getGeoData);
router.delete('/geo-data/:id', checkRoles(allowedRoles), geoController.deleteGeoData);

module.exports = router;