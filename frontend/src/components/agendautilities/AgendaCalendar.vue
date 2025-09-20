<template>
  <v-container fluid class="fill-height pa-0">
    <v-card class="flex-grow-1 d-flex flex-column">
      <v-card-text class="py-4 px-2 flex-grow-1">
        <v-calendar
          :attributes="calendarEvents"
          is-expanded
          :locale="esLocale"
          @dayclick="openModalForDay"
          class="h-100"
        />
      </v-card-text>
    </v-card>
    
    <v-dialog v-model="eventDayDialog" max-width="500px">
      <v-card>
        <v-card-title class="headline">
          Eventos para {{ formatDate(selectedDay) }}
        </v-card-title>
        <v-card-text>
          <v-list dense>
            <v-list-item v-if="eventsForSelectedDay.length === 0">
              <v-list-item-title>No hay eventos programados.</v-list-item-title>
            </v-list-item>
            <v-list-item v-for="event in eventsForSelectedDay" :key="event.id">
              <v-list-item-title class="font-weight-bold">{{ event.customData.title }}</v-list-item-title>
              <v-list-item-subtitle v-if="event.customData.subtitle">{{ event.customData.subtitle }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="text" @click="eventDayDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { setupCalendar } from 'v-calendar';

// Configuración global para v-calendar (idioma español)
setupCalendar({
  locales: {
    'es-ES': {
      firstDayOfWeek: 1,
      masks: {
        weekdays: 'WWW',
      },
    },
  },
});

const esLocale = 'es-ES';

// Store
const agendaStore = useAgendaStore();

// Estado local
const eventDayDialog = ref(false);
const selectedDay = ref(null);

// Propiedad computada para generar los eventos para el calendario
const calendarEvents = computed(() => {
  const events = [];

  // 1. Eventos de Seguimiento (followupEvents)
  agendaStore.agendaContacts.forEach(contact => {
    if (contact.followupEvents && contact.followupEvents.length > 0) {
      contact.followupEvents.forEach(event => {
        events.push({
          key: `event-${event.id}`,
          dates: new Date(event.fecha),
          dot: {
            color: 'blue',
            class: 'v-tooltip-class',
          },
          popover: {
            label: `Seguimiento: ${event.tipo_evento}\nNotas: ${event.notas}`,
          },
          customData: {
            title: `Evento: ${event.tipo_evento}`,
            subtitle: `Notas: ${event.notas}`,
            type: 'followup',
            contactName: contact.completo,
          },
        });
      });
    }
  });

  // 2. Cumpleaños de Contactos
  agendaStore.agendaContacts.forEach(contact => {
    if (contact.fecha_nacimiento) {
      const birthDate = new Date(contact.fecha_nacimiento);
      events.push({
        key: `birthday-${contact.contact_cedula}`,
        dates: { month: birthDate.getMonth() + 1, day: birthDate.getDate() },
        dot: {
          color: 'purple',
        },
        popover: {
          label: `Cumpleaños de ${contact.completo}`,
        },
        customData: {
          title: `Cumpleaños de ${contact.completo}`,
          type: 'birthday',
          contactName: contact.completo,
        },
      });
    }
  });

  return events;
});

// Lógica para mostrar eventos al hacer clic en un día
const openModalForDay = (day) => {
  selectedDay.value = day.date;
  eventDayDialog.value = true;
};

const eventsForSelectedDay = computed(() => {
  if (!selectedDay.value) return [];
  const selectedDate = new Date(selectedDay.value).toISOString().split('T')[0];
  
  return calendarEvents.value.filter(event => {
    const eventDate = new Date(event.dates).toISOString().split('T')[0];
    return eventDate === selectedDate;
  });
});

const formatDate = (date) => {
  if (!date) return '';
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(date).toLocaleDateString('es-ES', options);
};

</script>