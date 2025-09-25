// ./middlewares/rate_limit.middleware.js

const rateLimit = require('express-rate-limit');
// 🚨 IMPORTACIÓN REQUERIDA: Importamos el helper para generar claves de IP seguras
const { ipKeyGenerator } = require('express-rate-limit'); 

/**
 * Middleware para limitar la tasa de solicitudes (Rate Limiting).
 * * Configurado para limitar las peticiones por usuario autenticado (req.user.id).
 * @param {number} limit - Número máximo de solicitudes permitidas.
 * @param {number} windowInSeconds - Ventana de tiempo en segundos.
 */
const rateLimitMiddleware = (limit, windowInSeconds) => rateLimit({
    // Configuración de la ventana de tiempo en milisegundos
    windowMs: windowInSeconds * 1000, 
    // Número máximo de solicitudes en esa ventana
    max: limit, 

    // ✅ CORRECCIÓN: Usamos ipKeyGenerator si el usuario no está autenticado
    keyGenerator: (req, res) => {
        // Prioridad 1: ID de Usuario (si está autenticado)
        if (req.user) {
            return req.user.id;
        }
        
        // Prioridad 2: IP del Request. 
        // Usamos ipKeyGenerator para manejar correctamente los formatos IPv6 y evitar el error/vulnerabilidad.
        return ipKeyGenerator(req, res); 
    }, 
    
    // Mensaje de error cuando se excede el límite
    message: (req, res) => {
        return res.status(429).json({
            error: 'Demasiadas solicitudes.', 
            message: `Has excedido el límite de ${limit} consultas en ${windowInSeconds} segundos. Intenta de nuevo más tarde.`,
            limit_reset: windowInSeconds
        });
    },
    // Envía los encabezados de límite de tasa (X-RateLimit-Limit, etc.)
    standardHeaders: true, 
    // Deshabilita los encabezados de retrocompatibilidad
    legacyHeaders: false, 
});

module.exports = { rateLimitMiddleware };