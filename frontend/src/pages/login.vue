<template>
  <v-container
    fluid
    class="pa-0 fill-height login-background d-flex justify-center align-center"
    :style="{'--login-bg-image': loginBgImage}"
  >
    <!-- Contenedor centralizado para mejor visualización en desktop y móvil -->
    <v-card
      class="pa-6 pa-sm-8 elevation-12 login-card"
      width="90%"
      max-width="400"
    >
      <div class="text-center mb-6">
        <v-icon size="64" color="white" class="mb-2">mdi-alpha-t-circle-outline</v-icon>
        <h2 class="text-h4 font-weight-bold text-white">Iniciar Sesión</h2>
        <p class="text-subtitle-1 text-medium-emphasis mt-2">Accede a tu cuenta de Tarsus</p>
      </div>

      <v-form @submit.prevent="handleLogin" ref="formRef">
        <!-- Campo Email -->
        <v-text-field
          v-model="email"
          label="Correo Electrónico"
          prepend-inner-icon="mdi-email-outline"
          :rules="emailRules"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <!-- Campo Contraseña -->
        <v-text-field
          v-model="password"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          :type="showPassword ? 'text' : 'password'"
          label="Contraseña"
          prepend-inner-icon="mdi-lock-outline"
          :rules="passwordRules"
          required
          variant="outlined"
          @click:append-inner="showPassword = !showPassword"
          class="mb-6"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <!-- Mensaje de Error (si existe) -->
        <v-alert
            v-if="authStore.authError"
            type="error"
            density="compact"
            class="mb-4"
        >
            {{ authStore.authError }}
        </v-alert>


        <!-- Botón de Login -->
        <v-btn
          color="primary"
          block
          size="large"
          type="submit"
          :loading="authStore.isLoading"
          class="text-none font-weight-bold"
        >
          Entrar
        </v-btn>
      </v-form>

      <v-divider class="my-6"></v-divider>

      <!-- Enlace a Registro -->
      <div class="text-center">
        <router-link to="/register" class="text-white text-decoration-none">
          ¿No tienes una cuenta? <span class="font-weight-bold text-primary">Regístrate aquí</span>
        </router-link>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSnackbar } from '@/composables/useSnackbar'; // Importar el composable de notificaciones

// Configuración y variables
const router = useRouter();
const authStore = useAuthStore();
const { showSnackbar } = useSnackbar(); // Hook para notificaciones
const formRef = ref(null); // Referencia al formulario para validación
const email = ref('');
const password = ref('');
const showPassword = ref(false);

// Estilos de fondo (usando una imagen de placeholder y degradado oscuro)
const loginBgImage = 'url(https://placehold.co/1920x1080/0d1117/30363d?text=Fondo+Login)';

// Reglas de Validación
const emailRules = [
  v => !!v || 'El correo es obligatorio.',
  v => /.+@.+\..+/.test(v) || 'El correo debe ser válido.',
];
const passwordRules = [
  v => !!v || 'La contraseña es obligatoria.',
];

/**
 * Maneja el envío del formulario de inicio de sesión.
 */
const handleLogin = async () => {
  // Resetear el error antes de intentar
  authStore.authError = null;

  // Validar el formulario
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  try {
    // 🔑 Llamada al action del store (incluye el setToken, carga de usuario y el splash screen)
    await authStore.login(email.value, password.value);
    
    // Si la llamada no lanza error, el inicio de sesión fue exitoso
    showSnackbar('Inicio de sesión exitoso. Redirigiendo...', 'success');
    
    // La redirección a /dashboard la maneja el action del store (ver auth.js)
  } catch (error) {
    // El error ya está en authStore.authError
    // Mostrar el error en un snackbar también
    showSnackbar(authStore.authError || 'Error desconocido al iniciar sesión.', 'error');
  }
};
</script>

<style scoped>
.fill-height {
  /* Asegura que el contenedor ocupe toda la altura de la vista */
  height: 100vh;
}

.login-background {
  /* Fondo estilizado con imagen y un overlay oscuro */
  position: relative;
  background-image: var(--login-bg-image);
  background-size: cover;
  background-position: center;
  background-color: #000;
  overflow: hidden;
  z-index: 0;
}

.login-background::before {
  /* Overlay oscuro para mejorar la legibilidad del texto */
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7); /* Oscurecer el fondo */
  z-index: 1;
}

.login-card {
  /* Estilo de tarjeta con transparencia y desenfoque (vidrio esmerilado) */
  background-color: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 2; /* Asegura que la tarjeta esté sobre el overlay */
  border-radius: 20px;
}

/* Forzar el color de texto a blanco dentro de la tarjeta para mejor contraste */
.login-card :deep(.v-label),
.login-card :deep(.v-input__control),
.login-card :deep(.v-icon) {
  color: white !important;
  opacity: 1;
}
</style>
