<template>
  <!-- Contenedor Fullscreen y centrado -->
  <v-container
    fluid
    class="unauthorized-splash fill-height pa-0 d-flex flex-column justify-center align-center"
  >
    <!-- Card principal con el mensaje -->
    <v-card
      class="pa-8 elevation-12 rounded-xl text-center unauthorized-card"
      width="100%"
      max-width="500"
    >
      <v-icon size="96" :color="iconColor" class="mb-4">{{ iconName }}</v-icon>
      
      <v-card-title class="text-h4 font-weight-bold mb-2" :class="`text-${iconColor}`">
        {{ cardTitle }}
      </v-card-title>

      <v-card-text class="text-subtitle-1 text-medium-emphasis">
        <p class="mb-4">
          Tu rol actual (<v-chip :color="iconColor" size="small" class="font-weight-bold">{{ authStore.rol }}</v-chip>) no tiene permisos para acceder a este recurso.
        </p>
        <p class="mb-6">
          {{ cardMessage }}
        </p>

        <!-- Indicador de Redirección -->
        <div class="d-flex align-center justify-center my-4">
          <v-progress-circular
            :model-value="progressValue"
            :rotate="360"
            :size="48"
            :width="6"
            color="primary"
            class="mr-3"
          >{{ timeRemaining }}s</v-progress-circular>
          <span class="font-weight-medium">Redirigiendo a <span class="text-primary">{{ redirectionTargetName }}</span>...</span>
        </div>
      </v-card-text>
      
      <v-card-actions class="justify-center">
        <v-btn
          color="primary"
          variant="flat"
          @click="redirectToHome"
        >
          Ir a {{ redirectionTargetName }} ahora
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

// Duración total del splash en segundos
const SPLASH_DURATION = 7; 
const timeRemaining = ref(SPLASH_DURATION);
const progressValue = ref(0);
let timer = null;

// --- Lógica de redirección inteligente basada en el rol ---

const isPendingUser = computed(() => {
    const role = authStore.rol;
    return role === 'PENDIENTE_PAGO' || role === 'PENDIENTE_REVISION';
});

const redirectionTargetRoute = computed(() => {
    return isPendingUser.value ? '/suscripcion' : '/dashboard';
});

const redirectionTargetName = computed(() => {
    return isPendingUser.value ? 'Gestor de Suscripción' : 'Página de Inicio';
});

const cardTitle = computed(() => {
    return isPendingUser.value ? 'Suscripción Pendiente' : 'Acceso No Autorizado';
});

const iconName = computed(() => {
    return isPendingUser.value ? 'mdi-credit-card-clock-outline' : 'mdi-lock-alert';
});

const iconColor = computed(() => {
    return isPendingUser.value ? 'warning' : 'error';
});

const cardMessage = computed(() => {
    if (authStore.rol === 'PENDIENTE_PAGO') {
        return 'Para habilitar tu cuenta, por favor, completa la información de pago y sube el comprobante en la página de Suscripción.';
    }
    if (authStore.rol === 'PENDIENTE_REVISION') {
        return 'Tu comprobante de pago ha sido recibido y está siendo revisado por el administrador. Serás notificado una vez que la cuenta sea habilitada.';
    }
    return 'Si esperas la habilitación de tu cuenta, por favor, aguarda la verificación del pago de tu suscripción y la habilitación por parte del administrador.';
});


// Redirige a la ruta determinada
const redirectToHome = () => {
    router.push(redirectionTargetRoute.value);
};

const startTimer = () => {
    // Calcula cuánto debe avanzar el progreso por milisegundo
    const intervalTime = 100; // Actualizar cada 100ms
    let startTime = Date.now();

    timer = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        
        // Actualiza el tiempo restante (entero)
        timeRemaining.value = SPLASH_DURATION - Math.floor(elapsedTime);
        
        // Actualiza el progreso (de 0 a 100)
        progressValue.value = (elapsedTime / SPLASH_DURATION) * 100;
        
        if (elapsedTime >= SPLASH_DURATION) {
            clearInterval(timer);
            progressValue.value = 100; // Aseguramos que llegue al 100%
            redirectToHome();
        }
    }, intervalTime);
};

onMounted(() => {
    startTimer();
});

onUnmounted(() => {
    // Limpieza: Asegurar que el temporizador se detenga al salir del componente
    if (timer) {
        clearInterval(timer);
    }
});
</script>

<style scoped>
.unauthorized-splash {
  /* Fondo oscuro similar a un modal o splash para captar la atención */
  background-color: #f5f5f5; /* Un fondo gris claro para contraste */
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999; /* Asegura que esté por encima de todo */
  /* Animación suave al aparecer */
  animation: fadeIn 0.5s ease-out;
}

.unauthorized-card {
  background-color: white !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
  /* El borde se define por la lógica del computed color */
  border-left: 8px solid; 
  transition: border-left-color 0.3s;
}
.unauthorized-card .text-error {
    color: #FF5252 !important;
}
.unauthorized-card .text-warning {
    color: #FB8C00 !important;
}

/* Estilos dinámicos para el borde de la tarjeta */
.unauthorized-card .v-card-title.text-error { border-left-color: #FF5252; }
.unauthorized-card .v-card-title.text-warning { border-left-color: #FB8C00; }


@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
