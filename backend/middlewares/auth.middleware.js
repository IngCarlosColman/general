// src/middleware/auth.middleware.js

const jwt = require('jsonwebtoken');

/**
 * Middleware para autenticar un token JWT.
 * @param {object} req - El objeto de solicitud.
 * @param {object} res - El objeto de respuesta.
 * @param {function} next - La siguiente función de middleware.
 */
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso no autorizado. Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado. Por favor, inicie sesión nuevamente.' });
        }
        console.error('Error al verificar el token:', err);
        return res.status(401).json({ error: 'Token inválido.' });
    }
};

/**
 * Middleware para verificar si el usuario tiene uno de los roles permitidos.
 * @param {string[]} allowedRoles - Un array de roles permitidos.
 * @returns {function} Middleware de Express.
 */
const checkRoles = (allowedRoles) => (req, res, next) => {
    if (!req.user || !req.user.rol) {
        return res.status(401).json({ error: 'Acceso no autorizado. No se encontró información del rol del usuario.' });
    }

    if (allowedRoles.includes(req.user.rol)) {
        next();
    } else {
        res.status(403).json({ error: 'Acceso prohibido. No tienes los permisos necesarios.' });
    }
};

module.exports = {
    authenticateJWT,
    checkRoles
};