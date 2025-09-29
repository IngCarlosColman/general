<route lang="json">
{
  "meta": {
    "requiresAuth": true,
    "roles": ["administrador"]
  }
}
</route>

<template>
  <v-container fluid class="pa-4">
    <v-card class="pa-6 rounded-xl shadow-lg elevation-8">
      <v-card-title class="text-h4 font-weight-black mb-4 text-primary">
        Gestión de Solicitudes de Activación
      </v-card-title>
      <v-card-subtitle class="text-subtitle-1 mb-6">
        Revisión y activación de cuentas con comprobantes de pago pendientes.
      </v-card-subtitle>

      <v-divider class="mb-6"></v-divider>

      <!-- Botón de recarga y spinner -->
      <v-row align="center" justify="end" class="mb-4">
        <v-col cols="auto">
          <v-btn
            color="secondary"
            :loading="store.isLoadingRequests"
            @click="store.fetchPendingRequests"
            prepend-icon="mdi-refresh"
          >
            Recargar Solicitudes ({{ store.pendingRequests.length }})
          </v-btn>
        </v-col>
      </v-row>

      <!-- Mensaje si no hay solicitudes -->
      <v-alert
        v-if="!store.isLoadingRequests && store.pendingRequests.length === 0"
        type="info"
        variant="tonal"
        class="mb-6"
      >
        <v-icon icon="mdi-check-all" class="mr-2"></v-icon>
        ¡Todo limpio! No hay solicitudes de activación pendientes de revisión.
      </v-alert>

      <!-- Tabla de Solicitudes Pendientes -->
      <v-data-table
        v-if="store.pendingRequests.length > 0"
        :headers="headers"
        :items="store.pendingRequests"
        :loading="store.isLoadingRequests"
        class="elevation-3 rounded-lg"
        loading-text="Cargando solicitudes..."
        no-data-text="No hay solicitudes pendientes."
      >
        <template v-slot:item.fecha_solicitud="{ item }">
          {{ formatDate(item.fecha_solicitud) }}
        </template>

        <template v-slot:item.monto_transferido="{ item }">
          <v-chip color="success" class="font-weight-bold">
            {{ formatCurrency(item.monto_transferido) }}
          </v-chip>
        </template>
        
        <template v-slot:item.comprobante_path="{ item }">
          <v-btn 
            color="info" 
            variant="flat" 
            size="small"
            :href="getComprobanteUrl(item.comprobante_path)" 
            target="_blank"
            prepend-icon="mdi-download"
          >
            Ver
          </v-btn>
        </template>

        <template v-slot:item.actions="{ item }">
          <v-btn
            color="success"
            icon="mdi-check-circle-outline"
            size="small"
            class="mr-2"
            :loading="store.isProcessingAction"
            @click="confirmAction(item.id, 'approve')"
            title="Aprobar Solicitud"
          ></v-btn>

          <v-btn
            color="error"
            icon="mdi-close-circle-outline"
            size="small"
            :loading="store.isProcessingAction"
            @click="confirmAction(item.id, 'reject')"
            title="Rechazar Solicitud"
          ></v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- Diálogo de Confirmación (Reemplaza alert()) -->
    <v-dialog v-model="showConfirmDialog" max-width="450">
      <v-card rounded="xl" class="pa-4">
        <v-card-title class="text-h6 text-warning d-flex align-center">
          <v-icon left size="28" class="mr-2">mdi-alert-octagon</v-icon>
          Confirmar Acción
        </v-card-title>
        <v-card-text>
          ¿Está seguro de que desea **{{ actionType === 'approve' ? 'APROBAR' : 'RECHAZAR' }}** la solicitud ID **{{ actionId }}**?<br>
          Esta acción es irreversible y actualizará el estado del usuario.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey-darken-1" variant="text" @click="showConfirmDialog = false">
            Cancelar
          </v-btn>
          <v-btn 
            :color="actionType === 'approve' ? 'success' : 'error'" 
            variant="flat" 
            @click="processAction"
          >
            Sí, {{ actionType === 'approve' ? 'Aprobar' : 'Rechazar' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAdminSubscriptionStore } from '@/stores/admin.subscription';
import { useAuthStore } from '@/stores/auth';

const store = useAdminSubscriptionStore();
const authStore = useAuthStore(); // Usado para obtener el rol, aunque el router ya lo verifica

// === Manejo de Diálogo de Confirmación ===
const showConfirmDialog = ref(false);
const actionId = ref(null);
const actionType = ref(''); // 'approve' o 'reject'

/**
 * Muestra el diálogo de confirmación antes de ejecutar la acción.
 * @param {number} id - ID de la solicitud.
 * @param {string} type - Tipo de acción ('approve' o 'reject').
 */
const confirmAction = (id, type) => {
    actionId.value = id;
    actionType.value = type;
    showConfirmDialog.value = true;
};

/**
 * Procesa la acción confirmada (Aprobar/Rechazar).
 */
const processAction = async () => {
    showConfirmDialog.value = false;
    // Llamar a la acción del store
    await store.handleRequestAction(actionId.value, actionType.value);
};

// === Funciones de Utilidad ===

/**
 * Formatea una fecha ISO a un formato más legible.
 * @param {string} isoDate - Fecha en formato ISO.
 */
const formatDate = (isoDate) => {
    if (!isoDate) return 'N/A';
    // Crea un objeto Date
    const date = new Date(isoDate);
    // Opciones de formato (ej: 25/09/2025)
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return date.toLocaleDateString('es-ES', options);
};

/**
 * Formatea un número como moneda. (Implementación básica local)
 * NOTA: Es mejor centralizar esto en un composable/store si se usa en muchos lugares.
 * @param {number} value - El monto.
 */
const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return '₲ 0';
    return `₲ ${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(value)}`;
};

/**
 * Construye la URL de descarga del comprobante.
 * @param {string} path - Ruta relativa al archivo (ej: '/uploads/proofs/...')
 */
const getComprobanteUrl = (path) => {
    // CLAVE: Asegúrate de que esta URL coincida con la configuración de tu backend
    // y que el backend sirva correctamente los archivos estáticos en esa ruta.
    return path; // Si el backend ya devuelve la URL completa
    // return `http://localhost:3000${path}`; // Si necesitas prefijar la base URL del backend
};

// === Configuración de la Tabla ===

const headers = [
    { title: 'ID Solicitud', key: 'id', align: 'start', sortable: true },
    { title: 'Usuario ID', key: 'id_usuario', sortable: true },
    { title: 'Plan Solicitado', key: 'plan_id', sortable: true },
    { title: 'Monto Reportado', key: 'monto_transferido', sortable: true, align: 'end' },
    { title: 'Fecha Solicitud', key: 'fecha_solicitud', sortable: true },
    { title: 'Comprobante', key: 'comprobante_path', sortable: false, align: 'center' },
    { title: 'Acciones', key: 'actions', sortable: false, align: 'center' },
];

// === Ciclo de Vida ===

onMounted(() => {
    // Al cargar el componente, cargamos las solicitudes
    store.fetchPendingRequests();
});
</script>

<style scoped>
.subscription-container {
    max-width: 1400px;
    margin: 20px auto;
}

/* Estilo para las tarjetas en la tabla */
.v-card-title {
    color: #1976D2; /* Color principal */
}

/* Ajuste para el estilo del data-table */
.elevation-3 {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !important;
}
</style>
