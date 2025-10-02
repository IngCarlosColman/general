import axios from 'axios';
import router from '../router';
import { useAuthStore } from '../stores/auth';

/**
 * @fileoverview Instancia de Axios con interceptores para manejo de autenticación
 * y refresco de tokens. Es el cliente HTTP central de la aplicación.
 */

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  
  // CORRECCIÓN CRÍTICA: Se ELIMINA el 'Content-Type: application/json' GLOBAL.
  // Axios ahora inferirá el Content-Type automáticamente:
  // - Para objetos planos (login, register): Asumirá application/json.
  // - Para FormData (submitPaymentProof): Asumirá multipart/form-data con boundary correcto.
  headers: {
    // Dejamos el objeto vacío para no afectar configuraciones futuras si son necesarias.
  },
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    error ? prom.reject(error) : prom.resolve(token);
  });
  failedQueue = [];
};

// Interceptor de solicitud: Añade el token de acceso
axiosClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    if (authStore.token) {
      config.headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    
    // Si estamos enviando FormData (como en la subida de archivos), eliminamos cualquier
    // Content-Type que se haya colado para asegurar que Axios lo genere con el boundary.
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuesta: Maneja errores 401 y renueva el token
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authStore = useAuthStore();
    const originalRequest = error.config;
    const isUnauthorized = error.response?.status === 401;

    // Solo reintentamos si es un error 401 y no es la petición de reintento
    if (isUnauthorized && !originalRequest._retry) {
      if (isRefreshing) {
        // Si ya estamos refrescando, añadimos la petición a la cola
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return axiosClient(originalRequest);
        })
        .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axiosClient.post('/refresh');
        const newAccessToken = response.data.token;
        authStore.setToken(newAccessToken); // ⚠️ Asegúrate de tener esta acción en tu store
        
        processQueue(null, newAccessToken);
        
        // Retorna la petición original con el nuevo token
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return axiosClient(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        console.error('No se pudo refrescar el token, redirigiendo a login...');
        authStore.logout();
        if (router.currentRoute.value.path !== '/login') {
          router.push('/login');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
