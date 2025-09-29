import { defineStore } from 'pinia';
import { ref } from 'vue';
import adminSubscriptionService from '@/services/admin.subscription.service';
import { useSnackbar } from '@/composables/useSnackbar';
import { useAuthStore } from './auth'; // Para recargar la lista de usuarios si es necesario

export const useAdminSubscriptionStore = defineStore('adminSubscription', () => {
    // === ESTADO (STATE) ===
    const pendingRequests = ref([]);
    const isLoadingRequests = ref(false);
    const isProcessingAction = ref(false);
    const error = ref(null);

    const { showSnackbar } = useSnackbar();
    const authStore = useAuthStore();

    // === ACCIONES (ACTIONS) ===

    /**
     * Obtiene y actualiza la lista de solicitudes pendientes de activación.
     */
    const fetchPendingRequests = async () => {
        isLoadingRequests.value = true;
        error.value = null;
        try {
            const data = await adminSubscriptionService.getPendingRequests();
            // Aseguramos que la lista se reemplace con los nuevos datos
            pendingRequests.value = data.requests || []; 
            showSnackbar('Lista de solicitudes actualizada con éxito.', 'info');
        } catch (err) {
            error.value = err;
            showSnackbar(err, 'error');
            console.error('[ADMIN STORE] Error al cargar solicitudes:', err);
        } finally {
            isLoadingRequests.value = false;
        }
    };

    /**
     * Maneja la acción de aprobar o rechazar una solicitud específica.
     * @param {number} solicitudId - ID de la solicitud a procesar.
     * @param {string} action - 'approve' o 'reject'.
     */
    const handleRequestAction = async (solicitudId, action) => {
        isProcessingAction.value = true;
        error.value = null;

        try {
            const response = await adminSubscriptionService.handleRequestAction(solicitudId, action);
            
            // 1. Eliminar la solicitud de la lista local inmediatamente (optimista)
            pendingRequests.value = pendingRequests.value.filter(
                (req) => req.id !== solicitudId
            );

            // 2. Mostrar mensaje de éxito
            showSnackbar(response.message, 'success');

            // 3. Opcional: Si la acción fue aprobar, la sesión del admin debe seguir siendo válida. 
            // Si el admin está revisando su propia solicitud, esta llamada actualizaría su rol
            // pero normalmente el admin no puede auto-aprobarse, así que es más seguro forzar 
            // la recarga de la lista si es necesario.

            // 4. Forzar una recarga completa de la lista (más seguro y actualiza conteos)
            await fetchPendingRequests();
            
        } catch (err) {
            error.value = err;
            showSnackbar(err, 'error');
            console.error('[ADMIN STORE] Error al procesar acción:', err);
            
            // Si hay un error, volvemos a cargar la lista para asegurar su consistencia
            await fetchPendingRequests(); 
        } finally {
            isProcessingAction.value = false;
        }
    };

    return {
        pendingRequests,
        isLoadingRequests,
        isProcessingAction,
        error,
        fetchPendingRequests,
        handleRequestAction
    };
});
