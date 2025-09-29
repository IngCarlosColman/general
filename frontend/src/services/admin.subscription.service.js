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
            throw error.response?.data?.error || 'Error al obtener solicitudes pendientes.';
        }
    },

    /**
     * Envía una acción de revisión (Aprobar o Rechazar) para una solicitud específica.
     * @param {number} solicitudId - ID de la solicitud a manejar.
     * @param {string} action - 'approve' o 'reject'.
     * @returns {object} Respuesta del servidor.
     */
    async handleRequestAction(solicitudId, action) {
        if (!['approve', 'reject'].includes(action)) {
            throw 'Acción inválida.';
        }

        try {
            // RUTA FINAL: /api/subscription/admin/approve/:id o /api/subscription/admin/reject/:id
            const endpoint = `/subscription/admin/${action}/${solicitudId}`;
            const response = await api.post(endpoint, {});
            return response.data;
        } catch (error) {
            console.error(`[ADMIN SERVICE] Error al ${action} la solicitud ${solicitudId}:`, error);
            throw error.response?.data?.error || `Error al procesar la solicitud (${action}).`;
        }
    }
};

export default adminSubscriptionService;
