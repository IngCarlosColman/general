// src/stores/auth.js
import { defineStore } from 'pinia';
import authService from '@/services/auth.service';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    // Restaurar el estado del token y la autenticación desde sessionStorage
    token: sessionStorage.getItem('accessToken') || null,
    isLoggedIn: !!sessionStorage.getItem('accessToken'),
    user: null,
    authError: null,
    isLoading: false,
  }),

  actions: {
    async login(email, password) {
      this.isLoading = true;
      this.authError = null;
      try {
        const response = await authService.login(email, password);
        this.token = response.token;
        this.user = response.user;
        this.isLoggedIn = true;
        // Persistir el token en el sessionStorage
        sessionStorage.setItem('accessToken', response.token);
      } catch (error) {
        this.authError = error;
        this.isLoggedIn = false;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    setUser(userData) {
      this.user = userData;
    },

    async logout() {
      try {
        await authService.logout();
      } finally {
        this.user = null;
        this.token = null;
        this.isLoggedIn = false;
        // Limpiar el sessionStorage
        sessionStorage.removeItem('accessToken');
      }
    },

    async refreshToken() {
      try {
        const response = await authService.refreshToken();
        this.token = response.token;
        this.isLoggedIn = true;
        // Persistir el nuevo token
        sessionStorage.setItem('accessToken', response.token);
      } catch (error) {
        console.error('No se pudo refrescar el token:', error);
        this.logout(); // Redirige a login si el refresh falla
        throw error;
      }
    },
  },
});