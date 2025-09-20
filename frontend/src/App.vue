<template>
  <v-app>
    <router-view />

    <v-snackbar
      v-model="snackbarState.show"
      :color="snackbarState.color"
      :timeout="snackbarState.timeout"
      location="bottom right"
      @update:model-value="closeSnackbar"
    >
      {{ snackbarState.message }}
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

<style>
/* Estilos globales para asegurar que la app ocupe toda la pantalla */
html, body, #app, .v-application {
  height: 100% !important;
  width: 100% !important;
  margin: 0;
  padding: 0;
}
</style>