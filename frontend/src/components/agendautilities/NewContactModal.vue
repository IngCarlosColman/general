<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600px" persistent>
    <v-card :loading="isLoading" :disabled="isLoading">
      <v-card-title class="headline">
        <span class="text-h5">Añadir o Crear Contacto</span>
        <v-spacer></v-spacer>
        <v-btn icon @click="closeModal" :disabled="isLoading">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="formValid">
          <v-container>
            <v-row v-if="!isCreatingNewContact">
              <v-col cols="12">
                <v-autocomplete
                  v-model="selectedContact"
                  :items="searchResults"
                  :loading="isSearching"
                  :search-input.sync="searchQuery"
                  item-title="completo"
                  item-value="cedula"
                  label="Buscar por nombre o cédula"
                  placeholder="Ej. Juan Perez o 123456789"
                  variant="outlined"
                  clearable
                  no-data-text="Escribe para buscar un contacto"
                  return-object
                >
                  <template v-slot:append-inner>
                    <v-icon color="primary" @click="toggleCreateForm">
                      mdi-plus-circle-outline
                    </v-icon>
                    <v-tooltip activator="parent" location="bottom">Crear un contacto nuevo</v-tooltip>
                  </template>

                  <template v-slot:no-data>
                    <v-list-item>
                      <v-list-item-title class="text-caption">
                        No se encontraron resultados.
                      </v-list-item-title>
                      <v-list-item-subtitle class="mt-2">
                        <v-btn variant="text" color="primary" @click="toggleCreateForm">
                          <v-icon size="small" class="mr-1">mdi-plus</v-icon> Crear nuevo contacto
                        </v-btn>
                      </v-list-item-subtitle>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>
              <v-col v-if="selectedContact" cols="12">
                <v-alert
                  :type="isContactInAgenda ? 'info' : 'success'"
                  variant="tonal"
                  class="mt-2"
                >
                  <span v-if="isContactInAgenda">Este contacto ya está en tu agenda.</span>
                  <span v-else>Selecciona este contacto para añadirlo a tu agenda.</span>
                </v-alert>
              </v-col>
            </v-row>
            
            <v-row v-if="isCreatingNewContact">
              <v-col cols="12">
                <v-text-field
                  v-model="newContact.nombre_completo"
                  label="Nombre Completo"
                  variant="outlined"
                  required
                  :rules="[rules.required]"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="newContact.cedula"
                  label="Cédula"
                  variant="outlined"
                  required
                  :rules="[rules.required, rules.cedula]"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="newContact.email_personal"
                  label="Correo Electrónico"
                  variant="outlined"
                  type="email"
                  :rules="[rules.email]"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="newContact.direccion_residencia"
                  label="Dirección"
                  variant="outlined"
                  rows="2"
                ></v-textarea>
              </v-col>

              <v-col cols="12">
                <v-divider class="my-4"></v-divider>
                <div class="d-flex align-center justify-space-between mb-2">
                  <h3 class="text-h6">Teléfonos</h3>
                  <v-btn 
                    color="primary" 
                    variant="text" 
                    prepend-icon="mdi-plus" 
                    @click="addPhoneField"
                    size="small"
                  >
                    Añadir
                  </v-btn>
                </div>
                <v-alert v-if="newContactPhones.length === 0" type="info" variant="tonal" class="mt-2">
                  Añade al menos un número de teléfono.
                </v-alert>

                <div v-for="(phone, index) in newContactPhones" :key="index" class="d-flex align-center mt-2">
                  <v-text-field
                    v-model="phone.numero"
                    label="Número de Teléfono"
                    variant="outlined"
                    density="compact"
                    required
                    :rules="[rules.required, rules.phone]"
                    class="mr-2"
                  ></v-text-field>
                  <v-select
                    v-model="phone.tipo"
                    :items="phoneTypes"
                    label="Tipo"
                    variant="outlined"
                    density="compact"
                    required
                    :rules="[rules.required]"
                  ></v-select>
                  <v-btn icon color="error" size="small" variant="text" @click="removePhoneField(index)">
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </div>
              </v-col>

              <v-col cols="12">
                <v-btn variant="text" color="primary" @click="toggleCreateForm">
                  <v-icon size="small" class="mr-1">mdi-arrow-left</v-icon> Volver a la búsqueda
                </v-btn>
              </v-col>
            </v-row>
          </v-container>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="closeModal" :disabled="isLoading">Cancelar</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click="isCreatingNewContact ? createAndAddContact() : addExistingContact()"
          :loading="isLoading"
          :disabled="!isFormValid || (isCreatingNewContact && newContactPhones.length === 0)"
        >
          {{ isCreatingNewContact ? 'Crear y Añadir a Agenda' : 'Añadir a la Agenda' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed, defineProps, defineEmits, nextTick } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useSnackbar } from '@/composables/useSnackbar';
import { debounce } from 'lodash';

// Props y Emits
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue', 'contact-added']);

// Store y Composables
const agendaStore = useAgendaStore();
const { showSnackbar } = useSnackbar();

// Estado local
const form = ref(null);
const searchQuery = ref('');
const selectedContact = ref(null);
const searchResults = ref([]);
const isSearching = ref(false);
const isLoading = ref(false);
const isCreatingNewContact = ref(false);
const formValid = ref(false);

const newContact = ref({
  nombre_completo: '',
  cedula: '',
  email_personal: '',
  direccion_residencia: '',
});

// Estado para los teléfonos del nuevo contacto
const newContactPhones = ref([]);

// ✅ LISTA DE TIPOS DE TELÉFONO
const phoneTypes = ['Móvil', 'Fijo/Hogar', 'Empresarial'];

// Reglas de validación
const rules = {
  required: value => !!value || 'Este campo es obligatorio.',
  cedula: value => /^[a-zA-Z0-9-/\\]{7,25}$/.test(value) || 'La cédula/pasaporte debe tener entre 7 y 25 caracteres, y puede contener letras, números, guiones y barras.',
  email: value => !value || /.+@.+\..+/.test(value) || 'Debe ser un correo electrónico válido.',
  phone: value => /^\+?\d{7,20}$/.test(value) || 'El teléfono debe tener entre 7 y 20 dígitos. Solo se permite el signo "+" al inicio.',
};

// Propiedad computada para verificar si el contacto ya está en la agenda
const isContactInAgenda = computed(() => {
  if (!selectedContact.value) return false;
  return agendaStore.privateAgendaCedulas.includes(selectedContact.value.cedula);
});

// Propiedad computada para validar el formulario
const isFormValid = computed(() => {
  if (isCreatingNewContact.value) {
    const isBasicInfoValid = !!newContact.value.nombre_completo && !!newContact.value.cedula && rules.cedula(newContact.value.cedula) === true;
    const arePhonesValid = newContactPhones.value.length > 0 && newContactPhones.value.every(p => p.numero && p.tipo && rules.phone(p.numero) === true);
    return isBasicInfoValid && arePhonesValid;
  }
  return !!selectedContact.value && !isContactInAgenda.value;
});

// Función de búsqueda con debounce para no saturar la API
const debouncedSearch = debounce(async () => {
  if (searchQuery.value.length < 3) {
    searchResults.value = [];
    return;
  }
  isSearching.value = true;
  try {
    searchResults.value = await agendaStore.searchPublicContacts(searchQuery.value);
  } catch (error) {
    console.error('Error al buscar contactos:', error);
    showSnackbar('Error al buscar contactos.', 'error');
  } finally {
    isSearching.value = false;
  }
}, 500);

// Observar el campo de búsqueda para activar la función
watch(searchQuery, () => {
  debouncedSearch();
});

// Alterna entre la vista de búsqueda y el formulario de creación
const toggleCreateForm = () => {
  isCreatingNewContact.value = !isCreatingNewContact.value;
  // Resetea el formulario al cambiar de vista
  if (isCreatingNewContact.value) {
    selectedContact.value = null;
    searchQuery.value = '';
    searchResults.value = [];
    newContactPhones.value = [{ numero: '', tipo: 'Móvil' }]; // ✅ CAMPO INICIALIZADO con "Móvil"
  } else {
    newContact.value = {
      nombre_completo: '',
      cedula: '',
      email_personal: '',
      direccion_residencia: '',
    };
    newContactPhones.value = [];
  }
  nextTick(() => {
    if (form.value) {
      form.value.resetValidation();
    }
  });
};

// Lógica para añadir un contacto existente a la agenda
const addExistingContact = async () => {
  if (!selectedContact.value) return;

  isLoading.value = true;
  try {
    const result = await agendaStore.addContactToAgenda(selectedContact.value);
    if (result.success) {
      showSnackbar(result.message, 'success');
      emit('contact-added');
      closeModal();
    } else {
      showSnackbar(result.message, 'error');
    }
  } catch (error) {
    showSnackbar('Error al añadir el contacto a la agenda.', 'error');
    console.error('Error al añadir contacto:', error);
  } finally {
    isLoading.value = false;
  }
};

// Lógica para crear un contacto nuevo y luego añadirlo a la agenda
const createAndAddContact = async () => {
  if (form.value && !(await form.value.validate()).valid) {
    showSnackbar('Por favor, completa los campos obligatorios.', 'warning');
    return;
  }
  isLoading.value = true;
  try {
    const result = await agendaStore.createAndAddContact(newContact.value, newContactPhones.value);
    
    if (result.success) {
      showSnackbar('Contacto creado y añadido a tu agenda con éxito.', 'success');
      emit('contact-added');
      closeModal();
    } else {
      showSnackbar(result.message, 'error');
    }
  } catch (error) {
    showSnackbar('Error al crear y añadir el contacto.', 'error');
    console.error('Error al crear contacto:', error);
  } finally {
    isLoading.value = false;
  }
};

// Lógica para manejar los campos de teléfono dinámicamente
const addPhoneField = () => {
  newContactPhones.value.push({ numero: '', tipo: '' });
};

const removePhoneField = (index) => {
  newContactPhones.value.splice(index, 1);
  if (newContactPhones.value.length === 0) {
    addPhoneField(); // Asegura que siempre haya al menos un campo visible
  }
};

const closeModal = () => {
  // Limpia el estado al cerrar
  isCreatingNewContact.value = false;
  selectedContact.value = null;
  searchQuery.value = '';
  searchResults.value = [];
  newContact.value = {
    nombre_completo: '',
    cedula: '',
    email_personal: '',
    direccion_residencia: '',
  };
  // Resetea también la lista de teléfonos
  newContactPhones.value = [];
  emit('update:modelValue', false);
};

// Inicializa un campo de teléfono al abrir el modal en modo de creación
watch(() => props.modelValue, (newValue) => {
  if (newValue && isCreatingNewContact.value) {
    addPhoneField();
  }
});
</script>