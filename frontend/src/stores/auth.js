// src/stores/auth.js
import { defineStore } from 'pinia';
import authService from '@/services/auth.service';
import { decodeToken } from '@/utils/token'; 

// Función auxiliar para obtener el usuario decodificado al inicio
const getInitialUser = () => {
    const token = sessionStorage.getItem('accessToken');
    return decodeToken(token);
};

export const useAuthStore = defineStore('auth', {
    state: () => ({
        // Restaurar el estado del token
        token: sessionStorage.getItem('accessToken') || null,
        user: getInitialUser(), 
        authError: null,
        isLoading: false,
    }),

    getters: {
        isLoggedIn: (state) => !!state.token && !!state.user,
        rol: (state) => state.user?.rol || 'guest',
        isAdmin: (state) => state.user?.rol === 'administrador',
        isEditor: (state) => state.user?.rol === 'editor',
        userId: (state) => state.user?.id || null, 
    },

    actions: {
        async login(email, password) {
            this.isLoading = true;
            this.authError = null;
            try {
                const response = await authService.login(email, password);
                const newToken = response.token;
                this.setToken(newToken);
            } catch (error) {
                this.authError = error;
                this.logoutLocal(); 
                throw error;
            } finally {
                this.isLoading = false;
            }
        },
        setToken(newToken) {
            const decodedUser = decodeToken(newToken);
            
            if (!decodedUser) {
                this.logoutLocal(); 
                return;
            }

            this.token = newToken;
            this.user = decodedUser; 
            sessionStorage.setItem('accessToken', newToken);
        },

        logoutLocal() {
            this.user = null;
            this.token = null;
            sessionStorage.removeItem('accessToken');
        },

        async logout() {
            try {
                await authService.logout(); 
            } catch (error) {
                console.error('Error durante el logout del backend, limpiando localmente:', error);
            } finally {
                this.logoutLocal();
            }
        },

        async refreshToken() {
            try {
                const response = await authService.refreshToken();
                this.setToken(response.token);
            } catch (error) {
                console.error('No se pudo refrescar el token:', error);
                this.logout(); // Redirige a login si el refresh falla
                throw error;
            }
        },
    },
});