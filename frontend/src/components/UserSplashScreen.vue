<template>
  <v-overlay
    :model-value="true"
    class="align-center justify-center transition-opacity"
    persistent
    scrim="blue-grey-darken-4" 
    :z-index="20000" 
    >
    <div class="text-center pa-10">
      <v-progress-circular
        indeterminate
        color="white"
        size="64" 
        class="mb-8" 
      ></v-progress-circular>

      <div class="text-h3 font-weight-light text-white mb-2">
        ¡BIENVENIDO!
      </div>

      <div class="text-h5 font-weight-medium text-white mb-10">
        {{ userName }}
      </div>

      <div class="text-white text-subtitle-1">
        Cargando Panel de Control...
      </div>
    </div>
  </v-overlay>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth'; 

const authStore = useAuthStore();

const userName = computed(() => {
  return authStore.fullName;
});
</script>

<style scoped>
.transition-opacity {
  transition: opacity 0.3s ease-in-out;
}
</style>

<style>
.v-overlay__scrim {
  opacity: 1 !important; 
}
</style>