<template>
  <v-toolbar flat>
    <v-toolbar-title class="text-h6">{{ title }}</v-toolbar-title>
    <v-spacer></v-spacer>

    <v-select
      :model-value="selectedCategory"
      @update:model-value="$emit('update:selectedCategory', $event)"
      :items="categories"
      label="Categoría"
      density="compact"
      single-line
      hide-details
      clearable
      class="me-2"
      style="max-width: 200px;"
      prepend-inner-icon="mdi-filter"
      item-title="title"
      item-value="value"
      filterable
      no-data-text="No se encontraron categorías."
    >
      <template v-slot:item="{ props, item }">
        <v-list-item
          v-bind="props"
          :prepend-icon="item.raw.icon"
        ></v-list-item>
      </template>
    </v-select>

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
  selectedCategory: {
    type: String,
    default: '',
  },
  categories: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['update:search', 'search', 'add', 'update:selectedCategory']);
</script>