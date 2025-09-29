//src/services/auth.service.js
import api from '../api/axiosClient';

/**
 * Servicio de autenticación con métodos para login, registro, logout, obtener perfil y subida de comprobante.
 */

const login = async (email, password) => {
  try {
    const response = await api.post('/login', { email, password });
    return response.data;
  } catch (error) {
    // Lanza el mensaje de error específico del backend
    throw error.response.data.error;
  }
};

const register = async (username, email, password, first_name, last_name, telefono, direccion) => {
  try {
    const response = await api.post('/register', {
      username,
      email,
      password,
      first_name,
      last_name,
      telefono,
      direccion,
    });
    return response.data;
  } catch (error) {
    // Lanza el mensaje de error específico del backend
    throw error.response.data.error;
  }
};

/**
 * 🟢 FUNCIÓN: Envía el comprobante de pago al backend.
 * @param {string} planId - ID del plan seleccionado (option_id).
 * @param {File} comprobanteFile - El archivo del comprobante a subir.
 * @returns {object} Respuesta del servidor, que incluye el usuario actualizado.
 */
const submitPaymentProof = async (planId, comprobanteFile) => {
  const formData = new FormData();
  // El planId que enviamos es el option_id completo (ej: 'agente_anual')
  formData.append('plan_id', planId); 
  formData.append('comprobante', comprobanteFile); 

  try {
    // Endpoint: /api/subscription/upload-proof
    const response = await api.post('/subscription/upload-proof', formData, {
      headers: {
        // Es CRUCIAL para enviar archivos
        'Content-Type': 'multipart/form-data' 
      }
    });
    // La respuesta contiene { message: '...', user: {...} }
    return response.data;
  } catch (error) {
    // Si la respuesta tiene error.response.data.error, lo lanzamos.
    // Si no, lanzamos un mensaje de error genérico.
    throw error.response?.data?.error || 'Error de conexión o archivo no válido.';
  }
};

const logout = async () => {
  try {
    await api.post('/logout');
  } catch (error) {
    console.error('Error durante el logout:', error);
  }
};

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
 * 🟢 FUNCIÓN RE-AÑADIDA: Obtiene el perfil completo del usuario autenticado.
 * @returns {Promise<object>} Objeto con los datos del usuario.
 */
const getProfile = async () => {
    try {
        // Asumiendo que GET /users devuelve el perfil del usuario autenticado
        const response = await api.get('/users');
        return response.data.user; // Devolvemos el objeto 'user'
    } catch (error) {
        console.error('Error al obtener el perfil:', error);
        throw error.response.data.error || 'Error al cargar perfil';
    }
};


export default {
  login,
  register,
  logout,
  refreshToken,
  submitPaymentProof,
  getProfile, // 🟢 AÑADIDO: Necesario para la acción 'fetchUser' en el store Pinia
};
