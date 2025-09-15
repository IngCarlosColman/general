<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-2">
      <SearchAndActionsToolbar
        title="Guía Telefónica"
        v-model:search="tempSearch"
        @search="performSearch"
        @add="openDialog('create')"
      />

      <v-divider></v-divider>

      <ContactTable
        :headers="headers"
        :items="generalData"
        :items-length="totalItems"
        :loading="loading"
        :search="search"
        :sort-by="sortBy"
        :private-agenda-cedulas="privateAgendaCedulas"
        @update:options="loadItems"
        @edit="openDialog('edit', $event)"
        @delete="deleteItem($event)"
        @toggle-private-agenda="togglePrivateAgenda"
        @share-contact="shareContact"
        @open-whatsapp="openWhatsApp"
        @download-vcard="downloadVCard"
      />
    </v-card>

    <ContactFormDialog
      v-model="dialog"
      :edited-item="editedItem"
      :is-editing="isEditing"
      :saving="saving"
      :server-error="serverError"
      @close="closeDialog"
      @save="saveItem"
    />

    <ConfirmDeleteDialog
      v-model="deleteDialog"
      :name="nombreCompletoToDelete"
      :deleting="deleting"
      @close="closeDeleteDialog"
      @confirm="confirmDelete"
    />

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn
          color="white"
          variant="text"
          @click="snackbar.show = false"
        >
          Cerrar
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import apiClient from '@/services/api';
import SearchAndActionsToolbar from '@/components/comunes/SearchAndActionsToolbar.vue';
import ContactTable from '@/components/comunes/ContactTable.vue';
import ContactFormDialog from '@/components/comunes/ContactFormDialog.vue';
import ConfirmDeleteDialog from '@/components/comunes/ConfirmDeleteDialog.vue';

const generalData = ref([]);
const totalItems = ref(0);
const loading = ref(false);
const sortBy = ref([]);

const tempSearch = ref('');
const search = ref('');

const dialog = ref(false);
const deleteDialog = ref(false);
const editedItem = ref({});
const defaultItem = {
  nombres: '',
  apellidos: '',
  cedula: '',
  telefonos: [],
};
const itemToDelete = ref(null);
const serverError = ref('');
const isEditing = ref(false);
const saving = ref(false);
const deleting = ref(false);

const snackbar = ref({
  show: false,
  message: '',
  color: 'success',
  timeout: 3000,
});

const privateAgendaCedulas = ref([]);

const headers = computed(() => [
  { title: 'Cédula', key: 'cedula' },
  { title: 'Nombres', key: 'nombres' },
  { title: 'Apellidos', key: 'apellidos' },
  { title: 'Nombre Completo', key: 'completo' },
  { title: 'Teléfonos', key: 'telefonos', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' },
]);

const nombreCompletoToDelete = computed(() => {
  if (itemToDelete.value && (itemToDelete.value.nombres || itemToDelete.value.apellidos)) {
    return `${itemToDelete.value.nombres || ''} ${itemToDelete.value.apellidos || ''}`.trim();
  }
  return '';
});
const fetchPrivateAgendaCedulas = async () => {
  try {
    const response = await apiClient.get('/private-agenda/cedulas');
    privateAgendaCedulas.value = response.data;
  } catch (error) {
    console.error('Error al cargar la agenda privada del usuario:', error);
  }
};

const togglePrivateAgenda = async (item) => {
  try {
    if (privateAgendaCedulas.value.includes(item.cedula)) {
      await apiClient.delete(`/private-agenda/${item.cedula}`);
      showSnackbar('Contacto eliminado de tu agenda.', 'success');
    } else {
      await apiClient.post(`/private-agenda`, { contactCedula: item.cedula });
      showSnackbar('Contacto añadido a tu agenda con éxito.', 'success');
    }
    await fetchPrivateAgendaCedulas();
  } catch (error) {
    console.error('Error al actualizar la agenda privada:', error);
    showSnackbar('Error al actualizar tu agenda privada.', 'error');
  }
};

const performSearch = () => {
  search.value = tempSearch.value;
  loadItems({ page: 1, itemsPerPage: 10, sortBy: [] });
};

const loadItems = async ({ page, itemsPerPage, sortBy: vuetifySortBy }) => {
  if (!search.value || search.value.trim() === '') {
    generalData.value = [];
    totalItems.value = 0;
    return;
  }

  loading.value = true;
  try {
    const params = {
      page,
      itemsPerPage,
      sortBy: JSON.stringify(vuetifySortBy),
      search: search.value,
    };

    const response = await apiClient.get('/general', { params });

    generalData.value = response.data.items;
    totalItems.value = response.data.totalItems ?? 0;
  } catch (error) {
    console.error("Error al cargar los datos:", error);
    showSnackbar('Error al cargar los datos.', 'error');
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

const openDialog = (mode, item = null) => {
  isEditing.value = mode === 'edit';
  editedItem.value = isEditing.value && item ? { ...item } : { ...defaultItem };
  dialog.value = true;
  serverError.value = '';
};

const closeDialog = () => {
  dialog.value = false;
  editedItem.value = { ...defaultItem };
  isEditing.value = false;
  serverError.value = '';
};

const saveItem = async (itemToSave) => {
  saving.value = true;
  try {
    if (isEditing.value) {
      await apiClient.put(`/general/${itemToSave.id}`, itemToSave);
      showSnackbar('Registro actualizado correctamente.');
    } else {
      await apiClient.post('/general', itemToSave);
      showSnackbar('Registro creado correctamente.');
    }
    closeDialog();
    loadItems({ page: 1, itemsPerPage: 10, sortBy: [] });
  } catch (error) {
    console.error("Error al guardar el registro:", error);
    serverError.value = error.response?.data?.error || 'Ocurrió un error inesperado al guardar el registro.';
    showSnackbar('Error al guardar el registro.', 'error');
  } finally {
    saving.value = false;
  }
};

const deleteItem = (item) => {
  itemToDelete.value = item;
  deleteDialog.value = true;
};

const closeDeleteDialog = () => {
  deleteDialog.value = false;
  itemToDelete.value = null;
};

const confirmDelete = async () => {
  deleting.value = true;
  const id = itemToDelete.value.id;
  try {
    await apiClient.delete(`/general/${id}`);
    showSnackbar('Registro eliminado correctamente.');
    closeDeleteDialog();
    loadItems({ page: 1, itemsPerPage: 10, sortBy: [] });
  } catch (error) {
    console.error("Error al eliminar el registro:", error);
    showSnackbar(error.response?.data?.error || 'Ocurrió un error al intentar eliminar el registro.', 'error');
  } finally {
    deleting.value = false;
  }
};

const showSnackbar = (message, color = 'success') => {
  snackbar.value.message = message;
  snackbar.value.color = color;
  snackbar.value.show = true;
};

const openWhatsApp = (item) => {
  if (item.telefonos?.length) {
    const phoneNumber = item.telefonos[0].replace(/\D/g, '');
    const fullNumber = `595${phoneNumber}`;
    window.open(`https://wa.me/${fullNumber}`, '_blank');
  }
};

const downloadVCard = (item) => {
  const vcardContent = `BEGIN:VCARD
VERSION:3.0
N:;${item.nombres};${item.apellidos};;
FN:${item.completo}
UID:${item.cedula}
${item.telefonos.map(tel => `TEL;TYPE=CELL:${tel}`).join('\n')}
END:VCARD`;

  const blob = new Blob([vcardContent], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${item.completo}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const shareContact = async (item) => {
  if (navigator.share) {
    try {
      const shareData = {
        title: `Contacto de ${item.nombres}`,
        text: `Nombre: ${item.completo}\nCédula: ${item.cedula}\nTeléfonos: ${item.telefonos?.join(', ') ?? 'No disponibles'}`,
      };
      await navigator.share(shareData);
      showSnackbar('Contacto compartido correctamente.', 'success');
    } catch (error) {
      console.error('Error al compartir el contacto:', error);
      if (error.name !== 'AbortError') {
        showSnackbar('Error al compartir el contacto.', 'error');
      }
    }
  } else {
    showSnackbar('La funcionalidad de compartir no es compatible con tu navegador.', 'warning');
  }
};

onMounted(() => {
  fetchPrivateAgendaCedulas();
});
</script>