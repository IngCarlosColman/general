import api from '../api/axiosClient';
import { useAuthStore } from '@/stores/auth';

/**
 * @fileoverview Servicio centralizado para todas las operaciones de autenticación y de usuario.
 * @module auth.service
 */

/**
 * @description Inicia sesión del usuario en el sistema.
 * @param {string} email - Correo electrónico del usuario.
 * @param {string} password - Contraseña del usuario.
 * @returns {Promise<object>} Objeto de respuesta que incluye tokens y datos del usuario.
 * @throws {string} Mensaje de error si la autenticación falla.
 */
const login = async (email, password) => {
  try {
    const response = await api.post('/login', { email, password });
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Error de red o el servidor no responde.';
  }
};

/**
 * @description Registra un nuevo usuario en el sistema.
 * @param {object} userData - Datos necesarios para el registro (ej: nombre, email, password).
 * @returns {Promise<object>} Objeto de respuesta con el usuario recién creado.
 * @throws {string} Mensaje de error si el registro falla.
 */
const register = async (userData) => {
  try {
    const response = await api.post('/register', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Error de red o el servidor no responde.';
  }
};

/**
 * @description Envía el FormData con el plan y el comprobante de pago para solicitar la activación.
 * @param {FormData} formData - Payload con 'comprobante' y 'plan_solicitado'.
 * @returns {Promise<object>} Respuesta del servidor, que incluye el usuario actualizado y un mensaje.
 * @throws {string} Mensaje de error si el servidor rechaza la subida.
 */
const submitPaymentProof = async (formData) => {
  try {
    const response = await api.post('/subscription/upload-proof', formData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Error de conexión o archivo no válido.';
  }
};

/**
 * @description Cierra la sesión del usuario.
 * @returns {Promise<void>}
 */
const logout = async () => {
  try {
    await api.post('/logout');
  } catch (error) {
    console.error('Error durante el logout, ignorando:', error);
  }
};

/**
 * @description Solicita un nuevo token de acceso usando el token de refresco (generalmente usado por interceptores).
 * @returns {Promise<object>} Objeto con el nuevo token.
 * @throws {object} Error si el refresco falla.
 */
const refreshToken = async () => {
  try {
    const response = await api.post('/refresh');
    return response.data;
  } catch (error) {
    console.error('Error al refrescar el token:', error);
    throw error;
  }
};

/**
 * @description Obtiene el perfil completo del usuario autenticado.
 * @returns {Promise<object>} Objeto con los datos del usuario.
 * @throws {string} Mensaje de error si la carga falla.
 */
const getProfile = async () => {
  try {
    const response = await api.get('/users');
    return response.data.user;
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    throw error.response?.data?.error || 'Error al cargar perfil';
  }
};

export default {
  login,
  register,
  logout,
  refreshToken,
  submitPaymentProof,
  getProfile,
};