<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <SearchAndActionsToolbar
        title="Guía Telefónica"
        :categories="categories"
        v-model:selected-category="selectedCategory"
        v-model:search="activeTable.searchTerm.value"
        :show-add-button="showAddButton"
        @add="activeTable.openDialog('create')"
        @search="handleSearch"
      />
      <v-divider></v-divider>
      <ContactTable
        :headers="activeTable.headers.value"
        :items="activeTable.items.value"
        :items-length="activeTable.totalItems.value"
        :loading="activeTable.isLoading.value || isTogglingAgenda"
        :private-agenda-cedulas="agendaStore.privateAgendaCedulas"
        :options="activeTable.options"
        @update:options="newOptions => Object.assign(activeTable.options, newOptions)"
        @edit="activeTable.openDialog('edit', $event)"
        @delete="activeTable.confirmDeleteItem($event)"
        @toggle-private-agenda="togglePrivateAgenda"
        @share-contact="shareContact"
        @open-whatsapp="openWhatsApp"
        @download-vcard="downloadVCard"
      />
    </v-card>
    <ContactFormDialog
      v-model:model-value="activeTable.dialog.value"
      :edited-item="activeTable.editedItem.value"
      :is-editing="activeTable.isEditing.value"
      :saving="activeTable.isSaving.value"
      @close="activeTable.closeDialog"
      @save="activeTable.saveItem"
    />
    <ConfirmDeleteDialog
      v-model:model-value="activeTable.deleteDialog.value"
      :name="activeTable.itemToDelete.value?.nombreCompleto"
      :deleting="activeTable.isDeleting.value"
      @close="activeTable.closeDeleteDialog"
      @confirm="activeTable.deleteItem"
    />
    <v-snackbar
      v-model="snackbarState.show"
      :color="snackbarState.color"
      :timeout="snackbarState.timeout"
      class="centered-snackbar"
    >
      {{ snackbarState.message }}
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
    title: 'Agenda Personal',
    value: 'private-agenda',
    icon: 'mdi-folder-account',
    headers: [
      { title: 'Cédula', key: 'cedula', align: 'start' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Relación', key: 'tipo_relacion' },
      { title: 'Añadido', key: 'created_at' },
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
const { snackbarState, closeSnackbar, showSnackbar } = useSnackbar();
const agendaStore = useAgendaStore();
const { openWhatsApp, downloadVCard, shareContact } = useContactUtilities();

// Instancias separadas para cada tabla
const generalTable = useCrudTable(computed(() => `/${selectedCategory.value}`), defaultItem);
const privateAgendaTable = useCrudTable(ref('/private-agenda/agenda'), {});

// Estado de carga específico para la acción de agregar/quitar de la agenda
const isTogglingAgenda = ref(false);

// === PROPIEDADES COMPUTADAS Y WATCHERS ===

// El objeto principal que orquesta la lógica de la vista activa
const activeTable = computed(() => {
  const category = categories.value.find(c => c.value === selectedCategory.value);
  if (selectedCategory.value === 'private-agenda') {
    return {
      ...privateAgendaTable,
      headers: computed(() => category?.headers || []),
    };
  } else {
    return {
      ...generalTable,
      headers: computed(() => category?.headers || []),
    };
  }
});

// Propiedad computada para controlar la visibilidad del botón 'Adicionar Registro'
const showAddButton = computed(() => selectedCategory.value === 'private-agenda');

// Observa el cambio de categoría para restablecer los filtros y recargar la tabla activa
watch(selectedCategory, (newValue) => {
  if (!newValue) {
    selectedCategory.value = 'general';
    return;
  }
  Object.assign(activeTable.value.options, { page: 1, itemsPerPage: 10, sortBy: [] });
  activeTable.value.searchTerm.value = '';
  activeTable.value.loadItems();
});

// === ACCIONES Y FUNCIONES ===
const togglePrivateAgenda = async (item) => {
  if (!item || !item.cedula) {
    showSnackbar('Error: No se pudo identificar el contacto. La cédula está vacía.', 'error');
    console.error('Cédula del contacto es undefined o nula:', item);
    return;
  }

  const cedula = item.cedula;
  const isCurrentlyInAgenda = agendaStore.privateAgendaCedulas.includes(cedula);
  let result;

  if (isCurrentlyInAgenda) {
    result = await agendaStore.removeContactFromAgenda(cedula);
  } else {
    // Al añadir a la agenda, se pasa el objeto completo
    result = await agendaStore.addContactToAgenda(item);
  }

  if (result.success) {
    showSnackbar(result.message, 'success');
    // ❌ LÍNEA ELIMINADA: Ya no se fuerza la recarga de toda la tabla
    // activeTable.value.loadItems();
  } else {
    showSnackbar(result.message, 'error');
  }
};

const handleSearch = () => {
  Object.assign(activeTable.value.options, { page: 1, itemsPerPage: 10, sortBy: [] });
  activeTable.value.loadItems();
};

// Cargar los datos iniciales al montar el componente
onMounted(() => {
  agendaStore.fetchAgendaContacts();
  generalTable.loadItems();
});
</script>

<style scoped>
</style>