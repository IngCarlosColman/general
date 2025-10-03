<template>
  <div class="pago-karla">
    <h2 class="text-h5 font-weight-bold text-center mb-6 text-secondary">
      3. Realice el Pago y Suba el Comprobante
    </h2>

    <v-row justify="center" class="w-100 ma-0">
      
      <v-col cols="12" md="7">
        <v-card class="pa-5 rounded-xl elevation-4 h-100" flat>
          
          <v-card-title class="text-h6 font-weight-bold mb-4 text-primary">
            Carga de Comprobante
          </v-card-title>
          <v-divider class="mb-4"></v-divider>

          <v-form @submit.prevent="$emit('uploadProof')">
            
            <v-alert
              v-if="currentPlan"
              type="info"
              icon="mdi-cash-multiple"
              class="mb-6 rounded-lg"
              variant="tonal"
              color="primary"
            >
              <div class="font-weight-medium text-body-1">
                Plan: <span class="font-weight-bold">{{ currentPlan.name }}</span>
              </div>
              <div class="font-weight-medium text-body-1">
                Monto Total a Pagar:
                <span class="font-weight-black text-h6">{{ currentPlan.totalPriceFormatted }}</span>
              </div>
            </v-alert>

            <v-alert
              type="success"
              icon="mdi-file-document-check-outline"
              class="mb-6 rounded-lg"
              variant="tonal"
              color="success"
            >
              Datos de Facturación Confirmados:
              <span class="font-weight-bold">{{ store.billingData.razon_social }}</span> - RUC:
              <span class="font-weight-bold">{{ store.billingData.ruc_fiscal }}</span>.
            </v-alert>

            <v-file-input
              :model-value="comprobanteFile"
              @update:model-value="$emit('update:comprobanteFile', $event)"
              :disabled="!selectedPlan || store.isUploading"
              :rules="fileRules"
              accept="image/jpeg,image/png,application/pdf"
              label="1. Adjunte Comprobante (JPG, PNG o PDF, máx 5MB)"
              prepend-icon="mdi-paperclip"
              variant="outlined"
              color="primary"
              clearable
              class="mb-4"
              single
            ></v-file-input>

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

              <v-btn
                variant="text"
                color="secondary"
                @click="$emit('prevStep')"
                prepend-icon="mdi-arrow-left"
                class="mt-3"
                block
              >
                Volver y Modificar Facturación
              </v-btn>

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
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card
          class="pa-5 rounded-xl elevation-4 border-lg h-100 bg-blue-grey-lighten-5"
          flat
        >
          <v-card-title
            class="text-h6 font-weight-bold text-blue-grey-darken-4 d-flex align-center"
          >
            <v-icon
              icon="mdi-bank-transfer-in"
              class="mr-3"
              color="blue-grey-darken-2"
            ></v-icon>
            Información para Transferencia
          </v-card-title>
          <v-card-text class="py-3">
            <p class="mb-3 font-weight-medium text-body-2 text-medium-emphasis">
              Realice el pago total de su plan a la siguiente cuenta:
            </p>
            
            <v-list density="compact" class="bg-transparent">
              <v-list-item class="px-0 py-1">
                <span class="font-weight-medium text-caption text-uppercase">TIPO DE ALIAS:</span>
                <span class="ml-2 font-weight-bold text-primary">RUC</span>
              </v-list-item>
              <v-list-item class="px-0 py-1">
                <span class="font-weight-medium text-caption text-uppercase">ALIAS:</span>
                <span class="ml-2 font-weight-bold text-primary">3685150 - 7</span>
              </v-list-item>
              <v-list-item class="px-0 py-1">
                <span class="font-weight-medium text-caption text-uppercase">CUENTA NUMERO:</span>
                <span class="ml-2 font-weight-bold text-primary">266422</span>
              </v-list-item>
              <v-list-item class="px-0 py-1">
                <span class="font-weight-medium text-caption text-uppercase">DESTINATARIO:</span>
                <span class="ml-2 font-weight-bold text-primary">Carlos Colman</span>
              </v-list-item>
              <v-list-item class="px-0 py-1">
                <span class="font-weight-medium text-caption text-uppercase"
                  >ENTIDAD FINANCIERA:</span
                >
                <span class="ml-2 font-weight-bold text-primary"
                  >Cooperativa Universitaria Ltda.</span
                >
              </v-list-item>
            </v-list>
            
            <v-alert
              type="warning"
              density="compact"
              variant="tonal"
              class="mt-4 rounded-lg"
              icon="mdi-camera-timer"
            >
              **Importante:** Suba el comprobante de esta transferencia en el formulario de la izquierda para activar su licencia.
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { useSuscripcionStore } from '@/stores/suscripcion';

const store = useSuscripcionStore();

const props = defineProps({
  currentPlan: Object, // Plan con totalPriceFormatted
  selectedPlan: String,
  comprobanteFile: [File, Object, Array], // Permite el binding bidireccional
  fileRules: Array,
});

const emit = defineEmits(['prevStep', 'uploadProof', 'update:comprobanteFile']);
</script>

<style scoped>
/* * 1. DEFINICIÓN DE COLORES Y TIPOGRAFÍA */
/* Colores personalizados (Azul Profundo y Cian Vívido) */
.text-primary { color: #1976D2 !important; }
.text-secondary { color: #00BCD4 !important; }

/* Aplicar la fuente Karla al cuerpo del contenido */
.pago-karla, .pago-karla * {
    font-family: 'Karla', sans-serif !important;
}

/* Aplicar la fuente Francois One al título principal */
.text-h5 {
    font-family: 'Francois One', sans-serif !important;
}
</style>