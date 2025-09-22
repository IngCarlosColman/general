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

      let fetchedItems;
      let fetchedTotalItems;

      if (Array.isArray(response.data)) {
        // La API devuelve un array directo (e.g., en la categoría 'general')
        fetchedItems = response.data;
        fetchedTotalItems = response.data.length;
      } else {
        // La API devuelve un objeto con propiedades 'items' y 'totalItems'
        fetchedItems = response.data.items;
        fetchedTotalItems = response.data.totalItems ?? 0;
      }
      
      items.value = fetchedItems.map((item) => ({
        ...item,
        nombreCompleto: `${item.nombres || ''} ${item.apellidos || ''}`.trim()
      }));
      totalItems.value = fetchedTotalItems;

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
      // ⭐️ CORRECCIÓN CLAVE: Determinar el identificador principal
      const identifier = itemToSave.cedula || itemToSave.id;
      
      if (isEditing.value) {
        if (!identifier) {
          throw new Error('No se puede actualizar el registro. Falta el identificador (Cédula o ID).');
        }
        
        // Optimistic UI update: buscar y actualizar el ítem
        const index = items.value.findIndex(item => (item.id === identifier) || (item.cedula === identifier));
        if (index !== -1) {
          items.value[index] = { 
            ...items.value[index], // Mantener campos que no se editan
            ...itemToSave, // Actualizar con los nuevos datos
            nombreCompleto: `${itemToSave.nombres || ''} ${itemToSave.apellidos || ''}`.trim()
          };
        }
        
        // ✅ Solicitud PUT con el identificador correcto
        await apiClient.put(`${apiPath.value}/${identifier}`, itemToSave);
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
    if (!itemToDelete.value) {
      showSnackbar('Error: No se pudo identificar el registro a eliminar.', 'error');
      closeDeleteDialog();
      return;
    }

    isDeleting.value = true;
    const originalItems = [...items.value];
    const itemToDeleteCopy = itemToDelete.value;
    
    // **CAMBIO CLAVE:** Utiliza `cedula` si está disponible, de lo contrario, usa `id`.
    const identifier = itemToDeleteCopy.cedula || itemToDeleteCopy.id;

    // Optimistic UI update: elimina el elemento de la lista inmediatamente
    const itemIndex = items.value.findIndex(item => (item.id === identifier) || (item.cedula === identifier));
    if (itemIndex !== -1) {
      items.value.splice(itemIndex, 1);
    }

    try {
      if (!identifier) {
        throw new Error('El registro no tiene un identificador válido.');
      }
      await apiClient.delete(`${apiPath.value}/${identifier}`);
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

  // ✅ Observa los cambios en apiPath para restablecer los filtros
  watch(apiPath, () => {
    Object.assign(options, {
      page: 1,
      itemsPerPage: 10,
      sortBy: [],
    });
    searchTerm.value = '';
    loadItems();
  });

  // ✅ Observa los cambios en la paginación y ordenación
  watch(() => options.page, loadItems);
  watch(() => options.itemsPerPage, loadItems);
  watch(() => options.sortBy, loadItems, { deep: true });

  // ✅ Observa el término de búsqueda para recargar los datos
  watch(searchTerm, () => {
    Object.assign(options, { page: 1, sortBy: [] }); // Restablece la página a 1 al buscar
    loadItems();
  });

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