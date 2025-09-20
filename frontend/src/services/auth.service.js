//src/services/auth.service.js
import api from '../api/axiosClient';

const login = async (email, password) => {
  try {
    const response = await api.post('/login', { email, password });
    return response.data;
  } catch (error) {
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

export default {
  login,
  register,
  logout,
  refreshToken,
};
