<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <AgendaToolbar 
          @update:search="handleSearchUpdate" 
          @update:category="handleCategoryUpdate"
          :categories="allCategories"
          :is-loading="agendaStore.isLoading"
        >
          <template #buttons>
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-plus-circle-outline"
              @click="openNewContactModal"
            >
              Añadir Contacto
            </v-btn>
          </template>
        </AgendaToolbar>
      </v-col>
      <v-col cols="12">
        <AgendaTable
          :search="searchQuery"
          :filterCategory="selectedCategoryId"
          @show-details="showContactDetails"
          @refresh-data="refreshAgenda"
        />
      </v-col>
    </v-row>

    <ContactDetailsModal
      v-model="detailsModalOpen"
      :contact="selectedContact"
      @update-agenda="refreshAgenda"
    />

    <NewContactModal
      v-model="newContactModalOpen"
      @contact-added="refreshAgenda"
    />
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';

// === RUTAS CORREGIDAS ===
// Ahora apuntan a la carpeta 'agendautilities'
import AgendaToolbar from '@/components/agendautilities/AgendaToolbar.vue';
import AgendaTable from '@/components/agendautilities/AgendaTable.vue';
import ContactDetailsModal from '@/components/agendautilities/ContactDetailsModal.vue';
import NewContactModal from '@/components/agendautilities/NewContactModal.vue';
import AgendaCalendar from '@/components/agendautilities/AgendaCalendar.vue';

// Estado global de la agenda (nuestro cerebro)
const agendaStore = useAgendaStore();

// Estado local del componente para manejar la UI
const searchQuery = ref('');
const selectedCategoryId = ref(null);
const allCategories = ref([]);
const detailsModalOpen = ref(false);
const newContactModalOpen = ref(false);
const selectedContact = ref(null);

// Lógica para manejar la búsqueda (se emite desde AgendaToolbar)
const handleSearchUpdate = (newSearchTerm) => {
  searchQuery.value = newSearchTerm;
};

// Lógica para manejar la actualización de categoría (se emite desde AgendaToolbar)
const handleCategoryUpdate = (newCategoryId) => {
  selectedCategoryId.value = newCategoryId;
};

// Lógica para manejar la apertura del modal de detalles
const showContactDetails = (contact) => {
  selectedContact.value = contact;
  detailsModalOpen.value = true;
};

// Lógica para abrir el modal de creación de contactos
const openNewContactModal = () => {
  newContactModalOpen.value = true;
};

// Lógica para recargar la agenda
const refreshAgenda = () => {
  agendaStore.fetchAgendaContacts();
};

// Cargar datos iniciales al montar el componente
onMounted(async () => {
  await agendaStore.fetchAgendaContacts(); 
  await agendaStore.fetchAllCategories(); 
  allCategories.value = agendaStore.allCategories;
});

</script>