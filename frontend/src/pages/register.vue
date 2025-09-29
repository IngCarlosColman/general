<template>
  <v-container
    fluid
    class="pa-0 fill-height login-background d-flex justify-center align-center"
    :style="{'--login-bg-image': loginBgImage}"
  >
    <!-- Contenedor centralizado y adaptado a móvil -->
    <v-card
      class="pa-6 pa-sm-8 elevation-12 login-card"
      width="90%"
      max-width="600"
    >
      <div class="text-center mb-6">
        <v-icon size="64" color="white" class="mb-2">mdi-alpha-t-circle-outline</v-icon>
        <h2 class="text-h4 font-weight-bold text-white">Registro de Usuario</h2>
        <p class="text-subtitle-1 text-medium-emphasis mt-2">Crea tu cuenta para empezar</p>
      </div>

      <v-form @submit.prevent="handleRegister" ref="formRef">
        <v-row>
          <!-- Fila 1: Username y Email -->
          <v-col cols="12" md="6">
            <v-text-field
              v-model="username"
              label="Nombre de usuario"
              prepend-inner-icon="mdi-account-circle-outline"
              :rules="usernameRules"
              required
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="email"
              label="Correo Electrónico"
              prepend-inner-icon="mdi-email-outline"
              :rules="emailRules"
              required
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>

          <!-- Fila 2: Nombre y Apellido -->
          <v-col cols="12" md="6">
            <v-text-field
              v-model="first_name"
              label="Nombre"
              prepend-inner-icon="mdi-account-circle"
              :rules="requiredRule"
              required
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="last_name"
              label="Apellido"
              prepend-inner-icon="mdi-account-circle"
              :rules="requiredRule"
              required
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>

          <!-- Fila 3: Contraseña y Confirmación -->
          <v-col cols="12" md="6">
            <v-text-field
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              label="Contraseña"
              prepend-inner-icon="mdi-lock-outline"
              :rules="passwordRules"
              required
              variant="outlined"
              @click:append-inner="showPassword = !showPassword"
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="passwordConfirm"
              :type="showPassword ? 'text' : 'password'"
              label="Confirmar Contraseña"
              prepend-inner-icon="mdi-lock-check-outline"
              :rules="passwordConfirmRules"
              required
              variant="outlined"
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>

          <!-- Fila 4: Teléfono y Dirección -->
          <v-col cols="12" md="6">
            <v-text-field
              v-model="telefono"
              label="Teléfono"
              prepend-inner-icon="mdi-phone-outline"
              variant="outlined"
              :rules="requiredRule"
              required
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="direccion"
              label="Dirección"
              prepend-inner-icon="mdi-map-marker-outline"
              variant="outlined"
              :rules="requiredRule"
              required
              bg-color="rgba(255, 255, 255, 0.1)"
              color="white"
              dark
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- Mensaje de Error (si existe) -->
        <v-alert
            v-if="authStore.authError"
            type="error"
            density="compact"
            class="mb-4"
        >
            {{ authStore.authError }}
        </v-alert>

        <v-btn
          color="success"
          block
          size="large"
          type="submit"
          :loading="authStore.isLoading"
          class="text-none font-weight-bold mt-4"
        >
          Crear Cuenta
        </v-btn>
      </v-form>

      <v-divider class="my-6"></v-divider>

      <!-- Enlace a Login -->
      <div class="text-center">
        <router-link to="/login" class="text-white text-decoration-none">
          ¿Ya tienes una cuenta? <span class="font-weight-bold text-primary">Iniciar Sesión</span>
        </router-link>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSnackbar } from '@/composables/useSnackbar'; // Importar composable

const router = useRouter();
const authStore = useAuthStore();
const { showSnackbar } = useSnackbar();
const formRef = ref(null);

const username = ref('');
const email = ref('');
const password = ref('');
const passwordConfirm = ref('');
const first_name = ref('');
const last_name = ref('');
const telefono = ref('');
const direccion = ref('');
const showPassword = ref(false);

const loginBgImage = 'url(https://placehold.co/1920x1080/0d1117/30363d?text=Fondo+Registro)';


// --- Reglas de Validación ---
const requiredRule = [v => !!v || 'Campo obligatorio.'];
const usernameRules = [
  ...requiredRule,
  v => (v && v.length >= 3) || 'Mínimo 3 caracteres.',
];
const emailRules = [
  ...requiredRule,
  v => /.+@.+\..+/.test(v) || 'El correo debe ser válido.',
];
const passwordRules = [
  ...requiredRule,
  v => (v && v.length >= 8) || 'Mínimo 8 caracteres.',
];
const passwordConfirmRules = computed(() => [
  ...requiredRule,
  v => v === password.value || 'Las contraseñas no coinciden.',
]);

/**
 * Maneja el envío del formulario de registro.
 */
const handleRegister = async () => {
  // Resetear el error antes de intentar
  authStore.authError = null;

  // 1. Validar el formulario
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  try {
    // 2. Llamada al store para registrar
    await authStore.register({
      username: username.value,
      email: email.value,
      password: password.value,
      first_name: first_name.value,
      last_name: last_name.value,
      telefono: telefono.value,
      direccion: direccion.value,
    });
    
    // 3. Éxito: Mostrar snackbar y redirigir
    showSnackbar('Registro exitoso. ¡Ahora puedes iniciar sesión!', 'success');
    router.push('/login');

  } catch (error) {
    // 4. Fallo: Mostrar error en snackbar
    console.error('Fallo de registro:', error);
    showSnackbar(authStore.authError || 'Error desconocido al registrar. Intenta de nuevo.', 'error');
  }
};
</script>

<style scoped>
.fill-height {
  height: 100vh;
}

.login-background {
  position: relative;
  background-image: var(--login-bg-image);
  background-size: cover;
  background-position: center;
  background-color: #000;
  overflow: auto; /* Permite scroll si el contenido es más largo que la pantalla (útil en móvil) */
  z-index: 0;
  padding: 40px 0; /* Padding para que la tarjeta no pegue arriba y abajo */
}

.login-background::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 1;
}

.login-card {
  background-color: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 2;
  border-radius: 20px;
}

.login-card :deep(.v-label),
.login-card :deep(.v-input__control),
.login-card :deep(.v-icon) {
  color: white !important;
  opacity: 1;
}
</style>
