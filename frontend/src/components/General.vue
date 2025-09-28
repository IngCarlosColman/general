<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <SearchAndActionsToolbar
        title="Guía Telefónica"
        :categories="categories"
        :selected-category="selectedCategory"
        @update:selected-category="handleCategoryUpdate"
        v-model:search="pendingSearchTerm"
        @add="handleOpenCreate"
        @search="handleSearch"
        :current-user-rol="currentUserRol"
      />
      <v-divider></v-divider>
      <ContactTable
        :headers="activeTableHeaders"
        :items="activeTable.items.value"
        :items-length="activeTable.totalItems.value"
        :options="activeTable.options"
        :loading="activeTable.isLoading.value"
        :private-agenda-cedulas="privateAgendaCedulas"
        :no-data-text="noDataMessage"
        @update:options="newOptions => Object.assign(activeTable.options, newOptions)"
        @edit="handleEdit"
        @delete="handleDelete"
        @open-whatsapp="handleOpenWhatsApp"
        @toggle-private-agenda="togglePrivateAgenda"
        @add-phone="handleAddPhone"
        @share-contact="handleShareContact"
        :selected-category="selectedCategory"
        :current-user-id="currentUserId"
        :current-user-rol="currentUserRol"
      />
    </v-card>

    <ContactAddDialog
      v-model:model-value="activeTable.isAdding.value"
      :edited-item="activeTable.editedItem.value"
      :saving="activeTable.isSaving.value"
      :selected-category="selectedCategory"
      :agenda-categories="agendaCategories"
      @close="activeTable.closeAddDialog"
      @save="handleCreateSave"
      :current-user-rol="currentUserRol"
    />

    <ContactEditDialog
      v-model:model-value="activeTable.isEditing.value"
      :edited-item="activeTable.editedItem.value"
      :saving="activeTable.isSaving.value"
      :selected-category="selectedCategory"
      :agenda-categories="agendaCategories"
      @close="activeTable.closeEditDialog"
      @save="handleEditSave"
      :current-user-rol="currentUserRol"
    />

    <ConfirmDeleteDialog
      v-model:model-value="activeTable.deleteDialog.value"
      :name="activeTable.itemToDelete.value?.nombreCompleto"
      :deleting="activeTable.isDeleting.value"
      @close="activeTable.closeDeleteDialog"
      @confirm="handleConfirmDelete"
    />

        <ContactAddPhoneDialog
      ref="addPhoneDialogRef"
      @phone-added="handlePhoneAdded"
    />

  </v-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import SearchAndActionsToolbar from '@/components/comunes/SearchAndActionsToolbar.vue';
import ContactTable from '@/components/comunes/ContactTable.vue';
import ContactAddDialog from '@/components/comunes/ContactAddDialog.vue';
import ContactEditDialog from '@/components/comunes/ContactEditDialog.vue';
import ConfirmDeleteDialog from '@/components/comunes/ConfirmDeleteDialog.vue';
import ContactAddPhoneDialog from '@/components/comunes/ContactAddPhoneDialog.vue';

import { useCrudTable } from '@/composables/useCrudTable';
import { useSnackbar } from '@/composables/useSnackbar';
import { useContactUtilities } from '@/composables/useContactUtilities';
import apiClient from '@/api/axiosClient';

const useAuthStore = () => ({
  user: {
    id: 2,
    rol: 'administrador',
  }
});

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);
const currentUserRol = computed(() => authStore.user?.rol);

const isAdmin = computed(() => currentUserRol.value === 'administrador');
const isEditor = computed(() => currentUserRol.value === 'editor');

const defaultItem = {
  id: null,
  nombres: '',
  apellidos: '',
  cedula: '',
  telefonos: [{ codigo: '+595', numero: '' }],
  salario: 0,
  categoria_id: null,
  notas: '',
};

const selectedCategory = ref('general');
const privateAgendaCedulas = ref([]);
const agendaCategories = ref([]);
const pendingSearchTerm = ref('');
const addPhoneDialogRef = ref(null);

// NUEVO: Estado para controlar si es la carga inicial
const isInitialLoad = ref(true);

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
      { title: 'Categoría', key: 'nombre_categoria', sortable: false },
      { title: 'Notas', key: 'notas', sortable: false },
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


const { snackbarState, closeSnackbar, showSnackbar } = useSnackbar();
const { openWhatsApp, shareContact } = useContactUtilities();

const activeTablePath = computed(() => {
  if (selectedCategory.value === 'private-agenda') {
    return '/agenda';
  } else {
    return `/${selectedCategory.value}`;
  }
});

const activeTable = useCrudTable(activeTablePath, defaultItem);

const activeTableHeaders = computed(() => {
  const category = categories.value.find(c => c.value === selectedCategory.value);
  return category?.headers || [];
});

// NUEVO: Propiedad computada para el mensaje de la tabla
const noDataMessage = computed(() => {
  // Si es la carga inicial, mostramos el mensaje de instrucción
  if (isInitialLoad.value) {
    return "Realiza tu búsqueda por cédula o nombre de contacto.";
  }

  // Si no es la carga inicial (ya se buscó o se cambió de categoría)
  return "No se encontraron resultados.";
});

// ----------------------------------------------------
// MÉTODOS DE ACCIÓN Y DIÁLOGOS
// ----------------------------------------------------

const handleOpenCreate = () => {
  if (isAdmin.value || isEditor.value) {
    activeTable.editedItem.value = JSON.parse(JSON.stringify(defaultItem));

    activeTable.openAddDialog();
  } else {
    showSnackbar('No tienes permiso para crear nuevos registros.', 'error');
  }
};

const handleEdit = (item) => {
  activeTable.editedItem.value = JSON.parse(JSON.stringify(item));
  activeTable.openEditDialog(item);
};

const handleAddPhone = (item) => {
  if (addPhoneDialogRef.value) {
    addPhoneDialogRef.value.open(item);
  }
};

const handlePhoneAdded = async (cedula) => {
  try {
    const response = await apiClient.get(`/${selectedCategory.value}/${cedula}`);
    const updatedContact = response.data;

    const index = activeTable.items.value.findIndex(item => item.cedula === cedula);
    if (index !== -1) {
      const newItems = [...activeTable.items.value];
      newItems[index] = { ...newItems[index], ...updatedContact };
      activeTable.items.value = newItems;
    }

    if (selectedCategory.value === 'private-agenda') {
      await fetchPrivateAgendaCedulas();
    }
  } catch (error) {
    console.error('Error al actualizar el contacto:', error);
    showSnackbar('No se pudo actualizar el contacto en la tabla.', 'error');
  }
};

const handleCreateSave = async (itemToSave) => {
  const result = await activeTable.saveItem(itemToSave);
  if (result.success) {
    showSnackbar(result.message, 'success');
  } else {
    showSnackbar(result.message, 'error', 5000);
  }
};

const handleEditSave = async (itemToSave) => {
  const result = await activeTable.updateItem(itemToSave);
  if (result.success) {
    showSnackbar(result.message, 'success');
  } else {
    showSnackbar(result.message, 'error', 5000);
  }
};

const handleDelete = (item) => {
  activeTable.confirmDeleteItem(item);
};

const handleConfirmDelete = async () => {
  const result = await activeTable.deleteItem();
  if (result.success) {
    showSnackbar(result.message, 'success');
  } else {
    showSnackbar(result.message, 'error', 5000);
  }
};

const handleOpenWhatsApp = (contact, phone) => {
  const result = openWhatsApp(contact, phone);
  if (!result.success) {
    showSnackbar(result.message, result.color);
  }
};

const handleShareContact = async (contact) => {
  const result = await shareContact(contact, contact.telefonos);
  if (result.message) {
    showSnackbar(result.message, result.success ? 'success' : result.color || 'error');
  }
};

const fetchPrivateAgendaCedulas = async () => {
  try {
    const response = await apiClient.get('/agenda');
    if (response.data && Array.isArray(response.data)) {
      privateAgendaCedulas.value = response.data.map(item => item.cedula);
    } else {
      privateAgendaCedulas.value = [];
    }
  } catch (err) {
    console.error('Error al cargar la agenda privada:', err);
  }
};

const fetchAgendaCategories = async () => {
  try {
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
  const isCurrentlyInAgenda = privateAgendaCedulas.value.includes(cedula);

  if (isCurrentlyInAgenda) {
    try {
      await apiClient.delete(`/agenda/${cedula}`);
      result = { success: true, message: 'Contacto eliminado de tu agenda privada.' };
    } catch (err) {
      result = { success: false, message: err.response?.data?.error || 'Error al eliminar el contacto.' };
    }
  } else {
    try {
      await apiClient.post('/agenda', { cedula: cedula });
      result = { success: true, message: 'Contacto añadido a tu agenda privada.' };
    } catch (err) {
      result = { success: false, message: err.response?.data?.error || 'Error al añadir el contacto.' };
    }
  }

  if (result.success) {
    await fetchPrivateAgendaCedulas();
    if (selectedCategory.value === 'private-agenda' && isCurrentlyInAgenda) {
      activeTable.items.value = activeTable.items.value.filter(i => i.cedula !== cedula);
      activeTable.totalItems.value = activeTable.totalItems.value - 1;
    }
    showSnackbar(result.message, 'success');
  } else {
    showSnackbar(result.message, 'error');
  }
};

const handleCategoryUpdate = (newCategoryValue) => {
  if (newCategoryValue === null) {
    selectedCategory.value = 'general';
  } else {
    selectedCategory.value = newCategoryValue;
  }
};

const handleSearch = () => {
  activeTable.searchTerm.value = pendingSearchTerm.value || '';
  Object.assign(activeTable.options, { page: 1, itemsPerPage: 10, sortBy: [] });
  // IMPORTANTE: Una vez que el usuario busca, ya no es la carga inicial.
  isInitialLoad.value = false;
  activeTable.loadItems();
};

watch(selectedCategory, (newValue) => {
  if (newValue) {
    Object.assign(activeTable.options, { page: 1, itemsPerPage: 10, sortBy: [] });
    pendingSearchTerm.value = '';
    activeTable.searchTerm.value = '';
    // Al cambiar de categoría, sí cargamos los items, y ya no es la carga inicial.
    isInitialLoad.value = false;
    activeTable.loadItems();
  }
});

onMounted(() => {
  fetchPrivateAgendaCedulas();
  fetchAgendaCategories();
  // ELIMINADO: activeTable.loadItems(); para evitar la carga inicial.
});
</script>

<style scoped>
</style>
