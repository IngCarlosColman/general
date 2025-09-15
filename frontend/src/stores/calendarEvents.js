// stores/calendarEvents.js
import { defineStore } from 'pinia';
import apiClient from '@/services/api';

export const useCalendarEventsStore = defineStore('calendarEvents', {
  state: () => ({
    events: [],
    loading: false,
  }),
  actions: {
    async fetchEvents() {
      this.loading = true;
      try {
        const response = await apiClient.get('/private-agenda/events');
        this.events = response.data.events;
      } catch (error) {
        console.error('Error al cargar los eventos del calendario:', error);
      } finally {
        this.loading = false;
      }
    },
    async addEvent(eventData) {
      try {
        // Asumiendo que tu backend ya tiene un endpoint para esto.
        // La llamada a la API la haces en UserAgenda.vue
        // Aquí solo actualizamos el store
        // this.events.push(eventData); // Esto puede causar duplicados si el componente no recarga
        // Lo mejor es recargar los eventos para asegurar la consistencia.
        await this.fetchEvents();
      } catch (error) {
        console.error('Error al añadir el evento:', error);
      }
    }
  },
  getters: {
    getEvents: (state) => state.events,
  },
});