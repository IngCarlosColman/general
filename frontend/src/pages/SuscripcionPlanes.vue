<template>
  <v-container fluid class="pa-4 subscription-container">
    <v-row justify="center" class="mb-8">
      <v-col cols="12" md="10">
        <!-- Tarjeta Principal con Título y Estado del Rol -->
        <v-card class="pa-6 rounded-xl elevation-10 bg-white" color="#f5f5f5">
          <v-card-title class="text-h4 font-weight-black text-center text-primary">
            ¡Bienvenido a la Plataforma!
          </v-card-title>
          <v-card-subtitle class="text-h6 text-center mb-4 text-medium-emphasis">
            Active su Licencia para comenzar a operar.
          </v-card-subtitle>
          <p class="text-center text-subtitle-1 mb-4 text-medium-emphasis">
            Su rol actual es: 
            <v-chip 
              :color="getRoleColor(authStore.rol)" 
              class="font-weight-bold ml-2 text-white"
              size="large"
            >
              {{ authStore.rol.toUpperCase().replace('_', ' ') }}
            </v-chip>
          </p>

          <v-divider class="mb-6"></v-divider>

          <!-- 🟢 SECCIÓN DE ALERTA: PENDIENTE DE REVISIÓN -->
          <v-alert
              v-if="authStore.rol === 'PENDIENTE_REVISION'"
              type="info"
              icon="mdi-clock-time-four-outline"
              title="Solicitud de Activación en Curso"
              class="mb-8"
              variant="tonal"
              color="blue-grey"
              prominent
          >
            Hemos recibido su comprobante de pago. Un administrador revisará su solicitud en las próximas 24 horas. 
            Una vez aprobado, su rol cambiará a **EDITOR** y podrá acceder al sistema. Gracias por su paciencia.
          </v-alert>

          <!-- 🔴 SECCIÓN DE PLANES: SOLO VISIBLE SI EL ROL ES PENDIENTE_PAGO -->
          <div v-else-if="authStore.rol === 'PENDIENTE_PAGO'">
            <h2 class="text-h5 font-weight-bold text-center mb-6 text-secondary">
                1. Elija su Plan de Suscripción
            </h2>
            
            <v-expansion-panels flat multiple class="plans-accordion">
              <!-- GRUPO 1: PLANES AGENTES INDIVIDUALES -->
              <v-expansion-panel value="agentes">
                <v-expansion-panel-title class="text-h6 font-weight-bold text-primary">
                  Plan Agentes (Individual)
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row justify="center" class="pa-3">
                    <v-col v-for="plan in planesAgentes" :key="plan.id" cols="12" sm="6" lg="4">
                      <PlanCard
                        :plan="plan"
                        :selected="selectedPlan === plan.id"
                        @select="selectPlan"
                        :monthly-base-price="350000"
                      />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-divider></v-divider>

              <!-- GRUPO 2: PLANES MINI BROKER/DESARROLLADORAS (Anual - Múltiples Cuentas) -->
              <v-expansion-panel value="minibroker">
                <v-expansion-panel-title class="text-h6 font-weight-bold text-primary">
                  Plan Mini Broker / Desarrolladoras (5 a 15 Cuentas)
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row justify="center" class="pa-3">
                    <v-col v-for="plan in planesMiniBroker" :key="plan.id" cols="12" sm="6" lg="4">
                      <PlanCard
                        :plan="plan"
                        :selected="selectedPlan === plan.id"
                        @select="selectPlan"
                        :monthly-base-price="350000"
                      />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-divider></v-divider>

              <!-- GRUPO 3: PLANES INMOBILIARIAS (Anual - Múltiples Cuentas) -->
              <v-expansion-panel value="inmobiliarias">
                <v-expansion-panel-title class="text-h6 font-weight-bold text-primary">
                  Plan Inmobiliarias (20+ Cuentas)
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row justify="center" class="pa-3">
                    <v-col v-for="plan in planesInmobiliarias" :key="plan.id" cols="12" sm="6" lg="4">
                      <PlanCard
                        :plan="plan"
                        :selected="selectedPlan === plan.id"
                        @select="selectPlan"
                        :monthly-base-price="350000"
                      />
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <v-divider class="my-8"></v-divider>

            <h2 class="text-h5 font-weight-bold text-center mb-6 text-secondary">
                2. Suba su Comprobante de Pago
            </h2>

            <v-form @submit.prevent="handleUpload">
              <!-- Muestra el plan seleccionado con su precio total -->
              <v-alert
                v-if="currentPlan"
                type="success"
                icon="mdi-check-circle"
                class="mb-6"
                variant="tonal"
                color="green-darken-2"
              >
                Plan Seleccionado: <span class="font-weight-bold">{{ currentPlan.name }}</span> | 
                Monto Total a Pagar: <span class="font-weight-black text-h6">{{ currentPlan.totalPriceFormatted }}</span>
              </v-alert>

              <!-- Selector de Archivo -->
              <v-file-input
                v-model="comprobanteFile"
                :disabled="!selectedPlan || store.isUploading"
                :rules="fileRules"
                accept="image/jpeg,image/png,application/pdf"
                label="Seleccione Comprobante (JPG, PNG o PDF)"
                prepend-icon="mdi-paperclip"
                variant="outlined"
                clearable
                class="mb-4"
              ></v-file-input>

              <!-- Área de Mensajes y Botón -->
              <div class="d-flex flex-column align-center">
                <v-btn
                  type="submit"
                  :disabled="!selectedPlan || !comprobanteFile || store.isUploading"
                  :loading="store.isUploading"
                  color="primary"
                  size="large"
                  class="mt-4 font-weight-bold"
                  block
                  prepend-icon="mdi-cloud-upload-outline"
                >
                  Subir Comprobante y Enviar Solicitud
                </v-btn>

                <!-- Mensaje de Error -->
                <v-alert
                  v-if="store.uploadError"
                  type="error"
                  class="mt-4 w-100"
                  density="compact"
                  variant="flat"
                >
                  {{ store.uploadError }}
                </v-alert>
              </div>
            </v-form>
          </div>
          <!-- ⛔ OTROS ROLES: ACCESO DENEGADO (Deberían ser redirigidos por el router, pero es un fallback) -->
          <v-alert
              v-else
              type="error"
              icon="mdi-lock-alert"
              title="Acceso Denegado"
              variant="tonal"
              prominent
              class="mb-8"
          >
              Su rol actual ({{ authStore.rol.toUpperCase() }}) no requiere que complete el proceso de suscripción. Contacte a soporte si cree que esto es un error.
          </v-alert>

        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSuscripcionStore } from '@/stores/suscripcion';

// --- Importación de Componente de Tarjeta (Definido abajo) ---
import PlanCard from '@/components/PlanCard.vue';

// --- Stores ---
const authStore = useAuthStore();
const store = useSuscripcionStore();

// --- Estado Local ---
const selectedPlan = ref(null);
const comprobanteFile = ref(null);

// --- Reglas de Validación ---
const fileRules = [
  v => !!v || 'El comprobante es obligatorio.',
  v => !v || v.size <= 5000000 || 'El archivo debe ser menor a 5 MB.', // Límite de 5MB
];

// --- Computadas de Planes (Organización de la interfaz) ---

const allPlans = computed(() => store.plans);

// Filtramos y organizamos los planes en grupos
const planesAgentes = computed(() => 
  allPlans.value.filter(p => p.id.startsWith('agente_'))
);

const planesMiniBroker = computed(() => 
  allPlans.value.filter(p => p.id.startsWith('mb_'))
);

const planesInmobiliarias = computed(() => 
  allPlans.value.filter(p => p.id.startsWith('inm_'))
);

// Obtiene el plan completo actualmente seleccionado
const currentPlan = computed(() => {
  return store.plans.find(p => p.id === selectedPlan.value);
});


// --- Métodos ---

/**
 * Función para seleccionar un plan, deseleccionando si se hace clic nuevamente.
 * @param {string} planId - ID del plan seleccionado.
 */
const selectPlan = (planId) => {
    selectedPlan.value = selectedPlan.value === planId ? null : planId;
    // Limpiamos el error al cambiar de plan
    store.uploadError = null; 
};

/**
 * Función que determina el color del chip basado en el rol.
 * @param {string} rol - Rol del usuario.
 * @returns {string} Color de Vuetify.
 */
const getRoleColor = (rol) => {
    switch (rol) {
        case 'administrador': return 'red-darken-3';
        case 'editor': return 'green-darken-2';
        case 'PENDIENTE_PAGO': return 'yellow-darken-3';
        case 'PENDIENTE_REVISION': return 'blue-grey-darken-2';
        default: return 'grey';
    }
};

/**
 * Maneja la subida del archivo al store.
 */
const handleUpload = async () => {
    if (!selectedPlan.value || !comprobanteFile.value) {
        store.uploadError = 'Debe seleccionar un plan y adjuntar el comprobante.';
        return;
    }

    // El v-file-input devuelve un array si es 'multiple', si no, el objeto File.
    const file = Array.isArray(comprobanteFile.value)
        ? comprobanteFile.value[0]
        : comprobanteFile.value;

    if (!file) {
        store.uploadError = 'Debe seleccionar un archivo.';
        return;
    }

    // Llamada a la acción del store
    const result = await store.submitPaymentProof(selectedPlan.value, file);

    // Si la subida fue exitosa, limpiamos el campo. El rol de authStore se actualiza 
    // dentro de submitPaymentProof (vía authStore.fetchUser), lo que hará que el componente 
    // se re-renderice y muestre la alerta de PENDIENTE_REVISION.
    if (result.success) {
        // Limpiamos el campo de archivo y la selección para una interfaz limpia
        comprobanteFile.value = null; 
        selectedPlan.value = null; 
    }
};

</script>

<style scoped>
/* Contenedor centralizado y con padding */
.subscription-container {
    max-width: 1400px;
    margin: 20px auto;
    /* Estas propiedades aseguran que el contenedor no restrinja el flujo vertical */
    min-height: 100% !important; 
    overflow-y: visible !important;
}
/* Estilos generales para el acordeón de planes */
.plans-accordion .v-expansion-panel {
    margin-bottom: 12px;
    border-radius: 12px !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}
.plans-accordion .v-expansion-panel-title {
    background-color: #f7f7f7;
    border-radius: 12px 12px 0 0 !important;
    padding: 18px 24px;
}
.plans-accordion .v-expansion-panel-text {
    padding: 20px 0;
}
.text-primary { color: #007bff !important; } /* Azul Intenso */
.text-secondary { color: #28a745 !important; } /* Verde para Acciones */
</style>

<style>
/* Estilo para hacer el título del panel más visible */
.v-expansion-panel-title__overlay {
  opacity: 0 !important;
}
</style>
