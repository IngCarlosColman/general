<template>
  <v-container
    fluid
    class="pa-0 fill-height login-background d-flex justify-center align-center"
    :style="{'--login-bg-image': loginBgImage}"
  >
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
        <v-alert
            v-if="authStore.authError"
            type="error"
            density="compact"
            class="mb-4"
        >
            {{ authStore.authError }}
        </v-alert>
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
import { useSnackbar } from '@/composables/useSnackbar'; 
const router = useRouter();
const authStore = useAuthStore();
const { showSnackbar } = useSnackbar(); 
const formRef = ref(null); 
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loginBgImage = 'url(https://placehold.co/1920x1080/0d1117/30363d?text=Fondo+Login)';
const emailRules = [
  v => !!v || 'El correo es obligatorio.',
  v => /.+@.+\..+/.test(v) || 'El correo debe ser válido.',
];
const passwordRules = [
  v => !!v || 'La contraseña es obligatoria.',
];
const handleLogin = async () => {
  authStore.authError = null;
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  try {
    await authStore.login(email.value, password.value);
    showSnackbar('Inicio de sesión exitoso. Redirigiendo...', 'success');
    const userRol = authStore.rol;
    let targetPath = '/dashboard'; 
    if (userRol === 'PENDIENTE_PAGO' || userRol === 'PENDIENTE_REVISION') {

    }
    await router.push(targetPath);
  } catch (error) {
    showSnackbar(authStore.authError || 'Error desconocido al iniciar sesión.', 'error');
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
  overflow: hidden;
  z-index: 0;
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