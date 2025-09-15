<template>
  <v-container
    fluid
    class="pa-0 fill-height login-background d-flex justify-start align-center"
    :style="{'--login-bg-image': loginBgImage}"
  >
    <v-card
      class="pa-8 elevation-12 login-card"
      width="100%"
      max-width="450"
      style="margin-left: 80px;"
    >
      <div class="text-center mb-6">
        <v-icon size="64" color="white" class="mb-2">mdi-alpha-t-circle-outline</v-icon>
        <h2 class="text-h5 font-weight-bold text-white">Registro</h2>
      </div>

      <v-form @submit.prevent="handleRegister">
        <v-text-field
          v-model="username"
          label="Nombre de usuario"
          base-color="white"
          prepend-inner-icon="mdi-account-circle-outline"
          :rules="usernameRules"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <v-text-field
          v-model="first_name"
          label="Nombre"
          base-color="white"
          prepend-inner-icon="mdi-account-circle"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <v-text-field
          v-model="last_name"
          label="Apellido"
          base-color="white"
          prepend-inner-icon="mdi-account-circle"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <v-text-field
          v-model="telefono"
          label="Teléfono"
          base-color="white"
          prepend-inner-icon="mdi-phone"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <v-text-field
          v-model="direccion"
          label="Dirección"
          base-color="white"
          prepend-inner-icon="mdi-map-marker"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <v-text-field
          v-model="email"
          label="Correo electrónico"
          base-color="white"
          prepend-inner-icon="mdi-email-outline"
          :rules="emailRules"
          type="email"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          dark
        ></v-text-field>

        <v-text-field
          v-model="password"
          label="Contraseña"
          prepend-inner-icon="mdi-lock-outline"
          :type="showPassword ? 'text' : 'password'"
          :rules="passwordRules"
          required
          variant="outlined"
          class="mb-4"
          bg-color="rgba(255, 255, 255, 0.1)"
          color="white"
          base-color="white"
          dark
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
        ></v-text-field>

        <v-alert
          v-if="authStore.authError"
          type="error"
          class="mb-4"
          border="start"
          prominent
          color="red-darken-2"
        >
          {{ authStore.authError }}
        </v-alert>

        <v-btn
          type="submit"
          color="primary"
          block
          :loading="authStore.isLoading"
          :disabled="authStore.isLoading"
          size="large"
          class="mb-4"
          rounded="xl"
        >
          REGISTRARSE
        </v-btn>

        <v-btn
          to="/login"
          color="white"
          variant="outlined"
          block
          size="large"
          rounded="xl"
        >
          YA TENGO CUENTA
        </v-btn>
      </v-form>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import localBackgroundImage from '@/assets/login.jpg';

const authStore = useAuthStore();
const router = useRouter();

const username = ref('');
const email = ref('');
const password = ref('');
const first_name = ref('');
const last_name = ref('');
const telefono = ref('');
const direccion = ref('');
const showPassword = ref(false);
const loginBgImage = ref(`url(${localBackgroundImage})`);

const usernameRules = [v => !!v || 'El nombre de usuario es obligatorio.'];
const emailRules = [v => !!v || 'El correo es obligatorio.'];
const passwordRules = [v => !!v || 'La contraseña es obligatoria.'];

const handleRegister = async () => {
  try {
    await authStore.register(
      username.value,
      email.value,
      password.value,
      first_name.value,
      last_name.value,
      telefono.value,
      direccion.value
    );
    router.push('/login');
  } catch (error) {
    console.error('Fallo de registro:', error);
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
  background-color: rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;
  z-index: 2;
  box-shadow: 0 4px 60px rgba(0, 0, 0, 0.5) !important;
}

.login-card .v-field__label,
.login-card .v-field__prepend-inner .v-icon,
.login-card .v-field__append-inner .v-icon {
  color: white;
  opacity: 1;
}

.login-card .v-field__input {
  color: white;
}

.login-card .v-field__label {
  opacity: 0.8;
}

.login-card {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
</style>
