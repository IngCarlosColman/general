// src/middleware/auth.middleware.js

const jwt = require('jsonwebtoken');

/**
 * Middleware para autenticar un token JWT.
 * Verifica si el token es válido y adjunta el payload a req.user.
 */
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // 1. Verificar la presencia del encabezado y el formato 'Bearer'
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso no autorizado. Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];
    
    // 2. Verificar el token
    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        // 3. Manejo de errores específicos
        if (err.name === 'TokenExpiredError') {
            // 🚨 MEJORA DE CONSISTENCIA: Incluir un código de error para manejo frontend
            return res.status(401).json({ 
                error: 'Token de acceso expirado.',
                code: 'TOKEN_EXPIRED' 
            });
        }
        
        // Error general de token (firma inválida, formato incorrecto)
        console.error('Error al verificar el token:', err.message);
        return res.status(401).json({ error: 'Token inválido.' });
    }
};

/**
 * Middleware para verificar si el usuario tiene uno de los roles permitidos.
 * Se asume que authenticateJWT se ejecutó previamente.
 * @param {string[]} allowedRoles - Un array de roles permitidos.
 */
const checkRoles = (allowedRoles) => (req, res, next) => {
    // Si authenticateJWT pasó, req.user debe existir. Si no tiene rol, el token es inválido o corrupto.
    if (!req.user || !req.user.rol) {
        // Mejor usar 403 Forbidden o 401, dependiendo de la política. Usaremos 403 
        // ya que el usuario 'intentó' autenticarse, pero le faltan datos de rol.
        return res.status(403).json({ error: 'Acceso prohibido. No se pudo verificar el rol del usuario.' });
    }

    if (allowedRoles.includes(req.user.rol)) {
        next();
    } else {
        // 403 Forbidden: Autenticado, pero sin el permiso requerido.
        res.status(403).json({ error: 'Acceso prohibido. No tienes los permisos necesarios.' });
    }
};

module.exports = {
    authenticateJWT,
    checkRoles
};