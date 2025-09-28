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

    <UserSplashScreen v-if="authStore.showPostLoginSplash" />

  </v-app>
</template>

<script setup>
// ❌ ELIMINAMOS: import { ref, onMounted } from 'vue';
import UserSplashScreen from './components/UserSplashScreen.vue'; // Asume que la ruta es correcta
import { useSnackbar } from './composables/useSnackbar';
import { useAuthStore } from '@/stores/auth'; // 🟢 NUEVA IMPORTACIÓN

const { snackbarState, closeSnackbar } = useSnackbar();
// 🟢 Inicializamos el store para acceder al estado
const authStore = useAuthStore(); 

// ❌ ELIMINAMOS: 
// const showInitialSplash = ref(true);
// onMounted(() => { ... });
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