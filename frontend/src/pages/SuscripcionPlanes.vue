<template>
  <v-container fluid class="pa-4 subscription-container">
    <v-card class="pa-6 rounded-xl shadow-lg elevation-8 bg-white">
      <v-card-title class="text-h4 font-weight-black text-center mb-4 text-primary">
        ¡Bienvenido! Active su Licencia
      </v-card-title>
      <v-card-text>
        <p class="text-center text-subtitle-1 mb-6 text-medium-emphasis">
          Para comenzar a utilizar nuestra plataforma, seleccione un plan y suba su comprobante de pago para la activación. Su rol actual es: 
          <v-chip 
            :color="getRoleColor(authStore.rol)" 
            class="font-weight-bold ml-2"
          >
            {{ authStore.rol.toUpperCase() }}
          </v-chip>
        </p>

        <v-divider class="mb-6"></v-divider>

        <!-- 🟢 CONDICIÓN PRINCIPAL: SI EL ROL ES PENDIENTE_REVISION, MUESTRA ALERTA -->
        <v-alert
            v-if="authStore.rol === 'PENDIENTE_REVISION'"
            type="info"
            icon="mdi-clock-time-four-outline"
            title="Solicitud de Activación en Curso"
            class="mb-8"
            variant="tonal"
            prominent
        >
            <p class="text-body-1 font-weight-medium">
                ¡Gracias por enviar su comprobante de pago!
            </p>
            <p class="mt-2">
                Su cuenta ha sido marcada como **PENDIENTE DE REVISIÓN**. Un administrador está verificando la validez del pago y activará su plan en breve. Le notificaremos tan pronto como el proceso se complete.
            </p>
        </v-alert>

        <!-- 🔴 CONTENIDO NORMAL DE PLANES Y SUBIDA: SOLO SE MUESTRA SI NO ESTÁ PENDIENTE DE REVISIÓN -->
        <div v-else>
            <!-- Sección de Planes Agrupados -->
            <h2 class="text-h5 font-weight-bold mb-4">1. Elija su Plan</h2>
            
            <div v-for="planCategory in store.plans" :key="planCategory.id" class="mb-10">
                <h3 class="text-h6 font-weight-bold mb-4 text-secondary">{{ planCategory.name }} <span class="text-medium-emphasis text-body-2">- {{ planCategory.description }}</span></h3>
                
                <v-row>
                    <!-- Opciones de Plan dentro de la Categoría -->
                    <v-col v-for="option in planCategory.options" :key="option.option_id" cols="12" md="4">
                        <v-card
                            class="plan-card"
                            :class="{ 'plan-card-selected': selectedPlan === option.option_id }"
                            @click="selectedPlan = option.option_id"
                            :color="selectedPlan === option.option_id ? 'blue-lighten-5' : 'grey-lighten-4'"
                            hover
                            min-height="300"
                        >
                            <v-card-text class="d-flex flex-column justify-space-between h-100">
                                <div>
                                    <h4 class="text-h5 font-weight-bold mb-3 text-primary">{{ option.name }}</h4>
                                    
                                    <div class="mb-3">
                                        <p class="text-caption text-medium-emphasis">Costo Unitario Mensual (Equivalente):</p>
                                        <p class="text-h6 font-weight-black text-success">{{ store.formatCurrency(option.guaranies_unitario) }}</p>
                                    </div>

                                    <div class="mb-4">
                                        <p class="text-caption text-medium-emphasis">Total (Pago Único):</p>
                                        <p class="text-h5 font-weight-black text-blue-darken-3">{{ store.formatCurrency(option.guaranies_total) }}</p>
                                    </div>
                                    
                                    <v-chip 
                                        v-if="option.ahorro !== 'Sin descuento'"
                                        color="green" 
                                        variant="flat" 
                                        density="comfortable" 
                                        class="mb-3 font-weight-bold"
                                    >
                                        ¡Ahorra {{ option.ahorro }}!
                                    </v-chip>
                                </div>

                                <!-- Lista de Características -->
                                <v-list density="compact" class="bg-transparent mt-3">
                                    <v-list-item v-for="(feature, i) in option.features" :key="i" class="pa-0">
                                        <template v-slot:prepend>
                                            <v-icon color="success" size="small" class="mr-2">mdi-check-circle</v-icon>
                                        </template>
                                        <v-list-item-title class="text-body-2">{{ feature }}</v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </div>

            <v-divider class="mb-6"></v-divider>

            <!-- Sección de Subida de Comprobante -->
            <h2 class="text-h5 font-weight-bold mb-4">2. Suba su Comprobante de Pago</h2>

            <v-form @submit.prevent="handleSubmitProof">
                <v-file-input
                    v-model="comprobanteFile"
                    label="Comprobante de Pago (PDF o Imagen)"
                    accept="image/*,application/pdf"
                    prepend-icon="mdi-camera"
                    :rules="[v => !!v || 'Debe subir el comprobante.']"
                    variant="outlined"
                    class="mb-4"
                ></v-file-input>

                <v-alert
                    v-if="store.uploadError"
                    type="error"
                    icon="mdi-alert-circle"
                    class="mb-4"
                    density="compact"
                >{{ store.uploadError }}</v-alert>

                <v-alert
                    v-if="store.uploadSuccess"
                    type="success"
                    icon="mdi-check-circle"
                    class="mb-4"
                    density="compact"
                >{{ store.userMessage }}</v-alert>

                <v-btn
                    type="submit"
                    color="primary"
                    size="large"
                    block
                    :loading="store.isUploading"
                    :disabled="!selectedPlan || !comprobanteFile || store.isUploading"
                    class="font-weight-bold text-white"
                >
                    <v-icon left>mdi-upload</v-icon>
                    Enviar Comprobante y Solicitar Activación
                </v-btn>
            </v-form>
        </div>
        <!-- 👆 FIN DE CONTENIDO CONDICIONAL -->


        <v-divider class="my-6"></v-divider>
        <div class="text-center text-medium-emphasis text-caption">
            * El precio unitario es el equivalente mensual del costo total, aplicado el descuento por volumen/frecuencia.
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useSuscripcionStore } from '@/stores/suscripcion';
import { useAuthStore } from '@/stores/auth';

const store = useSuscripcionStore();
const authStore = useAuthStore();
const selectedPlan = ref(null);
const comprobanteFile = ref(null);


/**
 * 🟢 Función auxiliar para dar color a los roles en el chip.
 * @param {string} rol - El rol actual del usuario.
 * @returns {string} - El color de Vuetify.
 */
const getRoleColor = (rol) => {
    switch (rol) {
        case 'administrador':
            return 'red';
        case 'editor':
            return 'success';
        case 'visualizador':
            return 'blue';
        case 'PENDIENTE_REVISION':
            return 'info'; // Color para el nuevo estado
        default:
            return 'warning'; // PENDIENTE_PAGO o guest
    }
}


/**
 * Maneja el envío del formulario.
 */
const handleSubmitProof = async () => {
    store.uploadError = null; // Limpiar errores antes de intentar
    store.uploadSuccess = false; // Limpiar éxito previo
    
    // Si ya está PENDIENTE_REVISION, evitamos cualquier acción.
    if (authStore.rol === 'PENDIENTE_REVISION') {
        store.uploadError = 'Su solicitud ya está en revisión. Por favor, espere la activación.';
        return;
    }

    if (!selectedPlan.value) {
        store.uploadError = 'Por favor, seleccione un plan.';
        return;
    }

    // El comprobanteFile puede ser un FileList (si se usa directamente) o un array de Files (v-model en Vuetify)
    const file = Array.isArray(comprobanteFile.value) && comprobanteFile.value.length > 0
        ? comprobanteFile.value[0]
        : comprobanteFile.value;

    if (!file) {
        store.uploadError = 'Debe seleccionar un archivo.';
        return;
    }

    // Llamada a la acción del store
    const result = await store.submitPaymentProof(selectedPlan.value, file);

    // Si la subida fue exitosa, limpiamos el campo. El rol de authStore se actualiza 
    // dentro de submitPaymentProof (vía authStore.fetchUser), lo que hará que el componente 
    // se re-renderice y muestre la alerta de PENDIENTE_REVISION.
    if (result.success) {
        // Limpiamos el campo de archivo y la selección para una interfaz limpia
        comprobanteFile.value = null; 
        selectedPlan.value = null; 
    }
};

</script>

<style scoped>
/* Contenedor centralizado y con padding */
.subscription-container {
    max-width: 1200px;
    margin: 20px auto;
}
.plan-card {
    border: 3px solid transparent;
    transition: all 0.3s ease-in-out;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    height: 100%; /* Asegura que todas las tarjetas tengan la misma altura */
}
.plan-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
}
.plan-card-selected {
    border-color: #1976D2 !important; /* Color primario de Vuetify */
    box-shadow: 0 0 15px rgba(25, 118, 210, 0.5) !important;
}

/* Fuerza el 100% de altura en el contenido de la tarjeta */
.v-card-text.h-100 {
    height: 100%;
}
</style>
