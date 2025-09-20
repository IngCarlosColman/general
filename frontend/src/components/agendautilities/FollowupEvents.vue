<template>
  <v-card class="mt-4" outlined>
    <v-card-title class="d-flex align-center">
      Eventos de Seguimiento
      <v-spacer></v-spacer>
      <v-btn icon @click="isAddingEvent = !isAddingEvent">
        <v-icon>{{ isAddingEvent ? 'mdi-close' : 'mdi-plus' }}</v-icon>
      </v-btn>
    </v-card-title>
    
    <v-card-text>
      <v-form v-if="isAddingEvent" @submit.prevent="addEvent">
        <v-select
          v-model="newEvent.tipo_evento"
          :items="eventTypes"
          label="Tipo de Evento"
          variant="outlined"
          class="mb-4"
          required
        ></v-select>
        <v-text-field
          v-model="newEvent.fecha"
          label="Fecha"
          type="date"
          variant="outlined"
          class="mb-4"
          required
        ></v-text-field>
        <v-textarea
          v-model="newEvent.notas"
          label="Notas del Evento"
          variant="outlined"
          rows="2"
        ></v-textarea>
        <v-btn type="submit" color="primary" class="mt-2" :loading="isSavingEvent">
          Guardar Evento
        </v-btn>
      </v-form>
      
      <v-list v-else dense class="pa-0">
        <v-list-item v-if="agendaStore.contactFollowupEvents.length === 0">
          <v-list-item-title class="text-caption text-medium-emphasis">No hay eventos de seguimiento registrados.</v-list-item-title>
        </v-list-item>
        <v-list-item v-for="event in agendaStore.contactFollowupEvents" :key="event.id" class="pa-0 my-2">
          <div class="d-flex flex-column">
            <div class="d-flex justify-space-between align-center w-100">
              <v-list-item-title class="font-weight-bold text-subtitle-2">{{ event.tipo_evento }}</v-list-item-title>
              <v-list-item-action class="ml-auto d-flex">
                <v-btn icon size="small" variant="text" color="error" @click="deleteEvent(event.id)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-list-item-action>
            </div>
            <v-list-item-subtitle class="text-caption">{{ formatDate(event.fecha) }}</v-list-item-subtitle>
            <p v-if="event.notas" class="text-caption mt-1 text-wrap">{{ event.notas }}</p>
          </div>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, defineProps } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useSnackbar } from '@/composables/useSnackbar';

// Props
const props = defineProps({
  contactCedula: {
    type: String,
    required: true,
  },
});

// Store y Composables
const agendaStore = useAgendaStore();
const { showSnackbar } = useSnackbar();

// Estado local
const isAddingEvent = ref(false);
const isSavingEvent = ref(false);
const newEvent = ref({
  tipo_evento: '',
  fecha: '',
  notas: '',
});

// Tipos de evento predefinidos
const eventTypes = [
  'Llamada', 'Reunión', 'Correo Electrónico', 'Mensaje', 'Otro'
];

// Métodos
const addEvent = async () => {
  isSavingEvent.value = true;
  try {
    const payload = {
      contact_cedula: props.contactCedula,
      ...newEvent.value,
    };
    await agendaStore.addFollowupEvent(payload);
    showSnackbar('Evento agregado con éxito.', 'success');
    resetForm();
  } catch (error) {
    showSnackbar('Error al agregar el evento.', 'error');
    console.error('Error al agregar evento:', error);
  } finally {
    isSavingEvent.value = false;
  }
};

const deleteEvent = async (eventId) => {
  if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
    try {
      await agendaStore.deleteFollowupEvent(eventId, props.contactCedula);
      showSnackbar('Evento eliminado con éxito.', 'success');
    } catch (error) {
      showSnackbar('Error al eliminar el evento.', 'error');
      console.error('Error al eliminar evento:', error);
    }
  }
};

const resetForm = () => {
  newEvent.value = {
    tipo_evento: '',
    fecha: '',
    notas: '',
  };
  isAddingEvent.value = false;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};
</script>