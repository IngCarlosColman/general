const { Router } = require('express');
const axios = require('axios');
const router = Router();

// Lista blanca de endpoints permitidos.
// Estos son los únicos valores válidos para el parámetro 'endpoint'.
const ALLOWED_ENDPOINTS = [
    '/cuenta-rural/consultar', 
    '/cuenta-corriente/consultar',
    // Si la API tiene otros endpoints, agrégalos aquí.
];

const CATASTRO_API_URL = 'https://www.catastro.gov.py/expediente-electronico/api/public/consultas-publicas';

router.get('/catastro', async (req, res) => {
    try {
        const { endpoint, filters } = req.query;

        // 1. Validación de existencia de parámetros
        if (!endpoint || !filters || typeof filters !== 'string') {
            return res.status(400).json({ error: 'Faltan parámetros válidos (endpoint o filters).' });
        }

        // 2. 🚨 BLINDAJE CRÍTICO: VALIDACIÓN DE LISTA BLANCA (SSRF PREVENTION)
        // Normalizar el endpoint asegurando que empiece con '/'
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

        if (!ALLOWED_ENDPOINTS.includes(normalizedEndpoint)) {
            // El endpoint solicitado no está en la lista blanca y es rechazado.
            return res.status(403).json({ 
                error: 'Endpoint no autorizado o no reconocido.',
                disponible: ALLOWED_ENDPOINTS 
            });
        }
        
        // El resto de la lógica de construcción de URL ahora es segura
        const fullUrl = `${CATASTRO_API_URL}${normalizedEndpoint}`;

        let filtersObject;
        try {
            filtersObject = JSON.parse(filters);
        } catch (err) {
            console.error('⚠️ Error al parsear filters:', err.message);
            return res.status(400).json({ error: 'El parámetro filters no es un JSON válido.' });
        }

        // 3. Validación de Esquema (406 Not Acceptable)
        const isRural = normalizedEndpoint.includes('cuenta-rural');
        const isUrbana = normalizedEndpoint.includes('cuenta-corriente');

        if (isRural) {
            const { padron, idDepartamento, idCiudad } = filtersObject;
            if (!padron || !idDepartamento || !idCiudad) {
                return res.status(406).json({
                    error: 'Faltan parámetros para propiedad rural.',
                    required: ['padron', 'idDepartamento', 'idCiudad']
                });
            }
        } else if (isUrbana) {
            const { zona, manzana, lote, idDepartamento, idCiudad } = filtersObject;
            if (!zona || !manzana || !lote || !idDepartamento || !idCiudad) {
                return res.status(406).json({
                    error: 'Faltan parámetros obligatorios para propiedad urbana.',
                    required: ['zona', 'manzana', 'lote', 'idDepartamento', 'idCiudad'],
                    optional: ['pisoNivel', 'dptoSalon']
                });
            }
        } 
        // Nota: Si el endpoint no es ni rural ni urbana, ya fue detenido por la lista blanca.

        // 🛰️ Llamada a la API externa
        console.log('🔗 URL final:', fullUrl);
        console.log('📦 filters JSON:', filtersObject);

        const response = await axios.get(fullUrl, {
            params: {
                // Se sigue enviando 'filters' como string JSON para la API de Catastro
                filters: JSON.stringify(filtersObject) 
            },
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        res.status(200).json(response.data);

    } catch (error) {
        console.error('❌ Error en proxy Catastro:', error.message);
        if (error.response) {
            console.error('📄 Respuesta del servidor externo:', error.response.data);
            // Propagar el código de estado y el cuerpo del error de la API externa
            return res.status(error.response.status).json(error.response.data); 
        }
        return res.status(500).json({ error: 'Error del servidor al conectar con la API de Catastro.' });
    }
});

module.exports = router;