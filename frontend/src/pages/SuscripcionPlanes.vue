<template>
  <v-container class="pa-0 subscription-container">
    <v-row justify="center" class="w-100 ma-0">
      <v-col cols="12" sm="11" md="10" lg="10" xl="11"> 
        
        <v-card class="pa-6 rounded-xl elevation-6 bg-white main-card-karla" flat>
          
          <SuscripcionHeader :rol="authStore.rol" />

          <div v-if="authStore.rol === 'PENDIENTE_PAGO'">
            <v-card-text class="pa-0">
              
              <div class="d-flex justify-space-around align-center mb-6 text-body-1 font-weight-bold step-indicator">
                <div 
                  v-for="step in steps" 
                  :key="step.value"
                  class="d-flex align-center cursor-default step-item"
                >
                  <v-icon 
                    :color="step.value <= currentStep ? 'primary' : 'grey-lighten-1'" 
                    :icon="step.icon" 
                    size="small"
                    class="mr-2"
                  ></v-icon>
                  <span 
                    :class="{'text-primary': step.value <= currentStep, 'text-medium-emphasis': step.value > currentStep}"
                    class="d-none d-sm-inline font-karla"
                  >
                    {{ step.title }}
                  </span>
                </div>
              </div>
              
              <v-divider class="mb-8"></v-divider>
              
              <v-window v-model="currentStep">
                
                <v-window-item :value="1">
                  <StepPlanSelection
                    v-model:activeTab="activeTab"
                    :planesAgentes="planesAgentes"
                    :planesMiniBroker="planesMiniBroker"
                    :planesInmobiliarias="planesInmobiliarias"
                    :monthlyBasePrice="monthlyBasePrice"
                    :selectedPlan="selectedPlan"
                    :currentPlan="currentPlan"
                    @selectPlan="selectPlan"
                    @nextStep="currentStep = 2"
                  />
                </v-window-item>

                <v-window-item :value="2">
                  <v-form
                    ref="billingFormRef"
                    v-model="billingFormValid"
                    @submit.prevent="handleUpsertBillingData"
                    class="mb-6"
                  >
                    <div class="d-none">
                      <v-text-field v-model="store.billingData.ruc_fiscal" :rules="[billingRules.required, billingRules.ruc]"></v-text-field>
                      <v-text-field v-model="store.billingData.razon_social" :rules="[billingRules.required]"></v-text-field>
                      <v-text-field v-model="store.billingData.direccion_fiscal" :rules="[billingRules.required]"></v-text-field>
                      <v-select v-model="store.billingData.metodo_entrega" :items="[]" :rules="[billingRules.required]"></v-select>
                      <v-text-field v-model="store.billingData.email_facturacion" :rules="store.billingData.metodo_entrega === 'EMAIL' ? [billingRules.required, billingRules.email] : []"></v-text-field>
                    </div>

                    <StepFacturacion 
                      :billingRules="billingRules"
                      :isBillingLoading="store.isBillingLoading"
                      :isBillingFormValid="billingFormValid"
                      @prevStep="currentStep = 1"
                      @submitBilling="handleUpsertBillingData"
                    />
                  </v-form>
                </v-window-item>
                
                <v-window-item :value="3">
                  <StepPago
                    v-model:comprobanteFile="comprobanteFile"
                    :currentPlan="currentPlan"
                    :selectedPlan="selectedPlan"
                    :fileRules="fileRules"
                    @prevStep="currentStep = 2"
                    @uploadProof="handleUpload"
                  />
                </v-window-item>
                
              </v-window>
            </v-card-text>
          </div>
          
          <v-alert
            v-else
            type="error"
            icon="mdi-lock-alert"
            title="Acceso Denegado"
            variant="tonal"
            prominent
            class="mb-8"
          >
            Su cuenta actual es ({{ authStore.rol.toUpperCase().replace('_', ' ') }}) no requiere que complete el proceso de suscripción. Contacte a soporte si cree que esto es un error.
          </v-alert>
          
          <v-card-actions class="justify-center mt-8">
            <v-btn
              color="error"
              variant="text"
              prepend-icon="mdi-logout-variant"
              @click="handleLogout"
            >
              Salir de la Suscripción
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSuscripcionStore } from '@/stores/suscripcion';

// Componentes Refactorizados
import SuscripcionHeader from '@/components/pagos/SuscripcionHeader.vue';
import StepPlanSelection from '@/components/pagos/StepPlanSelection.vue';
import StepFacturacion from '@/components/pagos/StepFacturacion.vue';
import StepPago from '@/components/pagos/StepPago.vue';
// Componente Existente (asegura que la ruta sea correcta)
// import PlanCard from '@/components/pagos/PlanCard.vue'; // No se usa directamente aquí

// --- CONFIGURACIÓN Y STORES (LÓGICA REAL PRESERVADA) ---
const monthlyBasePrice = 350000;

const authStore = useAuthStore();
const store = useSuscripcionStore();
const router = useRouter();

// --- ESTADO LOCAL (LÓGICA REAL PRESERVADA) ---
const selectedPlan = ref(null);
const comprobanteFile = ref(null);
const activeTab = ref('agentes');
const currentStep = ref(1); // Control del paso actual (1: Plan, 2: Facturación, 3: Pago)
const billingFormValid = ref(false);
const billingFormRef = ref(null);

// Reglas de validación para facturación (LÓGICA REAL PRESERVADA)
const billingRules = {
  required: (value) => !!value || 'Campo obligatorio.',
  ruc: (value) =>
    /^[0-9]+-?[0-9kK]?$/.test(value) || 'Formato de RUC inválido.',
  email: (value) => {
    const pattern =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return pattern.test(value) || 'Email de facturación inválido.';
  },
};

const fileRules = [
  v => !!v || 'El comprobante es obligatorio.',
  v => {
    const file = Array.isArray(v) ? v[0] : v;
    return !file || !(file instanceof File) || file.size <= 5000000 || 'El archivo debe ser menor a 5 MB.';
  },
];

// --- COMPUTED (LÓGICA REAL PRESERVADA) ---
const allPlans = computed(() => store.plans);
const planesAgentes = computed(() => allPlans.value.filter(p => p.id.startsWith('agente_')));
const planesMiniBroker = computed(() => allPlans.value.filter(p => p.id.startsWith('mb_')));
const planesInmobiliarias = computed(() => allPlans.value.filter(p => p.id.startsWith('inm_')));

const currentPlan = computed(() => {
  const plan = store.plans.find(p => p.id === selectedPlan.value);
  if (plan) {
    const totalPrice = calculateTotalPrice(plan);
    return {
      ...plan,
      totalPrice,
      totalPriceFormatted: store.formatCurrency(totalPrice),
    };
  }
  return null;
});

// --- ACCIONES Y LÓGICA DE FLUJO (LÓGICA REAL PRESERVADA) ---

// Nuevo objeto para el Stepper Compacto (solo visual)
const steps = [
  { value: 1, title: 'Selección de Plan', icon: 'mdi-hand-pointing-up' },
  { value: 2, title: 'Datos de Facturación', icon: 'mdi-file-document-edit-outline' },
  { value: 3, title: 'Comprobante de Pago', icon: 'mdi-credit-card-fast-outline' },
];

onMounted(() => {
    store.fetchBillingData(); // Cargamos los datos de facturación existentes
});

const selectPlan = (planId) => {
  selectedPlan.value = selectedPlan.value === planId ? null : planId;
  store.uploadError = null;
};

/**
 * @description Valida el formulario de facturación del DOM
 */
const handleUpsertBillingData = async () => {
  const { valid } = await billingFormRef.value.validate();
  if (!valid) {
    return;
  }
  
  const dataToSend = {
    ruc_fiscal: store.billingData.ruc_fiscal,
    razon_social: store.billingData.razon_social,
    direccion_fiscal: store.billingData.direccion_fiscal,
    metodo_entrega: store.billingData.metodo_entrega,
    email_facturacion: store.billingData.email_facturacion,
  };

  const success = await store.upsertBillingData(dataToSend);
  if (success) {
    currentStep.value = 3; // Mover al paso de pago
  }
};

const handleUpload = async () => {
  if (!selectedPlan.value) {
    store.uploadError = 'Debe seleccionar un plan.';
    return;
  }

  const file = Array.isArray(comprobanteFile.value) && comprobanteFile.value.length > 0
    ? comprobanteFile.value[0]
    : comprobanteFile.value;

  if (!file || !(file instanceof File) || file.size === 0) {
    store.uploadError = 'Debe adjuntar un comprobante de pago válido.';
    comprobanteFile.value = null;
    return;
  }

  store.uploadError = null;

  const formData = new FormData();
  formData.append('comprobante', file);
  formData.append('plan_solicitado', selectedPlan.value);

  try {
    const result = await store.submitPaymentProof(formData);
    if (result && result.success) {
      comprobanteFile.value = null;
      selectedPlan.value = null;
    }
  } catch (error) {
    store.uploadError = error.message || error;
  }
};

const handleLogout = async () => {
  try {
    await authStore.logout();
    await router.push('/login');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};


// --- HELPERS (LÓGICA REAL PRESERVADA) ---
const getDurationInMonths = (plan) => {
  const durationText = plan.duration.toLowerCase();
  if (durationText.includes('1 mes')) return 1;
  if (durationText.includes('6 meses')) return 6;
  if (durationText.includes('1 año')) return 12;
  if (plan.id.startsWith('mb_') || plan.id.startsWith('inm_')) return 12;
  return 1;
};

const calculateTotalPrice = (plan) => {
  const pricePerMonth = plan.price;
  const months = getDurationInMonths(plan);
  const users = plan.users || 1;
  return pricePerMonth * months * users;
};

</script>

<style scoped>
/*
 * ESTILOS DE FUENTES Y LAYOUT
 * Utilizamos las fuentes 'Francois One' (Títulos) y 'Karla' (Cuerpo)
 */

/* CAMBIO 2: Estilos para aplicar el 95% de ancho en pantallas grandes */
.subscription-container {
  max-width: 95%; /* Ancho máximo para el contenedor principal */
  margin: auto;
  padding-top: 24px;
  padding-bottom: 24px;
}

/* Aplicar Karla a todo el contenido de la tarjeta principal (cuerpo del texto) */
.main-card-karla, .main-card-karla * {
  font-family: 'Karla', sans-serif !important;
}

/* Aplicar Francois One solo a los títulos (Ejemplo: v-card-title de SuscripcionHeader y títulos internos) */
:deep(.v-card-title), 
:deep(.text-h4), 
:deep(.text-h5) {
  font-family: 'Francois One', sans-serif !important;
}

/* Ajustes para el indicador de pasos compacto */
.step-indicator {
    padding-left: 12px;
    padding-right: 12px;
}
</style>