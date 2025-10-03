<template>
  <div class="facturacion-karla">
    <h2 class="text-h5 font-weight-bold text-center mb-6 text-secondary">
      2. Complete sus Datos de Facturación
    </h2>
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8" lg="7">
        
        <v-card class="pa-6 mb-6 rounded-xl elevation-6" flat>

          <h3 class="text-h6 font-weight-bold text-primary mb-4">
            Detalles de Facturación
          </h3>
          <span class="text-subtitle-1 font-weight-regular text-medium-emphasis mb-4 d-block">
            RUC, Razón Social y Dirección Fiscal
          </span>
          <v-divider class="mb-4"></v-divider>

          <v-text-field
            v-model="store.billingData.ruc_fiscal"
            label="RUC Fiscal"
            :rules="[billingRules.required, billingRules.ruc]"
            prepend-inner-icon="mdi-badge-account-horizontal-outline"
            variant="outlined"
            required
            color="primary"
            class="mb-4"
          ></v-text-field>

          <v-text-field
            v-model="store.billingData.razon_social"
            label="Razón Social (Nombre de la Empresa o Persona)"
            :rules="[billingRules.required]"
            prepend-inner-icon="mdi-factory"
            variant="outlined"
            required
            color="primary"
            class="mb-4"
          ></v-text-field>

          <v-text-field
            v-model="store.billingData.direccion_fiscal"
            label="Dirección Fiscal Completa"
            :rules="[billingRules.required]"
            prepend-inner-icon="mdi-map-marker-outline"
            variant="outlined"
            required
            color="primary"
            class="mb-4"
          ></v-text-field>
          
          <v-divider class="mt-4 mb-6"></v-divider>

          <h3 class="text-h6 font-weight-bold text-primary mb-4">
            Método de Entrega
          </h3>
          <span class="text-subtitle-1 font-weight-regular text-medium-emphasis mb-4 d-block">
            Seleccione cómo desea recibir sus facturas
          </span>
          <v-divider class="mb-4"></v-divider>

          <v-select
            v-model="store.billingData.metodo_entrega"
            label="Método de Entrega de Factura"
            :items="[
              { title: 'Correo Electrónico', value: 'EMAIL' },
              { title: 'Envío Postal', value: 'POSTAL' },
              { title: 'WhatsApp', value: 'WHATSAPP' },
              { title: 'Factura Digital', value: 'DIGITAL' },
            ]"
            :rules="[billingRules.required]"
            prepend-inner-icon="mdi-email-send-outline"
            variant="outlined"
            required
            color="primary"
            class="mb-4"
            @update:model-value="handleMetodoEntregaChange"
          ></v-select>

          <v-text-field
            v-model="store.billingData.email_facturacion"
            label="Email para Recepción de Facturas"
            :rules="
              store.billingData.metodo_entrega === 'EMAIL'
                ? [billingRules.required, billingRules.email]
                : []
            "
            prepend-inner-icon="mdi-email-check-outline"
            variant="outlined"
            color="primary"
            :disabled="store.billingData.metodo_entrega !== 'EMAIL'"
            :required="store.billingData.metodo_entrega === 'EMAIL'"
            class="mb-4"
          ></v-text-field>
          
          <v-alert
            v-if="store.billingData.metodo_entrega !== 'EMAIL'"
            type="info"
            density="compact"
            variant="tonal"
            class="mt-2"
          >
            Si selecciona otro método, el campo de Email para facturación es opcional.
          </v-alert>

        </v-card>
        
        <v-card-actions class="d-flex justify-space-between pa-4 pt-0">
          
          <v-btn
            variant="text"
            color="secondary"
            @click="$emit('prevStep')"
            prepend-icon="mdi-arrow-left"
          >
            Volver al Plan
          </v-btn>
          
          <v-btn
            color="primary"
            :disabled="!isBillingFormValid || isBillingLoading"
            :loading="isBillingLoading"
            prepend-icon="mdi-content-save-check-outline"
            size="large"
            @click="$emit('submitBilling')"
            class="font-weight-bold"
          >
            Guardar y Continuar al Pago
          </v-btn>
        </v-card-actions>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
// Lógica real preservada
import { useSuscripcionStore } from '@/stores/suscripcion';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  billingRules: Object,
  isBillingLoading: Boolean,
  isBillingFormValid: Boolean, // Se recibe del v-model del form del padre
});

const emit = defineEmits(['prevStep', 'submitBilling']);

const store = useSuscripcionStore();
const authStore = useAuthStore();

/**
 * @description Maneja el cambio en la selección de métodos de entrega. (Lógica real preservada)
 */
const handleMetodoEntregaChange = (newMethod) => {
  if (newMethod === 'EMAIL') {
    if (!store.billingData.email_facturacion && authStore.user?.email) {
      store.billingData.email_facturacion = authStore.user.email;
    }
  } else {
    // Si cambia a otro método, se limpia el campo de email para evitar validación innecesaria
    store.billingData.email_facturacion = '';
  }
};
</script>

<style scoped>
/* * 1. DEFINICIÓN DE COLORES Y TIPOGRAFÍA */
/* Colores personalizados (Azul Profundo y Cian Vívido) */
.text-primary { color: #1976D2 !important; }
.text-secondary { color: #00BCD4 !important; }

/* Aplicar la fuente Karla al cuerpo del contenido */
.facturacion-karla, .facturacion-karla * {
    font-family: 'Karla', sans-serif !important;
}

/* Aplicar la fuente Francois One al título principal */
.text-h5 {
    font-family: 'Francois One', sans-serif !important;
}
</style>