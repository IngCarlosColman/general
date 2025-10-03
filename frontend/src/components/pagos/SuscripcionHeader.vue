<template>
  <div>
    <v-card-title
      class="text-h4 font-weight-black text-center text-primary mb-2"
    >
      Bienvenido a la Agenda Inmobiliaria
    </v-card-title>
    <v-card-subtitle class="text-subtitle-1 text-center text-medium-emphasis">
      Active su Licencia para comenzar a operar.
      <v-chip
        :color="getRoleColor(rol)"
        class="font-weight-bold ml-2 text-white"
        size="large"
      >
        {{ rol.toUpperCase().replace('_', ' ') }}
      </v-chip>
    </v-card-subtitle>
    <v-divider class="my-6"></v-divider>
    <v-alert
      v-if="rol === 'PENDIENTE_REVISION'"
      type="info"
      icon="mdi-clock-time-four-outline"
      title="Solicitud de Activación en Curso"
      class="mb-8"
      variant="tonal"
      color="blue-grey"
      prominent
    >
      Hemos recibido su comprobante de pago. Un administrador revisará su
      solicitud en las próximas 24 horas. Una vez aprobado, su rol cambiará a
      **EDITOR** y podrá acceder al sistema. Gracias por su paciencia.
    </v-alert>
    </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  rol: {
    type: String,
    required: true,
  },
});

/**
 * @description Devuelve el color apropiado para el chip de rol.
 */
const getRoleColor = (rol) => {
  switch (rol) {
    case 'administrador':
      return 'red-darken-3';
    case 'editor':
      return 'green-darken-2';
    case 'PENDIENTE_PAGO':
      return 'yellow-darken-3';
    case 'PENDIENTE_REVISION':
      return 'blue-grey-darken-2';
    default:
      return 'grey';
  }
};
</script>

<style scoped>
.text-primary {
  color: #007bff !important;
}
</style>