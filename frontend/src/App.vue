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

    <UserSplashScreen v-if="showInitialSplash" />

  </v-app>
</template>

<script setup>
import { ref, onMounted } from 'vue'; // 👈 Importamos ref y onMounted
import UserSplashScreen from './components/UserSplashScreen.vue'; // 👈 Importa el nuevo componente
import { useSnackbar } from './composables/useSnackbar';

const { snackbarState, closeSnackbar } = useSnackbar();

// === LÓGICA DEL SPLASH SCREEN ===
// 1. Estado para controlar la visibilidad. Empieza en true (visible).
const showInitialSplash = ref(true);

onMounted(() => {
  // 2. Establecemos un temporizador de 3000 ms (3 segundos)
  setTimeout(() => {
    // 3. Después de 3 segundos, ocultamos el splash screen
    showInitialSplash.value = false;
  }, 3000); // 3 segundos
});
// =================================
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