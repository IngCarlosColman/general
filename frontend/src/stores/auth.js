import { defineStore } from 'pinia';
import authService from '@/services/auth.service';
import { decodeToken } from '@/utils/token'; 
import { useSnackbar } from '@/composables/useSnackbar'; 

// Función auxiliar para inicializar el estado del usuario al cargar la aplicación.
// Intenta decodificar el token de sessionStorage para restaurar la sesión.
const getInitialUser = () => {
    const token = sessionStorage.getItem('accessToken');
    // Si el token existe, intenta decodificarlo. Si falla, devuelve null.
    return decodeToken(token); 
};

export const useAuthStore = defineStore('auth', {
    // ------------------------------------
    // ESTADO (STATE)
    // ------------------------------------
    state: () => ({
        // Restaurar el token de sessionStorage
        token: sessionStorage.getItem('accessToken') || null,
        user: getInitialUser(), // Restaurar el usuario decodificado (con datos base: id, rol, etc.)
        authError: null,
        isLoading: false,
        // Estado para controlar la visibilidad del splash screen después del login
        showPostLoginSplash: false, 
    }),

    // ------------------------------------
    // GETTERS
    // ------------------------------------
    getters: {
        // Indica si el usuario está autenticado (tiene token y usuario válidos)
        isLoggedIn: (state) => !!state.token && !!state.user,
        rol: (state) => state.user?.rol || 'guest',
        
        // Comprobaciones de roles específicos
        isAdmin: (state) => state.user?.rol === 'administrador',
        isEditor: (state) => state.user?.rol === 'editor',
        // Comprueba si el usuario está en proceso de activación de suscripción
        isPending: (state) => state.user?.rol === 'PENDIENTE_PAGO' || state.user?.rol === 'PENDIENTE_REVISION',
        userId: (state) => state.user?.id || null, 
        
        // Combina first_name y last_name para el mensaje del splash screen
        fullName: (state) => {
            const firstName = state.user?.first_name || '';
            const lastName = state.user?.last_name || '';
            
            if (firstName || lastName) {
                // Asegura un espacio y elimina espacios extra si alguno está vacío
                return `${firstName} ${lastName}`.trim();
            }
            // Fallback si no hay nombre/apellido (ej: solo está el username del token)
            return state.user?.username || 'Usuario';
        },
    },

    // ------------------------------------
    // ACCIONES (ACTIONS)
    // ------------------------------------
    actions: {
        /**
         * Actualiza el objeto de usuario actual con nuevos datos (ej: tras obtener el perfil o aprobación).
         * Mantiene los datos base del token (id, rol, etc.) y fusiona los nuevos datos.
         * @param {object} userData - El nuevo objeto de usuario recibido del backend.
         */
        setUser(userData) {
            // Asegura que solo se actualice si hay datos válidos
            if (userData && typeof userData === 'object') {
                // Fusiona los datos nuevos con los existentes
                this.user = { ...this.user, ...userData }; 
            }
        },

        /**
         * Recarga los datos detallados del usuario desde el servidor (ej: para obtener datos de perfil).
         */
        async fetchUser() {
            if (!this.isLoggedIn) return; // Salir si no hay sesión activa

            this.isLoading = true;
            try {
                // Llama al servicio para obtener el perfil completo
                const userData = await authService.getProfile(); 
                
                // Actualiza el estado del store con los datos frescos
                this.setUser(userData); 

                return userData; // Devuelve los datos recargados
            } catch (error) {
                console.error('[AUTH STORE] Error al recargar datos del usuario:', error);
                
                // Manejo de errores de autenticación (ej: token expirado, 401/403)
                const isAuthError = (error.status === 401 || error.status === 403 || 
                                     (typeof error === 'string' && error.includes('Token')));

                if (isAuthError) {
                    const { showSnackbar } = useSnackbar(); 
                    showSnackbar('Tu sesión ha expirado, por favor vuelve a iniciar sesión.', 'error', 5000);
                    this.logoutLocal(); // Limpia el estado local
                }

                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        /**
         * Inicia sesión del usuario con credenciales.
         */
        async login(email, password) {
            this.isLoading = true;
            this.authError = null;
            try {
                const response = await authService.login(email, password);
                
                // 1. Establece el token y decodifica el usuario
                this.setToken(response.token);
                
                // 2. Activa y programa la desactivación del splash screen
                this.showPostLoginSplash = true; 
                setTimeout(() => {
                    this.showPostLoginSplash = false;
                }, 3000); // 3 segundos

            } catch (error) {
                this.authError = error;
                // Limpiamos la sesión local en caso de error de login (por si había un token viejo)
                this.logoutLocal(); 
                throw error;
            } finally {
                this.isLoading = false;
            }
        },

        /**
         * Registra un nuevo usuario en el sistema.
         */
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

        /**
         * Establece el nuevo token, lo guarda en sessionStorage y decodifica los datos base del usuario.
         * @param {string} newToken - El nuevo JWT.
         */
        setToken(newToken) {
            const decodedUser = decodeToken(newToken);
            
            if (!decodedUser) {
                // Si la decodificación falla, limpiamos la sesión
                this.logoutLocal(); 
                return;
            }

            this.token = newToken;
            // Solo actualizamos el estado base del token decodificado (id, rol, etc.)
            this.user = decodedUser; 
            sessionStorage.setItem('accessToken', newToken);
        },

        /**
         * Limpia solo los estados locales (token, user, sessionStorage).
         * No llama al backend. Útil para expiración forzada o errores de token.
         */
        logoutLocal() {
            this.user = null;
            this.token = null;
            sessionStorage.removeItem('accessToken');
            // Aseguramos que el splash se apague si estaba visible
            this.showPostLoginSplash = false; 
        },

        /**
         * Cierra la sesión, intentando llamar al backend para invalidarla y limpiando localmente.
         */
        async logout() {
            try {
                // Intenta llamar al backend para invalidar la sesión
                await authService.logout(); 
            } catch (error) {
                // Si falla la llamada al backend (ej: sin conexión), limpiamos localmente de todas formas
                console.error('Error durante el logout del backend, limpiando localmente de todas formas:', error);
            } finally {
                // Siempre limpia el estado local independientemente del resultado del backend
                this.logoutLocal();
            }
        },

        /**
         * Intenta obtener un nuevo token de acceso usando el token de refresco (si aplica en el servicio).
         */
        async refreshToken() {
            try {
                const response = await authService.refreshToken();
                this.setToken(response.token);
            } catch (error) {
                console.error('No se pudo refrescar el token, cerrando sesión:', error);
                // Si el refresh falla, cerramos la sesión completamente.
                this.logout(); 
                throw error;
            }
        },
    },
});
