<template>
  <v-container>
    <v-card outlined class="pa-3">
      <v-card-title class="pa-0 text-h6 d-flex justify-space-between align-center">
        Teléfonos
      </v-card-title>
      <v-divider class="my-2"></v-divider>
      
      <v-list dense>
        <v-list-item v-if="agendaStore.contactPhones.length === 0">
          <v-list-item-title class="text-caption text-medium-emphasis">No hay teléfonos registrados.</v-list-item-title>
        </v-list-item>
        <v-list-item v-for="phone in agendaStore.contactPhones" :key="phone.id" class="pa-0 my-1">
          <div class="d-flex align-center w-100">
            <v-list-item-title class="mr-2">{{ phone.numero }}</v-list-item-title>
            <v-list-item-subtitle>{{ phone.tipo }}</v-list-item-subtitle>
            <v-spacer></v-spacer>
            <v-list-item-action class="ml-auto d-flex">
              <v-btn icon size="small" variant="text" @click="editPhone(phone)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" variant="text" color="error" @click="deletePhone(phone.id, phone.cedula_persona)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </div>
        </v-list-item>
      </v-list>
      
      <v-card-actions class="px-0">
        <v-btn
          color="primary"
          variant="text"
          prepend-icon="mdi-plus"
          @click="showAddForm = true"
          v-if="!showAddForm"
        >
          Añadir Teléfono
        </v-btn>
      </v-card-actions>

      <v-form v-if="showAddForm" ref="phoneForm" @submit.prevent="addOrUpdatePhone">
        <v-row class="mt-2">
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="phoneToAdd.numero"
              label="Número"
              variant="outlined"
              :rules="[rules.required, rules.numeric]"
              required
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="phoneToAdd.tipo"
              label="Tipo (ej. personal, trabajo)"
              variant="outlined"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="2" class="d-flex align-center">
            <v-btn type="submit" color="primary" icon size="small" class="mr-2">
              <v-icon>{{ isEditingPhone ? 'mdi-check' : 'mdi-plus' }}</v-icon>
            </v-btn>
            <v-btn icon size="small" @click="cancelEditPhone">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-col>
        </v-row>
      </v-form>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch, defineProps } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useSnackbar } from '@/composables/useSnackbar';

// Props
const props = defineProps({
  contactCedula: {
    type: String,
    required: true,
  },
});

// Store y Composables
const agendaStore = useAgendaStore();
const { showSnackbar } = useSnackbar();

// Estado local
const phoneForm = ref(null);
const phoneToAdd = ref({
  numero: '',
  tipo: '',
  contact_cedula: props.contactCedula,
});
const isEditingPhone = ref(false);
const showAddForm = ref(false);

// Reglas de validación
const rules = {
  required: value => !!value || 'Este campo es obligatorio.',
  numeric: value => /^\d+$/.test(value) || 'Debe ser un número válido.',
};

// Métodos
const addOrUpdatePhone = async () => {
  const { valid } = await phoneForm.value.validate();
  if (!valid) return;
  
  try {
    if (isEditingPhone.value) {
      await agendaStore.updateContactPhone({
        ...phoneToAdd.value,
        contact_cedula: props.contactCedula,
      });
      showSnackbar('Teléfono actualizado con éxito.', 'success');
    } else {
      await agendaStore.addContactPhone({
        ...phoneToAdd.value,
        contact_cedula: props.contactCedula,
      });
      showSnackbar('Teléfono añadido con éxito.', 'success');
    }
    cancelEditPhone();
  } catch (error) {
    showSnackbar('Error al guardar el teléfono.', 'error');
    console.error('Error al guardar el teléfono:', error);
  }
};

const editPhone = (phone) => {
  phoneToAdd.value = { ...phone, contact_cedula: props.contactCedula };
  isEditingPhone.value = true;
  showAddForm.value = true;
};

const deletePhone = async (phoneId, contactCedula) => {
  if (confirm('¿Estás seguro de que quieres eliminar este teléfono?')) {
    try {
      await agendaStore.deleteContactPhone(phoneId, contactCedula);
      showSnackbar('Teléfono eliminado.', 'success');
    } catch (error) {
      showSnackbar('Error al eliminar el teléfono.', 'error');
      console.error('Error al eliminar teléfono:', error);
    }
  }
};

const cancelEditPhone = () => {
  phoneToAdd.value = { numero: '', tipo: '', contact_cedula: props.contactCedula };
  isEditingPhone.value = false;
  showAddForm.value = false;
  if (phoneForm.value) {
    phoneForm.value.resetValidation();
  }
};

// Reiniciar el formulario cuando cambia el contacto
watch(() => props.contactCedula, () => {
  cancelEditPhone();
});
</script>