// src/api/axiosClient.js
import axios from 'axios';
import router from '../router';
import { useAuthStore } from '../stores/auth';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor de solicitud: AHORA sí necesitamos agregar el 'Authorization'
axiosClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    // Añadimos el accessToken a la cabecera si existe
    if (authStore.token) {
      config.headers['Authorization'] = `Bearer ${authStore.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    error ? prom.reject(error) : prom.resolve(token);
  });
  failedQueue = [];
};

// Interceptor de respuesta: maneja errores 401 y renueva el token
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authStore = useAuthStore();
    const originalRequest = error.config;
    const isUnauthorized = error.response?.status === 401;
    const isRetry = originalRequest._isRetry;

    if (isUnauthorized && !isRetry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._isRetry = true;
      isRefreshing = true;

      try {
        const response = await axiosClient.post('/refresh');
        const newAccessToken = response.data.token;
        authStore.setToken(newAccessToken); // ⚠️ Guardamos el nuevo token

        processQueue(null, newAccessToken); // Resolvemos las peticiones en cola con el nuevo token
        
        // Retornamos la solicitud original con el nuevo token
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await authStore.logout();
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