// src/stores/useAgendaStore.js

import { defineStore } from 'pinia';
import axiosClient from '@/api/axiosClient';

export const useAgendaStore = defineStore('agenda', {
  state: () => ({
    agendaContacts: [],
    privateAgendaCedulas: [],
    isLoading: false,
    error: null,
    // Estados específicos para los detalles del contacto seleccionado
    currentContactDetails: null,
    contactFollowupEvents: [],
    contactCategories: [],
    contactPhones: [],
    contactName: null,
    contactNotes: null,
    // Estado para todas las categorías predefinidas
    allCategories: [],
  }),

  actions: {
    // --- Acciones de la Agenda Principal ---

    async fetchAgendaContacts() {
      this.isLoading = true;
      this.error = null;
      try {
        const response = await axiosClient.get('/private-agenda/agenda');
        
        let dataToProcess = [];
        if (response.data) {
          dataToProcess = Array.isArray(response.data) ? response.data : (response.data.items || response.data.data || []);
        }

        this.agendaContacts = dataToProcess;
        this.privateAgendaCedulas = dataToProcess.map(c => c.contact_cedula);
      } catch (err) {
        this.error = 'Error al cargar los contactos de la agenda.';
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },

    async addContactToAgenda(cedula) {
      try {
        const response = await axiosClient.post('/private-agenda/agenda', { contact_cedula: cedula });
        await this.fetchAgendaContacts();
        return response.data;
      } catch (err) {
        console.error('Error al añadir contacto a la agenda:', err);
        throw err;
      }
    },

    async removeContactFromAgenda(cedula) {
      try {
        await axiosClient.delete(`/private-agenda/agenda/${cedula}`);
        await this.fetchAgendaContacts();
      } catch (err) {
        console.error('Error al eliminar contacto de la agenda:', err);
        throw err;
      }
    },

    // --- Acciones de Búsqueda Pública ---
    
    async searchPublicContacts(query) {
      if (!query || query.length < 3) {
        return [];
      }
      try {
        const response = await axiosClient.get(`/public-guide/search`, {
          params: { q: query }
        });
        return response.data;
      } catch (err) {
        console.error('Error al buscar en la guía pública:', err);
        throw err;
      }
    },

    // --- Acciones de los Detalles del Contacto ---

    async fetchContactData(cedula) {
      try {
        const [detailsRes, notesRes, namesRes, phonesRes, eventsRes, categoriesRes] = await Promise.all([
          axiosClient.get(`/private-agenda/details/${cedula}`),
          axiosClient.get(`/private-agenda/notas/${cedula}`),
          axiosClient.get(`/private-agenda/nombres/${cedula}`),
          axiosClient.get(`/private-agenda/telefonos/${cedula}`),
          axiosClient.get(`/private-agenda/events/${cedula}`),
          axiosClient.get(`/private-agenda/categorias/${cedula}`),
        ]);

        this.currentContactDetails = detailsRes.data;
        this.contactNotes = notesRes.data;
        this.contactName = namesRes.data;
        this.contactPhones = phonesRes.data;
        this.contactFollowupEvents = eventsRes.data;
        this.contactCategories = categoriesRes.data;

      } catch (err) {
        console.error('Error al cargar datos completos del contacto:', err);
        throw err;
      }
    },

    // --- Acciones para Detalle, Nombre y Notas ---

    async upsertContactDetails(detailsPayload) {
      const { cedula } = detailsPayload;
      try {
        const existingDetails = await axiosClient.get(`/private-agenda/details/${cedula}`).catch(() => null);
        let response;
        if (existingDetails?.data) {
          response = await axiosClient.put(`/private-agenda/details/${cedula}`, detailsPayload);
        } else {
          response = await axiosClient.post('/private-agenda/details', detailsPayload);
        }
        this.currentContactDetails = response.data;
        return response.data;
      } catch (err) {
        console.error('Error al guardar detalles de contacto:', err);
        throw err;
      }
    },

    async upsertUserNombre(nombrePayload) {
      const { contact_cedula } = nombrePayload;
      try {
        const existingName = await axiosClient.get(`/private-agenda/nombres/${contact_cedula}`).catch(() => null);
        let response;
        if (existingName?.data) {
          response = await axiosClient.put(`/private-agenda/nombres/${contact_cedula}`, nombrePayload);
        } else {
          response = await axiosClient.post('/private-agenda/nombres', nombrePayload);
        }
        this.contactName = response.data;
        return response.data;
      } catch (err) {
        console.error('Error al guardar nombre personalizado:', err);
        throw err;
      }
    },

    async upsertContactNote(notePayload) {
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
    },
    
    // --- Acciones para Teléfonos ---
    
    async fetchContactPhones(cedula) {
      try {
        const response = await axiosClient.get(`/private-agenda/telefonos/${cedula}`);
        this.contactPhones = response.data;
        return response.data;
      } catch (err) {
        console.error('Error al cargar teléfonos:', err);
        throw err;
      }
    },
    
    async addContactPhone(phonePayload) {
      try {
        const response = await axiosClient.post(`/private-agenda/telefonos/${phonePayload.contact_cedula}`, phonePayload);
        await this.fetchContactPhones(phonePayload.contact_cedula);
        return response.data;
      } catch (err) {
        console.error('Error al añadir teléfono:', err);
        throw err;
      }
    },
    
    async updateContactPhone(phonePayload) {
      try {
        const response = await axiosClient.put(`/private-agenda/telefonos/${phonePayload.id}`, phonePayload);
        await this.fetchContactPhones(phonePayload.contact_cedula);
        return response.data;
      } catch (err) {
        console.error('Error al actualizar teléfono:', err);
        throw err;
      }
    },
    
    async deleteContactPhone(phoneId, contactCedula) {
      try {
        await axiosClient.delete(`/private-agenda/telefonos/${phoneId}`);
        await this.fetchContactPhones(contactCedula);
      } catch (err) {
        console.error('Error al eliminar teléfono:', err);
        throw err;
      }
    },

    // --- Acciones para Eventos ---
    
    async fetchContactFollowupEvents(cedula) {
      try {
        const response = await axiosClient.get(`/private-agenda/events/${cedula}`);
        this.contactFollowupEvents = response.data;
        return response.data;
      } catch (err) {
        console.error('Error al cargar eventos:', err);
        throw err;
      }
    },

    async addFollowupEvent(eventPayload) {
      try {
        const response = await axiosClient.post(`/private-agenda/events/${eventPayload.contact_cedula}`, eventPayload);
        await this.fetchContactFollowupEvents(eventPayload.contact_cedula);
        return response.data;
      } catch (err) {
        console.error('Error al añadir evento:', err);
        throw err;
      }
    },

    async deleteFollowupEvent(eventId, contactCedula) {
      try {
        await axiosClient.delete(`/private-agenda/events/${eventId}`);
        await this.fetchContactFollowupEvents(contactCedula);
      } catch (err) {
        console.error('Error al eliminar evento:', err);
        throw err;
      }
    },

    // --- Acciones para Categorías ---

    async fetchAllCategories() {
      try {
        const response = await axiosClient.get('/private-agenda/categorias');
        this.allCategories = response.data;
        return response.data;
      } catch (err) {
        console.error('Error al cargar todas las categorías:', err);
        throw err;
      }
    },

    async fetchContactCategories(cedula) {
      try {
        const response = await axiosClient.get(`/private-agenda/categorias/${cedula}`);
        this.contactCategories = response.data;
        return response.data;
      } catch (err) {
        console.error('Error al cargar categorías del contacto:', err);
        throw err;
      }
    },

    async assignCategoryToContact(cedula, categoryId) {
      try {
        const response = await axiosClient.post(`/private-agenda/categorias/${cedula}`, { categoria_id: categoryId });
        await this.fetchContactCategories(cedula);
        return response.data;
      } catch (err) {
        console.error('Error al asignar categoría:', err);
        throw err;
      }
    },

    async removeCategoryFromContact(cedula, categoryId) {
      try {
        await axiosClient.delete(`/private-agenda/categorias/${cedula}/${categoryId}`);
        await this.fetchContactCategories(cedula);
      } catch (err) {
        console.error('Error al eliminar categoría:', err);
        throw err;
      }
    },

    async createCategory(categoryName) {
      try {
        const response = await axiosClient.post('/private-agenda/categorias', { nombre_categoria: categoryName });
        await this.fetchAllCategories();
        return response.data;
      } catch (err) {
        console.error('Error al crear categoría:', err);
        throw err;
      }
    },
  },
});