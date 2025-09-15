<template>
  <div class="map-container">
    <div v-if="properties.length === 0" class="placeholder-text">
      No hay propiedades con coordenadas para mostrar en el mapa.
    </div>
    <div v-else class="placeholder-text">
      El componente del mapa se mostrará aquí pronto.
    </div>
    <v-progress-linear
      v-if="properties.length > 0"
      color="blue-lighten-2"
      indeterminate
      class="mt-4"
    ></v-progress-linear>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

const props = defineProps({
  properties: {
    type: Array,
    default: () => [],
  },
});
</script>

<style scoped>
.map-container {
  min-height: 400px;
  border: 2px dashed #e0e0e0;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  background-color: #fafafa;
  padding: 20px;
}

.placeholder-text {
  font-size: 1.2rem;
  color: #757575;
}
</style>