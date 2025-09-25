/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue`
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router/auto';
import { setupLayouts } from 'virtual:generated-layouts';
import { routes } from 'vue-router/auto-routes';
import { useAuthStore } from '@/stores/auth'; 

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: setupLayouts(routes),
});

// Guardián de autenticación y roles
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    
    // Verifica si alguna de las rutas coincidentes requiere autenticación
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
    
    // Obtiene el array de roles permitidos de la metadata de la ruta
    // Usamos el 'roles' del último match si existe, sino un array vacío
    const allowedRoles = to.meta.roles || []; 

    // --- 1. Verificación de Autenticación ---
    if (requiresAuth && !authStore.isLoggedIn) {
        // Redirige a login si requiere auth y no está logueado
        return next({ path: '/login' });
    } 

    // --- 2. Verificación de Roles ---
    // Solo aplica si la ruta requiere autenticación Y tiene roles definidos
    if (requiresAuth && allowedRoles.length > 0) {
        // Comprueba si el rol del usuario está incluido en los roles permitidos
        if (!allowedRoles.includes(authStore.rol)) {
            console.warn(`[AuthGuard] Acceso Denegado a ${to.path}. Rol: ${authStore.rol}`);
            // Redirige a una página de 'No Autorizado' (debes crear esta ruta)
            return next({ path: '/unauthorized' }); 
        }
    }

    // --- 3. Redirección de Rutas Públicas (si ya está logueado) ---
    if (!requiresAuth && authStore.isLoggedIn) {
        if (to.path === '/login' || to.path === '/register') {
            return next({ path: '/dashboard' });
        }
    } 
    
    // --- 4. Continuar ---
    next();
});


// Workaround for https://github.com/vitejs/vite/issues/11804
router.onError((err, to) => {
    if (err?.message?.includes?.('Failed to fetch dynamically imported module')) {
        if (localStorage.getItem('vuetify:dynamic-reload')) {
            console.error('Dynamic import error, reloading page did not fix it', err);
        } else {
            console.log('Reloading page to fix dynamic import error');
            localStorage.setItem('vuetify:dynamic-reload', 'true');
            location.assign(to.fullPath);
        }
    } else {
        console.error(err);
    }
});

router.isReady().then(() => {
    localStorage.removeItem('vuetify:dynamic-reload');
});

export default router;  