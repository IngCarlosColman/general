<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <SearchAndActionsToolbar
        title="Guía Telefónica"
        :categories="categories"
        v-model:selected-category="selectedCategory"
        v-model:search="activeTable.searchTerm.value"
        @add="activeTable.openDialog('create')"
        @search="handleSearch"
      />
      <v-divider></v-divider>
      <ContactTable
        :headers="activeTableHeaders"
        :items="activeTable.items.value"
        :items-length="activeTable.totalItems.value"
        :options="activeTable.options"
        :loading="activeTable.isLoading.value"
        :private-agenda-cedulas="privateAgendaCedulas"
        @update:options="newOptions => Object.assign(activeTable.options, newOptions)"
        @edit="handleEdit"
        @delete="handleDelete"
        @share-contact="shareContact"
        @open-whatsapp="openWhatsApp"
        @download-vcard="downloadVCard"
        @toggle-private-agenda="togglePrivateAgenda"
      />
    </v-card>
    <ContactFormDialog
      v-model:model-value="activeTable.dialog.value"
      :edited-item="activeTable.editedItem.value"
      :is-editing="activeTable.isEditing.value"
      :saving="activeTable.isSaving.value"
      :selected-category="selectedCategory"
      :agenda-categories="agendaCategories"
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
import { useContactUtilities } from '@/composables/useContactUtilities';
import apiClient from '@/api/axiosClient';

// === STATE AND OPTIONS ===
const defaultItem = {
  nombres: '',
  apellidos: '',
  cedula: '',
  telefonos: [],
  salario: 0,
  categoria_id: null, // ✅ Nuevo campo para la agenda privada
  notas: '',           // ✅ Nuevo campo para la agenda privada
};

const selectedCategory = ref('general');
const privateAgendaCedulas = ref([]);
const agendaCategories = ref([]); // ✅ Nuevo estado para las categorías de la agenda
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
    title: 'Mi Agenda Privada',
    value: 'private-agenda',
    icon: 'mdi-star',
    headers: [
      { title: 'Cédula', key: 'cedula' },
      { title: 'Nombres', key: 'nombres' },
      { title: 'Apellidos', key: 'apellidos' },
      { title: 'Teléfonos', key: 'telefonos', sortable: false },
      { title: 'Categoría', key: 'nombre_categoria', sortable: false }, // ✅ Nota: el key es el nombre del campo de la tabla.
      { title: 'Notas', key: 'notas', sortable: false }, // ✅ Nuevo key para la columna de notas
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
const { openWhatsApp, downloadVCard, shareContact } = useContactUtilities();

// La ruta de la API se hace una propiedad computada
const activeTablePath = computed(() => {
  if (selectedCategory.value === 'private-agenda') {
    return '/agenda';
  } else {
    // La ruta por defecto de la guía general es la misma que la categoría
    return `/${selectedCategory.value}`;
  }
});

// Se instancia el composable una sola vez, pasándole la ruta reactiva
const activeTable = useCrudTable(activeTablePath, defaultItem);

// Propiedad computada para los headers de la tabla
const activeTableHeaders = computed(() => {
  const category = categories.value.find(c => c.value === selectedCategory.value);
  return category?.headers || [];
});

// === ACCIONES Y FUNCIONES ===
const fetchPrivateAgendaCedulas = async () => {
  try {
    const response = await apiClient.get('/agenda');
    if (response.data && Array.isArray(response.data)) { // Tu backend devuelve un array directamente
      privateAgendaCedulas.value = response.data.map(item => item.cedula);
    } else {
      privateAgendaCedulas.value = [];
    }
  } catch (err) {
    console.error('Error al cargar la agenda privada:', err);
    showSnackbar('Error al cargar la agenda privada', 'error');
  }
};

const fetchAgendaCategories = async () => {
  try {
    // ✅ CORRECCIÓN: La ruta es ' en lugar de '/categories'
    const response = await apiClient.get('/categorias');
    agendaCategories.value = response.data;
  } catch (err) {
    console.error('Error al cargar las categorías:', err);
    showSnackbar('Error al cargar las categorías de la agenda.', 'error');
  }
};

const togglePrivateAgenda = async (item) => {
  if (!item || !item.cedula) {
    showSnackbar('Error: No se pudo identificar el contacto. La cédula está vacía.', 'error');
    console.error('Cédula del contacto es undefined o nula:', item);
    return;
  }

  const cedula = item.cedula;
  let result;

  if (selectedCategory.value === 'private-agenda') {
    try {
      await apiClient.delete(`/agenda/${cedula}`);
      result = { success: true, message: 'Contacto eliminado de tu agenda privada.' };
    } catch (err) {
      result = { success: false, message: err.response?.data?.error || 'Error al eliminar el contacto.' };
    }
  } else {
    if (privateAgendaCedulas.value.includes(cedula)) {
      try {
        await apiClient.delete(`/agenda/${cedula}`);
        result = { success: true, message: 'Contacto eliminado de tu agenda privada.' };
      } catch (err) {
        result = { success: false, message: err.response?.data?.error || 'Error al eliminar el contacto.' };
      }
    } else {
      try {
        await apiClient.post('/agenda', { contact_cedula: cedula });
        result = { success: true, message: 'Contacto añadido a tu agenda privada.' };
      } catch (err) {
        result = { success: false, message: err.response?.data?.error || 'Error al añadir el contacto.' };
      }
    }
  }

  if (result.success) {
    // Si la operación fue exitosa, actualizamos la lista de cédulas.
    await fetchPrivateAgendaCedulas();
    showSnackbar(result.message, 'success');
  } else {
    showSnackbar(result.message, 'error');
  }
};

const handleSearch = () => {
  Object.assign(activeTable.options, { page: 1, itemsPerPage: 10, sortBy: [] });
  activeTable.loadItems();
};

const handleEdit = (item) => {
  activeTable.openDialog('edit', item);
};

const handleDelete = (item) => {
  activeTable.confirmDeleteItem(item);
};

// Observa el cambio de categoría para restablecer los filtros y recargar la tabla activa
watch(selectedCategory, (newValue) => {
  if (newValue) {
    Object.assign(activeTable.options, { page: 1, itemsPerPage: 10, sortBy: [] });
    activeTable.searchTerm.value = '';
    activeTable.loadItems();
  }
});

// Cargar los datos iniciales al montar el componente
onMounted(() => {
  fetchPrivateAgendaCedulas();
  fetchAgendaCategories(); // ✅ Llama a la nueva función para cargar las categorías
  activeTable.loadItems();
});
</script>

<style scoped>
</style>