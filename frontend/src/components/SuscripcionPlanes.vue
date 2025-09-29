<template>
  <v-container fluid class="pa-4 subscription-container">
    <v-card class="pa-6 rounded-xl shadow-lg elevation-8">
      <v-card-title class="text-h4 font-weight-black text-center mb-4 text-primary">
        ¡Bienvenido! Active su Licencia
      </v-card-title>
      <v-card-text>
        <p class="text-center text-subtitle-1 mb-6 text-medium-emphasis">
          Para comenzar a utilizar nuestra plataforma, seleccione un plan y suba su comprobante de pago para la activación. Su rol actual es: <v-chip color="warning" class="font-weight-bold ml-2">PENDIENTE_PAGO</v-chip>
        </p>

        <v-divider class="mb-6"></v-divider>

        <!-- Sección de Planes -->
        <h2 class="text-h5 font-weight-bold mb-4">1. Elija su Plan</h2>
        <v-row>
          <!-- Tarjeta de Plan -->
          <v-col v-for="plan in plans" :key="plan.id" cols="12" md="4">
            <v-card
              class="plan-card"
              :class="{ 'plan-card-selected': selectedPlan === plan.id }"
              @click="selectedPlan = plan.id"
              :color="selectedPlan === plan.id ? 'blue-lighten-5' : 'grey-lighten-5'"
              hover
              flat
            >
              <v-card-title class="text-h5 font-weight-bold text-center text-blue-darken-3">{{ plan.name }}</v-card-title>
              <v-card-subtitle class="text-center text-h6 font-weight-bold text-green-darken-2 py-2">{{ plan.price }}</v-card-subtitle>
              <v-card-text>
                <v-list density="compact" class="bg-transparent">
                  <v-list-item v-for="(feature, i) in plan.features" :key="i" class="py-1">
                    <template v-slot:prepend>
                      <v-icon color="success" icon="mdi-check-circle-outline"></v-icon>
                    </template>
                    <v-list-item-title class="text-body-2">{{ feature }}</v-list-item-title>
                  </v-list-item>
                </v-list>
                <v-btn
                  :color="selectedPlan === plan.id ? 'primary' : 'grey'"
                  variant="flat"
                  block
                  class="mt-4"
                  :disabled="selectedPlan === plan.id"
                >
                  {{ selectedPlan === plan.id ? 'Seleccionado' : 'Seleccionar' }}
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        
        <v-divider class="my-6"></v-divider>

        <!-- Sección de Subida de Comprobante -->
        <h2 class="text-h5 font-weight-bold mb-4">2. Subir Comprobante de Pago</h2>
        
        <v-alert
            v-if="store.uploadSuccess"
            type="success"
            icon="mdi-check-all"
            closable
            class="mb-4 elevation-2"
        >
            {{ store.userMessage }}
            <p class="mt-2 text-caption">Su solicitud ha sido enviada. Un administrador revisará el pago y activará su cuenta en breve.</p>
        </v-alert>

        <v-alert
            v-if="store.uploadError"
            type="error"
            icon="mdi-alert-circle-outline"
            closable
            class="mb-4 elevation-2"
        >
            {{ store.uploadError }}
        </v-alert>

        <v-form @submit.prevent="handleSubmitProof">
          <v-row>
            <v-col cols="12" md="6">
              <v-file-input
                v-model="comprobanteFile"
                label="Adjuntar Comprobante (PDF, JPG, PNG)"
                hint="Adjunte una imagen o PDF de su transferencia/depósito."
                persistent-hint
                accept=".pdf,.jpg,.jpeg,.png"
                :disabled="!selectedPlan || store.isUploading || store.uploadSuccess"
                prepend-icon="mdi-paperclip"
                show-size
                clearable
                :rules="[v => !!v || 'El comprobante es obligatorio']"
              ></v-file-input>
            </v-col>

            <v-col cols="12" md="6" class="d-flex align-center">
              <v-btn
                :loading="store.isUploading"
                :disabled="!selectedPlan || !comprobanteFile || store.uploadSuccess"
                color="success"
                size="large"
                prepend-icon="mdi-upload-multiple"
                type="submit"
                block
                class="elevation-4"
              >
                Enviar Solicitud de Activación
              </v-btn>
            </v-col>
          </v-row>
        </v-form>

      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useSuscripcionStore } from '@/stores/suscripcion';

const store = useSuscripcionStore();

// Estado local
const selectedPlan = ref(null); 
const comprobanteFile = ref(null); 

// Planes de ejemplo
const plans = ref([
  {
    id: 'basic',
    name: 'Básico',
    price: '₲ 100.000 / Mes',
    features: [
      'Acceso a Búsqueda Catastral',
      '50 Consultas WFS al día',
      'Visualización de 50 propiedades guardadas',
      'Soporte estándar por email'
    ]
  },
  {
    id: 'standard',
    name: 'Estándar (Recomendado)',
    price: '₲ 250.000 / Mes',
    features: [
      'Todo lo del Básico',
      'Consultas WFS ilimitadas',
      'Visualización de 500 propiedades guardadas',
      'Filtro por área Geoespacial',
      'Soporte prioritario por WhatsApp'
    ]
  },
  {
    id: 'pro',
    name: 'Profesional',
    price: '₲ 500.000 / Mes',
    features: [
      'Todo lo del Estándar',
      'Visualización de 5000 propiedades guardadas',
      'Funcionalidad de exportación a CSV/KML',
      'Gestión de 2 usuarios visualizadores adicionales',
      'Atención personalizada 24/7'
    ]
  }
]);

/**
 * Maneja el envío del formulario.
 */
const handleSubmitProof = async () => {
    store.uploadError = null; // Limpiar errores antes de intentar
    
    if (!selectedPlan.value) {
        store.uploadError = 'Por favor, seleccione un plan.';
        return;
    }

    // El comprobanteFile puede ser un FileList (si se usa directamente) o un array de Files (v-model en Vuetify)
    const file = Array.isArray(comprobanteFile.value) && comprobanteFile.value.length > 0
        ? comprobanteFile.value[0]
        : comprobanteFile.value;

    if (!file) {
        store.uploadError = 'Debe seleccionar un archivo.';
        return;
    }

    // Llamada a la acción del store
    await store.submitPaymentProof(selectedPlan.value, file);
};

</script>

<style scoped>
/* Contenedor centralizado y con padding */
.subscription-container {
    max-width: 1200px;
    margin: 20px auto;
}
.plan-card {
    border: 3px solid transparent;
    transition: all 0.3s ease-in-out;
    cursor: pointer;
}
/* Estilo para la tarjeta seleccionada */
.plan-card-selected {
    border-color: #1976D2 !important; /* Vuetify Primary Blue */
    box-shadow: 0 0 18px rgba(25, 118, 210, 0.6) !important;
}
/* Asegura que los textos largos en la lista se envuelvan */
.v-list-item-title {
    white-space: normal;
    font-size: 0.9rem;
}
</style>
