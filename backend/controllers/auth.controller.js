const { pool } = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SALT_ROUNDS = 10;

// Registro de usuario
const register = async (req, res) => {
    const { username, email, password, first_name, last_name, telefono, direccion } = req.body;

    try {
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const defaultRole = 'editor';

        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, rol, first_name, last_name, telefono, direccion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [username, email, password_hash, defaultRole, first_name, last_name, telefono, direccion]
        );
        res.status(201).json({ message: 'Usuario registrado con éxito', user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            console.error('Error: El email ya está registrado.', err);
            return res.status(409).json({ error: 'El email ya está registrado. Por favor, utiliza otro.' });
        }
        console.error('Error al registrar el usuario:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// Login de usuario
const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // ⚠️ CORRECCIÓN CLAVE: Ahora seleccionamos el 'password_hash' de la base de datos
        const userResult = await pool.query('SELECT id, username, email, rol, first_name, last_name, telefono, direccion, password_hash FROM users WHERE email = $1', [email]);
        const user = userResult.rows[0];
        if (!user) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(400).json({ error: 'Credenciales inválidas.' });
        }

        // ⚠️ CAMBIO: Actualizamos la fecha de último inicio de sesión
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // ⚠️ CORRECCIÓN: Incluimos todos los campos en el JWT
        const accessToken = jwt.sign({
            id: user.id,
            username: user.username,
            email: user.email,
            rol: user.rol,
            first_name: user.first_name,
            last_name: user.last_name,
            telefono: user.telefono,
            direccion: user.direccion
        }, process.env.JWT_SECRET, { expiresIn: '15m' });

        const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_SECRET, { expiresIn: '7d' });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // ⚠️ CORRECCIÓN: Incluimos los nuevos campos en la respuesta
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

// Refresh token
const refreshToken = async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ error: 'No se proporcionó refresh token.' });
    }

    try {
        const payload = jwt.verify(token, process.env.REFRESH_SECRET);

        // ⚠️ CORRECCIÓN: Seleccionamos todos los campos para el nuevo token
        const userResult = await pool.query('SELECT rol, username, email, first_name, last_name, telefono, direccion FROM users WHERE id = $1', [payload.id]);
        const user = userResult.rows[0];
        if (!user) {
            return res.status(403).json({ error: 'Usuario no encontrado.' });
        }

        // ⚠️ CORRECCIÓN: Creamos un nuevo token con todos los campos
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

        const newRefreshToken = jwt.sign({ id: payload.id }, process.env.REFRESH_SECRET, { expiresIn: '7d' });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ token: newAccessToken });
    } catch (err) {
        console.error('Error al refrescar el token:', err);
        res.status(403).json({ error: 'Refresh token inválido o expirado.' });
    }
};

// Logout
const logout = (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict'
    });
    res.status(200).json({ message: 'Sesión cerrada correctamente.' });
};

module.exports = {
    register,
    login,
    refreshToken,
    logout
};
