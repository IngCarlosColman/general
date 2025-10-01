<template>
  <v-card
    class="plan-card pa-4 rounded-xl d-flex flex-column transition-ease-in-out hover:scale-105"
    :class="{ 'selected-card': selected }"
    @click="$emit('select', plan.id)"
    :color="selected ? 'primary-lighten-5' : 'white'"
    elevation="4"
  >
    <!-- Título y precio -->
    <div class="d-flex justify-space-between align-start mb-3">
        <v-chip
          :color="selected ? 'primary' : 'grey-darken-1'"
          class="font-weight-bold text-uppercase"
          label
        >
          {{ plan.type }}
        </v-chip>
        <div class="text-right">

            <!-- 1. Precio Base TACHADO (e.g., 350.000) - Usa 'text-h4' -->
            <p v-if="discountPercentage > 0" class="text-h4 text-decoration-line-through text-medium-emphasis">
                {{ formatCurrency(monthlyBasePrice) }}
            </p>

            <!-- 🟢 PRECIO MENSUAL DEL PLAN (FOCO) - Usa 'text-h3' para ser 2-3 ptos más grande -->
            <p class="text-h3 font-weight-black text-primary">
                {{ formatCurrency(plan.price) }}<span class="text-subtitle-2 text-medium-emphasis"> / mes</span>
            </p>

            <!-- 🟢 PORCENTAJE DE DESCUENTO -->
            <p v-if="discountPercentage > 0" class="text-subtitle-2 text-success font-weight-bold">
                ¡{{ discountPercentage }}% de Ahorro!
            </p>

            <v-divider class="my-1"></v-divider>

            <!-- 🟢 PRECIO TOTAL DE PAGO ÚNICO (Multiplicado por meses Y cuentas) -->
            <p class="text-caption text-medium-emphasis">
                Pago Único Total
            </p>
            <p class="text-body-1 font-weight-bold text-medium-emphasis">
                {{ formatCurrency(totalPrice) }}
            </p>
            <p class="text-caption text-medium-emphasis">
                Por {{ durationInMonths }} {{ durationInMonths > 1 ? 'Meses' : 'Mes' }} ({{ plan.users }} {{ plan.users > 1 ? 'Cuentas' : 'Cuenta' }})
            </p>
        </div>
    </div>

    <v-divider class="my-3"></v-divider>

    <!-- Nombre del Plan -->
    <v-card-title class="text-h5 font-weight-bold pa-0 mb-3 text-secondary">
      {{ plan.name }}
    </v-card-title>

    <!-- Características/Beneficios -->
    <v-card-text class="pa-0 flex-grow-1">
      <v-list dense class="bg-transparent">
        <v-list-item v-for="(feature, i) in plan.features" :key="i" class="px-0 py-1">
          <template v-slot:prepend>
            <v-icon color="success" size="small" class="mr-2">mdi-check-circle-outline</v-icon>
          </template>
          <v-list-item-title class="text-body-2">{{ feature }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card-text>

    <!-- Botón de Selección -->
    <v-spacer></v-spacer>
    <v-card-actions class="pa-0 mt-4">
      <v-btn
        :color="selected ? 'primary' : 'grey-lighten-2'"
        :variant="selected ? 'elevated' : 'outlined'"
        block
        class="font-weight-bold"
        size="large"
      >
        {{ selected ? 'Seleccionado' : 'Elegir Plan' }}
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

// --- PROPIEDADES COMPUTADAS PARA EL CÁLCULO DE PRECIOS ---

/**
 * Determina la duración en meses basándose en el campo 'duration' del plan.
 * Asume patrones de texto específicos o un fallback a 12 meses para planes corporativos.
 */
const durationInMonths = computed(() => {
    const durationText = props.plan.duration.toLowerCase();

    if (durationText.includes('1 mes')) return 1;
    if (durationText.includes('6 meses')) return 6;
    if (durationText.includes('1 año')) return 12;

    // Fallback para planes corporativos si la duración no es explícita
    // Se asume que los IDs que empiezan con 'mb_' o 'inm_' son planes anuales corporativos
    if (props.plan.id.startsWith('mb_') || props.plan.id.startsWith('inm_')) {
        return 12;
    }
    return 1; // Default a 1 mes si no se puede determinar
});

/**
 * Calcula el precio total del pago único.
 * Fórmula: Precio Mensual Equivalente * Duración en Meses * Cantidad de Cuentas
 */
const totalPrice = computed(() => {
    // props.plan.price es el precio mensual equivalente con descuento
    const pricePerMonth = props.plan.price;
    const months = durationInMonths.value;
    const users = props.plan.users || 1; // Asegura al menos 1 usuario para el cálculo

    return pricePerMonth * months * users;
});

/**
 * Calcula el porcentaje de descuento comparando el precio mensual del plan
 * con el 'monthlyBasePrice' (e.g., 350000).
 */
const discountPercentage = computed(() => {
    const basePrice = props.monthlyBasePrice;

    if (props.plan.price >= basePrice) {
        return 0;
    }

    const discountAmount = basePrice - props.plan.price;
    const percentage = (discountAmount / basePrice) * 100;

    // Redondea al número entero más cercano para la visualización
    return Math.round(percentage);
});

</script>

<style scoped>
/* Estilos necesarios para la interactividad y diseño */
.plan-card {
    border: 3px solid transparent;
    transition: all 0.3s ease-in-out;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    height: 100%; /* Asegura que todas las tarjetas tengan la misma altura */
    min-height: 400px;
}
.selected-card {
    border-color: #007bff; /* Color primario para el borde de la selección */
    box-shadow: 0 6px 15px rgba(0, 123, 255, 0.3); /* Sombra de acento */
    background-color: #e6f2ff !important;
}
/* Estilos para hover (simulando tailwind hover:scale-105) */
.plan-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}
.text-primary { color: #007bff !important; }
.text-secondary { color: #28a745 !important; }

/* Ajuste de tipografía para precios */
.text-h3 {
    font-size: 2.25rem !important; /* Más grande que h4 (típicamente 2.125rem) */
    line-height: 1.1;
}
</style>
