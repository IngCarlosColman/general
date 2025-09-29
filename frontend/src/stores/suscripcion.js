import { defineStore } from 'pinia';
import { ref } from 'vue';
import axiosClient from '../api/axiosClient';
// Importamos useAuthStore para poder forzar una recarga de datos del usuario si es necesario
// Asegúrese de que la ruta sea correcta
import { useAuthStore } from './auth'; 

export const useSuscripcionStore = defineStore('suscripcion', () => {
    // === ESTADO (STATE) ===
    const isUploading = ref(false);
    const uploadError = ref(null);
    const uploadSuccess = ref(false);
    const userMessage = ref('');

    // === ACCIONES (ACTIONS) ===

    /**
     * Simula la selección de un plan y la subida de un comprobante de pago.
     * @param {string} planId - ID del plan seleccionado ('basic', 'standard', 'pro').
     * @param {File} comprobanteFile - Archivo del comprobante de pago.
     * @returns {object} Resultado de la operación.
     */
    const submitPaymentProof = async (planId, comprobanteFile) => {
        isUploading.value = true;
        uploadError.value = null;
        uploadSuccess.value = false;
        userMessage.value = '';

        if (!comprobanteFile) {
            uploadError.value = 'Debe adjuntar el comprobante de pago.';
            isUploading.value = false;
            return { success: false, message: uploadError.value };
        }

        try {
            // Creamos un FormData para enviar el archivo y datos adicionales
            const formData = new FormData();
            formData.append('plan_id', planId);
            formData.append('comprobante', comprobanteFile);

            // 🔑 Llamada al NUEVO ENDPOINT que crearemos en el backend
            const response = await axiosClient.post('/subscription/upload-proof', formData, {
                headers: {
                    // Es crucial para enviar el archivo
                    'Content-Type': 'multipart/form-data' 
                }
            });
            
            uploadSuccess.value = true;
            userMessage.value = response.data.message || 'Comprobante subido con éxito. Su cuenta está ahora PENDIENTE DE REVISIÓN.';

            // Opcional: Recargar datos del usuario para reflejar algún cambio de estado local
            const authStore = useAuthStore();
            await authStore.fetchUser(); 
            
            return { success: true, message: userMessage.value };

        } catch (err) {
            uploadError.value = err.response?.data?.error || 'Error al subir el comprobante. Intente de nuevo.';
            userMessage.value = uploadError.value;
            console.error('[FAIL] Error en submitPaymentProof:', err);
            return { success: false, message: uploadError.value };
        } finally {
            isUploading.value = false;
        }
    };

    return {
        isUploading,
        uploadError,
        uploadSuccess,
        userMessage,
        submitPaymentProof
    };
});
