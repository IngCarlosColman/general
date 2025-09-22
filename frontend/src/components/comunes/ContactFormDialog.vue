<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600px" persistent>
    <v-card>
      <v-toolbar color="primary" flat density="compact">
        <v-toolbar-title class="text-white">{{ title }}</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon @click="$emit('close')" color="white">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card-text>
        <v-form ref="form" class="mt-4">
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="editedItem.nombres"
                label="Nombres"
                required
                :rules="[v => !!v || 'Campo obligatorio']"
              ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="editedItem.apellidos"
                label="Apellidos"
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                :model-value="completo"
                label="Nombre Completo"
                readonly
                density="compact"
                hint="Este campo se genera automáticamente."
                persistent-hint
              ></v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="editedItem.cedula"
                label="Cédula"
                required
                :rules="[v => !!v || 'Campo obligatorio']"
                :readonly="isEditing"
              ></v-text-field>
            </v-col>
            <template v-if="selectedCategory === 'private-agenda'">
              <v-col cols="12" sm="6">
                <v-select
                  v-model="editedItem.categoria_id"
                  :items="agendaCategories"
                  item-title="nombre_categoria"
                  item-value="id"
                  label="Categoría"
                  clearable
                ></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-textarea
                  v-model="editedItem.notas"
                  label="Notas de la Agenda"
                  rows="2"
                  no-resize
                ></v-textarea>
              </v-col>
            </template>
            <v-col cols="12">
              <div class="mb-2 text-subtitle-1">Teléfonos</div>
              <div v-for="(tel, index) in editedItem.telefonos" :key="index" class="d-flex align-center mb-2">
                <v-text-field
                  v-model="editedItem.telefonos[index]"
                  :label="`Teléfono #${index + 1}`"
                  density="compact"
                  prepend-inner-icon="mdi-phone"
                  hide-details
                  class="me-2"
                ></v-text-field>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  color="red"
                  @click="removeTelefono(index)"
                >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </div>
              <v-btn
                color="orange"
                variant="text"
                @click="addTelefono"
                prepend-icon="mdi-plus-circle-outline"
              >
                Añadir teléfono
              </v-btn>
            </v-col>
            <v-col cols="12" v-if="serverError">
              <v-alert type="error" density="compact" outlined class="text-start">
                {{ serverError }}
              </v-alert>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="px-6 pb-4">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="$emit('close')">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" @click="save" :loading="saving">Guardar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, defineProps, defineEmits, ref } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  editedItem: {
    type: Object,
    required: true
  },
  isEditing: {
    type: Boolean,
    required: true
  },
  saving: {
    type: Boolean,
    default: false
  },
  serverError: {
    type: String,
    default: ''
  },
  selectedCategory: { // ✅ Agregada la prop del padre
    type: String,
    required: true
  },
  agendaCategories: { // ✅ Agregada la prop del padre
    type: Array,
    default: () => []
  }
});

const emit = defineEmits([
  'update:modelValue',
  'update:editedItem',
  'close',
  'save'
]);

const form = ref(null);

const title = computed(() => {
  return props.isEditing ? 'Editar Registro' : 'Nuevo Registro';
});

const completo = computed(() => {
  if (props.editedItem.nombres || props.editedItem.apellidos) {
    return `${props.editedItem.nombres || ''} ${props.editedItem.apellidos || ''}`.trim();
  }
  return '';
});

const addTelefono = () => {
  if (!props.editedItem.telefonos) {
    props.editedItem.telefonos = [];
  }
  props.editedItem.telefonos.push('');
};

const removeTelefono = (index) => {
  props.editedItem.telefonos.splice(index, 1);
};

const save = async () => {
  const { valid } = await form.value.validate();
  if (valid) {
    emit('save', props.editedItem);
  }
};
</script>