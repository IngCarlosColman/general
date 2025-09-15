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
          @input="performSearch"
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
import { ref, computed, onMounted } from 'vue';
import apiClient from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useSnackbar } from '@/composables/useSnackbar';
import { debounce } from 'lodash';
// Importa el nuevo store que creaste en el paso 1
import { useCalendarEventsStore } from '@/stores/calendarEvents';

const { showSnackbar } = useSnackbar();
const authStore = useAuthStore();
// Crea una instancia del store de eventos
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
const originalDateOfBirth = ref(''); 
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

const performSearch = debounce(() => {
  loadItems({ page: 1, itemsPerPage: 10, sortBy: sortBy.value });
}, 500);

const openAddContactDialog = async () => {
  addContactDialog.value = true;
  await fetchAgendaCedulas();
  generalContacts.value = [];
  generalTotalItems.value = 0;
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
  if (!options.search || options.search.trim() === '') {
    generalContacts.value = [];
    generalTotalItems.value = 0;
    return;
  }
  
  generalLoading.value = true;
  try {
    const { page, itemsPerPage, search: generalSearch = '' } = options;
    const response = await apiClient.get('/general', {
      params: {
        page: page,
        itemsPerPage: itemsPerPage,
        search: generalSearch,
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
  editedItem.value = Object.assign({}, defaultItem, item);
  
  // Convertir el formato ISO 8601 a YYYY-MM-DD para el input type="date"
  if (editedItem.value.fecha_nacimiento) {
    editedItem.value.fecha_nacimiento = editedItem.value.fecha_nacimiento.split('T')[0];
  }
  
  // Almacenar la fecha original para comparación
  originalDateOfBirth.value = editedItem.value.fecha_nacimiento;

  detailsDialog.value = true;
};

const closeDetailsDialog = () => {
  detailsDialog.value = false;
  editedItem.value = Object.assign({}, defaultItem);
  originalDateOfBirth.value = '';
};

const saveDetails = async () => {
  try {
    const updatedData = {
      cargo: editedItem.value.cargo,
      empresa: editedItem.value.empresa,
      notas: editedItem.value.notas,
      fechaNacimiento: editedItem.value.fecha_nacimiento,
      esPadre: editedItem.value.es_padre,
      esMadre: editedItem.value.es_madre,
    };
    
    // Verificar si la fecha de nacimiento cambió antes de hacer la solicitud PUT
    let hasDateChanged = editedItem.value.fecha_nacimiento !== originalDateOfBirth.value;

    const response = await apiClient.put(`/private-agenda/${editedItem.value.cedula}`, updatedData);
    if (response.status === 200) {
      showSnackbar('Detalles actualizados con éxito.', 'success');
      closeDetailsDialog();
      await loadItems({ page: 1, itemsPerPage: 10, sortBy: [] });

      // Sincronizar el aniversario SOLO si la fecha de nacimiento ha cambiado
      if (editedItem.value.fecha_nacimiento && hasDateChanged) {
        const [year, month, day] = editedItem.value.fecha_nacimiento.split('-');
        const currentYear = new Date().getFullYear();
        const birthdayDate = `${currentYear}-${month}-${day}T00:00:00.000Z`;
        const birthdayTitle = `Cumpleaños de ${editedItem.value.nombres} ${editedItem.value.apellidos}`;
        const eventId = `birthday-${editedItem.value.cedula}-${year}-${month}-${day}`;

        const eventData = {
          id: eventId,
          title: birthdayTitle,
          description: `Recordatorio de cumpleaños para ${editedItem.value.nombres} ${editedItem.value.apellidos}.`,
          date: birthdayDate,
          color: 'green',
          icon: 'mdi-cake-variant'
        };

        try {
          await apiClient.put('/private-agenda/events', eventData);
          showSnackbar('Aniversario agregado al calendario.', 'info');
          
          // Llama a la acción del store para recargar los eventos
          await calendarEventsStore.fetchEvents();

        } catch (eventError) {
          console.error('Error al sincronizar el aniversario con el calendario:', eventError);
        }
      }
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
  if (!itemToDelete.value) return;
  try {
    const response = await apiClient.delete(`/private-agenda/${itemToDelete.value.cedula}`);
    if (response.status === 200) {
      showSnackbar('Contacto eliminado de tu agenda.', 'success');
      closeDeleteDialog();
      await fetchAgendaCedulas();
      await loadItems({ page: 1, itemsPerPage: 10, sortBy: [] });
      
      // Llama a la acción del store después de eliminar un contacto para mantener la consistencia
      await calendarEventsStore.fetchEvents();
    }
  } catch (error) {
    console.error('Error al eliminar el contacto:', error);
    showSnackbar('Error al eliminar el contacto de la agenda.', 'error');
  }
};

onMounted(() => {
  fetchAgendaCedulas();
});
</script>

<style scoped>
</style>