<template>
  <v-app class="dashboard-layout">
    <!-- 🟢 NUEVA VERIFICACIÓN PRINCIPAL: Si la suscripción está pendiente, muestra solo los planes -->
    <SuscripcionPlanes v-if="isSubscriptionRequired" />

    <!-- 🟢 CONTENIDO NORMAL DEL DASHBOARD (Solo visible si la suscripción está activa o el rol es administrador) -->
    <template v-else>
      <!-- BARRA SUPERIOR (APP BAR) -->
      <v-app-bar app elevation="2" color="surface-container" flat>
        <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
        <v-toolbar-title class="font-weight-bold d-flex align-center">
          <!-- El espacio en blanco entre el v-img y el texto ayuda con la separación -->
          <v-img
            :src="logoSrc"
            alt="Logo de la Aplicación"
            width="40"
            height="40"
            class="mr-5"
          ></v-img>
          <span>Agenda Inmobiliaria</span>
        </v-toolbar-title>

        <v-spacer></v-spacer> <!-- Mueve los iconos a la derecha -->

        <!-- Botón de Tema (Opcional) -->
        <v-btn icon>
          <v-icon>mdi-white-balance-sunny</v-icon>
        </v-btn>

        <!-- Menú de Usuario en la Barra Superior -->
        <v-menu offset-y>
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <v-icon>mdi-account-circle</v-icon>
            </v-btn>
          </template>
          <v-list>
            <!-- Opción de Mi Perfil -->
            <v-list-item @click="showComponent('mi-perfil')">
               <v-list-item-title>Mi Perfil</v-list-item-title>
            </v-list-item>
            <v-list-item @click="handleLogout">
              <v-list-item-title>Cerrar Sesión</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-app-bar>

      <!-- BARRA LATERAL (NAVIGATION DRAWER) -->
      <v-navigation-drawer
        v-model="drawer"
        :permanent="true"
        :width="drawer ? 256 : 72"
        color="grey-darken-4"
        class="flex-shrink-0 transition-width duration-300"
        app
      >
        <!-- Detalles del Usuario -->
        <v-list class="pt-4" nav>
          <v-list-item
            prepend-icon="mdi-account-circle-outline"
            :title="user ? `${user.first_name} ${user.last_name}` : 'Usuario'"
            :subtitle="user?.email || 'Correo'"
            nav
          ></v-list-item>
        </v-list>
        <v-divider></v-divider>

        <!-- Menú de Navegación Principal -->
        <v-list density="compact" nav>
          <v-list-item
            prepend-icon="mdi-view-dashboard"
            title="Panel Principal"
            :class="{ 'px-2': !drawer }"
            @click="showComponent('dashboard-main')"
            :active="currentComponent === 'dashboard-main'"
            color="primary"
          ></v-list-item>

          <v-list-item
            prepend-icon="mdi-book-multiple"
            title="Guía Telefónica"
            :class="{ 'px-2': !drawer }"
            @click="showComponent('general')"
            :active="currentComponent === 'general'"
            color="primary"
          ></v-list-item>

          <v-list-item
            prepend-icon="mdi-card-account-details-outline"
            title="Consulta Datos Personales"
            :class="{ 'px-2': !drawer }"
            @click="showComponent('consulta-padron')"
            :active="currentComponent === 'consulta-padron'"
            color="primary"
          ></v-list-item>

          <v-list-item
            prepend-icon="mdi-map-marker-radius"
            title="Catastro Dinámico"
            :class="{ 'px-2': !drawer }"
            @click="showComponent('catastro')"
            :active="currentComponent === 'catastro'"
            color="primary"
          ></v-list-item>

          <!-- Opción de Perfil Personal (para que sea accesible desde el menú) -->
          <v-list-item
            prepend-icon="mdi-account-circle"
            title="Mi Perfil"
            :class="{ 'px-2': !drawer }"
            @click="showComponent('mi-perfil')"
            :active="currentComponent === 'mi-perfil'"
            color="primary"
          ></v-list-item>


          <!-- APLICACIÓN DE ROLE GUARD: Solo visible para el administrador -->
          <RoleGuard :allowedRoles="['administrador']">
            <v-list-item
              prepend-icon="mdi-account-multiple"
              title="Gestión de Usuarios"
              :class="{ 'px-2': !drawer }"
              @click="showComponent('gestion-usuarios')"
              :active="currentComponent === 'gestion-usuarios'"
              color="primary"
            ></v-list-item>
          </RoleGuard>

          <v-list-item
            prepend-icon="mdi-logout"
            title="Cerrar Sesión"
            :class="{ 'px-2': !drawer }"
            @click="handleLogout"
          ></v-list-item>
        </v-list>
      </v-navigation-drawer>

      <!-- CONTENIDO PRINCIPAL -->
      <v-main class="main-scroll-area bg-grey-lighten-4">
        <v-container fluid class="pa-6">
          <component
            v-if="components[currentComponent]"
            :is="components[currentComponent]"
            :key="currentComponent"
          />
        </v-container>
      </v-main>

      <!-- FOOTER -->
      <v-footer app color="grey-darken-4" class="py-2">
        <div class="flex-grow-1 text-center text-sm-start text-white">
          &copy; 2024 Mi Aplicación
        </div>
        <div class="hidden-xs-only d-flex flex-grow-1 justify-end">
          <span class="text-caption text-disabled mr-2">
            v1.0.0
          </span>
        </div>
      </v-footer>
    </template>
  </v-app>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Panel from '@/components/Panel.vue';
import General from '@/components/General.vue';
import UsersProfiles from '@/components/usersprofiles.vue';
import Catastro from '@/components/Catastro.vue';
import Consulta from '@/components/Consulta.vue';
import RoleGuard from '@/components/RoleGuard.vue';
// 🟢 NUEVA IMPORTACIÓN: Componente para gestionar los planes
import SuscripcionPlanes from '@/pages/SuscripcionPlanes.vue';
import miImagen from '@/assets/logo.svg';


const logoSrc = ref(miImagen);

const authStore = useAuthStore();
const router = useRouter();

const drawer = ref(true);
const user = computed(() => authStore.user);

// 🟢 PROPIEDAD COMPUTADA CLAVE: Determina si se debe mostrar la pantalla de suscripción
const isSubscriptionRequired = computed(() => {
    const rol = authStore.rol;
    return rol === 'PENDIENTE_PAGO' || rol === 'PENDIENTE_REVISION';
});

const components = {
  // Panel Principal
  'dashboard-main': Panel,
  general: General,
  catastro: Catastro,
  'consulta-padron': Consulta,
  // Componente para ver/editar el perfil del usuario actual
  'mi-perfil': UsersProfiles,
  // Componente para la gestión de TODOS los usuarios (Administrador)
  'gestion-usuarios': UsersProfiles,
};

// MODIFICADO: Ahora el componente inicial es 'dashboard-main'
const currentComponent = ref('dashboard-main');

const showComponent = (name) => {
  currentComponent.value = name;
};

const handleLogout = async () => {
  try {
    await authStore.logout();
    await router.push('/login');
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
};
</script>

<style scoped>
.dashboard-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-scroll-area {
  overflow-y: auto;
  /* Altura: 100vh - AppBar(64px) - Footer(~40px) */
  height: calc(100vh - 64px - 40px);
}

/* Opcional: mejora la transición del sidebar */
.transition-width {
    transition: width 0.3s ease-in-out;
}
</style>
