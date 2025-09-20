<template>
  <v-container fluid class="fill-height">
    <v-card class="pa-4 flex-grow-1 d-flex flex-column">
      <v-card-title class="text-h5">
        Mi Agenda Personal
      </v-card-title>
      <v-card-subtitle class="text-subtitle-1 mb-4">
        Contactos que has agregado a tu agenda.
      </v-card-subtitle>
      <v-divider class="my-4"></v-divider>
      
      <v-data-table-virtual
        :headers="headers"
        :items="filteredContacts"
        :search="search"
        :loading="agendaStore.isLoading"
        :no-data-text="noDataText"
        item-value="contact_cedula"
        class="elevation-1 flex-grow-1"
        height="450"
        >
        <template v-slot:item.star="{ item }">
          <v-tooltip bottom>
            <template v-slot:activator="{ props }">
              <v-icon
                v-bind="props"
                size="small"
                color="yellow darken-2"
                @click="removeContact(item.raw.contact_cedula)"
                class="pointer"
                >
                mdi-star
              </v-icon>
            </template>
            <span>Quitar de mi agenda</span>
          </v-tooltip>
        </template>
  
        <template v-slot:item.completo="{ item }">
                    {{ item.raw?.nombres }} {{ item.raw?.apellidos }}
        </template>
  
        <template v-slot:item.last_interaction="{ item }">
          {{ formatDate(item.raw?.last_interaction) }}
        </template>
  
        <template v-slot:item.next_followup="{ item }">
          {{ formatDate(item.raw?.next_followup) }}
        </template>
  
        <template v-slot:item.action="{ item }">
          <v-tooltip bottom>
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                icon
                size="small"
                variant="flat"
                color="primary"
                @click="showDetails(item.raw)"
                >
                <v-icon>mdi-eye</v-icon>
              </v-btn>
            </template>
            <span>Ver y editar detalles</span>
          </v-tooltip>
        </template>
  
        <template v-slot:no-data>
          <div class="text-center py-5">
            <v-icon size="48">mdi-information-outline</v-icon>
            <p class="text-subtitle-1 mt-2">{{ noDataText }}</p>
          </div>
        </template>
      </v-data-table-virtual>
  
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, defineProps, defineEmits, watch } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useSnackbar } from '@/composables/useSnackbar';

// Props y Emits
const props = defineProps({
  search: {
    type: String,
    default: '',
  },
  filterCategory: {
    type: [Number, String],
    default: null,
  },
});

const emit = defineEmits(['show-details', 'refresh-data']);

// Store y Composables
const agendaStore = useAgendaStore();
const { showSnackbar } = useSnackbar();

// Configuración de la tabla
const headers = [
  { title: 'Quitar', key: 'star', sortable: false, width: '5%' },
  { title: 'Nombre', key: 'completo' },
  { title: 'Última Interacción', key: 'last_interaction' },
  { title: 'Próximo Seguimiento', key: 'next_followup' },
  { title: 'Empresa', key: 'empresa' },
  { title: 'Acciones', key: 'action', sortable: false, width: '10%' },
];

// Lógica de filtrado y búsqueda
const filteredContacts = computed(() => {
  // Inicializa contacts con un array vacío si agendaStore.agendaContacts es nulo o undefined
  let contacts = agendaStore.agendaContacts || [];

  // Filtrado por categoría
  if (props.filterCategory) {
    const categoryId = parseInt(props.filterCategory);
    contacts = contacts.filter(contact => 
      // Usa el encadenamiento opcional para evitar el error si 'contact' es undefined
      contact?.categorias?.some(cat => cat.categoria_id === categoryId)
    );
  }

  // Búsqueda por texto
  if (props.search) {
    const searchTerm = props.search.toLowerCase();
    contacts = contacts.filter(contact => 
      // Usa el encadenamiento opcional para cada propiedad
      (contact?.nombres && contact.nombres.toLowerCase().includes(searchTerm)) ||
      (contact?.apellidos && contact.apellidos.toLowerCase().includes(searchTerm)) ||
      (contact?.completo && contact.completo.toLowerCase().includes(searchTerm)) ||
      (contact?.cedula && contact.cedula.toLowerCase().includes(searchTerm)) ||
      (contact?.empresa && contact.empresa.toLowerCase().includes(searchTerm)) ||
      (contact?.cargo && contact.cargo.toLowerCase().includes(searchTerm))
    );
  }
  
  // Filtra cualquier elemento nulo o undefined antes de devolver el array
  return contacts.filter(c => c);
});

// Mensaje de no-data personalizado
const noDataText = computed(() => {
  if (agendaStore.isLoading) {
    return 'Cargando contactos...';
  }
  if (props.search || props.filterCategory) {
    return 'No se encontraron resultados que coincidan con tu búsqueda.';
  }
  return 'No tienes contactos en tu agenda personal.';
});

// Métodos
const showDetails = (contact) => {
  emit('show-details', contact);
};

const removeContact = async (cedula) => {
  try {
    await agendaStore.removeContactFromAgenda(cedula);
    showSnackbar('Contacto eliminado de tu agenda personal.', 'success');
    emit('refresh-data');
  } catch (error) {
    showSnackbar('Error al eliminar el contacto.', 'error');
    console.error('Error al eliminar contacto:', error);
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};
</script>