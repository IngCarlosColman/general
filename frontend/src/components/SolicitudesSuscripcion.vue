<template>
  <v-container fluid class="pa-4">
    <v-card class="pa-6 rounded-xl shadow-lg elevation-8">
      <v-card-title class="text-h4 font-weight-black mb-4 text-primary">
        Gestión de Solicitudes de Suscripción
      </v-card-title>
      <v-card-text>
        <p class="mb-6">
          Revisa y gestiona los comprobantes de pago subidos por los usuarios para activar su licencia.
        </p>

        <v-data-table
          :headers="headers"
          :items="pendingRequests"
          :loading="isLoading"
          item-key="id"
          no-data-text="No hay solicitudes pendientes de revisión."
          loading-text="Cargando solicitudes..."
          class="elevation-1"
        >
          <!-- Slot personalizado para el campo 'username' -->
          <template v-slot:item.username="{ item }">
            <v-chip color="info" size="small">{{ item.username }}</v-chip>
          </template>

          <!-- Slot personalizado para el campo 'monto_transferido' -->
          <template v-slot:item.monto_transferido="{ item }">
            <span class="font-weight-bold">{{ item.monto_transferido }} $</span>
          </template>
          
          <!-- Slot personalizado para el campo 'comprobante_path' -->
          <template v-slot:item.comprobante_path="{ item }">
            <v-btn
              variant="flat"
              color="primary"
              size="small"
              icon="mdi-file-eye-outline"
              @click="openComprobante(item.comprobanteUrl)"
              title="Ver Comprobante"
            ></v-btn>
          </template>

          <!-- Slot personalizado para las acciones -->
          <template v-slot:item.actions="{ item }">
            <v-btn
              color="success"
              class="mr-2"
              size="small"
              :disabled="isProcessingAction"
              @click="handleAction(item.id, 'approve')"
            >
              Aprobar
            </v-btn>
            <v-btn
              color="error"
              size="small"
              :disabled="isProcessingAction"
              @click="handleAction(item.id, 'reject')"
            >
              Rechazar
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
    
    <!-- Modal para visualización del comprobante -->
    <v-dialog v-model="showImageModal" max-width="800">
      <v-card>
        <v-card-title class="text-h6">
          Comprobante de Pago
          <v-btn icon="mdi-close" variant="text" @click="showImageModal = false" class="float-right"></v-btn>
        </v-card-title>
        <v-card-text>
          <v-img :src="currentComprobanteUrl" max-height="700" contain></v-img>
        </v-card-text>
      </v-card>
    </v-dialog>

  </v-container>
</template>

<style scoped>
/* Estilos adicionales si fueran necesarios */
</style>
<script setup>
import { ref, onMounted } from 'vue';
import api from '@/api/axiosClient';
import { useSnackbar } from '@/composables/useSnackbar';
import { useRouter } from 'vue-router';

// Metadata de la ruta para el guardián de roles
definePageMeta({
  requiresAuth: true,
  roles: ['administrador'], // Solo el administrador puede acceder
});

const { showSnackbar } = useSnackbar();
const router = useRouter();

const pendingRequests = ref([]);
const isLoading = ref(true);
const isProcessingAction = ref(false);
const showImageModal = ref(false);
const currentComprobanteUrl = ref('');

// Definición de las columnas de la tabla
const headers = [
  { title: 'ID Solicitud', key: 'id', align: 'start' },
  { title: 'Usuario', key: 'username' },
  { title: 'Plan Solicitado', key: 'plan_id' },
  { title: 'Monto Reportado', key: 'monto_transferido', align: 'end' },
  { title: 'Comprobante', key: 'comprobante_path', align: 'center', sortable: false },
  { title: 'Fecha de Subida', key: 'fecha_subida' },
  { title: 'Acciones', key: 'actions', align: 'center', sortable: false },
];

/**
 * Carga las solicitudes pendientes del backend.
 */
const fetchPendingRequests = async () => {
  isLoading.value = true;
  try {
    // La ruta está definida en subscription.routes.js
    const response = await api.get('/subscription/admin/pending-requests');
    // Mapeamos los datos para mejorar la visualización en la tabla
    pendingRequests.value = response.data.requests.map(req => ({
      ...req,
      // Formateo de fecha simple
      fecha_subida: new Date(req.fecha_subida).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
      // Asume que el comprobante_path contiene solo el nombre del archivo
      comprobanteUrl: `${import.meta.env.VITE_BACKEND_URL}/uploads/${req.comprobante_path}`
    }));
  } catch (error) {
    showSnackbar('Error al cargar las solicitudes: ' + (error.response?.data?.error || error.message), 'error');
    console.error('Error fetching pending requests:', error);
  } finally {
    isLoading.value = false;
  }
};

/**
 * Muestra el modal para visualizar el comprobante.
 * @param {string} url - URL completa del comprobante.
 */
const openComprobante = (url) => {
  currentComprobanteUrl.value = url;
  showImageModal.value = true;
};

/**
 * Maneja la acción de aprobar o rechazar una solicitud.
 * @param {number} requestId - ID de la solicitud.
 * @param {string} action - 'approve' o 'reject'.
 */
const handleAction = async (requestId, action) => {
  if (isProcessingAction.value) return;
  isProcessingAction.value = true;

  try {
    const endpoint = `/subscription/admin/${action}/${requestId}`;
    const response = await api.post(endpoint);

    // Muestra la notificación de éxito
    showSnackbar(response.data.message || `Solicitud ${action === 'approve' ? 'aprobada' : 'rechazada'} con éxito.`, 'success');

    // Refresca la lista de solicitudes pendientes
    await fetchPendingRequests();

  } catch (error) {
    showSnackbar('Error al procesar la acción: ' + (error.response?.data?.error || error.message), 'error');
    console.error(`Error al procesar ${action} para solicitud ${requestId}:`, error);
  } finally {
    isProcessingAction.value = false;
  }
};

onMounted(fetchPendingRequests);
</script>
