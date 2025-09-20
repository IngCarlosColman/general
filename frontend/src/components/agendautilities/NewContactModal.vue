<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600px" persistent>
    <v-card :loading="isLoading" :disabled="isLoading">
      <v-card-title class="headline">
        <span class="text-h5">Añadir Contacto a la Agenda</span>
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="formValid">
          <v-container>
            <v-row>
              <v-col cols="12">
                <v-autocomplete
                  v-model="selectedContact"
                  :items="searchResults"
                  :loading="isSearching"
                  :search-input.sync="searchQuery"
                  item-title="completo"
                  item-value="cedula"
                  label="Buscar contacto por nombre o cédula"
                  placeholder="Ej. Juan Perez o 123456789"
                  variant="outlined"
                  clearable
                  :rules="[rules.required]"
                  required
                  no-data-text="Escribe para buscar un contacto"
                  return-object
                >
                  <template v-slot:no-data>
                    <v-list-item>
                      <v-list-item-title class="text-caption">
                        No se encontraron resultados.
                      </v-list-item-title>
                    </v-list-item>
                  </template>
                </v-autocomplete>
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
          @click="addContact"
          :loading="isLoading"
          :disabled="!selectedContact || isContactInAgenda"
        >
          {{ isContactInAgenda ? 'Ya está en la agenda' : 'Añadir a la Agenda' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed, defineProps, defineEmits } from 'vue';
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
const formValid = ref(false);
const searchQuery = ref('');
const selectedContact = ref(null);
const searchResults = ref([]);
const isSearching = ref(false);
const isLoading = ref(false);

// Reglas de validación
const rules = {
  required: value => !!value || 'Debes seleccionar un contacto.',
};

// Propiedad computada para verificar si el contacto ya está en la agenda
const isContactInAgenda = computed(() => {
  if (!selectedContact.value) return false;
  return agendaStore.privateAgendaCedulas.includes(selectedContact.value.cedula);
});

// Función de búsqueda con debounce para no saturar la API
const debouncedSearch = debounce(async () => {
  if (searchQuery.value.length < 3) {
    searchResults.value = [];
    return;
  }
  isSearching.value = true;
  try {
    // Llama a la nueva acción del store (que crearemos a continuación)
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

// Lógica para añadir el contacto a la agenda
const addContact = async () => {
  if (!selectedContact.value) return;

  isLoading.value = true;
  try {
    await agendaStore.addContactToAgenda(selectedContact.value.cedula);
    showSnackbar('Contacto añadido a tu agenda con éxito.', 'success');
    emit('contact-added');
    closeModal();
  } catch (error) {
    showSnackbar('Error al añadir el contacto a la agenda.', 'error');
    console.error('Error al añadir contacto:', error);
  } finally {
    isLoading.value = false;
  }
};

const closeModal = () => {
  selectedContact.value = null;
  searchQuery.value = '';
  searchResults.value = [];
  emit('update:modelValue', false);
};
</script>