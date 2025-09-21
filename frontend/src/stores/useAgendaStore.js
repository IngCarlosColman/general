// src/stores/useAgendaStore.js

import { defineStore } from 'pinia';
import axiosClient from '@/api/axiosClient';
import { ref, computed } from 'vue';

export const useAgendaStore = defineStore('agenda', () => {
  // === ESTADO ===
  const agendaContacts = ref([]);
  const privateAgendaCedulas = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  
  // Estados específicos para los detalles del contacto seleccionado
  const currentContactDetails = ref(null);
  const contactFollowupEvents = ref([]);
  const contactCategories = ref([]);
  const contactPhones = ref([]);
  const contactName = ref(null);
  const contactNotes = ref(null);
  const allCategories = ref([]);

  // === COMPUTED (GETTERS) ===
  const getAgendaContacts = computed(() => agendaContacts.value);
  const getPrivateAgendaCedulas = computed(() => privateAgendaCedulas.value);

  // === ACCIONES ===

  // --- Acciones de la Agenda Principal ---
  const fetchAgendaContacts = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await axiosClient.get('/private-agenda/agenda');
      
      let dataToProcess = [];
      if (response.data) {
        dataToProcess = Array.isArray(response.data) ? response.data : (response.data.items || response.data.data || []);
      }
      
      agendaContacts.value = dataToProcess;
      privateAgendaCedulas.value = dataToProcess.map(c => c.contact_cedula);
    } catch (err) {
      error.value = 'Error al cargar los contactos de la agenda.';
      console.error('Error al cargar la agenda:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const addContactToAgenda = async (item) => {
    try {
      const response = await axiosClient.post('/private-agenda/agenda', { contact_cedula: item.cedula });
      
      if (!privateAgendaCedulas.value.includes(item.cedula)) {
        privateAgendaCedulas.value.push(item.cedula);
        agendaContacts.value.push(item);
      }
      
      return { success: true, message: 'Contacto añadido con éxito.', data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error desconocido al añadir el contacto.';
      error.value = errorMessage;
      console.error('Error al añadir contacto:', err.response?.data || err.message);
      return { success: false, message: errorMessage };
    }
  };

  const removeContactFromAgenda = async (cedula) => {
    try {
      await axiosClient.delete(`/private-agenda/agenda/${cedula}`);
      
      privateAgendaCedulas.value = privateAgendaCedulas.value.filter(c => c !== cedula);
      agendaContacts.value = agendaContacts.value.filter(c => c.contact_cedula !== cedula);

      return { success: true, message: 'Contacto eliminado de tu agenda.' };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Error desconocido al eliminar el contacto.';
      error.value = errorMessage;
      console.error('Error al eliminar contacto de la agenda:', err.response?.data || err.message);
      return { success: false, message: errorMessage };
    }
  };

  // --- Acciones de Búsqueda Pública ---
  const searchPublicContacts = async (query) => {
    if (!query || query.length < 3) {
      return [];
    }
    try {
      // ✅ CORRECCIÓN: Se cambia la URL del endpoint y el nombre del parámetro
      const response = await axiosClient.get(`/public-contacts/search`, {
        params: { query: query }
      });
      return response.data;
    } catch (err) {
      console.error('Error al buscar en la guía pública:', err);
      throw err;
    }
  };

  /**
   * ✅ NUEVA ACCIÓN MEJORADA: Crea un nuevo contacto, lo añade a la agenda y también guarda sus teléfonos.
   * @param {object} newContactData - Objeto con los datos del nuevo contacto (nombre, cedula, etc.).
   * @param {Array<object>} phonesPayload - Array opcional de objetos de teléfono a añadir.
   * @returns {object} - Resultado de la operación.
   */
  const createAndAddContact = async (newContactData, phonesPayload = []) => {
    isLoading.value = true;
    try {
      // 1. Crear el contacto en la guía general (asumiendo que la API es /contactos)
      const createResponse = await axiosClient.post('/contactos', newContactData);
      
      // 2. Extraer el objeto completo del contacto creado y añadirlo a la agenda
      const createdContact = createResponse.data;
      
      if (!createdContact || !createdContact.cedula) {
        throw new Error('La respuesta de la API no contiene los datos del nuevo contacto.');
      }
      
      const addResponse = await addContactToAgenda(createdContact);
      
      if (!addResponse.success) {
        throw new Error(`El contacto fue creado pero no se pudo añadir a la agenda: ${addResponse.message}`);
      }
      
      // ✅ 3. Añadir teléfonos si se proporcionan
      if (phonesPayload && phonesPayload.length > 0) {
        // Usamos Promise.all para añadir todos los teléfonos en paralelo
        const phonePromises = phonesPayload.map(phone => {
          return addContactPhone({
            ...phone,
            contact_cedula: createdContact.cedula // Aseguramos que la cédula del nuevo contacto se use
          });
        });
        await Promise.all(phonePromises);
      }
      
      return { success: true, message: 'Contacto y teléfonos creados y añadidos con éxito.', data: addResponse.data };
      
    } catch (err) {
      console.error('Error en el flujo de creación y adición:', err);
      const errorMessage = err.response?.data?.error || err.message;
      return { success: false, message: `Error al crear y añadir el contacto: ${errorMessage}` };
    } finally {
      isLoading.value = false;
    }
  };

  // --- Acciones de los Detalles del Contacto ---
  const fetchContactData = async (cedula) => {
    try {
      const [detailsRes, notesRes, namesRes, phonesRes, eventsRes, categoriesRes] = await Promise.all([
        axiosClient.get(`/private-agenda/details/${cedula}`),
        axiosClient.get(`/private-agenda/notas/${cedula}`),
        axiosClient.get(`/private-agenda/nombres/${cedula}`),
        axiosClient.get(`/private-agenda/telefonos/${cedula}`),
        axiosClient.get(`/private-agenda/events/${cedula}`),
        axiosClient.get(`/private-agenda/categorias/${cedula}`),
      ]);

      currentContactDetails.value = detailsRes.data;
      contactNotes.value = notesRes.data;
      contactName.value = namesRes.data;
      contactPhones.value = phonesRes.data;
      contactFollowupEvents.value = eventsRes.data;
      contactCategories.value = categoriesRes.data;
    } catch (err) {
      console.error('Error al cargar datos completos del contacto:', err);
      throw err;
    }
  };

  // --- Acciones para Detalle, Nombre y Notas ---
  const upsertContactDetails = async (detailsPayload) => {
    const { cedula } = detailsPayload;
    try {
      const existingDetails = await axiosClient.get(`/private-agenda/details/${cedula}`).catch(() => null);
      let response;
      if (existingDetails?.data) {
        response = await axiosClient.put(`/private-agenda/details/${cedula}`, detailsPayload);
      } else {
        response = await axiosClient.post('/private-agenda/details', detailsPayload);
      }
      currentContactDetails.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Error al guardar detalles de contacto:', err);
      throw err;
    }
  };

  const upsertUserNombre = async (nombrePayload) => {
    const { contact_cedula } = nombrePayload;
    try {
      const existingName = await axiosClient.get(`/private-agenda/nombres/${contact_cedula}`).catch(() => null);
      let response;
      if (existingName?.data) {
        response = await axiosClient.put(`/private-agenda/nombres/${contact_cedula}`, nombrePayload);
      } else {
        response = await axiosClient.post('/private-agenda/nombres', nombrePayload);
      }
      contactName.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Error al guardar nombre personalizado:', err);
      throw err;
    }
  };

  const upsertContactNote = async (notePayload) => {
    const { contact_cedula, cuerpo } = notePayload;
    try {
      const existingNote = await axiosClient.get(`/private-agenda/notas/${contact_cedula}`).catch(() => null);
      let response;
      if (existingNote?.data?.length > 0) {
        const noteId = existingNote.data[0].id;
        response = await axiosClient.put(`/private-agenda/notas/${noteId}`, { cuerpo });
      } else {
        response = await axiosClient.post(`/private-agenda/notas/${contact_cedula}`, { cuerpo });
      }
      return response.data;
    } catch (err) {
      console.error('Error al guardar nota de contacto:', err);
      throw err;
    }
  };
    
  // --- Acciones para Teléfonos ---
  const fetchContactPhones = async (cedula) => {
    try {
      const response = await axiosClient.get(`/private-agenda/telefonos/${cedula}`);
      contactPhones.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Error al cargar teléfonos:', err);
      throw err;
    }
  };
  
  const addContactPhone = async (phonePayload) => {
    try {
      const response = await axiosClient.post(`/private-agenda/telefonos/${phonePayload.contact_cedula}`, phonePayload);
      await fetchContactPhones(phonePayload.contact_cedula);
      return response.data;
    } catch (err) {
      console.error('Error al añadir teléfono:', err);
      throw err;
    }
  };
  
  const updateContactPhone = async (phonePayload) => {
    try {
      const response = await axiosClient.put(`/private-agenda/telefonos/${phonePayload.id}`, phonePayload);
      await fetchContactPhones(phonePayload.contact_cedula);
      return response.data;
    } catch (err) {
      console.error('Error al actualizar teléfono:', err);
      throw err;
    }
  };
  
  const deleteContactPhone = async (phoneId, contactCedula) => {
    try {
      await axiosClient.delete(`/private-agenda/telefonos/${phoneId}`);
      await fetchContactPhones(contactCedula);
    } catch (err) {
      console.error('Error al eliminar teléfono:', err);
      throw err;
    }
  };

  // --- Acciones para Eventos ---
  const fetchContactFollowupEvents = async (cedula) => {
    try {
      const response = await axiosClient.get(`/private-agenda/events/${cedula}`);
      contactFollowupEvents.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Error al cargar eventos:', err);
      throw err;
    }
  };

  const addFollowupEvent = async (eventPayload) => {
    try {
      const response = await axiosClient.post(`/private-agenda/events/${eventPayload.contact_cedula}`, eventPayload);
      await fetchContactFollowupEvents(eventPayload.contact_cedula);
      return response.data;
    } catch (err) {
      console.error('Error al añadir evento:', err);
      throw err;
    }
  };

  const deleteFollowupEvent = async (eventId, contactCedula) => {
    try {
      await axiosClient.delete(`/private-agenda/events/${eventId}`);
      await fetchContactFollowupEvents(contactCedula);
    } catch (err) {
      console.error('Error al eliminar evento:', err);
      throw err;
    }
  };

  // --- Acciones para Categorías ---
  const fetchAllCategories = async () => {
    try {
      const response = await axiosClient.get('/private-agenda/categorias');
      allCategories.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Error al cargar todas las categorías:', err);
      throw err;
    }
  };

  const fetchContactCategories = async (cedula) => {
    try {
      const response = await axiosClient.get(`/private-agenda/categorias/${cedula}`);
      contactCategories.value = response.data;
      return response.data;
    } catch (err) {
      console.error('Error al cargar categorías del contacto:', err);
      throw err;
    }
  };

  const assignCategoryToContact = async (cedula, categoryId) => {
    try {
      const response = await axiosClient.post(`/private-agenda/categorias/${cedula}`, { categoria_id: categoryId });
      await fetchContactCategories(cedula);
      return response.data;
    } catch (err) {
      console.error('Error al asignar categoría:', err);
      throw err;
    }
  };

  const removeCategoryFromContact = async (cedula, categoryId) => {
    try {
      await axiosClient.delete(`/private-agenda/categorias/${cedula}/${categoryId}`);
      await fetchContactCategories(cedula);
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      throw err;
    }
  };

  const createCategory = async (categoryName) => {
    try {
      const response = await axiosClient.post('/private-agenda/categorias', { nombre_categoria: categoryName });
      await fetchAllCategories();
      return response.data;
    } catch (err) {
      console.error('Error al crear categoría:', err);
      throw err;
    }
  };

  return {
    agendaContacts,
    privateAgendaCedulas,
    isLoading,
    error,
    currentContactDetails,
    contactFollowupEvents,
    contactCategories,
    contactPhones,
    contactName,
    contactNotes,
    allCategories,
    getAgendaContacts,
    getPrivateAgendaCedulas,
    fetchAgendaContacts,
    addContactToAgenda,
    removeContactFromAgenda,
    searchPublicContacts,
    createAndAddContact,
    fetchContactData,
    upsertContactDetails,
    upsertUserNombre,
    upsertContactNote,
    fetchContactPhones,
    addContactPhone,
    updateContactPhone,
    deleteContactPhone,
    fetchContactFollowupEvents,
    addFollowupEvent,
    deleteFollowupEvent,
    fetchAllCategories,
    fetchContactCategories,
    assignCategoryToContact,
    removeCategoryFromContact,
    createCategory
  };
});