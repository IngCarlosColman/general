<template>
  <v-container fluid>
    <v-card class="pa-4">
      <v-row>
        <v-col cols="12" sm="5">
          <v-text-field
            v-model="searchQuery"
            prepend-inner-icon="mdi-magnify"
            label="Buscar en mi agenda"
            single-line
            hide-details
            clearable
            variant="outlined"
            :loading="props.isLoading"
            :disabled="props.isLoading"
          ></v-text-field>
        </v-col>
        <v-col cols="12" sm="5">
          <v-autocomplete
            v-model="selectedCategory"
            :items="categories"
            item-title="nombre_categoria"
            item-value="id"
            label="Filtrar por categoría"
            prepend-inner-icon="mdi-filter"
            variant="outlined"
            clearable
            hide-details
            single-line
            :loading="props.isLoading"
            :disabled="props.isLoading"
          ></v-autocomplete>
        </v-col>
        <v-col cols="12" sm="2" class="d-flex align-center">
          <slot name="buttons"></slot>
        </v-col>
      </v-row>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch, defineEmits, defineProps } from 'vue';

// Definimos las props que este componente puede recibir
const props = defineProps({
  categories: {
    type: Array,
    default: () => [],
  },
  isLoading: { // <-- Nueva prop para el estado de carga
    type: Boolean,
    default: false,
  },
});

// Definimos los eventos que este componente puede emitir
const emit = defineEmits(['update:search', 'update:category']);

// Estado local para el campo de búsqueda y la categoría seleccionada
const searchQuery = ref('');
const selectedCategory = ref(null);

// Usamos watch para observar los cambios en searchQuery
watch(searchQuery, (newVal) => {
  emit('update:search', newVal);
});

// Usamos watch para observar los cambios en selectedCategory
watch(selectedCategory, (newVal) => {
  emit('update:category', newVal);
});
</script>