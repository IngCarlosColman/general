<template>
  <v-app>
    <router-view />
    
    <v-snackbar
      :model-value="snackbarState.snackbar"
      :color="snackbarState.color"
      :timeout="3000"
      location="bottom right"
      @update:model-value="closeSnackbar"
    >
      {{ snackbarState.text }}
      <template v-slot:actions>
        <v-btn
          color="white"
          variant="text"
          @click="closeSnackbar"
        >
          Cerrar
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { useSnackbar } from './composables/useSnackbar';

// Importa tanto el estado de solo lectura como la función para cerrarlo
const { snackbarState, closeSnackbar } = useSnackbar();
</script>