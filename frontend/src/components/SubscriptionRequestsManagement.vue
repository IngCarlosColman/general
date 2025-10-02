<template>
  <v-container fluid class="pa-4">
    <v-card class="pa-6 rounded-xl shadow-lg elevation-8">
      <v-card-title class="text-h4 font-weight-black mb-4 text-primary">
        Gestión de Solicitudes de Suscripción
      </v-card-title>
      <v-card-text>
        <p class="mb-6">
          Revisa y gestiona los comprobantes de pago subidos por los usuarios con rol <v-chip color="warning" size="small">PENDIENTE_REVISION</v-chip>.
        </p>
        <v-data-table
          :headers="headers"
          :items="mappedPendingRequests"
          :loading="adminStore.isLoadingRequests"
          item-key="id"
          no-data-text="No hay solicitudes pendientes de revisión."
          loading-text="Cargando solicitudes..."
          class="elevation-1"
        >
          <template v-slot:item.username="{ item }">
            <v-chip color="info" size="small">{{ item.username }}</v-chip>
          </template>
          <template v-slot:item.plan_solicitado="{ item }">
            <v-chip color="secondary" size="small" class="font-weight-bold">{{ item.plan_solicitado }}</v-chip>
          </template>
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
          <template v-slot:item.actions="{ item }">
            <v-btn
              color="success"
              class="mr-2"
              size="small"
              :disabled="adminStore.isProcessingAction"
              @click="handleAction(item.id, 'approve')"
            >
              Aprobar
            </v-btn>
            <v-btn
              color="error"
              size="small"
              :disabled="adminStore.isProcessingAction"
              @click="handleAction(item.id, 'reject')"
            >
              Rechazar
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-dialog v-model="showImageModal" max-width="800">
      <v-card>
        <v-card-title class="text-h6">
          Comprobante de Pago
          <v-btn icon="mdi-close" variant="text" @click="showImageModal = false" class="float-right"></v-btn>
        </v-card-title>
        <v-card-text>
          <template v-if="isPdf">
            <VuePdfEmbed
              :source="currentComprobanteUrl"
              :height="700"
              class="pdf-viewer"
            />
          </template>
          <template v-else>
            <v-img :src="currentComprobanteUrl" max-height="700" contain></v-img>
          </template>
          <div class="text-center mt-4">
            <v-btn
              color="info"
              :href="currentComprobanteUrl"
              target="_blank"
              download
              prepend-icon="mdi-download"
            >
              Descargar Comprobante ({{ isPdf ? 'PDF' : 'Imagen' }})
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useSnackbar } from '@/composables/useSnackbar';
import { useAdminSubscriptionStore } from '@/stores/admin.subscription';
import VuePdfEmbed from 'vue-pdf-embed';
const { showSnackbar } = useSnackbar();
const adminStore = useAdminSubscriptionStore();
const showImageModal = ref(false);
const currentComprobanteUrl = ref('');
// Definición de las columnas de la tabla
const headers = [
    { title: 'ID Solicitud', key: 'id', align: 'start' },
    { title: 'Usuario', key: 'username' },
    { title: 'Plan Solicitado', key: 'plan_solicitado' },
    { title: 'Comprobante', key: 'comprobante_path', align: 'center', sortable: false },
    { title: 'Fecha Solicitud', key: 'fecha_solicitud_formatted' },
    { title: 'Acciones', key: 'actions', align: 'center', sortable: false },
];
/**
 * @computed mappedPendingRequests
 * @description Transforma los datos brutos del store para su uso en la v-data-table y construye la URL correctamente.
 */
const mappedPendingRequests = computed(() => {
    if (!adminStore.pendingRequests || adminStore.pendingRequests.length === 0) {
        return [];
    }

    // 1. SOLUCIÓN CRÍTICA: Usa un valor de respaldo si la variable de entorno no se carga.
    // Usamos el puerto 8000 (el puerto de tu Express) como fallback.
    const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    // 2. Limpia la base URL de barras finales si existen (previene doble barra).
    const cleanBaseUrl = baseUrl.endsWith('/')
                           ? baseUrl.slice(0, -1)
                           : baseUrl;

    return adminStore.pendingRequests.map(req => {

        // 3. Limpia la ruta de la DB de barras iniciales (previene doble barra).
        const cleanPath = req.ruta_comprobante.startsWith('/')
                           ? req.ruta_comprobante.substring(1)
                           : req.ruta_comprobante;

        return {
            ...req,
            username: `${req.first_name} ${req.last_name}`,
            fecha_solicitud_formatted: new Date(req.fecha_solicitud).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),

            // 4. CONCATENACIÓN ROBUSTA: une la base limpia, una sola barra, y la ruta limpia.
            comprobanteUrl: `${cleanBaseUrl}/${cleanPath}`
        };
    });
});
/**
 * @computed isPdf
 * @description Determina si la URL actual apunta a un archivo PDF.
 */
const isPdf = computed(() => {
    if (!currentComprobanteUrl.value) return false;
    // Verifica si la URL termina con la extensión .pdf (ignorando mayúsculas/minúsculas)
    return currentComprobanteUrl.value.toLowerCase().endsWith('.pdf');
});
const openComprobante = (url) => {
    currentComprobanteUrl.value = url;
    showImageModal.value = true;
};
const handleAction = async (requestId, action) => {
    if (adminStore.isProcessingAction) return;
    // Convertir la acción a mayúsculas para que coincida con el controlador
    const actionUpper = action.toUpperCase();
    try {
        await adminStore.handleRequestAction(requestId, actionUpper);
    } catch (error) {
        console.error(`Error al procesar ${actionUpper} para solicitud ${requestId}:`, error);
    }
};
onMounted(() => {
    adminStore.fetchPendingRequests();
});
</script>
<style scoped>
/* Estilo opcional para el visor PDF si necesitas un desplazamiento específico */
.pdf-viewer {
    max-height: 700px;
    overflow-y: auto;
    border: 1px solid #ccc;
    padding: 5px;
}
</style>

