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
            <!-- Precio Mensual con descuento -->
            <p v-if="plan.price < monthlyBasePrice" class="text-subtitle-2 text-decoration-line-through text-medium-emphasis">
                ₲ {{ formatCurrency(monthlyBasePrice) }} /mes
            </p>
            <!-- Precio Total (Foco principal) -->
            <p class="text-h5 font-weight-black text-primary">
                {{ plan.totalPriceFormatted }}
            </p>
            <p v-if="plan.period" class="text-caption text-medium-emphasis">
                Pago Único por {{ plan.period }}
            </p>
            <p v-else class="text-caption text-medium-emphasis">
                Pago Único
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
import { defineProps, defineEmits } from 'vue';
import { useSuscripcionStore } from '@/stores/suscripcion';

const store = useSuscripcionStore();

defineProps({
  plan: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  // Precio base para calcular visualmente el descuento
  monthlyBasePrice: {
    type: Number,
    required: true,
  }
});

defineEmits(['select']);

// Exportamos el método de la tienda para usarlo en el template
const formatCurrency = store.formatCurrency;

</script>

<style scoped>
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
</style>
