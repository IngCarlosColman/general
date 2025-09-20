import { ref, reactive, watch, computed } from 'vue';
import apiClient from '@/api/axiosClient';
import { useSnackbar } from './useSnackbar';

/**
 * Composible para manejar la lógica de tablas con operaciones CRUD (Create, Read, Update, Delete)
 * de forma dinámica.
 * @param {import('vue').Ref<string>} apiPath - La ruta base de la API para la tabla (e.g., '/abogados').
 * @param {object} defaultItem - El objeto por defecto para crear nuevos registros.
 * @returns {object} - Un objeto con propiedades y métodos para gestionar la tabla.
 */
export function useCrudTable(apiPath, defaultItem) {
  // === ESTADO REACTIVO ===
  const items = ref([]);
  const totalItems = ref(0);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isDeleting = ref(false);
  const dialog = ref(false);
  const deleteDialog = ref(false);
  const editedItem = ref({ ...defaultItem });
  const isEditing = ref(false);
  const itemToDelete = ref(null);
  const searchTerm = ref('');
  
  // === IMPORTAR COMPOSABLE DE SNACKBAR ===
  const { showSnackbar } = useSnackbar();

  // === LÓGICA DE PAGINACIÓN Y BÚSQUEDA ===
  const options = reactive({
    page: 1,
    itemsPerPage: 10,
    sortBy: [],
  });

  const loadItems = async () => {
    isLoading.value = true;
    try {
      const { page, itemsPerPage, sortBy } = options;
      const params = {
        page,
        itemsPerPage,
        search: searchTerm.value,
      };
      if (sortBy && sortBy.length > 0) {
        params.sortBy = JSON.stringify(sortBy);
      }
      const response = await apiClient.get(apiPath.value, { params });
      items.value = response.data.items.map((item) => ({
        ...item,
        nombreCompleto: `${item.nombres || ''} ${item.apellidos || ''}`.trim()
      }));
      totalItems.value = response.data.totalItems ?? 0;
    } catch (err) {
      console.error('Error al cargar datos:', err);
      showSnackbar('Error al cargar los datos', 'error');
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Cómputo para determinar si el botón de reset de búsqueda debe ser visible.
   */
  const showResetButton = computed(() => !!searchTerm.value);

  // === LÓGICA DEL DIÁLOGO DE FORMULARIO ===
  const openDialog = (mode, item = {}) => {
    isEditing.value = mode === 'edit';
    editedItem.value = { ...defaultItem, ...item };
    dialog.value = true;
  };

  const closeDialog = () => {
    dialog.value = false;
  };

  const saveItem = async (itemToSave) => {
    isSaving.value = true;
    
    let originalItems = [...items.value];
    
    try {
      if (isEditing.value) {
        const index = items.value.findIndex(item => item.id === itemToSave.id);
        if (index !== -1) {
          // Actualización optimista
          items.value[index] = { 
            ...itemToSave,
            nombreCompleto: `${itemToSave.nombres || ''} ${itemToSave.apellidos || ''}`.trim()
          };
        }
        await apiClient.put(`${apiPath.value}/${itemToSave.id}`, itemToSave);
        showSnackbar('Registro actualizado con éxito.', 'success');
      } else {
        const tempId = `temp_${Date.now()}`;
        const newItemWithId = { 
          ...itemToSave,
          id: tempId,
          telefonos: itemToSave.telefonos || [],
          nombreCompleto: `${itemToSave.nombres || ''} ${itemToSave.apellidos || ''}`.trim()
        };
        items.value.unshift(newItemWithId);
        
        const response = await apiClient.post(apiPath.value, itemToSave);
        
        const tempIndex = items.value.findIndex(item => item.id === tempId);
        if (tempIndex !== -1) {
          items.value[tempIndex] = {
            ...itemToSave,
            ...response.data,
            nombreCompleto: `${itemToSave.nombres || ''} ${itemToSave.apellidos || ''}`.trim()
          };
        }
        showSnackbar('Registro creado con éxito.', 'success');
      }
      closeDialog();
    } catch (err) {
      console.error('Error al guardar el registro:', err);
      items.value = originalItems;
      const errorMessage = err.response?.data?.error || 'Error desconocido al guardar el registro.';
      showSnackbar(errorMessage, 'error');
    } finally {
      isSaving.value = false;
    }
  };

  // === LÓGICA DEL DIÁLOGO DE ELIMINACIÓN ===
  const confirmDeleteItem = (item) => {
    itemToDelete.value = item;
    deleteDialog.value = true;
  };

  const closeDeleteDialog = () => {
    deleteDialog.value = false;
  };

  const deleteItem = async () => {
    isDeleting.value = true;
    
    const itemToDeleteCopy = { ...itemToDelete.value };
    
    const originalItems = [...items.value];
    const itemIndex = items.value.findIndex(item => item.id === itemToDeleteCopy.id);
    if (itemIndex !== -1) {
      items.value.splice(itemIndex, 1);
    }

    try {
      await apiClient.delete(`${apiPath.value}/${itemToDeleteCopy.id}`);
      showSnackbar('Registro eliminado con éxito.', 'success');
      closeDeleteDialog();
    } catch (err) {
      console.error('Error al eliminar el registro:', err);
      items.value = originalItems;
      const errorMessage = err.response?.data?.error || 'Error desconocido al eliminar el registro.';
      showSnackbar(errorMessage, 'error');
    } finally {
      isDeleting.value = false;
    }
  };

  // === WATCHERS ===

  // ✅ Solo observa los cambios en apiPath para restablecer los filtros
  watch(apiPath, () => {
    Object.assign(options, {
      page: 1,
      itemsPerPage: 10,
      sortBy: [],
    });
    searchTerm.value = '';
    loadItems(); // Llama a loadItems después de un cambio de categoría
  });

  // ✅ ¡El cambio crucial! Solo observa los cambios en las opciones de la tabla (paginación, ordenación).
  // Se ha eliminado `searchTerm` de esta lista.
  watch(() => options.page, loadItems);
  watch(() => options.itemsPerPage, loadItems);
  watch(() => options.sortBy, loadItems, { deep: true });

  return {
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
    searchTerm,
    options,
    showResetButton,
    loadItems,
    openDialog,
    closeDialog,
    saveItem,
    confirmDeleteItem,
    closeDeleteDialog,
    deleteItem,
  };
}