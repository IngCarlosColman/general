import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; // 🟢 Aseguramos la importación de computed
import authService from '@/services/auth.service'; // 🟢 Usamos el servicio de auth
import { useAuthStore } from './auth'; 
import { useSnackbar } from '@/composables/useSnackbar'; // 🟢 Importar Snackbar

export const useSuscripcionStore = defineStore('suscripcion', () => {
    // === ESTADO (STATE) ===
    const isUploading = ref(false);
    const uploadError = ref(null);
    const uploadSuccess = ref(false);
    const userMessage = ref('');
    // Almacena la estructura de planes
    const plans = ref([]); 

    // === GETTERS ===

    /**
     * 🟢 NUEVO: Formatea un número como moneda (Guaraníes de Paraguay)
     * Definido como un computed getter para Pinia.
     */
    const formatCurrency = computed(() => (value) => {
        if (typeof value !== 'number' || isNaN(value)) {
            return '₲ 0';
        }
        // Usamos Intl.NumberFormat para formatear como Guaraníes (PYG)
        // Usando el formato base del código de usuario
        return `₲ ${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(value)}`;
    });

    // === INICIALIZACIÓN DE PLANES (SIMULACIÓN DE FETCH) ===
    // ❌ Eliminamos la función formatCurrency externa y baseMonthlyCost no usado.
    // 🟢 Datos de planes adaptados para usar valores de ahorro fijos.
    plans.value = [
      // --- PLAN AGENTES (Individual o Pequeño) ---
      { 
        id: 'agente', 
        name: 'Plan Agente Individual', 
        description: 'Ideal para agentes inmobiliarios individuales.',
        options: [
            { 
                option_id: 'agente_mensual', 
                name: 'Mensual', 
                guaranies_unitario: 350000, 
                guaranies_total: 350000,
                ahorro: 'Sin descuento',
                billing_period: 'monthly',
                features: ['Acceso completo por 1 mes', '1 Usuario Editor', 'Soporte estándar'] 
            },
            { 
                option_id: 'agente_semestral', 
                name: 'Semestral (5% Dto.)', 
                guaranies_unitario: 332500, // 350.000 * 0.95
                guaranies_total: 1995000, // 332.500 * 6
                ahorro: '₲ 105.000', // Cálculo manual: (350k * 6) - 1.995k = 105k
                billing_period: 'semesterly',
                features: ['Acceso completo por 6 meses', '1 Usuario Editor', '5% de descuento mensual'] 
            },
            { 
                option_id: 'agente_anual', 
                name: 'Anual (10% Dto.)', 
                guaranies_unitario: 315000, // 350.000 * 0.90
                guaranies_total: 3780000, // 315.000 * 12
                ahorro: '₲ 420.000', // Cálculo manual: (350k * 12) - 3.780k = 420k
                billing_period: 'annually',
                features: ['Acceso completo por 1 año', '1 Usuario Editor', '10% de descuento mensual'] 
            },
        ]
      },
      
      // --- PLAN MINI BROKER / DESARROLLADORAS (Multi-cuenta) ---
      { 
        id: 'mini_broker', 
        name: 'Plan Mini Broker/Desarrollador', 
        description: 'Planes anuales para equipos pequeños o desarrollo.',
        options: [
            { 
                option_id: 'mb_anual_5', 
                name: 'Anual 5 Cuentas (13% Dto.)', 
                guaranies_unitario: 304500, 
                guaranies_total: 18270000, 
                ahorro: '₲ 2.730.000', // Cálculo manual: (4.2M * 5) - 18.27M = 2.73M
                billing_period: 'annually_multi',
                features: ['5 Cuentas Editor Anuales', '13% de descuento por volumen', 'Gestión centralizada'] 
            },
            { 
                option_id: 'mb_anual_10', 
                name: 'Anual 10 Cuentas (15% Dto.)', 
                guaranies_unitario: 297500, 
                guaranies_total: 35700000,
                ahorro: '₲ 6.300.000', // Cálculo manual: (4.2M * 10) - 35.7M = 6.3M
                billing_period: 'annually_multi',
                features: ['10 Cuentas Editor Anuales', '15% de descuento por volumen', 'Soporte prioritario'] 
            },
            { 
                option_id: 'mb_anual_15', 
                name: 'Anual 15 Cuentas (17% Dto.)', 
                guaranies_unitario: 290500, 
                guaranies_total: 52290000, 
                ahorro: '₲ 10.710.000', // Cálculo manual: (4.2M * 15) - 52.29M = 10.71M
                billing_period: 'annually_multi',
                features: ['15 Cuentas Editor Anuales', '17% de descuento por volumen', 'Atención personalizada'] 
            },
        ]
      },
      
      // --- PLAN INMOBILIARIAS (Corporativo) ---
      { 
        id: 'inmobiliaria', 
        name: 'Plan Inmobiliaria Corporativo', 
        description: 'Planes de alto volumen para grandes inmobiliarias.',
        options: [
            { 
                option_id: 'inm_anual_20', 
                name: 'Anual 20 Cuentas (19% Dto.)', 
                guaranies_unitario: 283500, 
                guaranies_total: 68040000, 
                ahorro: '₲ 15.960.000', // Cálculo manual: (4.2M * 20) - 68.04M = 15.96M
                billing_period: 'annually_multi',
                features: ['20 Cuentas Editor Anuales', '19% de descuento por volumen', 'Módulo de administración avanzada'] 
            },
            { 
                option_id: 'inm_anual_30', 
                name: 'Anual 30 Cuentas (21% Dto.)', 
                guaranies_unitario: 276500, 
                guaranies_total: 99540000, 
                ahorro: '₲ 26.460.000', // Cálculo manual: (4.2M * 30) - 99.54M = 26.46M
                billing_period: 'annually_multi',
                features: ['30 Cuentas Editor Anuales', '21% de descuento por volumen', 'Integraciones personalizadas'] 
            },
            { 
                option_id: 'inm_anual_50', 
                name: 'Anual 50 Cuentas (23% Dto.)', 
                guaranies_unitario: 269500, 
                guaranies_total: 161700000, 
                ahorro: '₲ 48.300.000', // Cálculo manual: (4.2M * 50) - 161.7M = 48.3M
                billing_period: 'annually_multi',
                features: ['50 Cuentas Editor Anuales', '23% de descuento por volumen', 'Soporte VIP y SLA'] 
            },
        ]
      },
    ];


    // === ACCIONES (ACTIONS) ===

    /**
     * Sube el comprobante de pago usando el servicio y actualiza el estado de autenticación.
     * @param {string} planId - ID completo de la opción de plan (ej: 'agente_anual').
     * @param {File} comprobanteFile - Archivo del comprobante de pago.
     * @returns {object} Resultado de la operación.
     */
    const submitPaymentProof = async (planId, comprobanteFile) => {
        const authStore = useAuthStore();
        const { showSnackbar } = useSnackbar();

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
            // Llamada al servicio de Auth
            const response = await authService.submitPaymentProof(planId, comprobanteFile);
            
            uploadSuccess.value = true;
            userMessage.value = response.message || 'Comprobante subido con éxito. Su cuenta está ahora PENDIENTE DE REVISIÓN.';
            
            // CLAVE: Actualizamos el store de Pinia para forzar la redirección del Router Guard
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
        formatCurrency, // Exportamos el getter
        submitPaymentProof
    };
});
