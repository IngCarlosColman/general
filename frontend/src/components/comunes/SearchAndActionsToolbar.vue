<template>
  <v-toolbar flat>
    <v-toolbar-title class="text-h6">{{ title }}</v-toolbar-title>
    <v-spacer></v-spacer>
    <v-text-field
      :model-value="search"
      @update:model-value="$emit('update:search', $event)"
      label="Buscar..."
      single-line
      hide-details
      density="compact"
      class="me-2"
      @keyup.enter="$emit('search')"
      prepend-inner-icon="mdi-magnify"
    ></v-text-field>
    <v-btn
      color="blue"
      variant="flat"
      @click="$emit('search')"
      prepend-icon="mdi-magnify"
      class="me-2"
    >
      Buscar
    </v-btn>
    <v-btn
      color="green"
      variant="flat"
      @click="$emit('add')"
      prepend-icon="mdi-plus"
    >
      Adicionar Registro
    </v-btn>
  </v-toolbar>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  title: {
    type: String,
    default: 'Búsqueda',
  },
  search: {
    type: String,
    default: '',
  },
});

defineEmits(['update:search', 'search', 'add']);
</script>