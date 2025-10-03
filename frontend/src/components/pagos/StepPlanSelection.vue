<template>
  <div class="selection-karla">
    <h2 class="text-h5 font-weight-bold text-center mb-6 text-secondary">
      1. Elija su Plan de Suscripción
    </h2>
    
    <v-card class="mb-6 elevation-2 rounded-xl" flat>
      <v-tabs
        v-model="tabModel"
        align-tabs="center"
        color="primary"
        height="60"
        slider-color="secondary"
      >
        <v-tab value="agentes" prepend-icon="mdi-account-star">
          Agentes
          <div class="text-caption text-medium-emphasis ml-2 d-none d-sm-inline">
            (Individual)
          </div>
        </v-tab>
        
        <v-tab value="minibroker" prepend-icon="mdi-office-building-cog">
          Mini Broker/Desarrolladoras
          <div class="text-caption text-medium-emphasis ml-2 d-none d-sm-inline">
            (5 a 15 Cuentas)
          </div>
        </v-tab>
        
        <v-tab value="inmobiliarias" prepend-icon="mdi-domain">
          Inmobiliarias
          <div class="text-caption text-medium-emphasis ml-2 d-none d-sm-inline">
            (20+ Cuentas)
          </div>
        </v-tab>
      </v-tabs>
    </v-card>

    <v-window :model-value="tabModel" class="py-4">
      <v-window-item value="agentes">
        <v-row justify="center" class="pa-3">
          <v-col
            v-for="plan in planesAgentes"
            :key="plan.id"
            cols="12"
            sm="6"
            lg="4"
          >
            <PlanCard
              :plan="plan"
              :selected="selectedPlan === plan.id"
              @select="$emit('selectPlan', plan.id)"
              :monthlyBasePrice="monthlyBasePrice"
            />
          </v-col>
        </v-row>
      </v-window-item>

      <v-window-item value="minibroker">
        <v-row justify="center" class="pa-3">
          <v-col
            v-for="plan in planesMiniBroker"
            :key="plan.id"
            cols="12"
            sm="6"
            lg="4"
          >
            <PlanCard
              :plan="plan"
              :selected="selectedPlan === plan.id"
              @select="$emit('selectPlan', plan.id)"
              :monthlyBasePrice="monthlyBasePrice"
            />
          </v-col>
        </v-row>
      </v-window-item>

      <v-window-item value="inmobiliarias">
        <v-row justify="center" class="pa-3">
          <v-col
            v-for="plan in planesInmobiliarias"
            :key="plan.id"
            cols="12"
            sm="6"
            lg="4"
          >
            <PlanCard
              :plan="plan"
              :selected="selectedPlan === plan.id"
              @select="$emit('selectPlan', plan.id)"
              :monthlyBasePrice="monthlyBasePrice"
            />
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>

    <v-alert
      v-if="currentPlan"
      type="success"
      class="mt-6 font-weight-bold elevation-8 rounded-xl"
      variant="flat"
      color="success-darken-2" 
      prominent
      :title="`Plan seleccionado: ${currentPlan.name}`"
      :text="`El monto total a pagar es: ${currentPlan.totalPriceFormatted}. Haga clic para continuar con la facturación.`"
    >
      <template #append>
        <v-btn
          color="white"
          class="font-weight-bold text-success-darken-2"
          @click="$emit('nextStep')"
          append-icon="mdi-arrow-right-bold"
          variant="flat"
          size="large"
        >
          Ir a Facturación
        </v-btn>
      </template>
    </v-alert>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
// Importamos PlanCard desde la ruta indicada por la refactorización
import PlanCard from '@/components/pagos/PlanCard.vue';

const props = defineProps({
  planesAgentes: Array,
  planesMiniBroker: Array,
  planesInmobiliarias: Array,
  monthlyBasePrice: Number,
  selectedPlan: String,
  currentPlan: Object, // Plan con totalPriceFormatted
  activeTab: String, // Prop para el v-model del tab
});

const emit = defineEmits(['selectPlan', 'nextStep', 'update:activeTab']);

// Implementación de v-model para 'activeTab'
const tabModel = computed({
  get: () => props.activeTab,
  set: (val) => emit('update:activeTab', val),
});

// Alias para los props de las categorías de planes
const planesAgentes = computed(() => props.planesAgentes);
const planesMiniBroker = computed(() => props.planesMiniBroker);
const planesInmobiliarias = computed(() => props.planesInmobiliarias);
</script>

<style scoped>
/* * 1. DEFINICIÓN DE COLORES Y TIPOGRAFÍA */
/* Colores personalizados (Azul Profundo y Cian Vívido) */
.text-primary { color: #1976D2 !important; }
.text-secondary { color: #00BCD4 !important; }

/* Nuevo color para la alerta de acción (verde oscuro) */
.text-success-darken-2 { color: #388E3C !important; }
.bg-success-darken-2 { background-color: #388E3C !important; }

/* Aplicar la fuente Karla al cuerpo del contenido */
.selection-karla, .selection-karla * {
    font-family: 'Karla', sans-serif !important;
}

/* Aplicar la fuente Francois One al título principal */
.text-h5 {
    font-family: 'Francois One', sans-serif !important;
}
</style>