// src/routes/geo.routes.js
const express = require('express');
const router = express.Router();
const geoController = require('../controllers/geo.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a las rutas estándar
const allowedRoles = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// Rutas protegidas con validación de roles

// POST: 1. Ruta para insertar/actualizar una propiedad (Almacenamiento de GeoJSON)
router.post('/geo-data', checkRoles(allowedRoles), geoController.upsertGeoData);

// POST: 2. ⚡ NUEVA RUTA TURBO para consultar la caché de múltiples padrones (Batch Check)
router.post('/geo-data/batch-check', checkRoles(allowedRoles), geoController.batchCheckGeoData);

// GET: 3. Ruta para obtener geojson por ID (o por query, si el controlador lo soporta)
// Ajustada para usar ID en el parámetro de ruta (asumiendo que getGeoData utiliza req.params.id)
router.get('/geo-data/:id', checkRoles(allowedRoles), geoController.getGeoData);

// DELETE: 4. Ruta para eliminar geojson por ID
// Ajustada para usar ID en el parámetro de ruta (asumiendo que deleteGeoData utiliza req.params.id)
router.delete('/geo-data/:id', checkRoles(allowedRoles), geoController.deleteGeoData);


// ====================================================================
// 🧹 RUTA CRON JOB
// ====================================================================

// DELETE: 5. Nueva ruta para la limpieza de registros antiguos (Cron Job)
// Requiere rol de 'administrador' y es la que debe ser llamada por tu servicio de programación.
router.delete('/geo-data/clean', checkRoles(['administrador']), geoController.cleanGeoDataCache);

module.exports = router;
