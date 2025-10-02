import { defineStore } from 'pinia';
import { ref } from 'vue';
import adminSubscriptionService from '@/services/admin.subscription.service';
import { useSnackbar } from '@/composables/useSnackbar';
import { useAuthStore } from './auth';

export const useAdminSubscriptionStore = defineStore('adminSubscription', () => {
    const pendingRequests = ref([]);
    const isLoadingRequests = ref(false);
    const isProcessingAction = ref(false);
    const error = ref(null);

    const { showSnackbar } = useSnackbar();
    // authStore no se usa directamente en este código, pero se mantiene por si es necesario para el contexto (ej. actualizar datos del admin).
    // const authStore = useAuthStore(); 

    /**
     * @function fetchPendingRequests
     * @description Carga las solicitudes de activación pendientes de revisión desde el backend.
     */
    const fetchPendingRequests = async () => {
        isLoadingRequests.value = true;
        error.value = null;
        try {
            const data = await adminSubscriptionService.getPendingRequests();
            
            // ATENCIÓN: El backend devuelve un objeto con la clave 'solicitudes', no un array directo ni 'requests'.
            if (data && data.solicitudes) {
                pendingRequests.value = data.solicitudes; 
            } else if (Array.isArray(data)) {
                // Caso de fallback si el servicio devuelve solo el array
                pendingRequests.value = data;
            } else {
                pendingRequests.value = []; 
            }

            showSnackbar('Lista de solicitudes actualizada con éxito.', 'info');
        } catch (err) {
            pendingRequests.value = [];
            // Usamos un mejor manejo del error para mostrar mensajes más claros
            const errorMessage = err?.response?.data?.error || 'Error desconocido al cargar solicitudes.';
            error.value = errorMessage;
            showSnackbar(errorMessage, 'error');
            console.error('[ADMIN STORE] Error al cargar solicitudes:', err);
        } finally {
            isLoadingRequests.value = false;
        }
    };

    /**
     * @function handleRequestAction
     * @description Procesa la aprobación o rechazo de una solicitud y actualiza el estado local.
     * @param {number} solicitudId - ID de la solicitud a procesar.
     * @param {string} action - 'APPROVE' o 'REJECT'.
     */
    const handleRequestAction = async (solicitudId, action) => {
        isProcessingAction.value = true;
        error.value = null;
        try {
            const response = await adminSubscriptionService.handleRequestAction(solicitudId, action.toUpperCase());
            
            // Optimista: Se elimina la solicitud de la lista local
            pendingRequests.value = pendingRequests.value.filter(
                (req) => req.id !== solicitudId
            );
            
            // Nota: El backend en caso de APROBACIÓN devuelve el 'user' actualizado.
            // Si el frontend necesita actualizar la sesión del admin (que es poco probable) o 
            // los datos de un usuario específico, se haría aquí. Por ahora, solo actualizamos la lista.
            
            showSnackbar(response.message, 'success');
            
            // Recomendado: Llamar a fetch después para asegurar que la lista esté 100% sincronizada,
            // aunque ya eliminamos el item localmente.
            // await fetchPendingRequests();

        } catch (err) {
            const errorMessage = err?.response?.data?.error || `Error al procesar la acción ${action}.`;
            error.value = errorMessage;
            showSnackbar(errorMessage, 'error');
            console.error('[ADMIN STORE] Error al procesar acción:', err);
            
            // En caso de error, volvemos a cargar toda la lista para restaurar el estado correcto
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