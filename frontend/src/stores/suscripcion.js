import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; 
import authService from '@/services/auth.service'; 
import { useAuthStore } from './auth'; 
import { useSnackbar } from '@/composables/useSnackbar'; 

export const useSuscripcionStore = defineStore('suscripcion', () => {
    // Inicializamos el snackbar para los mensajes
    const { showSnackbar } = useSnackbar();
    // Inicializamos el store de Auth para actualizar el estado del usuario
    const authStore = useAuthStore(); 

    // === ESTADO (STATE) ===
    const isUploading = ref(false);
    const uploadError = ref(null);
    const uploadSuccess = ref(false);
    const userMessage = ref('');
    
    // Almacena la estructura de planes, usando los IDs que concuerdan con la lógica de duración del backend
    const plans = ref([
        // --- PLANES INDIVIDUALES (Agente) ---
        {
            id: 'agente_mensual',
            name: 'Agente Básico - Mensual',
            price: 50000,
            duration: '1 Mes',
            features: [
                'Acceso a todas las herramientas de publicación.',
                'Soporte estándar.',
                '1 usuario (editor).'
            ]
        },
        {
            id: 'agente_semestral',
            name: 'Agente Estándar - Semestral',
            price: 270000,
            duration: '6 Meses',
            features: [
                'Acceso a todas las herramientas de publicación.',
                'Soporte prioritario.',
                '1 usuario (editor).'
            ]
        },
        {
            id: 'agente_anual',
            name: 'Agente Pro - Anual',
            price: 500000,
            duration: '1 Año',
            features: [
                'Acceso a todas las herramientas de publicación.',
                'Soporte premium 24/7.',
                '1 usuario (editor) y 1 usuario (visualizador).'
            ]
        },
        // --- PLANES CORPORATIVOS (Mini Broker / Inmobiliaria - Todos Anuales) ---
        {
            id: 'mb_anual_5',
            name: 'Mini Broker Anual (5 Usuarios)',
            price: 1000000,
            duration: '1 Año',
            features: [
                'Todo el plan Agente Pro.',
                'Gestión de 5 usuarios (1 editor + 4 visualizadores).',
                'Reportes avanzados.'
            ]
        },
        {
            id: 'inm_anual_20',
            name: 'Inmobiliaria Anual (20 Usuarios)',
            price: 3500000,
            duration: '1 Año',
            features: [
                'Todo el plan Mini Broker.',
                'Gestión de 20 usuarios (1 editor + 19 visualizadores).',
                'Atención personalizada 24/7.'
            ]
        },
    ]); 

    // === GETTERS ===

    /**
     * Formatea un número como moneda (Guaraníes de Paraguay).
     */
    const formatCurrency = computed(() => (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '₲ 0';
        }
        // Usamos Intl.NumberFormat para formatear como Guaraníes (PYG)
        return `₲ ${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(value)}`;
    });

    // === ACCIONES (ACTIONS) ===

    /**
     * Envía el plan seleccionado y el comprobante de pago al backend.
     * @param {string} planId - ID del plan seleccionado.
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
            showSnackbar(uploadError.value, 'error');
            return { success: false, message: uploadError.value };
        }

        try {
            // Llamada al servicio que maneja el envío de datos multipart/form-data
            const response = await authService.submitPaymentProof(planId, comprobanteFile);
            
            uploadSuccess.value = true;
            userMessage.value = response.message || 'Comprobante subido con éxito. Su cuenta está ahora PENDIENTE DE REVISIÓN.';
            
            // CLAVE: Actualizamos el store de Pinia con los nuevos datos del usuario (principalmente el rol/estado)
            if (response.user) {
                 authStore.setUser(response.user); 
            }

            showSnackbar(userMessage.value, 'success');
            
            return { success: true, message: userMessage.value };

        } catch (err) {
            // El error es lanzado directamente por el servicio, solo lo capturamos
            const errorMessage = err || 'Error al subir el comprobante. Intente de nuevo.';
            uploadError.value = errorMessage;
            showSnackbar(errorMessage, 'error');
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
        plans,
        formatCurrency, 
        submitPaymentProof
    };
});
