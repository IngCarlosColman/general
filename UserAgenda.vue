<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <v-toolbar flat>
        <v-toolbar-title class="text-h6">Mi Agenda Privada</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-text-field
          v-model="search"
          label="Buscar en mi agenda..."
          single-line
          hide-details
          density="compact"
          class="me-2"
          prepend-inner-icon="mdi-magnify"
        ></v-text-field>
        <v-btn
          color="green"
          variant="flat"
          @click="openAddContactDialog"
          prepend-icon="mdi-plus"
        >
          Añadir Contacto
        </v-btn>
      </v-toolbar>

      <v-divider></v-divider>

      <v-card-text class="pa-0">
        <v-data-table-server
          :headers="headers"
          :items="agendaData"
          :items-length="totalItems"
          :loading="loading"
          :search="search"
          v-model:sort-by="sortBy"
          @update:options="loadItems"
          loading-text="Cargando mi agenda..."
          no-data-text="No tienes contactos en tu agenda. Añade uno para empezar."
          :items-per-page-options="[
            { value: 10, title: '10' },
            { value: 25, title: '25' },
            { value: 50, title: '50' },
            { value: 100, title: '100' },
          ]"
        >
          <template v-slot:item.telefonos="{ item }">
            <v-chip-group>
              <v-chip v-for="tel in item.telefonos" :key="tel" size="small">
                {{ tel }}
              </v-chip>
            </v-chip-group>
          </template>
          
          <template v-slot:item.actions="{ item }">
            <v-tooltip text="Ver detalles" location="top">
              <template v-slot:activator="{ props }">
                <v-icon
                  size="small"
                  class="me-2"
                  @click="showDetails(item)"
                  color="blue"
                  v-bind="props"
                >
                  mdi-information
                </v-icon>
              </template>
            </v-tooltip>
            <v-tooltip text="Eliminar de mi agenda" location="top">
              <template v-slot:activator="{ props }">
                <v-icon
                  size="small"
                  @click="confirmDelete(item)"
                  color="red"
                  v-bind="props"
                >
                  mdi-delete
                </v-icon>
              </template>
            </v-tooltip>
          </template>
          
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <v-dialog v-model="addContactDialog" max-width="800px">
      <v-card>
        <v-toolbar color="green" flat density="compact">
          <v-toolbar-title class="text-white">Añadir Contacto a Mi Agenda</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="closeAddContactDialog" color="white">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text>
          <v-text-field
            v-model="addSearch"
            label="Buscar contactos en la guía general..."
            single-line
            hide-details
            density="compact"
            class="mb-4"
            prepend-inner-icon="mdi-magnify"
            @keyup.enter="loadGeneralItems({ page: 1, itemsPerPage: 10, search: addSearch })"
          >
            <template v-slot:append-inner>
              <v-icon @click="loadGeneralItems({ page: 1, itemsPerPage: 10, search: addSearch })" style="cursor: pointer;">mdi-magnify</v-icon>
            </template>
          </v-text-field>
          <v-data-table-server
            :headers="generalHeaders"
            :items="generalContacts"
            :items-length="generalTotalItems"
            :loading="generalLoading"
            loading-text="Buscando..."
            no-data-text="No se encontraron resultados."
            @update:options="loadGeneralItems"
          >
            <template v-slot:item.telefonos="{ item }">
              <v-chip-group>
                <v-chip v-for="tel in item.telefonos" :key="tel" size="small">
                  {{ tel }}
                </v-chip>
              </v-chip-group>
            </template>
            <template v-slot:item.actions="{ item }">
              <v-tooltip text="Añadir a mi agenda" location="top">
                <template v-slot:activator="{ props }">
                  <v-btn
                    :disabled="isAlreadyAdded(item.cedula)"
                    icon
                    size="small"
                    @click="addContactToAgenda(item)"
                    v-bind="props"
                  >
                    <v-icon color="green">{{ isAlreadyAdded(item.cedula) ? 'mdi-check-circle' : 'mdi-plus-circle' }}</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </template>
          </v-data-table-server>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="detailsDialog" max-width="600px">
      <v-card>
        <v-toolbar color="blue" flat density="compact">
          <v-toolbar-title class="text-white">Detalles de Contacto</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon @click="closeDetailsDialog" color="white">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="py-4">
          <v-form ref="detailsForm">
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.cedula"
                  label="Cédula"
                  density="compact"
                  variant="outlined"
                  disabled
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.nombres"
                  label="Nombres"
                  density="compact"
                  variant="outlined"
                  disabled
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="editedItem.apellidos"
                  label="Apellidos"
                  density="compact"
                  variant="outlined"
                  disabled
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.cargo"
                  label="Cargo"
                  density="compact"
                  variant="outlined"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.empresa"
                  label="Empresa/Organización"
                  density="compact"
                  variant="outlined"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="editedItem.notas"
                  label="Notas"
                  rows="3"
                  density="compact"
                  variant="outlined"
                ></v-textarea>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="editedItem.fecha_nacimiento"
                  label="Fecha de Nacimiento"
                  type="date"
                  density="compact"
                  variant="outlined"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="editedItem.es_padre"
                  label="Es Padre"
                  density="compact"
                  color="primary"
                ></v-checkbox>
              </v-col>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="editedItem.es_madre"
                  label="Es Madre"
                  density="compact"
                  color="primary"
                ></v-checkbox>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn color="blue" variant="flat" @click="saveDetails">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="400px">
      <v-card>
        <v-toolbar color="red" flat density="compact">
          <v-toolbar-title class="text-white">Confirmar Eliminación</v-toolbar-title>
        </v-toolbar>
        <v-card-text class="py-4">
          ¿Estás seguro de que deseas eliminar a este contacto de tu agenda?
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn color="grey" @click="closeDeleteDialog">Cancelar</v-btn>
          <v-btn color="red" @click="deleteConfirmed">Eliminar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import apiClient from '@/api/axiosClient';
import { useAuthStore } from '@/stores/auth';
import { useSnackbar } from '@/composables/useSnackbar';
import { debounce } from 'lodash';
import { useCalendarEventsStore } from '@/stores/calendarEvents';

const { showSnackbar } = useSnackbar();
const authStore = useAuthStore();
const calendarEventsStore = useCalendarEventsStore();

const agendaData = ref([]);
const agendaCedulas = ref([]);
const totalItems = ref(0);
const loading = ref(false);
const sortBy = ref([]);
const search = ref('');

const addContactDialog = ref(false);
const generalContacts = ref([]);
const generalTotalItems = ref(0);
const generalLoading = ref(false);
const addSearch = ref('');
const generalHeaders = [
  { title: 'Cédula', key: 'cedula' },
  { title: 'Nombres', key: 'nombres' },
  { title: 'Apellidos', key: 'apellidos' },
  { title: 'Teléfonos', key: 'telefonos', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
];

const detailsDialog = ref(false);
const editedItem = ref({});
const originalItem = ref({});
const defaultItem = {
  cedula: '',
  nombres: '',
  apellidos: '',
  cargo: '',
  empresa: '',
  notas: '',
  fecha_nacimiento: '',
  es_padre: false,
  es_madre: false,
};

const deleteDialog = ref(false);
const itemToDelete = ref(null);

const headers = computed(() => {
  return [
    { title: 'Cédula', key: 'cedula' },
    { title: 'Nombres', key: 'nombres', sortable: true },
    { title: 'Apellidos', key: 'apellidos', sortable: true },
    { title: 'Teléfonos', key: 'telefonos', sortable: false },
    { title: 'Cargo', key: 'cargo', sortable: false },
    { title: 'Empresa', key: 'empresa', sortable: false },
    { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
  ];
});

const debouncedSearch = debounce(() => {
  // Cuando el valor de `search` cambia, el VDataTableServer lo detecta
  // y llama a `loadItems` automáticamente. No se necesita llamar directamente aquí.
  // El debounce simplemente retrasa la actualización de la variable `search`
  // para reducir las llamadas a la API.
}, 500);

// Observador para la variable de búsqueda que usa el debounce
watch(search, (newVal) => {
  debouncedSearch(newVal);
});

const loadItems = async ({ page, itemsPerPage, sortBy: vuetifySortBy }) => {
  loading.value = true;
  try {
    const params = {
      page: page,
      itemsPerPage: itemsPerPage,
      sortBy: JSON.stringify(vuetifySortBy),
      search: search.value,
    };
    const response = await apiClient.get('/private-agenda', { params });
    
    agendaData.value = response.data.items ?? [];
    totalItems.value = response.data.totalItems ?? 0;

  } catch (error) {
    console.error('Error al cargar la agenda privada:', error);
    showSnackbar('Error al cargar la agenda privada. Intenta de nuevo.', 'error');
    
    agendaData.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

const openAddContactDialog = async () => {
  addContactDialog.value = true;
  await fetchAgendaCedulas();
  generalContacts.value = [];
  generalTotalItems.value = 0;
  addSearch.value = '';
};

const closeAddContactDialog = () => {
  addContactDialog.value = false;
  addSearch.value = '';
};

const fetchAgendaCedulas = async () => {
  try {
    const response = await apiClient.get('/private-agenda/cedulas');
    agendaCedulas.value = response.data;
  } catch (error) {
    console.error('Error al cargar las cédulas de la agenda:', error);
  }
};

const isAlreadyAdded = (cedula) => {
  return agendaCedulas.value.includes(cedula);
};

const loadGeneralItems = async (options) => {
  const searchTerm = addSearch.value;

  if (!searchTerm || searchTerm.trim() === '') {
    generalContacts.value = [];
    generalTotalItems.value = 0;
    return;
  }
  
  generalLoading.value = true;
  try {
    const { page, itemsPerPage } = options;
    const response = await apiClient.get('/general', {
      params: {
        page: page,
        itemsPerPage: itemsPerPage,
        search: searchTerm,
      },
    });
    generalContacts.value = response.data.items;
    generalTotalItems.value = response.data.totalItems;
  } catch (error) {
    console.error('Error al cargar la guía telefónica general:', error);
  } finally {
    generalLoading.value = false;
  }
};

const addContactToAgenda = async (contact) => {
  try {
    const response = await apiClient.post('/private-agenda', {
      contactCedula: contact.cedula
    });
    if (response.status === 201) {
      showSnackbar('Contacto añadido a tu agenda con éxito.', 'success');
      await fetchAgendaCedulas();
      await loadItems({ page: 1, itemsPerPage: 10, sortBy: [] });
    }
  } catch (error) {
    console.error('Error al añadir el contacto:', error);
    showSnackbar('Error al añadir el contacto a la agenda.', 'error');
  }
};

const showDetails = (item) => {
  originalItem.value = JSON.parse(JSON.stringify(item));
  editedItem.value = Object.assign({}, defaultItem, item);
  
  if (editedItem.value.fecha_nacimiento) {
    editedItem.value.fecha_nacimiento = editedItem.value.fecha_nacimiento.split('T')[0];
  }
  
  detailsDialog.value = true;
};

const closeDetailsDialog = () => {
  detailsDialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  originalItem.value = {};
};

// Función auxiliar para calcular el tercer domingo de junio
const getThirdSundayInJune = (year) => {
  const juneFirst = new Date(year, 5, 1);
  const dayOfWeek = juneFirst.getDay();
  const firstSunday = dayOfWeek === 0 ? 1 : 1 + (7 - dayOfWeek);
  return new Date(year, 5, firstSunday + 14);
};

const saveDetails = async () => {
  try {
    const originalDateOfBirth = originalItem.value.fecha_nacimiento?.split('T')[0] || '';
    const originalIsFather = originalItem.value.es_padre || false;
    const originalIsMother = originalItem.value.es_madre || false;
    
    const updatedData = {
      cargo: editedItem.value.cargo,
      empresa: editedItem.value.empresa,
      notas: editedItem.value.notas,
      fechaNacimiento: editedItem.value.fecha_nacimiento,
      esPadre: editedItem.value.es_padre,
      esMadre: editedItem.value.es_madre,
    };
    
    const hasDateChanged = editedItem.value.fecha_nacimiento !== originalDateOfBirth;
    const hasFatherChanged = editedItem.value.es_padre !== originalIsFather;
    const hasMotherChanged = editedItem.value.es_madre !== originalIsMother;

    const response = await apiClient.put(`/private-agenda/${editedItem.value.cedula}`, updatedData);
    
    if (response.status === 200) {
      showSnackbar('Detalles actualizados con éxito.', 'success');
      
      // Sincronizar Aniversario
      if (editedItem.value.fecha_nacimiento && hasDateChanged) {
        const [year, month, day] = editedItem.value.fecha_nacimiento.split('-');
        const currentYear = new Date().getFullYear();
        const birthdayDate = `${currentYear}-${month}-${day}T00:00:00.000Z`;
        const eventId = `birthday-${editedItem.value.cedula}`;
        const eventData = {
          id: eventId,
          title: `Cumpleaños de ${editedItem.value.nombres} ${editedItem.value.apellidos}`,
          description: `Recordatorio de cumpleaños para ${editedItem.value.nombres} ${editedItem.value.apellidos}.`,
          date: birthdayDate,
          color: 'green',
          icon: 'mdi-cake-variant'
        };
        try {
          await apiClient.put('/private-agenda/events', eventData); 
          showSnackbar('Aniversario sincronizado con el calendario.', 'info');
        } catch (eventError) {
          console.error('Error al sincronizar el aniversario con el calendario:', eventError);
        }
      } else if (!editedItem.value.fecha_nacimiento && originalDateOfBirth) {
        const eventId = `birthday-${editedItem.value.cedula}`;
        try {
          await apiClient.delete(`/private-agenda/events/${eventId}`);
        } catch (eventError) {
          if (eventError.response && eventError.response.status === 404) {
            console.warn(`Intento de eliminar un evento no existente: ${eventId}`);
          } else {
            console.error('Error al intentar eliminar el evento de cumpleaños:', eventError);
          }
        }
      }

      // Sincronizar Día de la Madre
      if (editedItem.value.es_madre && hasMotherChanged) {
        const motherDayEvent = {
          id: `mother-day-${editedItem.value.cedula}`,
          title: `Día de la Madre de ${editedItem.value.nombres} ${editedItem.value.apellidos}`,
          description: `Recordatorio del Día de la Madre para ${editedItem.value.nombres} ${editedItem.value.apellidos}.`,
          date: `${new Date().getFullYear()}-05-15T00:00:00.000Z`,
          color: 'pink',
          icon: 'mdi-flower'
        };
        try {
          await apiClient.put('/private-agenda/events', motherDayEvent);
          showSnackbar('Evento del Día de la Madre agregado.', 'info');
        } catch (eventError) {
          console.error('Error al sincronizar el Día de la Madre:', eventError);
        }
      } else if (!editedItem.value.es_madre && originalIsMother) {
        const eventId = `mother-day-${editedItem.value.cedula}`;
        try {
          await apiClient.delete(`/private-agenda/events/${eventId}`);
        } catch (eventError) {
          if (eventError.response && eventError.response.status === 404) {
            console.warn(`Intento de eliminar un evento no existente: ${eventId}`);
          } else {
            console.error('Error al intentar eliminar el evento del Día de la Madre:', eventError);
          }
        }
      }

      // Sincronizar Día del Padre
      if (editedItem.value.es_padre && hasFatherChanged) {
        const fatherDayDate = getThirdSundayInJune(new Date().getFullYear());
        const formattedDate = fatherDayDate.toISOString();
        const fatherDayEvent = {
          id: `father-day-${editedItem.value.cedula}`,
          title: `Día del Padre de ${editedItem.value.nombres} ${editedItem.value.apellidos}`,
          description: `Recordatorio del Día del Padre para ${editedItem.value.nombres} ${editedItem.value.apellidos}.`,
          date: formattedDate,
          color: 'blue',
          icon: 'mdi-account-tie'
        };
        try {
          await apiClient.put('/private-agenda/events', fatherDayEvent);
          showSnackbar('Evento del Día del Padre agregado.', 'info');
        } catch (eventError) {
          console.error('Error al sincronizar el Día del Padre:', eventError);
        }
      } else if (!editedItem.value.es_padre && originalIsFather) {
        const eventId = `father-day-${editedItem.value.cedula}`;
        try {
          await apiClient.delete(`/private-agenda/events/${eventId}`);
        } catch (eventError) {
          if (eventError.response && eventError.response.status === 404) {
            console.warn(`Intento de eliminar un evento no existente: ${eventId}`);
          } else {
            console.error('Error al intentar eliminar el evento del Día del Padre:', eventError);
          }
        }
      }
      
      closeDetailsDialog();
      await loadItems({ page: 1, itemsPerPage: 10, sortBy: [] });
      await calendarEventsStore.fetchEvents();
    }
  } catch (error) {
    console.error('Error al guardar los detalles:', error);
    showSnackbar('Error al guardar los detalles del contacto.', 'error');
  }
};

const confirmDelete = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const closeDeleteDialog = () => {
  deleteDialog.value = false;
  itemToDelete.value = null;
};

const deleteConfirmed = async () => {
  const contactToDelete = itemToDelete.value;
  if (!contactToDelete) {
    return;
  }
  
  try {
    const response = await apiClient.delete(`/private-agenda/${contactToDelete.cedula}`);
    if (response.status === 200) {
      showSnackbar('Contacto eliminado de tu agenda.', 'success');
      
      const eventIdsToDelete = [
        `birthday-${contactToDelete.cedula}`,
        `mother-day-${contactToDelete.cedula}`,
        `father-day-${contactToDelete.cedula}`
      ];
      
      await Promise.all(eventIdsToDelete.map(async (eventId) => {
        try {
          await apiClient.delete(`/private-agenda/events/${eventId}`);
        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.warn(`No se pudo eliminar el evento ${eventId}, puede que ya no exista.`);
          } else {
            console.error(`Error al intentar eliminar el evento ${eventId}:`, error);
          }
        }
      }));
      
      await Promise.all([
        loadItems({ page: 1, itemsPerPage: 10, sortBy: [] }),
        calendarEventsStore.fetchEvents()
      ]);
    }
  } catch (error) {
    console.error('Error al eliminar el contacto:', error);
    showSnackbar('Error al eliminar el contacto de la agenda.', 'error');
  } finally {
    closeDeleteDialog();
  }
};

onMounted(() => {
  fetchAgendaCedulas();
});
</script>

<style scoped>
</style>
