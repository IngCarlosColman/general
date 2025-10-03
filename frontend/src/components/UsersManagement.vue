<template>
  <v-container>
    <v-card class="pa-6 rounded-xl elevation-6">
      <v-card-title class="text-h5 font-weight-bold d-flex justify-space-between align-center">
        Gestión de Usuarios
        <v-btn color="primary" @click="fetchUsers" :loading="isLoading" icon size="small">
          <v-icon>mdi-refresh</v-icon>
          <v-tooltip activator="parent" location="bottom">Recargar Usuarios</v-tooltip>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <p class="text-subtitle-1 mb-4">
          Visualiza y edita los perfiles y roles de todos los usuarios del sistema.
        </p>

        <v-alert v-if="errorMessage" type="error" class="mb-4" closable>
          {{ errorMessage }}
        </v-alert>

        <v-data-table
          :headers="headers"
          :items="users"
          :loading="isLoading"
          class="elevation-1"
          item-key="id"
          density="comfortable"
          :items-per-page="10"
        >
          <template v-slot:item.full_name="{ item }">
            {{ item.first_name }} {{ item.last_name }}
          </template>

          <template v-slot:item.suscripcion_vence="{ item }">
            <span v-if="!item.suscripcion_vence || item.rol === 'PENDIENTE_PAGO'">
              N/A
            </span>
            <v-chip
              v-else
              :color="getSubscriptionStatus(item).color"
              size="small"
              label
            >
              {{ getSubscriptionStatus(item).text }}
            </v-chip>
          </template>

          <template v-slot:item.actions="{ item }">
            <v-btn 
              icon 
              size="small" 
              variant="flat" 
              color="blue-grey-lighten-4" 
              @click="openEditModal(item)"
              class="mx-1"
            >
              <v-icon>mdi-pencil</v-icon>
              <v-tooltip activator="parent" location="top">Editar Usuario</v-tooltip>
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <v-dialog v-model="isModalOpen" max-width="600px" persistent>
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span class="text-h5">Editar Usuario: {{ selectedUser.email }}</span>
          <v-btn icon flat @click="closeModal">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="updateUser">
            <v-text-field
              v-model="selectedUser.first_name"
              label="Nombre"
              prepend-inner-icon="mdi-account-circle"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="selectedUser.last_name"
              label="Apellido"
              prepend-inner-icon="mdi-account-circle"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="selectedUser.telefono"
              label="Teléfono"
              prepend-inner-icon="mdi-phone"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="selectedUser.direccion"
              label="Dirección"
              prepend-inner-icon="mdi-map-marker"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-select
              v-model="selectedUser.rol"
              :items="allowedRoles"
              label="Rol del Usuario"
              prepend-inner-icon="mdi-security"
              variant="outlined"
              class="mb-4"
              :rules="[v => !!v || 'El rol es obligatorio.']"
              required
            ></v-select>

            <v-btn
              color="success"
              type="submit"
              block
              :loading="isUpdating"
              class="mt-4"
            >
              Guardar Cambios
            </v-btn>

          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/api/axiosClient';
import { useSnackbar } from '@/composables/useSnackbar';
import { useAuthStore } from '@/stores/auth';

const { showSnackbar } = useSnackbar();
const authStore = useAuthStore();

const users = ref([]);
const isModalOpen = ref(false);
const isLoading = ref(false);
const isUpdating = ref(false);
const errorMessage = ref('');

// Define los roles permitidos para la edición (debe coincidir con la lógica del backend)
const allowedRoles = ['administrador', 'editor', 'visualizador', 'PENDIENTE_PAGO', 'PENDIENTE_REVISION'];

// Objeto reactivo para el usuario seleccionado
const selectedUser = ref({
  id: null,
  first_name: '',
  last_name: '',
  email: '',
  telefono: '',
  direccion: '',
  rol: '',
  suscripcion_vence: null, // Agregado para consistencia
});

// 🎯 CAMBIO CLAVE: Se agregaron las nuevas columnas a la tabla
const headers = [
  { title: 'Nombre Completo', key: 'full_name' },
  { title: 'Email', key: 'email' },
  { title: 'Teléfono', key: 'telefono' }, // ⬅️ AGREGADO
  { title: 'Vence', key: 'suscripcion_vence' }, // ⬅️ AGREGADO
  { title: 'Rol', key: 'rol' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

/**
 * Lógica para determinar el estado de la suscripción y darle formato
 * @param {Object} user - Objeto del usuario
 */
const getSubscriptionStatus = (user) => {
  const expirationDate = user.suscripcion_vence ? new Date(user.suscripcion_vence) : null;
  const now = new Date();
  
  // Si el rol es PENDIENTE, no hay vencimiento activo
  if (user.rol.includes('PENDIENTE')) {
    return { text: 'Pendiente', color: 'orange' };
  }

  // Si no hay fecha o la fecha es inválida, pero no es rol pendiente
  if (!expirationDate || isNaN(expirationDate.getTime())) {
    return { text: user.rol, color: 'blue-grey' };
  }
  
  // Formato de fecha
  const formattedDate = expirationDate.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Si ya venció
  if (expirationDate < now) {
    return { text: `Vencido (${formattedDate})`, color: 'error' };
  }

  // Si vence en menos de 7 días (aviso)
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (expirationDate.getTime() - now.getTime() < oneWeek) {
    return { text: `Expira pronto (${formattedDate})`, color: 'warning' };
  }

  // Si está activo
  return { text: `Activo hasta ${formattedDate}`, color: 'success' };
};


/**
 * Función para obtener la lista completa de usuarios (solo accesible para Admin)
 */
const fetchUsers = async () => {
  isLoading.value = true;
  errorMessage.value = '';
  if (!authStore.isAdmin) {
    errorMessage.value = 'No tienes permisos para ver esta sección.';
    isLoading.value = false;
    return;
  }

  try {
    const response = await api.get('/admin/users');
    users.value = response.data.users;
    showSnackbar('Lista de usuarios actualizada.', 'success');
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    errorMessage.value = error.response?.data?.error || 'Error al cargar la lista de usuarios.';
  } finally {
    isLoading.value = false;
  }
};

/**
 * Abre el modal y carga los datos del usuario seleccionado.
 * @param {Object} user - Objeto del usuario a editar.
 */
const openEditModal = (user) => {
  // Clonar el objeto para que la edición no afecte la tabla hasta guardar.
  selectedUser.value = { ...user };
  isModalOpen.value = true;
};

/**
 * Cierra el modal de edición y limpia mensajes.
 */
const closeModal = () => {
  isModalOpen.value = false;
  isUpdating.value = false;
  errorMessage.value = '';
};


/**
 * Función para actualizar el perfil de un usuario específico (Admin)
 */
const updateUser = async () => {
  isUpdating.value = true;
  errorMessage.value = '';

  try {
    const response = await api.put(`/admin/users/${selectedUser.value.id}`, {
      first_name: selectedUser.value.first_name,
      last_name: selectedUser.value.last_name,
      telefono: selectedUser.value.telefono,
      direccion: selectedUser.value.direccion,
      rol: selectedUser.value.rol, // El admin puede cambiar el rol
    });

    // Actualizar el usuario en la lista local para reflejar el cambio en la tabla
    const index = users.value.findIndex(u => u.id === selectedUser.value.id);
    if (index !== -1) {
      // ⚠️ Aseguramos que la fecha de vencimiento se mantenga actualizada si fue retornada
      users.value[index] = { ...response.data.user };
    }

    showSnackbar('Usuario actualizado con éxito.', 'success');
    closeModal();
    
    // Si el administrador se está editando a sí mismo, forzar recarga de su token/store
    if (selectedUser.value.id === authStore.userId) {
        await authStore.fetchUser();
    }

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    errorMessage.value = error.response?.data?.error || 'Error al actualizar el usuario. Inténtalo de nuevo.';
  } finally {
    isUpdating.value = false;
  }
};

onMounted(() => {
  // Iniciar la carga de usuarios al montar el componente
  fetchUsers();
});

</script>

<style scoped>
/* Estilos para el componente de gestión de usuarios */
</style>