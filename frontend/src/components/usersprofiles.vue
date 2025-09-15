<template>
  <v-container>
    <v-card class="pa-6">
      <v-card-title class="text-h5 font-weight-bold">
        Mi Perfil
      </v-card-title>
      <v-card-text>
        <p>
          Bienvenido, {{ profile.first_name || 'Usuario' }}. Aquí puedes ver
          y actualizar tus datos personales.
        </p>
        <v-btn color="primary" @click="isModalOpen = true">
          Actualizar Perfil
        </v-btn>
      </v-card-text>
    </v-card>

    <v-dialog v-model="isModalOpen" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          <span class="text-h5">Editar Perfil</span>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="updateProfile">
            <v-text-field
              v-model="profile.first_name"
              label="Nombre"
              prepend-inner-icon="mdi-account-circle"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="profile.last_name"
              label="Apellido"
              prepend-inner-icon="mdi-account-circle"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="profile.email"
              label="Correo Electrónico"
              prepend-inner-icon="mdi-email-outline"
              variant="outlined"
              class="mb-4"
              readonly
            ></v-text-field>

            <v-text-field
              v-model="profile.telefono"
              label="Teléfono"
              prepend-inner-icon="mdi-phone"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="profile.direccion"
              label="Dirección"
              prepend-inner-icon="mdi-map-marker"
              variant="outlined"
              class="mb-4"
            ></v-text-field>
          </v-form>

          <v-alert
            v-if="errorMessage"
            type="error"
            class="mt-4"
            border="start"
            prominent
          >
            {{ errorMessage }}
          </v-alert>
          <v-alert
            v-if="updateSuccess"
            type="success"
            class="mt-4"
            border="start"
            prominent
          >
            ¡Perfil actualizado con éxito!
          </v-alert>

        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="secondary"
            variant="text"
            @click="closeModal"
          >
            Cerrar
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            @click="updateProfile"
            :loading="isLoading"
            :disabled="isLoading"
          >
            Guardar Cambios
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, watchEffect } from 'vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';

const authStore = useAuthStore();
const isModalOpen = ref(false);
const isLoading = ref(false);
const updateSuccess = ref(false);
const errorMessage = ref('');

const profile = ref({
  first_name: '',
  last_name: '',
  email: '',
  telefono: '',
  direccion: ''
});

// Sincronizar el perfil del usuario del store con el formulario local
watchEffect(() => {
  if (authStore.user) {
    profile.value = { ...authStore.user };
  }
});

const updateProfile = async () => {
  isLoading.value = true;
  updateSuccess.value = false;
  errorMessage.value = '';
  try {
    const response = await api.put('/users', {
      first_name: profile.value.first_name,
      last_name: profile.value.last_name,
      telefono: profile.value.telefono,
      direccion: profile.value.direccion,
    });

    authStore.setUser(response.data.user);

    updateSuccess.value = true;

  } catch (error) {
    console.error('Error al actualizar el perfil:', error);
    errorMessage.value = 'Error al actualizar el perfil. Inténtalo de nuevo.';
  } finally {
    isLoading.value = false;
  }
};

const closeModal = () => {
  isModalOpen.value = false;
  updateSuccess.value = false;
  errorMessage.value = '';
  // Opcional: restablecer el formulario a los datos originales si se cierra sin guardar
  if (authStore.user) {
    profile.value = { ...authStore.user };
  }
};
</script>

<style scoped>
/* Estilos específicos para el componente */
</style>
