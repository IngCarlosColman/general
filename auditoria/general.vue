<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <SearchAndActionsToolbar
        title="Guía Telefónica"
        :categories="categories"
        v-model:selected-category="selectedCategory"
        v-model:search="activeTable.searchTerm.value"
        @add="openDialog('create')"
        @search="handleSearch"
      />
      <v-divider></v-divider>
      <ContactTable
        :headers="activeTable.headers.value"
        :items="activeTable.items.value"
        :items-length="activeTable.totalItems.value"
        :loading="activeTable.isLoading.value"
        :private-agenda-cedulas="agendaStore.privateAgendaCedulas"
        :options="activeTable.options"
        @update:options="newOptions => Object.assign(activeTable.options, newOptions)"
        @edit="openDialog('edit', $event)"
        @delete="confirmDeleteItem($event)"
        @toggle-private-agenda="togglePrivateAgenda"
        @share-contact="shareContact"
        @open-whatsapp="openWhatsApp"
        @download-vcard="downloadVCard"
      />
    </v-card>
    <ContactFormDialog
      v-model:model-value="dialog"
      :edited-item="editedItem"
      :is-editing="isEditing"
      :saving="isSaving"
      @close="closeDialog"
      @save="saveItem"
    />
    <ConfirmDeleteDialog
      v-model:model-value="deleteDialog"
      :name="itemToDelete?.nombreCompleto"
      :deleting="isDeleting"
      @close="closeDeleteDialog"
      @confirm="deleteItem"
    />
    <v-snackbar
      v-model="snackbarState.show"
      :color="snackbarState.color"
      :timeout="snackbarState.timeout"
    >
      {{ snackbarState.message }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="closeSnackbar">Cerrar</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>
<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import SearchAndActionsToolbar from '@/components/comunes/SearchAndActionsToolbar.vue';
import ContactTable from '@/components/comunes/ContactTable.vue';
import ContactFormDialog from '@/components/comunes/ContactFormDialog.vue';
import ConfirmDeleteDialog from '@/components/comunes/ConfirmDeleteDialog.vue';
import { useCrudTable } from '@/composables/useCrudTable';
import { useSnackbar } from '@/composables/useSnackbar';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useContactUtilities } from '@/composables/useContactUtilities';
// === STATE AND OPTIONS ===
const defaultItem = {
  nombres: '',
  apellidos: '',
  cedula: '',
  telefonos: [],
  salario: 0,
};
const selectedCategory = ref('general');
const categories = ref([
  {
    title: 'Guía General',
    value: 'general',
    icon: 'mdi-book-multiple',
  },
  {
    title: 'Agenda Personal',
    value: 'private-agenda',
    icon: 'mdi-folder-account',
  },
  // Tu código original para otras categorías...
  {
    title: 'Abogados',
    value: 'abogados',
    icon: 'mdi-scale-balance',
  },
  {
    title: 'Despachantes',
    value: 'despachantes',
    icon: 'mdi-ferry',
  },
  {
    title: 'Docentes',
    value: 'docentes',
    icon: 'mdi-school',
  },
  {
    title: 'Funcionarios BNF',
    value: 'funcbnf',
    icon: 'mdi-bank',
  },
  {
    title: 'Funcionarios Públicos',
    value: 'funcpublic',
    icon: 'mdi-account-group',
  },
  {
    title: 'Itaipu',
    value: 'itaipu',
    icon: 'mdi-transmission-tower',
  },
  {
    title: 'Yacyreta',
    value: 'yacyreta',
    icon: 'mdi-transmission-tower',
  },
]);
// === COMPOSABLES ===
const { snackbarState, closeSnackbar, showSnackbar } = useSnackbar();
const agendaStore = useAgendaStore();
const { openWhatsApp, downloadVCard, shareContact } = useContactUtilities();
// Instancias separadas para cada tabla
const generalTable = useCrudTable(computed(() => `/${selectedCategory.value}`), defaultItem);
const privateAgendaTable = useCrudTable(ref('/private-agenda/agenda'), {});
// Usamos propiedades computadas para alternar entre las tablas
const activeTable = computed(() => {
  if (selectedCategory.value === 'private-agenda') {
    return {
      ...privateAgendaTable,
      headers: computed(() => [
        { title: 'Cédula', key: 'contact_cedula', align: 'start' },
        { title: 'Nombres', key: 'nombres' },
        { title: 'Apellidos', key: 'apellidos' },
        { title: 'Relación', key: 'tipo_relacion' },
        { title: 'Añadido', key: 'created_at' },
        { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
      ]),
    };
  } else {
    // Busca las cabeceras en el objeto de categorías
    const categoryHeaders = categories.value.find(c => c.value === selectedCategory.value)?.headers || [];
    return {
      ...generalTable,
      headers: computed(() => categoryHeaders),
    };
  }
});
const {
  dialog,
  deleteDialog,
  editedItem,
  isEditing,
  isSaving,
  isDeleting,
  itemToDelete,
  openDialog,
  closeDialog,
  saveItem,
  confirmDeleteItem,
  closeDeleteDialog,
  deleteItem,
} = generalTable; // Mantener la lógica de diálogos de la tabla general
// === LÓGICA DE LA AGENDA PERSONAL ===
const togglePrivateAgenda = async (item) => {
  if (!item || !item.cedula) {
    showSnackbar('Error: No se pudo identificar el contacto. La cédula está vacía.', 'error');
    console.error('Cédula del contacto es undefined o nula:', item);
    return;
  }
  console.log('Intentando añadir a la agenda el contacto con cédula:', item.cedula);
  const cedula = item.cedula;
  const isCurrentlyInAgenda = agendaStore.privateAgendaCedulas.includes(cedula);
  let result;
  if (isCurrentlyInAgenda) {
    // Si ya está en la agenda, se elimina.
    result = await agendaStore.removeContactFromAgenda(cedula);
  } else {
    // Si no está, se añade.
    result = await agendaStore.addContactToAgenda(cedula);
  }
  if (result.success) {
    showSnackbar(result.message, 'success');
  } else {
    showSnackbar(result.message, 'error');
  }
};
// === ACCIONES Y FUNCIONES ===
const handleSearch = () => {
  // Restablece la paginación a la página 1 al buscar
  Object.assign(activeTable.value.options, { page: 1, itemsPerPage: 10, sortBy: [] });
  activeTable.value.loadItems();
};
watch(selectedCategory, () => {
  // Cuando se cambia la categoría, se restablecen las opciones de la tabla activa
  Object.assign(activeTable.value.options, { page: 1, itemsPerPage: 10, sortBy: [] });
  activeTable.value.searchTerm.value = '';
  activeTable.value.loadItems();
});
// Cargar los datos iniciales al montar el componente
onMounted(() => {
  agendaStore.loadUserAgenda();
  generalTable.loadItems();
});
</script>
<style scoped>
.centered-snackbar {
  position: fixed !important;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
---- general.vue con tus cambios...
-----
encuentre que motivo que el codigo general.vue actual (con tus cambios) no devuelva los registros..