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
    
    /**
     * @description Almacena la estructura de planes, usando los IDs que concuerdan 
     * con la lógica de duración del backend (subscription.controller.js).
     * Se han añadido nuevos planes corporativos para estar en sincronía con el backend.
     */
    const plans = ref([
        // --- GRUPO 1: PLANES INDIVIDUALES (Agente) ---
        {
            id: 'agente_mensual',
            type: 'individual', // Nuevo campo para clasificación
            name: 'Agente Básico - Mensual',
            price: 350000,  
            duration: '1 Mes',
            users: 1, // Nuevo campo: 1 editor
            features: [
                'Acceso completo a herramientas de publicación y gestión.',
                'Soporte estándar.',
                '1 usuario principal.'
            ]
        },
        {
            id: 'agente_semestral',
            type: 'individual',
            name: 'Agente Estándar - Semestral',
            price: 1995000,
            duration: '6 Meses',
            users: 1, // 1 editor
            features: [
                'Acceso completo a herramientas de publicación y gestión.',
                'Soporte prioritario.',
                '1 usuario principal.'
            ]
        },
        {
            id: 'agente_anual',
            type: 'individual',
            name: 'Agente Pro - Anual',
            price: 3780000,
            duration: '1 Año',
            users: 1, // 1 editor
            features: [
                'Acceso completo a herramientas de publicación y gestión.',
                'Soporte premium 24/7.',
                'Gestión de 1 usuarios'
            ]
        },
        // --- GRUPO 2: PLANES CORPORATIVOS (Mini Broker / Inmobiliaria - Todos Anuales) ---
        {
            id: 'mb_anual_5',
            type: 'empresarial',
            name: 'Mini Broker Anual (5 Usuarios)',
            price: 18270000,
            duration: '1 Año',
            users: 5,
            features: [
                'Todas las ventajas del plan Agente Pro.',
                'Gestión de hasta 5 usuarios (1 editor + 4 visualizadores).',
                'Reportes de rendimiento avanzados.'
            ]
        },
        {
            id: 'mb_anual_10',
            type: 'empresarial',
            name: 'Mini Broker Anual (10 Usuarios)',
            price: 35700000,
            duration: '1 Año',
            users: 10,
            features: [
                'Todas las ventajas del plan Agente Pro.',
                'Gestión de hasta 10 usuarios (1 editor + 9 visualizadores).',
                'Reportes de rendimiento avanzados.'
            ]
        },
        {
            id: 'mb_anual_15',
            type: 'empresarial',
            name: 'Mini Broker Anual (15 Usuarios)',
            price: 52290000,
            duration: '1 Año',
            users: 15,
            features: [
                'Todas las ventajas del plan Agente Pro.',
                'Gestión de hasta 15 usuarios (1 editor + 14 visualizadores).',
                'Reportes de rendimiento avanzados.'
            ]
        },
        {
            id: 'inm_anual_20',
            type: 'empresarial',
            name: 'Inmobiliaria Anual (20 Usuarios)',
            price: 68040000,
            duration: '1 Año',
            users: 20,
            features: [
                'Todas las ventajas de Mini Broker.',
                'Gestión de hasta 20 usuarios (1 editor + 19 visualizadores).',
                'Atención personalizada 24/7 y Acuerdo de Nivel de Servicio (SLA).'
            ]
        },
        {
            id: 'inm_anual_30',
            type: 'empresarial',
            name: 'Inmobiliaria Anual (30 Usuarios)',
            price: 99540000,
            duration: '1 Año',
            users: 30,
            features: [
                'Todas las ventajas de Mini Broker.',
                'Gestión de hasta 30 usuarios (1 editor + 29 visualizadores).',
                'Atención personalizada 24/7 y Acuerdo de Nivel de Servicio (SLA).'
            ]
        },
        {
            id: 'inm_anual_50',
            type: 'empresarial',
            name: 'Inmobiliaria Anual (50 Usuarios)',
            price: 161700000,
            duration: '1 Año',
            users: 50,
            features: [
                'Todas las ventajas de Mini Broker.',
                'Gestión de hasta 50 usuarios (1 editor + 49 visualizadores).',
                'Atención personalizada 24/7 y Acuerdo de Nivel de Servicio (SLA).'
            ]
        },
    ]); 

    // === GETTERS ===

    /**
     * @description Formatea un número como moneda (Guaraníes de Paraguay: ₲).
     */
    const formatCurrency = computed(() => (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '₲ 0';
        }
        // Usamos Intl.NumberFormat para formatear como Guaraníes (PYG) sin decimales.
        return `₲ ${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(value)}`;
    });

    /**
     * @description Agrupa los planes en dos categorías (individual y corporate) para fácil visualización en la UI.
     */
    const groupedPlans = computed(() => {
        return plans.value.reduce((groups, plan) => {
            const key = plan.type;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(plan);
            return groups;
        }, {});
    });

    // === ACCIONES (ACTIONS) ===

    /**
     * @description Envía el plan seleccionado y el comprobante de pago al backend.
     * @param {string} planId - ID del plan seleccionado (option_id).
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

    // Exportamos el estado, getters y acciones
    return {
        isUploading,
        uploadError,
        uploadSuccess,
        userMessage,
        plans,
        formatCurrency, 
        groupedPlans, // Nuevo getter
        submitPaymentProof
    };
});
