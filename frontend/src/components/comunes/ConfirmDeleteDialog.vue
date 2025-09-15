<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="450px" persistent>
    <v-card>
      <v-toolbar color="red" flat density="compact">
        <v-icon class="me-2">mdi-alert-box</v-icon>
        <v-toolbar-title class="text-white">Confirmar Eliminación</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon @click="$emit('close')" color="white">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card-text class="text-center pa-6 text-body-1">
        ¿Estás seguro de que deseas eliminar el registro de
        <span class="font-weight-bold d-block mt-2" v-if="name">
          "{{ name }}"
        </span>
        <span v-else>este registro</span>
        ?
      </v-card-text>
      <v-card-actions class="px-6 pb-4 d-flex justify-end">
        <v-btn variant="text" @click="$emit('close')">Cancelar</v-btn>
        <v-btn color="red" variant="flat" @click="$emit('confirm')" :loading="deleting">Eliminar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  deleting: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  'update:modelValue',
  'close',
  'confirm'
]);
</script>