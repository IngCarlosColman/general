<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <SearchAndActionsToolbar
        title="Guía Telefónica"
        :categories="categories"
        :selected-category="selectedCategory"
        @update:selected-category="handleCategoryUpdate" v-model:search="pendingSearchTerm"
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
        :selected-category="selectedCategory" :current-user-id="currentUserId"
        :current-user-rol="currentUserRol"
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
      :current-user-id="currentUserId"
      :current-user-rol="currentUserRol"
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

// ----------------------------------------------------
// 🔑 INTEGRACIÓN DE PERMISOS
// Reemplaza esta simulación con la importación y uso de tu useAuthStore real.
const useAuthStore = () => ({
  user: {
    // ID del usuario logueado. Cambia 2 (Admin) o 5 (Editor) para pruebas.
    id: 2,
    // Rol actual: 'administrador' o 'editor'.
    rol: 'administrador',
  }
});

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);
const currentUserRol = computed(() => authStore.user?.rol);
// ----------------------------------------------------

// === STATE AND OPTIONS ===
const defaultItem = {
  nombres: '',
  apellidos: '',
  cedula: '',
  telefonos: [],
  salario: 0,
  categoria_id: null,
  notas: '',
};

const selectedCategory = ref('general');
const privateAgendaCedulas = ref([]);
const agendaCategories = ref([]);
const pendingSearchTerm = ref('');
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
    // 1. Actualizamos la lista de cédulas para refrescar el ícono de estrella en cualquier vista.
    await fetchPrivateAgendaCedulas();

    // 2. CORRECCIÓN: Si estamos en la vista 'Mi Agenda Privada' y eliminamos,
    //    manipulamos el array localmente para eliminar el registro sin recargar la tabla completa.
    if (selectedCategory.value === 'private-agenda') {
        // Filtramos el item eliminado del array local.
        activeTable.items.value = activeTable.items.value.filter(i => i.cedula !== cedula);
        activeTable.totalItems.value = activeTable.totalItems.value - 1;
    }

    // activeTable.loadItems(); <--- ¡ELIMINADA PARA EVITAR EL EFECTO DE CARGA!

    // La notificación de éxito se espera que sea manejada por el interceptor de Axios.
  } else {
    // Mantenemos el snackbar de error.
    showSnackbar(result.message, 'error');
  }
};

/**
 * Controla la actualización del v-select de categorías.
 */
const handleCategoryUpdate = (newCategoryValue) => {
    // Si el nuevo valor es nulo (botón de limpiar), forzamos a la categoría 'general'
    if (newCategoryValue === null) {
      selectedCategory.value = 'general';
    } else {
      selectedCategory.value = newCategoryValue;
    }
    // El watch(selectedCategory) se encargará de resetear la búsqueda y recargar la tabla.
};


/**
 * Controla la búsqueda.
 */
const handleSearch = () => {
  // Copiamos el término pendiente al término activo antes de cargar.
  activeTable.searchTerm.value = pendingSearchTerm.value || '';
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

    // Limpiamos las dos variables de búsqueda para sincronizar el estado
    pendingSearchTerm.value = ''; // Limpia el input visible
    activeTable.searchTerm.value = ''; // Limpia el filtro activo

    activeTable.loadItems();
  }
});

// Cargar los datos iniciales al montar el componente
onMounted(() => {
  fetchPrivateAgendaCedulas();
  fetchAgendaCategories();
  activeTable.loadItems();
});
</script>

<style scoped>
</style>