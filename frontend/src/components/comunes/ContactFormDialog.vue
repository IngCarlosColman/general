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
                :readonly="isFieldReadOnly" ></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="editedItem.apellidos"
                label="Apellidos"
                :readonly="isFieldReadOnly" ></v-text-field>
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
                :readonly="isEditing || isFieldReadOnly" ></v-text-field>
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
                  :readonly="isFieldReadOnly" ></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <v-textarea
                  v-model="editedItem.notas"
                  label="Notas de la Agenda"
                  rows="2"
                  no-resize
                  :readonly="isFieldReadOnly" ></v-textarea>
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
                  :readonly="isFieldReadOnly" ></v-text-field>
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  color="red"
                  @click="removeTelefono(index)"
                  v-if="!isFieldReadOnly" >
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </div>
              <v-btn
                color="orange"
                variant="text"
                @click="addTelefono"
                prepend-icon="mdi-plus-circle-outline"
                v-if="!isFieldReadOnly" >
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
        <v-btn 
          color="primary" 
          variant="flat" 
          @click="save" 
          :loading="saving" 
          :disabled="isSaveButtonDisabled" v-if="!isFieldReadOnly" >
          Guardar
        </v-btn>
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
  selectedCategory: {
    type: String,
    required: true
  },
  agendaCategories: {
    type: Array,
    default: () => []
  },
  // 🔑 NUEVAS PROPS DE PERMISOS
  currentUserId: {
    type: [Number, String],
    required: true,
  },
  currentUserRol: {
    type: String,
    required: true,
  },
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

/**
 * Determina si el formulario debe estar en modo solo lectura.
 */
const isFieldReadOnly = computed(() => {
  // 1. Al crear un nuevo registro, el formulario nunca es de solo lectura (el botón 'Add' ya controla el acceso).
  if (!props.isEditing) return false;

  // 2. Al editar un contacto de una categoría de Guía General (no privada).
  //    Asumimos que los datos base de la guía principal son Read-Only para evitar cambios no autorizados.
  if (props.selectedCategory !== 'private-agenda') {
    return true;
  }

  // 3. Al editar un contacto de la Agenda Privada:
  
  // El Administrador tiene control total sobre cualquier registro de la agenda privada.
  if (props.currentUserRol === 'administrador') {
    return false;
  }

  // El Editor solo puede editar sus propios registros (donde el ID del creador coincide con su ID).
  if (props.currentUserRol === 'editor') {
    // Usamos doble igualdad (==) para comparar ID que pueden ser Number o String.
    return props.editedItem.created_by != props.currentUserId;
  }

  // 4. Cualquier otro caso es Read-Only por seguridad.
  return true;
});

const isSaveButtonDisabled = computed(() => props.saving || isFieldReadOnly.value);

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
  if (isFieldReadOnly.value) return; // Doble chequeo por seguridad

  const { valid } = await form.value.validate();
  if (valid) {
    emit('save', props.editedItem);
  }
};
</script>