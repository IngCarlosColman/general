import api from '../api/axiosClient';

/**
 * Servicio para manejar las operaciones relacionadas con la gestión
 * de solicitudes de suscripción (Admin).
 */
const adminSubscriptionService = {

    /**
     * Obtiene la lista de todas las solicitudes de activación pendientes de revisión.
     * Requiere rol 'administrador'.
     * @returns {Array} Lista de solicitudes.
     */
    async getPendingRequests() {
        try {
            // RUTA FINAL: /api/subscription/admin/pending-requests
            const response = await api.get('/subscription/admin/pending-requests');
            return response.data;
        } catch (error) {
            console.error('[ADMIN SERVICE] Error al obtener solicitudes pendientes:', error);
            // Usamos el error del backend si está disponible
            throw error.response?.data?.error || 'Error al obtener solicitudes pendientes.';
        }
    },

    /**
     * Envía una acción de revisión (Aprobar o Rechazar) para una solicitud específica.
     * @param {number} solicitudId - ID de la solicitud a manejar.
     * @param {string} action - 'APPROVE' o 'REJECT' (Viene capitalizado desde el store).
     * @returns {object} Respuesta del servidor.
     */
    async handleRequestAction(solicitudId, action) {
        // ⚠️ CORRECCIÓN 1: Validamos con mayúsculas, ya que el store envía action.toUpperCase()
        if (!['APPROVE', 'REJECT'].includes(action)) {
            throw 'Acción inválida.';
        }

        try {
            // 🎯 CORRECCIÓN 2: Usar el nuevo ENDPOINT UNIFICADO.
            // RUTA FINAL: /api/subscription/admin/request-action/:id
            const endpoint = `/subscription/admin/request-action/${solicitudId}`;
            
            // 🎯 CORRECCIÓN 3: Enviar el tipo de acción en el CUERPO (BODY) del POST.
            // Esto resuelve el error "Acción inválida" en el backend.
            const response = await api.post(endpoint, {
                action: action // 'APPROVE' o 'REJECT'
            });
            
            return response.data;
        } catch (error) {
            // Usamos toLowerCase() solo para el log y el mensaje de error, para que se lea mejor
            const actionLower = action.toLowerCase();
            console.error(`[ADMIN SERVICE] Error al ${actionLower} la solicitud ${solicitudId}:`, error);
            
            // Usamos el error del backend si está disponible
            throw error.response?.data?.error || `Error al procesar la solicitud (${actionLower}).`;
        }
    }
};

export default adminSubscriptionService;