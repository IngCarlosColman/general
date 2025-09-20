<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <SearchAndActionsToolbar
        title="Guía Telefónica"
        :categories="categories"
        v-model:selected-category="selectedCategory"
        v-model:search="searchTerm"
        @add="openDialog('create')"
        @search="handleSearch" />
      <v-divider></v-divider>
      <ContactTable
        :headers="headers"
        :items="items"
        :items-length="totalItems"
        :loading="isLoading"
        :private-agenda-cedulas="agendaStore.privateAgendaCedulas"
        :options="options"
        @update:options="newOptions => Object.assign(options, newOptions)"
        @edit="openDialog('edit', $event)"
        @delete="confirmDeleteItem($event)"
        @toggle-private-agenda="togglePrivateAgenda"
        @share-contact="shareContact"
        @open-whatsapp="openWhatsApp"
        @download-vcard="downloadVCard"
      />
    </v-card>

    <ContactFormDialog
      v-model:model-value="dialog"
      :edited-item="editedItem"
      :is-editing="isEditing"
      :saving="isSaving"
      @close="closeDialog"
      @save="saveItem"
    />

    <ConfirmDeleteDialog
      v-model:model-value="deleteDialog"
      :name="itemToDelete?.nombreCompleto"
      :deleting="isDeleting"
      @close="closeDeleteDialog"
      @confirm="deleteItem"
    />

    <v-snackbar
      v-model="snackbarState.snackbar"
      :color="snackbarState.color"
      :timeout="3000"
      class="centered-snackbar"
    >
      {{ snackbarState.text }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="closeSnackbar">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import SearchAndActionsToolbar from '@/components/comunes/SearchAndActionsToolbar.vue';
import ContactTable from '@/components/comunes/ContactTable.vue';
import ContactFormDialog from '@/components/comunes/ContactFormDialog.vue';
import ConfirmDeleteDialog from '@/components/comunes/ConfirmDeleteDialog.vue';
import { useCrudTable } from '@/composables/useCrudTable';
import { useSnackbar } from '@/composables/useSnackbar';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useContactUtilities } from '@/composables/useContactUtilities';

// === STATE AND OPTIONS ===
const defaultItem = {
  nombres: '',
  apellidos: '',
  cedula: '',
  telefonos: [],
  salario: 0,
};

const selectedCategory = ref('general');
const categories = ref([
  {
    title: 'Guía General',
    value: 'general',
    icon: 'mdi-book-multiple',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Nombre Completo', key: 'completo' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
  {
    title: 'Abogados',
    value: 'abogados',
    icon: 'mdi-scale-balance',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
  {
    title: 'Despachantes',
    value: 'despachantes',
    icon: 'mdi-ferry',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
  {
    title: 'Docentes',
    value: 'docentes',
    icon: 'mdi-school',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Salario', key: 'salario' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
  {
    title: 'Funcionarios BNF',
    value: 'funcbnf',
    icon: 'mdi-bank',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Salario', key: 'salario' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
  {
    title: 'Funcionarios Públicos',
    value: 'funcpublic',
    icon: 'mdi-account-group',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Salario', key: 'salario' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
  {
    title: 'Itaipu',
    value: 'itaipu',
    icon: 'mdi-transmission-tower',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Ubicación', key: 'ubicacion' },
      { title: 'Salario', key: 'salario' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
  {
    title: 'Yacyreta',
    value: 'yacyreta',
    icon: 'mdi-transmission-tower',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Salario', key: 'salario' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
    ],
  },
]);

// === COMPOSABLES ===
const apiPath = computed(() => `/${selectedCategory.value}`);
const {
  items,
  totalItems,
  isLoading,
  isSaving,
  isDeleting,
  dialog,
  deleteDialog,
  editedItem,
  isEditing,
  itemToDelete,
  options,
  searchTerm,
  loadItems,
  openDialog,
  closeDialog,
  saveItem,
  confirmDeleteItem,
  closeDeleteDialog,
  deleteItem,
} = useCrudTable(apiPath, defaultItem);

const { snackbarState, closeSnackbar, showSnackbar } = useSnackbar();
const agendaStore = useAgendaStore();
const { openWhatsApp, downloadVCard, shareContact } = useContactUtilities();

// === LÓGICA DE LA AGENDA PERSONAL ===
const togglePrivateAgenda = async (item) => {
  const cedula = item.cedula;
  const isCurrentlyInAgenda = agendaStore.privateAgendaCedulas.includes(cedula);

  let success = false;
  if (isCurrentlyInAgenda) {
    success = await agendaStore.removeContactFromAgenda(cedula);
    if (success) {
      showSnackbar('Contacto eliminado de tu agenda.', 'success');
    }
  } else {
    success = await agendaStore.addContactToAgenda(cedula);
    if (success) {
      showSnackbar('Contacto añadido a tu agenda.', 'success');
    }
  }

  if (!success && agendaStore.error) {
    showSnackbar(agendaStore.error, 'error');
  }
};

// === COMPUTED PROPERTIES AND WATCHERS ===
const headers = computed(() => {
  const category = categories.value.find(c => c.value === selectedCategory.value);
  return category ? category.headers : [];
});

watch(selectedCategory, (newValue) => {
  if (!newValue) {
    selectedCategory.value = 'general';
    return;
  }
  
  searchTerm.value = '';
  Object.assign(options, { page: 1, itemsPerPage: 10, sortBy: [] });
  // La búsqueda se activa aquí después de un cambio de categoría
  loadItems();
});

/**
 * Función que maneja la acción de búsqueda.
 * Solo realiza la búsqueda si el término no está vacío.
 */
const handleSearch = () => {
  if (searchTerm.value && searchTerm.value.trim() !== '') {
    // Restablece la paginación a la página 1 al buscar
    Object.assign(options, { page: 1, itemsPerPage: 10, sortBy: [] });
    loadItems();
  }
};

// === INITIAL LOAD ===
onMounted(() => {
  agendaStore.fetchAgendaContacts();
  // Llama a la búsqueda inicial solo cuando el componente se monta
  loadItems();
});
</script>

<style scoped>
.centered-snackbar {
  position: fixed !important;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>