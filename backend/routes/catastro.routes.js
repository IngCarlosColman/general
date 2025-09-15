const { Router } = require('express');
const axios = require('axios');
const router = Router();

// URL base de la API externa de Catastro
const CATASTRO_API_URL = 'https://www.catastro.gov.py/expediente-electronico/api/public/consultas-publicas';

// Endpoint que actúa como proxy para la API de Catastro
router.get('/catastro', async (req, res) => {
    try {
        const { endpoint, filters } = req.query;

        // Validar que los parámetros de búsqueda estén presentes
        if (!endpoint || !filters) {
            return res.status(400).json({ error: 'Faltan parámetros de búsqueda (endpoint o filters).' });
        }

        // Convertir la cadena de filtros JSON a un objeto de JavaScript
        const filtersObject = JSON.parse(filters);

        // Hacer la solicitud a la API de Catastro usando el objeto `params` de axios.
        // *** CORRECCIÓN APLICADA AQUÍ: Se eliminó el objeto `params` y se construyó la URL manualmente,
        // *** como lo hiciste en tu primer intento, pero pasando los filtros directamente como un objeto.
        // *** Este formato parece ser el que la API de Catastro espera.
        const response = await axios.get(`${CATASTRO_API_URL}${endpoint}`, {
            params: {
                filters: filters
            },
            headers: {
                'Accept': 'application/json'
            }
        });

        // Enviar la respuesta de la API de Catastro de vuelta al frontend
        res.status(200).json(response.data);

    } catch (error) {
        // Manejar errores de la solicitud
        console.error('Error en la llamada al proxy de Catastro:', error.message);

        if (error.response) {
            // Si la API de Catastro devolvió un error (ej. 406, 400), pasar el estado y el mensaje
            return res.status(error.response.status).json(error.response.data);
        } else {
            // Si el error es de conexión o de otro tipo
            return res.status(500).json({ error: 'Error del servidor al conectar con la API de Catastro.' });
        }
    }
});

module.exports = router;