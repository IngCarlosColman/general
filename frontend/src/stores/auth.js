// src/stores/auth.js
import { defineStore } from 'pinia';
import authService from '@/services/auth.service';
import { decodeToken } from '@/utils/token'; 
import { useSnackbar } from '@/composables/useSnackbar'; // 🟢 Importamos el snackbar para mensajes

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
        // 🟢 ESTADO PARA CONTROLAR EL SPLASH SCREEN
        showPostLoginSplash: false, 
    }),

    getters: {
        isLoggedIn: (state) => !!state.token && !!state.user,
        rol: (state) => state.user?.rol || 'guest',
        isAdmin: (state) => state.user?.rol === 'administrador',
        isEditor: (state) => state.user?.rol === 'editor',
        userId: (state) => state.user?.id || null, 
        
        // 🟢 GETTER: Combina first_name y last_name para el splash
        fullName: (state) => {
            const firstName = state.user?.first_name || '';
            const lastName = state.user?.last_name || '';
            
            if (firstName || lastName) {
                // Junta first_name y last_name, asegurando un espacio y eliminando espacios extra
                return `${firstName} ${lastName}`.trim();
            }
            return state.user?.username || 'Usuario';
        },
    },

    actions: {
        /**
         * 🟢 ACCIÓN: Reemplaza el objeto de usuario actual con nuevos datos.
         * Se usa tras actualizar el perfil, subir un comprobante o recargar los datos (fetchUser).
         * @param {object} userData - El nuevo objeto de usuario recibido del backend.
         */
        setUser(userData) {
            // Asegura que solo se actualice si hay datos válidos
            if (userData && typeof userData === 'object') {
                this.user = { ...this.user, ...userData }; // Fusiona o reemplaza el objeto
            }
        },

        /**
         * 🟢 NUEVA ACCIÓN: Recarga los datos del usuario llamando a auth.service.getProfile().
         */
        async fetchUser() {
            if (!this.isLoggedIn) return; // Salir si no hay sesión activa

            this.isLoading = true;
            try {
                // Llama a la nueva función del servicio (asume que devuelve {user: data})
                const userData = await authService.getProfile(); 
                
                // Actualiza el estado del store con los datos frescos
                this.setUser(userData); 

                return userData; // Devuelve los datos recargados
            } catch (error) {
                console.error('[AUTH STORE] Error al recargar datos del usuario:', error);
                
                // Si el error es de autenticación (ej: 401/403), cerramos sesión.
                if (error.status === 401 || error.status === 403 || error === 'Token de acceso inválido o expirado.') {
                    // Obtenemos el composable para mostrar el mensaje de error al usuario
                    const { showSnackbar } = useSnackbar(); 
                    showSnackbar('Tu sesión ha expirado, por favor vuelve a iniciar sesión.', 'error', 5000);
                    this.logoutLocal();
                }

                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        async login(email, password) {
            this.isLoading = true;
            this.authError = null;
            try {
                const response = await authService.login(email, password);
                
                this.setToken(response.token);
                // 🟢 Mostrar el splash screen solo después de un login exitoso
                this.showPostLoginSplash = true; 
                // Ocultar el splash después de 3 segundos
                setTimeout(() => {
                    this.showPostLoginSplash = false;
                }, 3000); // 3000 ms = 3 segundos

            } catch (error) {
                this.authError = error;
                this.logoutLocal(); 
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        async register(username, email, password, first_name, last_name, telefono, direccion) {
            this.isLoading = true;
            this.authError = null;
            try {
                const response = await authService.register(username, email, password, first_name, last_name, telefono, direccion);
                // El registro no loguea automáticamente, solo devuelve el mensaje de éxito
                return response; 
            } catch (error) {
                this.authError = error;
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
            // Solo actualizamos el estado base del token decodificado
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
