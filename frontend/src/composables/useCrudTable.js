import { ref, reactive, watch, computed } from 'vue';
import apiClient from '@/api/axiosClient';

/**
 * Composible para manejar la lógica de tablas con operaciones CRUD (Create, Read, Update, Delete)
 * de forma dinámica, centralizando la lógica de la API y el estado.
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
    
    // 🟢 ESTADOS para los modales separados
    const isAdding = ref(false); 
    const isEditing = ref(false); 

    const deleteDialog = ref(false);
    const editedItem = ref({ ...defaultItem });
    const itemToDelete = ref(null);
    const searchTerm = ref('');

    // === LÓGICA DE PAGINACIÓN Y BÚSQUEDA ===
    const options = reactive({
        page: 1,
        itemsPerPage: 10,
        sortBy: [],
    });

    /**
     * Carga los ítems desde la API.
     * Retorna un resultado de error si falla.
     */
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
                // La API devuelve un array directo
                fetchedItems = response.data;
                fetchedTotalItems = response.data.length;
            } else {
                // La API devuelve un objeto con propiedades 'items' y 'totalItems' (ideal)
                fetchedItems = response.data.items;
                fetchedTotalItems = response.data.totalItems ?? 0;
            }

            items.value = fetchedItems.map((item) => ({
                ...item,
                nombreCompleto: `${item.nombres || ''} ${item.apellidos || ''}`.trim()
            }));
            totalItems.value = fetchedTotalItems;
            
            // ✅ Éxito sin notificación
            return { success: true };

        } catch (err) {
            console.error('Error al cargar datos:', err);
            // Retorna el error para que el componente padre lo maneje
            const errorMessage = err.response?.data?.error || 'Error al cargar los datos';
            return { success: false, message: errorMessage };
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * Cómputo para determinar si el botón de reset de búsqueda debe ser visible.
     */
    const showResetButton = computed(() => !!searchTerm.value);

    // === LÓGICA DEL DIÁLOGO DE FORMULARIO (SEPARADA) ===
    
    /**
     * Abre el modal de creación.
     */
    const openAddDialog = () => {
        editedItem.value = { ...defaultItem, telefonos: [] };
        isEditing.value = false;
        isAdding.value = true;
    };

    /**
     * Cierra el modal de creación.
     */
    const closeAddDialog = () => {
        isAdding.value = false;
    };

    /**
     * Abre el modal de edición.
     * @param {object} item - El objeto a editar.
     */
    const openEditDialog = (item) => {
        const clonedItem = { 
            ...item, 
            telefonos: item.telefonos ? [...item.telefonos] : [] 
        };
        editedItem.value = { ...defaultItem, ...clonedItem };
        isEditing.value = true;
        isAdding.value = false;
    };

    /**
     * Cierra el modal de edición.
     */
    const closeEditDialog = () => {
        isEditing.value = false;
    };
    
    // Función de cierre unificada para usar internamente
    const closeFormDialog = () => {
        closeAddDialog();
        closeEditDialog();
    };

    /**
     * 🟢 CORREGIDO: Maneja solo la lógica de Creación (POST).
     * @param {object} itemToSave - El objeto a crear.
     * Retorna { success: boolean, message: string }.
     */
    const saveItem = async (itemToSave) => {
        isSaving.value = true;
        let originalItems = [...items.value];
        const itemToSaveCopy = { ...itemToSave }; 

        try {
            // LÓGICA DE CREACIÓN (POST)
            const tempId = `temp_${Date.now()}`;
            const newItemWithId = {
                ...itemToSaveCopy,
                id: tempId, // ID temporal para Optimistic UI
                telefonos: itemToSaveCopy.telefonos || [],
                nombreCompleto: `${itemToSaveCopy.nombres || ''} ${itemToSaveCopy.apellidos || ''}`.trim()
            };
            items.value.unshift(newItemWithId);

            const response = await apiClient.post(apiPath.value, itemToSaveCopy);
            
            // Reemplazar el tempId con el ID REAL del servidor
            const tempIndex = items.value.findIndex(item => item.id === tempId);
            if (tempIndex !== -1) {
                // Si la API devuelve el objeto creado con el ID real, lo usamos.
                items.value[tempIndex] = {
                    ...items.value[tempIndex], 
                    ...response.data, 
                    nombreCompleto: `${itemToSaveCopy.nombres || ''} ${itemToSaveCopy.apellidos || ''}`.trim()
                };
            }
            
            closeFormDialog(); 
            return { success: true, message: 'Registro creado con éxito.' }; 
            
        } catch (err) {
            console.error('Error al guardar el registro (POST):', err);
            // Rollback: Revertir la lista
            items.value = originalItems; 
            const errorMessage = err.response?.data?.error || 'Error desconocido al guardar el registro.';
            return { success: false, message: errorMessage };
            
        } finally {
            isSaving.value = false;
        }
    };
    
    /**
     * 🟢 NUEVA FUNCIÓN: Maneja solo la lógica de Actualización (PUT).
     * @param {object} itemToUpdate - El objeto a actualizar.
     * Retorna { success: boolean, message: string }.
     */
    const updateItem = async (itemToUpdate) => {
        isSaving.value = true;
        let originalItems = [...items.value];
        const itemToSaveCopy = { ...itemToUpdate }; 
        const identifier = itemToSaveCopy.id || itemToSaveCopy.cedula;

        try {
            if (!identifier) {
                throw new Error('No se puede actualizar. Falta el identificador (ID o Cédula).');
            }

            // Optimistic UI update
            const index = items.value.findIndex(item => item.id === identifier || item.cedula === identifier);
            if (index !== -1) {
                items.value[index] = {
                    ...items.value[index], 
                    ...itemToSaveCopy, 
                    nombreCompleto: `${itemToSaveCopy.nombres || ''} ${itemToSaveCopy.apellidos || ''}`.trim()
                };
            }

            await apiClient.put(`${apiPath.value}/${identifier}`, itemToSaveCopy);
            
            closeFormDialog(); 
            return { success: true, message: 'Registro actualizado con éxito.' };
            
        } catch (err) {
            console.error('Error al actualizar el registro (PUT):', err);
            // Rollback: Revertir la lista
            items.value = originalItems; 
            const errorMessage = err.response?.data?.error || 'Error desconocido al actualizar el registro.';
            return { success: false, message: errorMessage };
            
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

    /**
     * Elimina un ítem.
     * Retorna { success: boolean, message: string }.
     */
    const deleteItem = async () => {
        if (!itemToDelete.value) {
            closeDeleteDialog();
            return { success: false, message: 'Error: No se pudo identificar el registro a eliminar.' };
        }

        isDeleting.value = true;
        const originalItems = [...items.value];
        const itemToDeleteCopy = itemToDelete.value;
        const identifier = itemToDeleteCopy.id || itemToDeleteCopy.cedula;

        // Optimistic UI update
        const itemIndex = items.value.findIndex(item => item.id === identifier || item.cedula === identifier);
        if (itemIndex !== -1) {
            items.value.splice(itemIndex, 1);
        }

        try {
            if (!identifier) {
                throw new Error('El registro no tiene un identificador válido.');
            }
            await apiClient.delete(`${apiPath.value}/${identifier}`);
            
            closeDeleteDialog();
            // ✅ Retorna el éxito para que el padre lo notifique
            return { success: true, message: 'Registro eliminado con éxito.' };
            
        } catch (err) {
            console.error('Error al eliminar el registro:', err);
            // Rollback
            items.value = originalItems;
            const errorMessage = err.response?.data?.error || 'Error desconocido al eliminar el registro.';
            
            // Retorna el error para que el padre lo notifique
            return { success: false, message: errorMessage };
            
        } finally {
            isDeleting.value = false;
        }
    };

    // === WATCHERS ===
    watch(apiPath, () => {
        Object.assign(options, {
            page: 1,
            itemsPerPage: 10,
            sortBy: [],
        });
        searchTerm.value = '';
        loadItems();
    });

    watch(() => options.page, loadItems);
    watch(() => options.itemsPerPage, loadItems);
    watch(() => options.sortBy, loadItems, { deep: true });

    watch(searchTerm, () => {
        Object.assign(options, { page: 1, sortBy: [] }); 
        loadItems();
    });

    return {
        items,
        totalItems,
        isLoading,
        isSaving,
        isDeleting,
        // PROPIEDADES NUEVAS
        isAdding, 
        isEditing,
        deleteDialog,
        editedItem,
        itemToDelete,
        searchTerm,
        options,
        showResetButton,
        loadItems,
        // MÉTODOS DE FORMULARIO SEPARADOS
        openAddDialog,
        closeAddDialog,
        openEditDialog,
        closeEditDialog,
        // 🟢 MÉTODOS CRUD SEPARADOS
        saveItem, // Para Creación (POST)
        updateItem, // Para Actualización (PUT)
        confirmDeleteItem,
        closeDeleteDialog,
        deleteItem, 
    };
}