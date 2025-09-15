import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // Asegúrate de que esta URL sea la correcta
  withCredentials: true, // Esto es crucial para enviar y recibir cookies (como el refreshToken)
});

// Interceptor para peticiones (agregar el token de acceso)
api.interceptors.request.use(
  (config) => {
    // Obtiene el token del store de Pinia, no de localStorage
    const authStore = useAuthStore();
    const token = authStore.token;
    if (token) {
      // Si existe, lo adjunta a los headers de la petición
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para respuestas (manejar el refresco del token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authStore = useAuthStore();
    const originalRequest = error.config;

    // Si el error es 401 y no es la petición de refresh, intentamos refrescar el token
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Previene bucles infinitos
      try {
        await authStore.refreshToken();
        // Después de refrescar, reintentamos la petición original con el nuevo token
        return api(originalRequest);
      } catch (refreshError) {
        // Si el refresh falla (token expirado), cerramos la sesión
        console.error('No se pudo refrescar el token, redirigiendo a login...');
        authStore.logout();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
