<template>
  <v-container fluid class="pa-4">
    <v-card class="pa-6 rounded-xl shadow-lg">
      <div class="d-flex align-center justify-space-between">
        <v-card-title class="text-h5 font-weight-bold mb-0">
          Búsqueda Avanzada de Propiedades
        </v-card-title>
        <v-btn
          :icon="isFormCollapsed ? 'mdi-plus' : 'mdi-close'"
          color="primary"
          variant="flat"
          size="small"
          @click="toggleFormVisibility"
        ></v-btn>
      </div>

      <v-expand-transition>
        <div v-if="!isFormCollapsed">
          <v-card-text>
            <v-form ref="formRef" @keydown.enter.prevent="handleSearch">
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.tipoPropiedad"
                    :items="tiposPropiedad"
                    label="Tipo de Propiedad"
                    hint="Selecciona si buscas propiedades rurales o urbanas."
                    persistent-hint
                    clearable
                    @update:model-value="handleTipoPropiedadChange"
                  ></v-select>
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.departamento"
                    :items="departamentos"
                    item-title="depart"
                    item-value="cod_dep"
                    label="Departamento"
                    hint="Selecciona un departamento para filtrar las propiedades."
                    persistent-hint
                    clearable
                  ></v-select>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.ciudadValue"
                    :items="ciudades"
                    item-title="ciudad"
                    item-value="value"
                    label="Ciudad"
                    :disabled="!form.departamento"
                    :loading="loadingCities"
                    hint="Selecciona la ciudad dentro del departamento."
                    persistent-hint
                    clearable
                  ></v-select>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.padron_ccc"
                    :label="form.tipoPropiedad === 'Rural' ? 'Padrón' : 'CCC'"
                    prepend-inner-icon="mdi-map-marker-outline"
                    clearable
                  >
                    <v-tooltip activator="parent" location="top">
                      <span>Padrón: <strong>5234</strong> (Rural)<br />CCC:
                        <strong>26-15470-18</strong> (Urbano)</span>
                    </v-tooltip>
                  </v-text-field>
                </v-col>
              </v-row>
              <v-row v-if="form.tipoPropiedad === 'Rural'">
                <v-col cols="12" md="6">
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.has_min"
                        label="Hectáreas Mínimas"
                        type="number"
                        clearable
                        hint="Ej: 5 a 23 has"
                        persistent-hint
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.has_max"
                        label="Hectáreas Máximas"
                        type="number"
                        clearable
                        hint="Ej: 5 a 23 has"
                        persistent-hint
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-col>
              </v-row>
              <v-row v-if="form.tipoPropiedad === 'Urbana'">
                <v-col cols="12" md="6">
                  <v-row>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.m2_min"
                        label="m2 Mínimos"
                        type="number"
                        clearable
                        hint="Ej: 360 a 5000 m2"
                        persistent-hint
                      ></v-text-field>
                    </v-col>
                    <v-col cols="6">
                      <v-text-field
                        v-model="form.m2_max"
                        label="m2 Máximos"
                        type="number"
                        clearable
                        hint="Ej: 360 a 5000 m2"
                        persistent-hint
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center mt-4">
            <v-btn
              color="primary"
              class="ma-2 font-weight-bold"
              size="large"
              variant="elevated"
              @click="handleSearch"
              :disabled="!form.departamento || isLoading"
            >
              <v-icon start>mdi-magnify</v-icon>
              Buscar Propiedades
            </v-btn>

            <v-btn
              color="grey-darken-2"
              class="ma-2 font-weight-bold"
              size="large"
              variant="outlined"
              @click="clearForm"
              :disabled="isLoading"
            >
              <v-icon start>mdi-close</v-icon>
              Limpiar
            </v-btn>
            
            <!-- 🔑 NUEVO BOTÓN MAPA EN LAS ACCIONES DEL FORMULARIO -->
            <v-btn
              color="info"
              class="ma-2 font-weight-bold"
              size="large"
              variant="tonal"
              @click="vermapas"
            >
              <v-icon start>mdi-map</v-icon>
              Mapa
            </v-btn>
            
          </v-card-actions>
        </div>
      </v-expand-transition>
    </v-card>

    <v-card-text class="mt-8">
      <!-- Mantenemos los botones en la sección de la tabla, pero el botón principal
           "Ver Mapas" (que ahora es handleViewMaps) está también en el formulario. -->
      <div class="d-flex justify-end align-center mb-4">
        <v-btn
          :disabled="isGettingMaps"
          color="teal-darken-2"
          class="mx-2 font-weight-bold"
          variant="tonal"
          size="default"
          @click="handleGetMaps"
        >
          <v-icon start>mdi-map-search-outline</v-icon>
          {{ 'Obtener Mapas' }}
        </v-btn>
        
        <!-- El botón "Ver Mapas" se hace redundante aquí ya que lo movimos arriba,
             pero lo dejaremos para mantener la funcionalidad de la tabla. -->
        <v-btn
          color="blue-grey-darken-2"
          class="mx-2 font-weight-bold"
          variant="tonal"
          size="default"
          @click="handleViewMaps"
          :disabled="mapaStore.propiedadesMapa.length === 0"
        >
          <v-icon start>mdi-map-marker-radius</v-icon>
          Ver Mapas (Tabla)
        </v-btn>
      </div>

      <v-data-table-server
        :headers="headers"
        :items="propiedades"
        :items-length="totalPropiedades"
        :loading="isLoading"
        :items-per-page-options="itemsPerPageOptions"
        item-value="id"
        @update:options="handleTableUpdate"
      >
        <template #loading>
          <v-progress-linear color="primary" indeterminate></v-progress-linear>
        </template>
        <template #no-data>
          <div class="pa-4 text-center text-subtitle-1">Sin Datos</div>
        </template>

        <template #item.acciones="{ item }">
          <div class="d-flex align-center justify-center">
            <v-btn
              color="blue-darken-2"
              class="ma-1"
              size="small"
              @click="handleSearchCadastre(item)"
              :loading="loadingCadastre[item.id]"
              :disabled="loadingCadastre[item.id]"
              prepend-icon="mdi-database-search"
            >
              Buscar
            </v-btn>
            <v-btn
              v-if="item.geojson"
              icon
              size="small"
              color="green-darken-1"
              class="ma-1"
              @click="verMapaIndividual(item)"
            >
              <v-icon>mdi-map-marker</v-icon>
            </v-btn>
            <v-btn
              v-if="canEdit"
              color="green-darken-2"
              class="ma-1"
              size="small"
              @click="editItem(item)"
              :disabled="!item.cedula_propietario || item.cedula_propietario.includes(',')"
              prepend-icon="mdi-pencil"
            >
              Editar
            </v-btn>
          </div>
        </template>

        <template #item.telefonos_list="{ item }">
          <v-chip-group v-if="item.telefonos_list && item.telefonos_list.length > 0">
            <v-chip v-for="tel in item.telefonos_list" :key="tel" size="small" variant="tonal" color="blue-grey">
              {{ tel }}
            </v-chip>
          </v-chip-group>
          <span v-else class="text-caption text-grey-darken-1">Sin Datos</span>
        </template>
        </v-data-table-server>
    </v-card-text>

    <v-dialog v-model="showMap" max-width="1200px" fullscreen>
      <v-card class="d-flex flex-column pa-4 rounded-xl" style="height: 100%;">
        <v-card-title class="d-flex justify-space-between align-center">
          <div class="text-h6 font-weight-bold">Mapa de Propiedades</div>
          <v-btn icon @click="showMap = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text class="pa-0 flex-grow-1">
          <Mapa v-if="showMap" :properties="mapaStore.propiedadesMapa" />
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="dialog" max-width="500px">
      <v-card class="pa-4 rounded-xl">
        <v-card-title class="text-h6 text-center">
          Modificar Datos
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editingItem.propietario"
            label="Propietario/s"
            :rules="[v => !!v || 'Campo requerido']"
          ></v-text-field>
          <v-text-field
            v-model="editingItem.cedula"
            label="Cédula/s"
            :rules="[v => !!v || 'Campo requerido']"
          ></v-text-field>
          <v-text-field
            v-model="editingItem.telefono"
            label="Teléfono"
            :rules="[v => !!v || 'Campo requerido']"
          ></v-text-field>
        </v-card-text>
        <v-card-actions class="justify-center">
          <v-btn
            color="primary"
            class="rounded-lg"
            @click="saveEditedItem"
          >
            Guardar
          </v-btn>
          <v-btn
            color="grey-darken-2"
            class="rounded-lg"
            @click="dialog = false"
          >
            Cancelar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCatastroStore } from '../stores/catastro';
// Importamos el store del mapa.js para centralizar la gestión de datos del mapa.
import { useMapaStore } from '../stores/mapa';
import Mapa from './Mapa.vue';

// === PROPS ===
const props = defineProps({
  canEdit: {
    type: Boolean,
    default: false,
  },
});

// === PINIA STORE ===
const store = useCatastroStore();
// Obtenemos el store del mapa para interactuar con su estado.
const mapaStore = useMapaStore();
const {
  departamentos,
  ciudades,
  propiedades,
  totalPropiedades,
  isLoading,
  loadingCities,
  loadingCadastre,
  error,
} = storeToRefs(store);

// 🔑 AÑADIDO: Destructuramos los estados necesarios para el botón de mapas
const {
  isGettingMaps,
} = storeToRefs(mapaStore);


// === ESTADO LOCAL DEL COMPONENTE ===
const isFormCollapsed = ref(false);

const form = reactive({
  tipoPropiedad: 'Rural',
  departamento: null,
  ciudad: null,
  ciudadValue: null,
  padron_ccc: null,
  has_min: null,
  has_max: null,
  m2_min: null,
  m2_max: null,
});

const tiposPropiedad = ref(['Rural', 'Urbana']);
const lastOptions = ref({ page: 1, itemsPerPage: 10, sortBy: [] });

// 🚀 AÑADIDO: Opciones para limitar la paginación a solo 10 registros
const itemsPerPageOptions = [
  { value: 10, title: '10' }
];

// ✅ HEADER RURAL CORREGIDO: Usando 'telefonos_list'
const ruralHeaders = [
  { title: 'Departamento', key: 'cod_dep' },
  { title: 'Ciudad', key: 'cod_ciu' },
  { title: 'Padrón', key: 'padron' },
  { title: 'Hectáreas', key: 'has' },
  { title: 'Propietario/s', key: 'propietario_completo' },
  { title: 'Cédula/s', key: 'cedula_propietario' },
  { title: 'Teléfono', key: 'telefonos_list' }, // <-- MODIFICADO
  { title: 'Acciones', key: 'acciones', sortable: false },
];

// ✅ HEADER URBANO CORREGIDO: Usando 'telefonos_list'
const urbanaHeaders = [
  { title: 'Departamento', key: 'cod_dep' },
  { title: 'Ciudad', key: 'cod_ciu' },
  { title: 'Zona', key: 'zona' },
  { title: 'Manzana', key: 'manzana' },
  { title: 'Lote', key: 'lote' },
  { title: 'mts2', key: 'mts2' },
  { title: 'Propietario/s', key: 'propietario_completo' },
  { title: 'Cédula/s', key: 'cedula_propietario' },
  { title: 'Teléfono', key: 'telefonos_list' }, // <-- MODIFICADO
  { title: 'Acciones', key: 'acciones', sortable: false },
];

const headers = ref(ruralHeaders);
const dialog = ref(false);
const editingItem = reactive({
  id: null,
  propietario: '',
  cedula: '',
  telefono: '',
});

// Nueva gestión del estado del snackbar
const snackbar = reactive({
  show: false,
  message: '',
  color: '',
  timeout: 3000,
});

const showSnackbar = (message, color = 'info') => {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
};

// === LÓGICA DEL MAPA ===
const showMap = ref(false);

// === MÉTODOS Y ACCIONES ===

const toggleFormVisibility = () => {
  isFormCollapsed.value = !isFormCollapsed.value;
};

const handleTipoPropiedadChange = () => {
  headers.value = form.tipoPropiedad === 'Rural' ? ruralHeaders : urbanaHeaders;
  if (form.tipoPropiedad === 'Rural') {
    form.m2_min = null;
    form.m2_max = null;
  } else {
    form.has_min = null;
    form.has_max = null;
  }
};

const handleSearch = () => {
  store.searchProperties(form, lastOptions.value);
  isFormCollapsed.value = true;
};

const handleTableUpdate = (options) => {
  if (!form.departamento && !form.padron_ccc) {
    store.propiedades = [];
    store.totalPropiedades = 0;
    return;
  }
  lastOptions.value = options;
  store.searchProperties(form, options);
};

const clearForm = () => {
  form.departamento = null;
  form.ciudad = null;
  form.ciudadValue = null;
  form.padron_ccc = null;
  form.has_min = null;
  form.has_max = null;
  form.m2_min = null;
  form.m2_max = null;
  store.ciudades = [];
  store.propiedades = [];
  store.totalPropiedades = 0;
  showMap.value = false;
  isFormCollapsed.value = false;
  // Al limpiar el formulario, también limpiamos los datos en el store del mapa.
  mapaStore.setPropiedadesMapa([]);
};

const handleSearchCadastre = async (item) => {
  showSnackbar('Consultando API de Catastro...', 'info');
  const result = await store.searchCadastre(item, form.tipoPropiedad);
  showSnackbar(result.message, result.success ? 'success' : 'error');
};

const editItem = (item) => {
  editingItem.id = item.cedula_propietario;
  editingItem.propietario = item.propietario_completo;
  editingItem.cedula = item.cedula_propietario;
  editingItem.telefono = item.telefono;
  dialog.value = true;
};

const handleGetMaps = async () => {
  showSnackbar('Obteniendo datos geográficos...', 'info');
  // Llama a la función del mapaStore para obtener los geojson.
  const result = await mapaStore.getMapsForFilteredProperties(propiedades.value);
  showSnackbar(result.message, result.success ? 'success' : 'error');
};

const handleViewMaps = () => {
  // Verifica los datos del mapa directamente en el store de Pinia.
  if (mapaStore.propiedadesMapa.length > 0) {
    showMap.value = true;
  } else {
    showSnackbar('No hay propiedades con coordenadas para mostrar en el mapa. Intente usar "Obtener Mapas".', 'warning');
  }
};
const vermapas = () => {
  // 🚀 ¡Activación directa y sin restricciones!
  showMap.value = true;
};
const saveEditedItem = async () => {
  const result = await store.updateGeneralData(editingItem.cedula, {
    nombres: editingItem.propietario,
    telefono: editingItem.telefono,
  });
  if (result.success) {
    showSnackbar(result.message, 'success');
    await store.searchProperties(form, lastOptions.value);
    dialog.value = false;
  } else {
    showSnackbar(result.message, 'error');
  }
};
// === WATCHERS ===
watch(() => form.departamento, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    store.fetchCiudades(newValue);
  }
});
watch(() => form.ciudadValue, (newValue) => {
  if (newValue) {
    const city = store.ciudades.find(c => c.value === newValue);
    if (city) {
      form.ciudad = city.cod_ciu;
    }
  } else {
    form.ciudad = null;
  }
});
// Este watcher es clave: escucha los cambios en las propiedades y actualiza el mapaStore
watch(propiedades, (newPropiedades) => {
  if (newPropiedades) {
    const propertiesWithGeojson = newPropiedades.filter(item => item.geojson);
    const mappedProperties = propertiesWithGeojson.map(item => ({
      ...item,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lng),
      geojson: item.geojson,
    }));
    // Se llama al store del mapa (mapa.js) para establecer los nuevos datos
    mapaStore.setPropiedadesMapa(mappedProperties);
  } else {
    mapaStore.setPropiedadesMapa([]);
  }
}, { deep: true });
const verMapaIndividual = (item) => {
  if (item.geojson) {
    // Al igual que el watcher, esta función llama al store del mapa con un solo item.
    mapaStore.setPropiedadesMapa([{
      ...item,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lng),
      geojson: item.geojson,
    }]);
    showMap.value = true;
  } else {
    showSnackbar('Esta propiedad no tiene datos geográficos para mostrar.', 'warning');
  }
};
// === CICLO DE VIDA ===
onMounted(() => {
  store.fetchDepartamentos();
});
</script>
<style scoped>
/* Estilos para una apariencia más moderna y unificada */
.rounded-xl {
  border-radius: 20px;
}
.shadow-lg {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
</style>
