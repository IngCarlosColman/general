<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <v-col cols="12" md="8" class="pa-4">
        <v-card class="elevation-4 h-100">
          <v-toolbar color="surface" density="compact" class="border-b">
            <v-toolbar-title class="text-h6 text-primary">Acompañamiento y Seguimiento</v-toolbar-title>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-refresh"
              @click="refreshEvents"
              class="me-2"
            >
              Ver Notas
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-plus"
              @click="openEventDialog({})"
            >
              Agregar Nota
            </v-btn>
          </v-toolbar>
          <v-card-text class="py-4 px-2">
            <FullCalendar ref="fullCalendarRef" :options="calendarOptions" />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4" class="pa-4 bg-grey-lighten-4">
        <v-card class="elevation-4 h-100 pa-2">
          <v-card-title class="d-flex align-center text-subtitle-1 text-blue-darken-3 font-weight-bold pt-4 pb-2">
            <v-icon color="blue-darken-3" class="me-2">mdi-bell-outline</v-icon>
            Notificaciones de la Semana
          </v-card-title>
          <v-divider class="mx-4 mb-2"></v-divider>
          <v-card-text class="py-2">
            <v-list dense class="bg-transparent">
              <v-list-item v-if="dailyReminder" class="py-2 px-0">
                <v-list-item-title class="font-weight-bold text-red-darken-3">
                  {{ dailyReminder }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item v-for="event in upcomingEvents" :key="event.id" class="py-2 px-0">
                <v-list-item-title class="d-flex align-center">
                  <v-icon size="small" :color="event.color" class="me-2">{{ event.icon }}</v-icon>
                  <span>{{ event.title }}</span>
                </v-list-item-title>
                <v-list-item-subtitle class="ms-6 text-caption text-medium-emphasis">
                  Fecha: {{ new Date(event.date).toLocaleDateString() }} {{ new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="upcomingEvents.length === 0 && !dailyReminder" class="py-2 px-0">
                <v-list-item-title class="text-caption text-medium-emphasis">
                  No hay eventos próximos en los siguientes 7 días.
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>

          <div v-if="parentalNotification">
            <v-divider class="mx-4 mb-2"></v-divider>
            <v-card-title class="d-flex align-center text-subtitle-1 text-green-darken-3 font-weight-bold pt-2 pb-2">
              <v-icon color="green-darken-3" class="me-2">mdi-star-outline</v-icon>
              Recordatorio Especial
            </v-card-title>
            <v-card-text class="text-caption text-medium-emphasis pb-4 pt-0">
              {{ parentalNotification }}
            </v-card-text>
          </div>

          <v-divider class="mx-4 mb-2"></v-divider>
          <v-card-title class="d-flex align-center text-subtitle-1 text-blue-darken-3 font-weight-bold pt-2 pb-2">
            <v-icon color="blue-darken-3" class="me-2">mdi-lightbulb-on-outline</v-icon>
            Lista de Recomendación
          </v-card-title>
          <v-card-text class="py-2">
            <p class="text-caption text-medium-emphasis mb-2">
              Recuerde que siempre es bueno enviar un detalle a las personas que hacen crecer tu negocio:
            </p>
            <v-list dense class="bg-transparent text-caption">
              <v-list-item prepend-icon="mdi-gift-outline">Una cartera.</v-list-item>
              <v-list-item prepend-icon="mdi-watch-variant">Un reloj.</v-list-item>
              <v-list-item prepend-icon="mdi-flower">Unas flores.</v-list-item>
              <v-list-item prepend-icon="mdi-bottle-wine">Una botella de vino.</v-list-item>
              <v-list-item prepend-icon="mdi-notebook-edit-outline">Una agenda personalizada.</v-list-item>
              <v-list-item prepend-icon="mdi-spa-outline">Un vale de spa.</v-list-item>
              <v-list-item prepend-icon="mdi-movie-open-outline">Un pase para cine.</v-list-item>
              <v-list-item class="font-weight-bold mt-2 text-medium-emphasis">
                <v-icon start size="small">mdi-lightbulb-on</v-icon>
                Anote siempre las preferencias de sus clientes.
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    
    <v-dialog v-model="eventDialog" max-width="500px">
      <v-card>
        <v-toolbar :color="isEditing ? 'blue-darken-3' : 'primary'" flat density="compact">
          <v-toolbar-title class="text-white">{{ isEditing ? 'Editar Evento' : 'Agregar Evento' }}</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="closeEventDialog" color="white">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="py-4">
          <v-text-field
            v-model="editedEvent.title"
            label="Título del evento"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'El título es obligatorio']"
          ></v-text-field>
          
          <v-text-field
            v-model="editedEvent.date"
            label="Fecha"
            type="date"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'La fecha es obligatoria']"
          ></v-text-field>

          <v-text-field
            v-model="editedEvent.time"
            label="Hora del evento (opcional)"
            type="time"
            variant="outlined"
            density="compact"
          ></v-text-field>

          <v-textarea
            v-model="editedEvent.description"
            label="Descripción o notas"
            variant="outlined"
            rows="3"
            density="compact"
          ></v-textarea>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn v-if="isEditing" color="red-darken-3" variant="text" @click="confirmDeleteEvent">
            Eliminar
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn color="grey-darken-2" @click="closeEventDialog">Cancelar</v-btn>
          <v-btn color="blue-darken-3" variant="flat" @click="saveEvent">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmDialog" max-width="400px">
      <v-card>
        <v-toolbar color="red-darken-3" flat density="compact">
          <v-toolbar-title class="text-white">Confirmar Eliminación</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="confirmDialog = false" color="white">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="py-4 text-center">
          ¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn color="grey-darken-2" @click="confirmDialog = false">Cancelar</v-btn>
          <v-btn color="red-darken-3" variant="flat" @click="deleteEvent">Eliminar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import apiClient from '@/services/api';
import { useSnackbar } from '@/composables/useSnackbar';
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { useCalendarEventsStore } from '@/stores/calendarEvents';
import { storeToRefs } from 'pinia';

const { showSnackbar } = useSnackbar();
const allContacts = ref([]);
const fullCalendarRef = ref(null);

const calendarEventsStore = useCalendarEventsStore();
const { events: customEvents } = storeToRefs(calendarEventsStore);
const calendarEvents = ref([]);

const eventDialog = ref(false);
const confirmDialog = ref(false);
const editedEvent = ref({ id: null, title: '', date: '', time: '', description: '', color: 'blue', icon: 'mdi-pencil' });
const defaultEvent = { id: null, title: '', date: '', time: '', description: '', color: 'blue', icon: 'mdi-pencil' };
const isEditing = computed(() => !!editedEvent.value.id);

// **NUEVA FUNCIÓN: Forzamos la recarga imperativa del calendario**
const refreshEvents = async () => {
  try {
    await calendarEventsStore.fetchEvents();
    await fetchContacts();
    generateAllEvents();
    
    if (fullCalendarRef.value) {
      const calendarApi = fullCalendarRef.value.getApi();
      calendarApi.removeAllEvents();
      calendarApi.addEventSource(calendarEvents.value);
    }

    showSnackbar('Eventos recargados con éxito.', 'success');
  } catch (error) {
    showSnackbar('Error al recargar los eventos.', 'error');
  }
};

const openEventDialog = (event) => {
  if (!event.id && !event.extendedProps) {
    editedEvent.value = Object.assign({}, defaultEvent, event);
  } else {
    const eventId = event.extendedProps?.id || event.id;

    if (typeof eventId === 'number') {
      let localDate;
      let time;

      if (event.start) {
        localDate = new Date(event.start);
        const hours = String(localDate.getHours()).padStart(2, '0');
        const minutes = String(localDate.getMinutes()).padStart(2, '0');
        time = `${hours}:${minutes}`;
      } else {
        localDate = new Date(event.startStr);
        time = '';
      }

      editedEvent.value = {
        id: eventId,
        title: event.title,
        date: localDate.toISOString().split('T')[0],
        time: event.allDay ? '' : time,
        description: event.extendedProps?.description,
        color: event.extendedProps?.color,
        icon: event.extendedProps?.icon,
      };
    } else {
      showSnackbar('No puedes editar o eliminar días festivos o cumpleaños.', 'info');
      return;
    }
  }

  eventDialog.value = true;
  
};

const closeEventDialog = () => {
  eventDialog.value = false;
  editedEvent.value = Object.assign({}, defaultEvent);
};

const saveEvent = async () => {
  if (!editedEvent.value.title || !editedEvent.value.date) {
    showSnackbar('El título y la fecha son obligatorios.', 'error');
    return;
  }
  
  let fullDateString;
  if (editedEvent.value.time) {
    const localDate = new Date(`${editedEvent.value.date}T${editedEvent.value.time}:00`);
    fullDateString = localDate.toISOString();
  } else {
    fullDateString = new Date(editedEvent.value.date).toISOString().split('T')[0] + 'T00:00:00.000Z';
  }

  const eventData = {
    title: editedEvent.value.title,
    description: editedEvent.value.description,
    color: editedEvent.value.color,
    icon: editedEvent.value.icon,
    date: fullDateString,
  };

  try {
    if (isEditing.value) {
      await apiClient.put(`/private-agenda/events/${editedEvent.value.id}`, eventData);
      showSnackbar('Evento actualizado con éxito.', 'success');
    } else {
      await apiClient.post('/private-agenda/events', eventData);
      showSnackbar('Evento agregado con éxito.', 'success');
    }

    // Usamos el nuevo método para recargar el calendario
    await refreshEvents();
    closeEventDialog();
  } catch (error) {
    console.error('Error al guardar el evento:', error);
    showSnackbar('Error al guardar el evento.', 'error');
  }
};

const confirmDeleteEvent = () => {
  if (typeof editedEvent.value.id !== 'number') {
    showSnackbar('No puedes eliminar días festivos o cumpleaños.', 'info');
    closeEventDialog();
    return;
  }
  confirmDialog.value = true;
};

const deleteEvent = async () => {
  try {
    await apiClient.delete(`/private-agenda/events/${editedEvent.value.id}`);
    showSnackbar('Evento eliminado con éxito.', 'success');
    
    // Usamos el nuevo método para recargar el calendario
    await refreshEvents();
    closeEventDialog();
    confirmDialog.value = false;
  } catch (error) {
    console.error('Error al eliminar el evento:', error);
    showSnackbar('Error al eliminar el evento.', 'error');
  }
};

const getEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  const month = Math.floor(n / 31);
  const day = (n % 31) + 1;
  return new Date(year, month - 1, day);
};

const getVariableHolidays = (year) => {
  const holidays = [];
  const easter = getEaster(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({ date: goodFriday, title: 'Viernes Santo', color: 'red' });

  const fatherDay = new Date(year, 5, 1);
  let sundayCount = 0;
  while (sundayCount < 3) {
    if (fatherDay.getDay() === 0) {
      sundayCount++;
    }
    if (sundayCount < 3) {
      fatherDay.setDate(fatherDay.getDate() + 1);
    }
  }
  holidays.push({ date: new Date(fatherDay), title: 'Día del Padre', color: 'red' });
  
  return holidays;
};

const generateAllEvents = () => {
  const events = [];
  const today = new Date();
  const currentYear = today.getFullYear();

  const fixedHolidays = [
      { month: 0, day: 1, title: 'Año Nuevo' },
      { month: 1, day: 14, title: 'Día de los Enamorados' },
      { month: 4, day: 1, title: 'Día del Trabajador' },
      { month: 4, day: 15, title: 'Día de la Madre' },
      { month: 4, day: 14, title: 'Independencia del Paraguay' },
      { month: 4, day: 15, title: 'Independencia del Paraguay' },
      { month: 11, day: 25, title: 'Navidad' },
  ];
  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    fixedHolidays.forEach(holiday => {
      events.push({
        title: holiday.title,
        date: new Date(year, holiday.month, holiday.day).toISOString(),
        color: 'red',
        icon: 'mdi-flag',
        allDay: true
      });
    });

    const variableHolidays = getVariableHolidays(year);
    variableHolidays.forEach(holiday => {
      events.push({
        title: holiday.title,
        date: holiday.date.toISOString(),
        color: 'red',
        icon: 'mdi-flag',
        allDay: true
      });
    });

    if (allContacts.value && Array.isArray(allContacts.value)) {
      allContacts.value.forEach(contact => {
        if (contact.fecha_nacimiento) {
          const birthDateString = contact.fecha_nacimiento.split('T')[0];
          const [birthYear, month, day] = birthDateString.split('-');
          const birthDate = new Date(year, month - 1, day);
          
          events.push({
            id: `birthday-${contact.cedula}-${year}`,
            title: `Cumpleaños de ${contact.nombres} ${contact.apellidos}`,
            date: birthDate.toISOString(),
            color: 'green',
            icon: 'mdi-cake-variant',
            allDay: true
          });
        }
      });
    }
  }

  if (customEvents.value && Array.isArray(customEvents.value)) {
    customEvents.value.forEach(event => {
      const isAllDay = event.date.endsWith('T00:00:00.000Z') || !event.date.includes('T');
      events.push({
        id: event.id,
        title: event.title,
        description: event.description,
        color: event.color,
        icon: event.icon,
        date: event.date,
        allDay: isAllDay
      });
    });
  }

  calendarEvents.value = events;
};

const fetchContacts = async () => {
  try {
    const contactsResponse = await apiClient.get('/private-agenda');
    allContacts.value = contactsResponse.data.items ?? [];
  } catch (error) {
    console.error('Error al cargar los contactos:', error);
  }
};

const calendarOptions = ref({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,dayGridWeek,dayGridDay'
  },
  locale: esLocale,
  // Ya no usamos una propiedad computada, ahora los eventos se cargan de forma imperativa.
  events: calendarEvents,
  eventDisplay: 'block',
  editable: true,
  eventStartEditable: true,
  eventResizableFromStart: false,
  eventDurationEditable: false,
  timeZone: 'local',
  
  dateClick: (info) => {
    openEventDialog({ date: info.dateStr, time: '' });
  },
  eventClick: (info) => {
    openEventDialog(info.event);
  },
  eventDrop: async (info) => {
    try {
      if (typeof info.event.extendedProps.id !== 'number') {
        info.revert();
        showSnackbar('No puedes mover los días festivos, cumpleaños o fechas especiales.', 'error');
        return;
      }

      const eventId = info.event.extendedProps.id;
      let newDateString;
      if (info.event.allDay) {
        newDateString = new Date(info.event.startStr).toISOString();
      } else {
        newDateString = info.event.start.toISOString();
      }

      await apiClient.put(`/private-agenda/events/${eventId}`, { date: newDateString });
      showSnackbar('Fecha del evento actualizada.', 'success');
      
      // Recargamos el calendario para reflejar los cambios
      await refreshEvents();
      
    } catch (error) {
      console.error('Error al actualizar fecha del evento:', error);
      showSnackbar('Error al actualizar la fecha del evento.', 'error');
      info.revert();
    }
  },
  
  eventDidMount: function(info) {
    if (info.event.extendedProps.description || info.event.title) {
      const tooltipText = `${info.event.title}${info.event.extendedProps.description ? ': ' + info.event.extendedProps.description : ''}`;
      info.el.setAttribute('title', tooltipText);
    }
  },
  
  eventContent: function(arg) {
    let titleEl = document.createElement('div');
    const iconClass = arg.event.extendedProps?.icon || 'mdi-calendar';
    titleEl.innerHTML = `<i class="mdi ${iconClass} me-1"></i>${arg.event.title}`;
    return { domNodes: [titleEl] };
  },
});

const upcomingEvents = computed(() => {
  const today = new Date();
  const next7Days = new Date();
  next7Days.setDate(today.getDate() + 7);
  
  return calendarEvents.value.filter(event => {
    const eventDate = new Date(event.date);
    if (isNaN(eventDate.getTime())) return false; 
    
    return eventDate >= today && eventDate <= next7Days;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
});

const dailyReminder = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  const eventToday = calendarEvents.value.find(event => {
    const eventDateWithoutTime = new Date(event.date).toISOString().split('T')[0];
    return eventDateWithoutTime === today && (event.color === 'green' || event.color === 'orange' || event.color === 'purple');
  });
  if (eventToday) {
    if (eventToday.color === 'green') {
      return `¡Hoy es cumpleaños de ${eventToday.title.replace('Cumpleaños de ', '')}!`;
    } else if (eventToday.color === 'orange') {
      return `¡Hoy es el Día del Padre de: ${eventToday.title.replace('Día del Padre: ', '')}!`;
    } else if (eventToday.color === 'purple') {
      return `¡Hoy es el Día de la Madre de: ${eventToday.title.replace('Día de la Madre: ', '')}!`;
    }
  }
  return null;
});

const parentalNotification = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  
  const isMotherDay = today.endsWith('-05-15');
  const isFatherDay = getVariableHolidays(new Date().getFullYear()).find(h => h.title === 'Día del Padre' && h.date.toISOString().split('T')[0] === today);
  
  if (isMotherDay) {
    const mothers = allContacts.value.filter(c => c.es_madre);
    if (mothers.length > 0) {
      const names = mothers.map(m => `${m.nombres} ${m.apellidos}`).join(', ');
      return `¡Recordatorio del Día de la Madre! Tus clientes: ${names}, esperan un detalle o tu llamada.`;
    }
  }
  
  if (isFatherDay) {
    const fathers = allContacts.value.filter(c => c.es_padre);
    if (fathers.length > 0) {
      const names = fathers.map(f => `${f.nombres} ${f.apellidos}`).join(', ');
      return `¡Recordatorio del Día del Padre! Tus clientes: ${names}, esperan un detalle o tu llamada.`;
    }
  }

  return null;
});

onMounted(() => {
  // Llama a la función de recarga en el onMounted
  refreshEvents();
  nextTick(() => {
    if (fullCalendarRef.value) {
      fullCalendarRef.value.getApi().updateSize();
    }
  });
});
</script>

<style scoped>
.h-100 {
  height: 100%;
}
</style>