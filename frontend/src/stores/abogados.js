import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAbogadosStore = defineStore('abogados', () => {
  // === ESTADO ===
  const abogados = ref([]);
  const totalAbogados = ref(0);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isDeleting = ref(false);
  const error = ref(null);

  // === ACCIONES ===
  
  /**
   * Obtiene la lista de abogados del back-end.
   * @param {object} options Opciones de paginación y ordenamiento.
   */
  async function fetchAbogados(options) {
    isLoading.value = true;
    error.value = null;
    try {
      // TODO: Implementar la llamada a la API
      // const response = await fetch(`/api/abogados?page=${options.page}&itemsPerPage=${options.itemsPerPage}&sortBy=${JSON.stringify(options.sortBy)}&search=${options.search}`);
      // if (!response.ok) throw new Error('Error al obtener los datos de abogados.');
      // const data = await response.json();
      // abogados.value = data.items;
      // totalAbogados.value = data.totalItems;

      // Código de ejemplo para demostración:
      abogados.value = [
        { id: 1, cedula: '1234567', nombres: 'Carlos', apellidos: 'Pérez', telefonos: ['981234567', '991234567'] },
        { id: 2, cedula: '7654321', nombres: 'Ana', apellidos: 'López', telefonos: ['971234567'] },
        { id: 3, cedula: '1122334', nombres: 'María', apellidos: 'Gómez', telefonos: [] },
      ];
      totalAbogados.value = 3;

    } catch (err) {
      console.error(err);
      error.value = err.message || 'Error desconocido al cargar abogados.';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Crea un nuevo registro de abogado.
   * @param {object} abogadoData Los datos del nuevo abogado.
   */
  async function createAbogado(abogadoData) {
    isSaving.value = true;
    error.value = null;
    try {
      // TODO: Implementar la llamada a la API POST /api/abogados
      // const response = await fetch('/api/abogados', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(abogadoData),
      // });
      // if (!response.ok) throw new Error('Error al crear el abogado.');
      
      // Tras una creación exitosa, recargar los datos
      await fetchAbogados({ page: 1, itemsPerPage: 10, sortBy: [] });

      return { success: true, message: 'Abogado creado con éxito.' };
    } catch (err) {
      console.error(err);
      error.value = err.message || 'Error desconocido al crear el abogado.';
      return { success: false, message: error.value };
    } finally {
      isSaving.value = false;
    }
  }
  
  /**
   * Actualiza un registro de abogado.
   * @param {number} id El ID del abogado.
   * @param {object} abogadoData Los datos actualizados.
   */
  async function updateAbogado(id, abogadoData) {
    isSaving.value = true;
    error.value = null;
    try {
      // TODO: Implementar la llamada a la API PUT /api/abogados/:id
      // const response = await fetch(`/api/abogados/${id}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(abogadoData),
      // });
      // if (!response.ok) throw new Error('Error al actualizar el abogado.');
      
      // Tras una actualización exitosa, recargar los datos
      await fetchAbogados({ page: 1, itemsPerPage: 10, sortBy: [] });

      return { success: true, message: 'Abogado actualizado con éxito.' };
    } catch (err) {
      console.error(err);
      error.value = err.message || 'Error desconocido al actualizar el abogado.';
      return { success: false, message: error.value };
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Elimina un registro de abogado.
   * @param {number} id El ID del abogado a eliminar.
   */
  async function deleteAbogado(id) {
    isDeleting.value = true;
    error.value = null;
    try {
      // TODO: Implementar la llamada a la API DELETE /api/abogados/:id
      // const response = await fetch(`/api/abogados/${id}`, {
      //   method: 'DELETE',
      // });
      // if (!response.ok) throw new Error('Error al eliminar el abogado.');
      
      // Tras una eliminación exitosa, recargar los datos
      await fetchAbogados({ page: 1, itemsPerPage: 10, sortBy: [] });

      return { success: true, message: 'Abogado eliminado con éxito.' };
    } catch (err) {
      console.error(err);
      error.value = err.message || 'Error desconocido al eliminar el abogado.';
      return { success: false, message: error.value };
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    abogados,
    totalAbogados,
    isLoading,
    isSaving,
    isDeleting,
    error,
    fetchAbogados,
    createAbogado,
    updateAbogado,
    deleteAbogado,
  };
});
