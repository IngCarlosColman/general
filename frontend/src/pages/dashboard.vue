<template>
  <v-app 
    class="dashboard-layout"
    :class="{ 'scrollable-app-layout': isSubscriptionRequired }"
  >
    <SuscripcionPlanes v-if="isSubscriptionRequired" />
    <template v-else>
      <v-app-bar app elevation="2" color="surface-container" flat>
        <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
        <v-toolbar-title class="font-weight-bold d-flex align-center">
          <v-img
            :src="logoSrc"
            alt="Logo de la Aplicación"
            width="40"
            height="40"
            class="mr-5"
          ></v-img>
          <span>Agenda Inmobiliaria</span>
        </v-toolbar-title>
        <v-spacer></v-spacer> <v-btn icon>
          <v-icon>mdi-white-balance-sunny</v-icon>
        </v-btn>
        <v-menu offset-y>
          <template v-slot:activator="{ props }">
            <v-btn icon v-bind="props">
              <v-icon>mdi-account-circle</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item @click="showComponent('mi-perfil')">
               <v-list-item-title>Mi Perfil</v-list-item-title>
            </v-list-item>
            <v-list-item @click="handleLogout">
              <v-list-item-title>Cerrar Sesión</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-app-bar>
      <v-navigation-drawer
        v-model="drawer"
        :permanent="true"
        :width="drawer ? 256 : 72"
        color="grey-darken-4"
        class="flex-shrink-0 transition-width duration-300"
        app
      >
        <v-list class="pt-4" nav>
          <v-list-item
            prepend-icon="mdi-account-circle-outline"
            :title="user ? `${user.first_name} ${user.last_name}` : 'Usuario'"
            :subtitle="user?.email || 'Correo'"
            nav
          ></v-list-item>
        </v-list>
        <v-divider></v-divider>
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
          <v-list-item
            prepend-icon="mdi-account-circle"
            title="Mi Perfil"
            :class="{ 'px-2': !drawer }"
            @click="showComponent('mi-perfil')"
            :active="currentComponent === 'mi-perfil'"
            color="primary"
          ></v-list-item>
          <RoleGuard :allowedRoles="['administrador']">
            <v-list-group value="admin-management">
                <template v-slot:activator="{ props }">
                    <v-list-item
                        v-bind="props"
                        prepend-icon="mdi-account-cog"
                        title="Gestión de Usuarios"
                        color="primary"
                    ></v-list-item>
                </template>
                <v-list-item
                    prepend-icon="mdi-cash-check"
                    title="Solicitudes de Activación"
                    @click="showComponent('admin-suscripciones')"
                    :active="currentComponent === 'admin-suscripciones'"
                    class="pl-6"
                ></v-list-item>
                <v-list-item
                    prepend-icon="mdi-account-supervisor-circle"
                    title="Control de Roles y Perfiles"
                    @click="showComponent('admin-perfiles')"
                    :active="currentComponent === 'admin-perfiles'"
                    class="pl-6"
                ></v-list-item>
            </v-list-group>
          </RoleGuard>
          <v-list-item
            prepend-icon="mdi-logout"
            title="Cerrar Sesión"
            :class="{ 'px-2': !drawer }"
            @click="handleLogout"
          ></v-list-item>
        </v-list>
      </v-navigation-drawer>
      <v-main class="main-scroll-area bg-grey-lighten-4">
        <v-container fluid class="pa-6">
          <component
            v-if="components[currentComponent]"
            :is="components[currentComponent]"
            :key="currentComponent"
          />
        </v-container>
      </v-main>
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
import SuscripcionPlanes from '@/pages/SuscripcionPlanes.vue';
import miImagen from '@/assets/logo.svg';
import UsersManagement from '@/components/UsersManagement.vue';
import SubscriptionRequestsManagement from '@/components/SubscriptionRequestsManagement.vue';
const logoSrc = ref(miImagen);
const authStore = useAuthStore();
const router = useRouter();
const drawer = ref(true);
const user = computed(() => authStore.user);
const isSubscriptionRequired = computed(() => {
    const rol = authStore.user?.rol; 
    return rol === 'PENDIENTE_PAGO' || rol === 'PENDIENTE_REVISION';
});
const components = {
  'dashboard-main': Panel,
  general: General,
  catastro: Catastro,
  'consulta-padron': Consulta,
  'mi-perfil': UsersProfiles,
  'admin-perfiles': UsersManagement,
  'admin-suscripciones': SubscriptionRequestsManagement, 
};
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
.scrollable-app-layout {
  overflow: auto;
}
.main-scroll-area {
  overflow-y: auto;
  height: calc(100vh - 64px - 40px);
}
.transition-width {
    transition: width 0.3s ease-in-out;
}
</style>