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

// POST: La ruta se mantiene, ya que los datos de identificación van en el cuerpo (req.body)
router.post('/geo-data', checkRoles(allowedRoles), geoController.upsertGeoData);

//  GET: La ruta cambia para aceptar parámetros de consulta (req.query)
// Esto permite buscar por la clave única compuesta (dpto, ciudad, tipo, padrón/ccc)
router.get('/geo-data', checkRoles(allowedRoles), geoController.getGeoData);

//  DELETE: La ruta cambia para aceptar parámetros de consulta para la eliminación
router.delete('/geo-data', checkRoles(allowedRoles), geoController.deleteGeoData);

module.exports = router;