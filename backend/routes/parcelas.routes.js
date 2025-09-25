const { Router } = require('express');
const axios = require('axios');
const router = Router();

// Importamos los middlewares necesarios
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { rateLimitMiddleware } = require('../middlewares/rate_limit.middleware'); 

const PARCELAS_API_URL = 'https://www.catastro.gov.py/geoserver/ows';

// 🚨 BLINDAJE: Función para sanear y escapar comillas simples para CQL
function sanitizeCQL(input) {
    if (typeof input !== 'string') {
        input = String(input); 
    }
    // Reemplaza comillas simples (') con doble comilla simple ('') para escapar la inyección.
    return input.replace(/'/g, "''"); 
}


// Endpoint que actúa como proxy para las peticiones de geodatos (AHORA BLINDADO)
router.get('/parcelas-geojson', 
    authenticateJWT, // 1. Restringe a usuarios logueados
    rateLimitMiddleware(50, 60), // 2. Limita a 50 solicitudes/min por usuario
    async (req, res) => {
        try {
            const { dpto, dist, padron } = req.query;

            // 3. Validación y saneamiento
            if (!dpto || !dist || !padron) {
                return res.status(400).json({ error: 'Faltan parámetros obligatorios: dpto, dist, padron.' });
            }

            // 🚨 SANEAMIENTO: Aplicar saneamiento a todas las entradas
            const safeDpto = sanitizeCQL(dpto);
            const safeDist = sanitizeCQL(dist);
            const safePadron = sanitizeCQL(padron);

            // Parámetros fijos del servicio WFS
            const params = {
                service: 'WFS',
                version: '1.1.0',
                request: 'GetFeature',
                outputFormat: 'application/json',
                srsname: 'EPSG:32721',
                typename: 'snc:parcelas_activas',
                
                // 4. CONSTRUCCIÓN BLINDADA del filtro CQL
                // Las variables ya están saneadas. Se asume que dist/dpto/padron son strings en la API externa.
                CQL_FILTER: `dist='${safeDist}' AND dpto='${safeDpto}' AND padron='${safePadron}'`
            };
            
            console.log('🔍 Consulta CQL blindada:', params.CQL_FILTER);

            const response = await axios.get(PARCELAS_API_URL, {
                params: params,
                headers: {
                     'Accept': 'application/json',
                     'User-Agent': 'Mozilla/5.0'
                }
            });

            res.status(200).json(response.data);
        } catch (error) {
            console.error('❌ Error en la llamada al proxy de parcelas GeoJSON:', error.message);
            if (error.response) {
                return res.status(error.response.status).json(error.response.data);
            } else {
                return res.status(500).json({ error: 'Error del servidor al conectar con la API de parcelas.' });
            }
        }
    }
);

module.exports = router;