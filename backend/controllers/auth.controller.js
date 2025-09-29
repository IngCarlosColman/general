const { pool } = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- Constantes ---
const SALT_ROUNDS = 10;
const REFRESH_COOKIE_OPTIONS = {
    // La cookie solo es accesible a través de HTTP, no por JavaScript
    httpOnly: true, 
    // Solo se envía con HTTPS en producción
    secure: process.env.NODE_ENV === 'production', 
    // Protege contra ataques CSRF (Cross-Site Request Forgery)
    sameSite: 'Strict', 
    // 7 días de validez
    maxAge: 7 * 24 * 60 * 60 * 1000 
};


// ===================================================================
// 1. REGISTRO DE USUARIO PÚBLICO (Asigna rol PENDIENTE_PAGO)
// ===================================================================
const register = async (req, res) => {
    const { username, email, password, first_name, last_name, telefono, direccion } = req.body;

    // 🔑 CAMBIO CLAVE: El rol por defecto es ahora PENDIENTE_PAGO
    const defaultRole = 'PENDIENTE_PAGO'; 

    if (!email || !password || !first_name) {
        return res.status(400).json({ error: 'Email, Contraseña y Nombre son obligatorios.' });
    }

    try {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await pool.query(
            // El campo username no es estrictamente obligatorio si se usa email/nombre,
            // pero lo mantenemos si existe en su esquema.
            'INSERT INTO users (username, email, password_hash, rol, first_name, last_name, telefono, direccion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [username, email.toLowerCase(), password_hash, defaultRole, first_name, last_name, telefono, direccion]
        );
        
        const newUser = result.rows[0];
        
        // 🚨 MEJORA DE SEGURIDAD: Eliminar el hash antes de enviar la respuesta
        delete newUser.password_hash; 

        res.status(201).json({ 
            message: 'Registro exitoso. Debe completar el flujo de suscripción para activar su cuenta.', 
            user: newUser 
        });
    } catch (err) {
        if (err.code === '23505') {
            console.error('Error: El email ya está registrado.', err);
            return res.status(409).json({ error: 'El email ya está registrado. Por favor, utiliza otro.' });
        }
        console.error('Error al registrar el usuario:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ===================================================================
// 2. LOGIN DE USUARIO (Verifica rol y pendiente de invitación)
// ===================================================================
const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const userResult = await pool.query('SELECT id, username, email, rol, first_name, last_name, telefono, direccion, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
        const user = userResult.rows[0];
        if (!user) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }

        // --- Lógica de Flujo de Suscripción (Multi-Cuenta) ---
        // 🔑 NUEVO: Si el rol es PENDIENTE_PAGO o visualizador, chequeamos invitaciones.
        if (user.rol === 'PENDIENTE_PAGO' || user.rol === 'visualizador') {
            const checkInvitationQuery = `
                SELECT 1 FROM suscripcion_cuentas_gestion 
                WHERE email_invitado = $1 AND estado_invitacion = 'PENDIENTE_INVITACION'
                LIMIT 1;
            `;
            const invitationResult = await pool.query(checkInvitationQuery, [email.toLowerCase()]);

            if (invitationResult.rowCount > 0) {
                // Si hay una invitación pendiente, generamos un token temporal
                const tempToken = jwt.sign(
                    { id: user.id, email: user.email, rol: user.rol }, 
                    process.env.JWT_SECRET, 
                    { expiresIn: '1h' }
                );

                // Señal al frontend para que fuerce la aceptación de la licencia
                return res.status(200).json({
                    message: 'Invitación pendiente de aceptación.',
                    action: 'ACCEPT_INVITATION', // Señal al frontend
                    token: tempToken,
                    user: { id: user.id, email: user.email, rol: user.rol }
                });
            }
        }
        // --- Fin de Lógica de Flujo de Suscripción ---


        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Verificación de secretos
        if (!process.env.JWT_SECRET || !process.env.REFRESH_SECRET) {
             console.error('❌ Una o ambas variables de secreto (JWT_SECRET/REFRESH_SECRET) no están definidas.');
             return res.status(500).json({ error: 'Configuración de seguridad inválida del servidor.' });
        }
        
        // Generación de tokens
        const accessToken = jwt.sign({
            id: user.id,
            username: user.username,
            email: user.email,
            rol: user.rol,
            first_name: user.first_name,
            last_name: user.last_name,
            telefono: user.telefono,
            direccion: user.direccion
        }, process.env.JWT_SECRET, { expiresIn: '60m' }); // Token de corta duración

        const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_SECRET, { expiresIn: '7d' }); // Token de larga duración

        // Establecer la cookie de refresco
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        res.status(200).json({
            token: accessToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                rol: user.rol,
                first_name: user.first_name,
                last_name: user.last_name,
                telefono: user.telefono,
                direccion: user.direccion
            }
        });
    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ===================================================================
// 3. REFRESH TOKEN (Se mantiene sin cambios, solo genera un nuevo token)
// ===================================================================
const refreshToken = async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ error: 'No se proporcionó refresh token.' });
    }

    try {
        const payload = jwt.verify(token, process.env.REFRESH_SECRET);

        const userResult = await pool.query('SELECT rol, username, email, first_name, last_name, telefono, direccion FROM users WHERE id = $1', [payload.id]);
        const user = userResult.rows[0];
        if (!user) {
            return res.status(403).json({ error: 'Usuario no encontrado.' });
        }

        // Generación de nuevo Access Token
        const newAccessToken = jwt.sign({
            id: payload.id,
            username: user.username,
            email: user.email,
            rol: user.rol,
            first_name: user.first_name,
            last_name: user.last_name,
            telefono: user.telefono,
            direccion: user.direccion
        }, process.env.JWT_SECRET, { expiresIn: '15m' });

        // Generación de un nuevo Refresh Token (para rotación de tokens)
        const newRefreshToken = jwt.sign({ id: payload.id }, process.env.REFRESH_SECRET, { expiresIn: '7d' });

        // Establecer la nueva cookie de refresco
        res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

        res.json({ token: newAccessToken });
    } catch (err) {
        console.error('Error al refrescar el token:', err);
        res.status(403).json({ error: 'Refresh token inválido o expirado.' });
    }
};

// ===================================================================
// 4. LOGOUT (Se mantiene sin cambios)
// ===================================================================
const logout = (req, res) => {
    // Limpia la cookie del refresh token
    const logoutOptions = {
        httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
        secure: REFRESH_COOKIE_OPTIONS.secure,
        sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
    };

    res.clearCookie('refreshToken', logoutOptions);
    res.status(200).json({ message: 'Sesión cerrada correctamente.' });
};

module.exports = {
    register,
    login,
    refreshToken,
    logout
};
