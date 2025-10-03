<template>
  <v-card
    class="plan-card pa-4 rounded-xl d-flex flex-column transition-swing elevation-4"
    :class="{ 'selected-card': selected }"
    @click="$emit('select', plan.id)"
    :color="selected ? 'primary-lighten-5' : 'white'"
    elevation="4"
  >
    <div class="d-flex justify-space-between align-start mb-3">
        <v-chip
          :color="selected ? 'secondary' : 'grey-darken-1'"
          class="font-weight-bold text-uppercase text-white"
          label
        >
          {{ plan.type }}
        </v-chip>
        
        <div class="text-right">
            <p v-if="discountPercentage > 0" class="text-subtitle-1 text-decoration-line-through text-medium-emphasis mb-0">
                {{ formatCurrency(monthlyBasePrice) }}
            </p>

            <p class="text-h3 font-weight-black text-primary mb-0">
                {{ formatCurrency(plan.price) }}<span class="text-subtitle-2 text-medium-emphasis">/mes</span>
            </p>
        </div>
    </div>
    
    <v-chip
      v-if="discountPercentage > 0"
      color="secondary"
      class="font-weight-black text-uppercase mb-4 mt-n2 align-self-end text-white"
      size="large"
      label
    >
      ¡Ahorra {{ discountPercentage }}%!
    </v-chip>

    <v-divider class="my-3"></v-divider>
    
    <div class="mb-4">
        <p class="text-caption text-medium-emphasis mb-0">
            Pago Único Total
        </p>
        <p class="text-h6 font-weight-black text-primary mb-1">
            {{ formatCurrency(totalPrice) }}
        </p>
        <p class="text-caption text-medium-emphasis">
            Por {{ durationInMonths }} {{ durationInMonths > 1 ? 'Meses' : 'Mes' }} ({{ plan.users }} {{ plan.users > 1 ? 'Cuentas' : 'Cuenta' }})
        </p>
    </div>

    <v-card-title class="text-h5 font-weight-bold pa-0 mb-3 text-primary">
      {{ plan.name }}
    </v-card-title>

    <v-card-text class="pa-0 flex-grow-1">
      <v-list dense class="bg-transparent">
        <v-list-item v-for="(feature, i) in plan.features" :key="i" class="px-0 py-1">
          <template v-slot:prepend>
            <v-icon color="secondary" size="small" class="mr-2">mdi-check-circle-outline</v-icon> </template>
          <v-list-item-title class="text-body-2">{{ feature }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>

    <v-spacer></v-spacer>
    <v-card-actions class="pa-0 mt-6">
      <v-btn
        :color="selected ? 'primary' : 'secondary'"
        :variant="selected ? 'elevated' : 'flat'"
        block
        class="font-weight-bold text-white"
        size="large"
        :append-icon="selected ? 'mdi-check-circle-outline' : 'mdi-chevron-right'"
      >
        {{ selected ? 'Plan Seleccionado' : 'Elegir Plan' }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
// Se asume que esta ruta y store existen en la estructura del proyecto
import { useSuscripcionStore } from '@/stores/suscripcion.js';

const store = useSuscripcionStore();

const props = defineProps({
    plan: {
        type: Object,
        required: true,
    },
    selected: {
        type: Boolean,
        default: false,
    },
    monthlyBasePrice: {
        type: Number,
        required: true,
    }
});

defineEmits(['select']);

// Función de formato de moneda (asumimos que viene del store)
const formatCurrency = store.formatCurrency;

// --- PROPIEDADES COMPUTADAS PARA EL CÁLCULO DE PRECIOS (LÓGICA REAL PRESERVADA) ---

const durationInMonths = computed(() => {
    const durationText = props.plan.duration.toLowerCase();

    if (durationText.includes('1 mes')) return 1;
    if (durationText.includes('6 meses')) return 6;
    if (durationText.includes('1 año')) return 12;

    // Se asume que los IDs que empiezan con 'mb_' o 'inm_' son planes anuales corporativos
    if (props.plan.id.startsWith('mb_') || props.plan.id.startsWith('inm_')) {
        return 12;
    }
    return 1;
});

const totalPrice = computed(() => {
    const pricePerMonth = props.plan.price;
    const months = durationInMonths.value;
    const users = props.plan.users || 1; 

    return pricePerMonth * months * users;
});

const discountPercentage = computed(() => {
    const basePrice = props.monthlyBasePrice;

    if (props.plan.price >= basePrice) {
        return 0;
    }

    const discountAmount = basePrice - props.plan.price;
    const percentage = (discountAmount / basePrice) * 100;

    return Math.round(percentage);
});

</script>

<style scoped>
/* * 1. DEFINICIÓN DE COLORES Y TIPOGRAFÍA
 */
/* Custom Colors (Usando las clases predeterminadas de Vuetify para facilitar el override) */
.text-primary { color: #1976D2 !important; } /* Azul Profundo */
.bg-primary-lighten-5 { background-color: #e3f2fd !important; } /* Fondo azul claro para selección */
.text-secondary { color: #00BCD4 !important; } /* Cian Vívido */
.bg-secondary { background-color: #00BCD4 !important; }
.text-white { color: rgb(56, 56, 58) !important; } /* Aseguramos texto blanco en chips/botones de color */


/* Aplicar la fuente Karla al cuerpo de la tarjeta */
.plan-card, .plan-card * {
    font-family: 'Karla', sans-serif !important;
}
/* Aplicar la fuente Francois One al título del Plan */
.v-card-title {
    font-family: 'Francois One', sans-serif !important;
}

/* * 2. ESTILOS DE INTERACTIVIDAD Y LAYOUT
 */
.plan-card {
    border: 3px solid transparent;
    transition: all 0.3s ease-in-out;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* Sombra sutil */
    height: 100%;
    min-height: 400px; /* Estándar mínimo para alineación */
    
    /* Efecto de hover elegante: Levantamiento y sombra */
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
    }
}
.selected-card {
    /* Borde Cian Vívido (Secondary) para acento visual */
    border-color: #00BCD4; 
    box-shadow: 0 0 0 4px #1976D2; /* Borde de acento más notorio (Azul Profundo) */
    background-color: #e3f2fd !important; /* light-blue-lighten-5 */
}

/* Ajuste de tipografía para el precio principal */
.text-h3 {
    font-size: 2.25rem !important;
    line-height: 1.1;
}
</style>