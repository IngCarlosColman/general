const { Router } = require('express');
const axios = require('axios');
const router = Router();

const CATASTRO_API_URL = 'https://www.catastro.gov.py/expediente-electronico/api/public/consultas-publicas';

router.get('/catastro', async (req, res) => {
    try {
        const { endpoint, filters } = req.query;

        if (!endpoint || !filters || typeof filters !== 'string') {
            return res.status(400).json({ error: 'Faltan parámetros válidos (endpoint o filters).' });
        }

        let filtersObject;
        try {
            filtersObject = JSON.parse(filters);
        } catch (err) {
            console.error('⚠️ Error al parsear filters:', err.message);
            return res.status(400).json({ error: 'El parámetro filters no es un JSON válido.' });
        }

        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        const fullUrl = `${CATASTRO_API_URL}${normalizedEndpoint}`;

        // 🔍 Detectar tipo de propiedad
        const isRural = normalizedEndpoint.includes('cuenta-rural');
        const isUrbana = normalizedEndpoint.includes('cuenta-corriente');

        // ✅ Validación según tipo
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
        } else {
            return res.status(400).json({ error: 'Tipo de propiedad no reconocido en el endpoint.' });
        }

        // 🛰️ Llamada a la API externa
        console.log('🔗 URL final:', fullUrl);
        console.log('📦 filters JSON:', filtersObject);

        const response = await axios.get(fullUrl, {
            params: {
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
            return res.status(error.response.status).json(error.response.data);
        }
        return res.status(500).json({ error: 'Error del servidor al conectar con la API de Catastro.' });
    }
});

module.exports = router;