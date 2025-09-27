<template>
  <v-card :color="color" :title="title" class="text-white elevation-4 rounded-lg">
    <v-card-text class="d-flex align-center justify-space-between py-4">
      <div class="d-flex flex-column">
        <span class="text-h5 font-weight-bold">{{ value }}</span>
        <span v-if="subtext" class="text-caption opacity-8">{{ subtext }}</span>
      </div>
      <v-icon :icon="icon" size="48" class="opacity-8"></v-icon>
    </v-card-text>
  </v-card>
</template>

<script setup>
// Define las propiedades (props) que el componente espera recibir del padre (Panel.vue)
defineProps({
  title: String,
  value: [String, Number],
  icon: String,
  color: String,
  subtext: String,
});
</script>

<style scoped>
.opacity-8 {
  opacity: 0.8;
}
</style>