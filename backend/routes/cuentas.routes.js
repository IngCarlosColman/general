// ... Importaciones ...
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { rateLimitMiddleware } = require('../middlewares/rate_limit.middleware'); 

// URL base para la consulta de cuentas catastrales
const CUENTAS_API_URL = 'https://www.catastro.gov.py/api/v1/public/cuentas';

// Endpoint que actúa como proxy para la API de cuentas
router.get('/cuentas', 
    authenticateJWT, // 1. Restringe el acceso a usuarios logueados
    // 🚨 AJUSTE: Limitado a 50 solicitudes dentro de un período de 60 segundos
    rateLimitMiddleware(50, 60), // Límite de 50 solicitudes por minuto
    async (req, res) => {
        try {
            const response = await axios.get(CUENTAS_API_URL, {
                params: req.query,
            });

            res.status(200).json(response.data);
        } catch (error) {
            console.error('Error en la llamada al proxy de cuentas:', error.message);
            
            if (error.response) {
                return res.status(error.response.status).json(error.response.data);
            } else {
                return res.status(500).json({ error: 'Error del servidor al conectar con la API de cuentas.' });
            }
        }
    }
);

module.exports = router;