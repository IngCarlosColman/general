import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
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
            type: 'Mensual', // Nuevo campo para clasificación
            name: 'Agente Básico',
            price: 350000, 
            duration: '1 Mes',
            users: 1, // Nuevo campo: 1 editor
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        {
            id: 'agente_semestral',
            type: 'Semestral',
            name: 'Agente Estándar',
            price: 332500,
            duration: '6 Meses',
            users: 1, // 1 editor
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        {
            id: 'agente_anual',
            type: 'Anual',
            name: 'Agente Pro',
            price: 315000,
            duration: '1 Año',
            users: 1, // 1 editor
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        // --- GRUPO 2: PLANES CORPORATIVOS (Mini Broker / Inmobiliaria - Todos Anuales) ---
        {
            id: 'mb_anual_5',
            type: '5 Cuentas',
            name: 'Mini Broker 5',
            price: 304500,
            duration: '1 Año',
            users: 5,
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                '4 Cuentas Secundarias.',
                'Panel Administracion.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        {
            id: 'mb_anual_10',
            type: '10 Cuentas',
            name: 'Mini Broker 10',
            price: 297500,
            duration: '1 Año',
            users: 10,
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                '9 Cuentas Secundarias.',
                'Panel Administracion.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        {
            id: 'mb_anual_15',
            type: '15 Cuentas',
            name: 'Mini Broker 15',
            price: 290500,
            duration: '1 Año',
            users: 15,
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                '14 Cuentas Secundarias.',
                'Panel Administracion.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        {
            id: 'inm_anual_20',
            type: '20 Cuentas',
            name: 'Inmobiliaria 20',
            price: 283500,
            duration: '1 Año',
            users: 20,
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                '19 Cuentas Secundarias.',
                'Panel Administracion.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        {
            id: 'inm_anual_30',
            type: '30 Cuentas',
            name: 'Inmobiliaria 30',
            price: 276500,
            duration: '1 Año',
            users: 30,
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                '29 Cuentas Secundarias.',
                'Panel Administracion.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
            ]
        },
        {
            id: 'inm_anual_50',
            type: '50 Cuentas',
            name: 'Inmobiliaria 50',
            price: 269500,
            duration: '1 Año',
            users: 50,
            features: [
                'Acceso completo.',
                '1 Cuenta principal.',
                '49 Cuentas Secundarias.',
                'Panel Administracion.',
                'Agenda Privada.',
                'Informaciones Personales.',
                'Listas Filtradas.',
                'Filtro Territorial.',
                'Filtro en Mapa Avanzado.'
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
     * @description Agrupa los planes en dos categorías principales (Individual y Corporativo) 
     * para fácil visualización en la UI, basándose en el número de usuarios.
     */
    const groupedPlans = computed(() => {
        return plans.value.reduce((groups, plan) => {
            // Asigna a 'Individual' si users es 1, o 'Corporativo' si es > 1
            const key = plan.users === 1 ? 'Individual' : 'Corporativo';
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(plan);
            return groups;
        }, { Individual: [], Corporativo: [] }); // Inicializa para garantizar las claves
    });

    // === ACCIONES (ACTIONS) ===

    /**
     * @description Envía el plan seleccionado y el comprobante de pago al backend.
     * @param {string} planId - ID del plan seleccionado (option_id).
     * @param {File} comprobanteFile - Archivo del comprobante de pago.
     * @returns {object} Resultado de la operación.
     */
/**
 * @description Envía el FormData ya construido al backend.
 * @param {FormData} formData - Payload con 'comprobante' y 'plan_solicitado'.
 * @returns {object} Resultado de la operación.
 */
const submitPaymentProof = async (formData) => {
  isUploading.value = true;
  uploadError.value = null;
  uploadSuccess.value = false;
  userMessage.value = '';

  if (!formData || !(formData instanceof FormData)) {
    uploadError.value = 'Error interno: datos de comprobante inválidos.';
    isUploading.value = false;
    showSnackbar(uploadError.value, 'error');
    return { success: false, message: uploadError.value };
  }

  try {
    const response = await authService.submitPaymentProof(formData);

    uploadSuccess.value = true;
    userMessage.value = response.message || 'Comprobante subido con éxito. Su cuenta está ahora PENDIENTE DE REVISIÓN.';

    if (response.user) {
      authStore.setUser(response.user);
    }

    showSnackbar(userMessage.value, 'success');
    return { success: true, message: userMessage.value };

  } catch (err) {
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
        groupedPlans,
        submitPaymentProof
    };
});
