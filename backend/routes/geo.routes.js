const express = require('express');
const router = express.Router();
const geoController = require('../controllers/geo.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a las rutas estándar
const allowedRoles = ['administrador', 'editor', 'visualizador']; 
// NOTA: Se añade 'visualizador' para consultas, aunque 'administrador' y 'editor' también pueden.

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT);

// ====================================================================
// RUTAS DE ESCRITURA (REQUIEREN ADMINISTRADOR/EDITOR)
// ====================================================================

// 1. POST (UPSERT): Ruta para insertar/actualizar una propiedad con su geometría.
router.post('/geo-data', checkRoles(['administrador', 'editor']), geoController.upsertGeoData);

// 2. DELETE (POR ID): Ruta para eliminar un registro por su ID de la base de datos.
router.delete('/geo-data/:id', checkRoles(['administrador', 'editor']), geoController.deleteGeoData);


// ====================================================================
// RUTAS DE LECTURA / CONSULTA (CACHÉ Y ESPACIAL)
// ====================================================================

// 3. POST (BATCH-CHECK): Ruta para consultar la caché de múltiples padrones a la vez.
// Es un POST porque se envían datos (el array de padrones) en el body.
router.post('/geo-data/batch-check', checkRoles(allowedRoles), geoController.batchCheckGeoData);

// 4. POST (QUERY ESPACIAL): 🔑 NUEVA RUTA. Realiza una búsqueda espacial por polígono
// y filtros atributivos (área, tipo_propiedad). Es POST porque la geometría va en el body.
router.post('/geo-data/query', checkRoles(allowedRoles), geoController.queryGeoData);

// 5. GET (DETALLE): Ruta para obtener el detalle de un registro por su clave de negocio
// (cod_dep, cod_ciu, tipo_propiedad, padron_ccc) usando query parameters.
// Ejemplo de llamada: GET /geo-data?cod_dep=X&cod_ciu=Y&padron_ccc=Z
router.get('/geo-data', checkRoles(allowedRoles), geoController.getGeoData);


// ====================================================================
// RUTA CRON JOB (REQUIERE MÁXIMOS PERMISOS)
// ====================================================================

// 6. DELETE (LIMPIEZA): Ruta para la limpieza de registros antiguos (Cron Job).
router.delete('/geo-data/clean', checkRoles(['administrador']), geoController.cleanGeoDataCache);

module.exports = router;
