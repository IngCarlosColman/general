<template>
    <v-container fluid class="pa-4 panel-dashboard">
    <h1 class="text-h4 font-weight-bold mb-6 text-primary">
      Panel de Control Principal
    </h1>

    <v-row class="mb-4" v-if="!isLoadingKpis">
      <v-col cols="12" sm="6" md="3">
        <KpiCard
          title="Propiedades Totales"
          :value="kpis.totalPropiedades.toLocaleString()"
          icon="mdi-map-marker-multiple"
          color="deep-purple-accent-3"
        />
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <KpiCard
          title="Contactos en Guía Teléfonica"
          :value="kpis.registrosGuiaTotal.toLocaleString()"
          icon="mdi-account-details-outline"
          color="blue-accent-3"
        />
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <KpiCard
          title="Catastro Pendiente"
          :value="catastroPendienteCalculado.toLocaleString()"
          icon="mdi-alert-box-outline"
          color="orange-darken-1"
          subtext="Registros sin vínculo propietario"
        />
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <KpiCard
          title="Cobertura GEOJSON"
          :value="coberturaGeojsonPorcentaje + '%'"
          icon="mdi-map-check"
          color="green-darken-1"
          :subtext="`${kpis.propiedadesConGeojson.toLocaleString()} de ${kpis.totalPropiedades.toLocaleString()}`"
        />
      </v-col>
    </v-row>

    <v-row class="mt-4" v-if="!isLoadingKpis">
      <v-col cols="12" md="4">
        <v-card
          title="Cobertura Telefónica General"
          subtitle="Registros con teléfono en la Guía"
          elevation="4"
          rounded="lg"
          class="h-100"
        >
          <v-card-text class="text-center">
            <div class="py-4">
              <v-progress-circular
                :model-value="coberturaTelefonoPorcentaje"
                size="180"
                width="20"
                color="blue-accent-3"
              >
                <div class="d-flex flex-column align-center">
                  <span class="text-h4 font-weight-bold">{{ coberturaTelefonoPorcentaje }}%</span>
                  <span class="text-subtitle-1 text-medium-emphasis">Completo</span>
                </div>
              </v-progress-circular>
            </div>
            <p class="mt-4 text-body-2 text-medium-emphasis">
              {{ kpis.registrosGuiaConTelefono.toLocaleString() }} contactos con teléfono registrado.
            </p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-card
          title="Top 5 Registros por Usuario"
          subtitle="Propiedades registradas (Rurales vs. Urbanas)"
          elevation="4"
          rounded="lg"
          class="h-100"
        >
          <v-card-text>
            <v-list density="compact" class="pa-0">
              <v-list-item
                v-for="item in top5FuncionariosCobertura"
                :key="item.nombre"
                class="mb-3"
              >
                <v-list-item-title class="font-weight-medium mb-1 d-flex justify-space-between">
                  <span>
                    {{ item.nombre }}
                    <v-chip size="small" :color="getCoverageColor(item.porcentaje)">{{ item.porcentaje }}% Rural</v-chip>
                  </span>
                  <span class="text-caption">
                    Urbanas: {{ item.propiedadesUrbanas.toLocaleString() }} | Total: {{ item.total.toLocaleString() }}
                  </span>
                </v-list-item-title>
                <v-progress-linear
                  :model-value="item.porcentaje"
                  :color="getCoverageColor(item.porcentaje)"
                  height="12"
                  rounded
                ></v-progress-linear>
              </v-list-item>

              <v-list-item v-if="top5FuncionariosCobertura.length > 0" class="text-center text-medium-emphasis text-caption py-2">
                * Mostrando los {{ top5FuncionariosCobertura.length }} usuarios con más registros.
              </v-list-item>

            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4" v-if="!isLoadingKpis">
      <v-col cols="12" md="6">
        <v-card title="Distribución de Propiedades" elevation="4" rounded="lg">
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <h3 class="text-subtitle-1 mb-2 font-weight-medium">Rural vs. Urbana</h3>
                <div class="bg-surface-light d-flex align-center justify-center rounded-lg pa-4" style="height: 200px;">
                  <v-progress-circular
                    :model-value="(distribucionCatastro.urbana / (distribucionCatastro.urbana + distribucionCatastro.rural)) * 100"
                    size="150"
                    width="15"
                    color="teal"
                    class="mr-4"
                  >
                    <span class="text-caption">Urbana: {{ distribucionCatastro.urbana.toLocaleString() }}</span>
                  </v-progress-circular>
                  <v-progress-circular
                    :model-value="(distribucionCatastro.rural / (distribucionCatastro.urbana + distribucionCatastro.rural)) * 100"
                    size="150"
                    width="15"
                    color="deep-purple"
                    rotate="180"
                  >
                    <span class="text-caption">Rural: {{ distribucionCatastro.rural.toLocaleString() }}</span>
                  </v-progress-circular>
                </div>
              </v-col>
              <v-col cols="12" sm="6">
                <h3 class="text-subtitle-1 mb-2 font-weight-medium">Top 5 Departamentos</h3>
                <div class="bg-surface-light rounded-lg pa-4">
                  <v-list density="compact">
                    <v-list-item
                      v-for="dep in distribucionCatastro.topDepartamentos"
                      :key="dep.name"
                      class="py-1"
                    >
                      <v-list-item-title class="text-caption">{{ dep.name }} ({{ dep.count.toLocaleString() }})</v-list-item-title>
                      <v-progress-linear
                        :model-value="(dep.count / distribucionCatastro.topDepartamentos[0].count) * 100"
                        color="blue"
                        height="8"
                        rounded
                      ></v-progress-linear>
                    </v-list-item>
                  </v-list>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card title="Tareas de Intervención Urgente" elevation="4" rounded="lg" class="h-100">
          <v-list lines="two" density="compact" class="pa-0">
            <v-list-item
              v-for="(item, index) in urgentTasks"
              :key="index"
              :prepend-icon="item.icon"
              :title="item.title"
              :subtitle="item.subtitle"
              :base-color="item.color"

              @click="$emit('change-view', item.link.name.toLowerCase(), item.link.query)"

              link
            >
              <template v-slot:append>
                <v-btn icon="mdi-arrow-right" variant="text" size="small" :color="item.color"></v-btn>
              </template>
            </v-list-item>
            <v-list-item v-if="urgentTasks.length === 0" class="text-center text-medium-emphasis">
              <v-icon color="success" class="mr-2">mdi-check-circle-outline</v-icon> ¡No hay tareas pendientes importantes!
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, defineEmits, onMounted } from 'vue';
import { useDashboardStore } from '@/stores/dashboard';
import { storeToRefs } from 'pinia';
import KpiCard from '@/components/KpiCard.vue';


// === SETUP ===

const emit = defineEmits(['change-view']);

// 1. Inicializar Store y desestructurar variables reactivas
const dashboardStore = useDashboardStore();
const {
  kpis,
  // ❌ Se elimina funcionariosCobertura de storeToRefs
  distribucionCatastro,
  isLoadingKpis,
  isLoadingDetails
} = storeToRefs(dashboardStore);

// 2. Acceder a Getters (ya son computed)
const coberturaGeojsonPorcentaje = dashboardStore.coberturaGeojsonPorcentaje;
const coberturaTelefonoPorcentaje = dashboardStore.coberturaTelefonoPorcentaje;
const catastroPendienteCalculado = dashboardStore.catastroPendienteCalculado;

// 🎯 SOLUCIÓN: Acceder al getter del Top 5 directamente desde el store
// Nota: Pinia getters se convierten en referencias (Refs) reactivas cuando se accede a ellas desde el script setup.
const top5FuncionariosCobertura = dashboardStore.top5FuncionariosCobertura;


// 3. Cargar datos al montar el componente
onMounted(() => {
  dashboardStore.loadDashboardData();
});


// === FUNCIONES LOCALES ===

// Función auxiliar para colores de barras de progreso
const getCoverageColor = (porcentaje) => {
  if (porcentaje >= 80) return 'teal';
  if (porcentaje >= 60) return 'blue';
  if (porcentaje >= 40) return 'orange';
  return 'red';
};

// Tareas Urgentes (Ahora usan los datos REALES del store)
const urgentTasks = computed(() => {
  const tasks = [];

  // Cálculo de Registros sin Teléfono
  const totalGuia = kpis.value.registrosGuiaTotal;
  const conTel = kpis.value.registrosGuiaConTelefono;
  const sinTelefonoCount = totalGuia - conTel;

  // Catastro Pendiente (Usando el valor CALCULADO)
  const catastroPendienteCount = catastroPendienteCalculado.value;

  // 1. Tarea: Catastro Pendiente
  if (catastroPendienteCount > 0) {
    tasks.push({
      title: 'Catastro Pendiente de Vínculo',
      subtitle: `Revisar los ${catastroPendienteCount.toLocaleString()} registros sin vincular a propiedad.`,
      icon: 'mdi-alert-box-outline',
      color: 'red-darken-1',
      // Asumiendo que esta acción redirige a una vista de 'General' filtrada
      link: { name: 'General', query: { filter: 'sin-vinculo-catastral' } }
    });
  }

  // 2. Tarea: Contactos sin Teléfono
  if (sinTelefonoCount > 0) {
    tasks.push({
      title: 'Contactos sin Teléfono',
      subtitle: `Revisar ${sinTelefonoCount.toLocaleString()} registros de la Guía sin contacto telefónico.`,
      icon: 'mdi-phone-alert',
      color: 'orange-darken-1',
      link: { name: 'General', query: { filter: 'sin-telefono' } }
    });
  }

  // 3. Tarea: Posibles Duplicados (Stub, ya que no tenemos KPI de backend para esto)
  tasks.push({
    title: 'Posibles Duplicados (Análisis Pendiente)',
    subtitle: 'Revisar 35 registros con cédula o padrón duplicado (DATO FICTICIO)',
    icon: 'mdi-content-copy',
    color: 'yellow-darken-2',
    link: { name: 'General', query: { filter: 'duplicados' } }
  });

  return tasks;
});
</script>

<style scoped>
.panel-dashboard .v-card {
  transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
}

.panel-dashboard .v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1) !important;
}

.v-list-item {
  /* Separador entre elementos de la lista */
  border-bottom: 1px solid rgba(var(--v-theme-surface-variant), 0.1);
}
.v-list-item:last-child {
  border-bottom: none;
}
</style>