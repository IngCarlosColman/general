// src\stores\app.js
import { defineStore } from 'pinia';
import authService from '@/services/auth.service';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    // Estado del usuario
    user: null,
    // El token de acceso JWT
    token: sessionStorage.getItem('accessToken') || null,
    // Estado de la sesión (se determina a partir del token)
    isLoggedIn: !!sessionStorage.getItem('accessToken'),
    // Manejo de errores de autenticación
    authError: null,
    // Estado de carga para mostrar spinners
    isLoading: false,
  }),

  actions: {
    /**
     * Inicia sesión del usuario
     * @param {string} email
     * @param {string} password
     */
    async login(email, password) {
      this.isLoading = true;
      this.authError = null;
      try {
        const response = await authService.login(email, password);

        // Guardar el token y los datos del usuario en el estado y en sessionStorage
        this.token = response.token;
        this.user = response.user;
        this.isLoggedIn = true;
        sessionStorage.setItem('accessToken', response.token);
        
      } catch (error) {
        this.authError = error;
        this.isLoggedIn = false;
        // Lanzamos el error para que el componente que lo llame lo pueda manejar
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Cierra la sesión del usuario
     */
    async logout() {
      try {
        await authService.logout();
      } finally {
        // Limpiamos el estado y el sessionStorage, independientemente del resultado del API
        this.user = null;
        this.token = null;
        this.isLoggedIn = false;
        sessionStorage.removeItem('accessToken');
        // Redirigir a la página de login
        this.router.push('/login');
      }
    },

    /**
     * Refresca el token de acceso usando el token de refresco (cookie)
     */
    async refreshToken() {
      try {
        const newToken = await authService.refreshToken();
        this.token = newToken;
        this.isLoggedIn = true;
        sessionStorage.setItem('accessToken', newToken);
      } catch (error) {
        console.error('No se pudo refrescar el token, redirigiendo a login...');
        this.logout();
      }
    },

    /**
     * Obtiene los datos del usuario autenticado desde el servidor.
     * Esta acción es útil para restaurar el estado del usuario al recargar la página.
     */
    async fetchUser() {
        this.isLoading = true;
        try {
            const user = await authService.getUserData(); // Asumimos un nuevo servicio para obtener el usuario
            this.user = user;
        } catch (error) {
            console.error('Error al obtener los datos del usuario:', error);
            // Si el token no es válido, cerramos la sesión
            this.logout();
        } finally {
            this.isLoading = false;
        }
    },

    /**
     * Verifica la autenticación al cargar la página y restaura el estado.
     */
    async checkAuth() {
      const storedToken = sessionStorage.getItem('accessToken');
      if (storedToken) {
        this.isLoggedIn = true;
        this.token = storedToken;
        // Si hay un token, obtenemos los datos del usuario para restaurar el estado
        await this.fetchUser();
      } else {
        this.isLoggedIn = false;
        this.token = null;
        this.user = null; // Nos aseguramos de que el usuario sea nulo si no hay token
      }
    }
  },
});
