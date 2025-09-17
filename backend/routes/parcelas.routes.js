const { Router } = require('express');
const axios = require('axios');
const router = Router();

// URL base para el servicio de geodatos (GeoServer OWS)
const PARCELAS_API_URL = 'https://www.catastro.gov.py/geoserver/ows';

// Endpoint que actúa como proxy para las peticiones de geodatos
router.get('/parcelas-geojson', async (req, res) => {
    try {
        // Extraemos los parámetros de la URL del frontend
        const params = req.query;

        // Agregamos los parámetros fijos que requiere el servicio WFS
        params.service = 'WFS';
        params.version = '1.1.0';
        params.request = 'GetFeature';
        params.outputFormat = 'application/json';
        params.srsname = 'EPSG:32721';
        params.typename = 'snc:parcelas_activas';

        // Construimos el filtro `CQL_FILTER`
        const { dpto, dist, padron } = params;
        params.CQL_FILTER = `dist=${dist} AND dpto='${dpto}' AND padron='${padron}'`;

        const response = await axios.get(PARCELAS_API_URL, {
            params: params,
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error en la llamada al proxy de parcelas GeoJSON:', error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        } else {
            return res.status(500).json({ error: 'Error del servidor al conectar con la API de parcelas.' });
        }
    }
});

module.exports = router;