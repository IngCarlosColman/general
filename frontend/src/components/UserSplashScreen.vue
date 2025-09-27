<template>
  <v-overlay
    :model-value="true"
    class="align-center justify-center transition-opacity"
    persistent
    scrim="blue-grey-darken-4"
    :z-index="9999"
  >
    <v-card
      class="pa-8 text-center rounded-xl elevation-10"
      color="blue-grey-darken-4"
      min-width="400"
    >
      <v-progress-circular
        indeterminate
        color="white"
        size="48"
        class="mb-4"
      ></v-progress-circular>
      <v-card-title class="text-h4 font-weight-bold text-white mb-2">
        ¡BIENVENIDO!
      </v-card-title>
      <v-card-subtitle class="text-h5 font-weight-regular text-white">
        {{ userName }}
      </v-card-subtitle>
      <v-card-text class="text-white text-caption mt-4">
        Cargando Panel de Control...
      </v-card-text>
    </v-card>
  </v-overlay>
</template>

<script setup>
import { computed } from 'vue';
// Importa tu store de autenticación (ajusta la ruta si es necesario)
import { useAuthStore } from '@/stores/auth'; 

const authStore = useAuthStore();

// Construye el nombre y apellido del usuario.
// Asegúrate que tu store tenga las propiedades 'nombre' y 'apellido' en el objeto 'user'.
const userName = computed(() => {
  const user = authStore.user; 
  if (user && user.nombre && user.apellido) {
    return `${user.nombre} ${user.apellido}`;
  }
  return 'Usuario';
});
</script>

<style scoped>
/* Opcional: Estilo para la transición suave al desaparecer */
.transition-opacity {
  transition: opacity 0.3s ease-in-out;
}
</style>