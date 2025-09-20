<template>
  <v-card class="mt-4">
    <v-card-title class="d-flex align-center">
      Categorías
      <v-spacer></v-spacer>
      <v-btn icon @click="toggleCreateCategory">
        <v-icon>{{ isCreatingCategory ? 'mdi-close' : 'mdi-plus' }}</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-autocomplete
        v-model="assignedCategoriesIds"
        :items="agendaStore.allCategories"
        item-title="nombre_categoria"
        item-value="id"
        label="Asignar categorías"
        multiple
        chips
        variant="outlined"
        closable-chips
        class="mb-4"
        no-data-text="No hay categorías disponibles"
        :disabled="isCreatingCategory"
      ></v-autocomplete>
      
      <v-form v-if="isCreatingCategory" @submit.prevent="createCategory">
        <v-text-field
          v-model="newCategoryName"
          label="Crear nueva categoría"
          append-inner-icon="mdi-plus"
          variant="outlined"
          :loading="isCreatingCategory"
          @click:append-inner="createCategory"
          @keydown.enter.prevent="createCategory"
        ></v-text-field>
      </v-form>

      <v-btn
        v-if="!isCreatingCategory"
        color="primary"
        @click="saveAssignedCategories"
        class="mt-2"
        :loading="isSaving"
      >
        Guardar Categorías
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, watch, defineProps, onMounted } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useSnackbar } from '@/composables/useSnackbar';

// Props
const props = defineProps({
  contactCedula: {
    type: String,
    required: true,
  },
});

// Store y Composables
const agendaStore = useAgendaStore();
const { showSnackbar } = useSnackbar();

// Estado local
const assignedCategoriesIds = ref([]);
const newCategoryName = ref('');
const isCreatingCategory = ref(false);
const isSaving = ref(false);

// Métodos
const toggleCreateCategory = () => {
  isCreatingCategory.value = !isCreatingCategory.value;
  newCategoryName.value = ''; // Limpiar el campo cuando se cierra
};

const fetchContactCategories = async (cedula) => {
  try {
    const categories = await agendaStore.fetchContactCategories(cedula);
    // Mapeamos los IDs de las categorías asignadas
    assignedCategoriesIds.value = categories.map(c => c.categoria_id);
  } catch (error) {
    console.error('Error al cargar categorías asignadas:', error);
    showSnackbar('Error al cargar las categorías del contacto.', 'error');
  }
};

const createCategory = async () => {
  if (!newCategoryName.value) return;
  try {
    await agendaStore.createCategory(newCategoryName.value);
    showSnackbar('Categoría creada con éxito.', 'success');
    newCategoryName.value = '';
    isCreatingCategory.value = false;
  } catch (error) {
    console.error('Error al crear categoría:', error);
    showSnackbar('Error al crear la categoría.', 'error');
  }
};

const saveAssignedCategories = async () => {
  isSaving.value = true;
  try {
    const currentCategories = assignedCategoriesIds.value;
    const oldCategories = agendaStore.contactCategories.map(c => c.categoria_id);
    
    // Categorías a añadir
    const categoriesToAdd = currentCategories.filter(id => !oldCategories.includes(id));
    // Categorías a eliminar
    const categoriesToRemove = oldCategories.filter(id => !currentCategories.includes(id));

    // Ejecutar las promesas en paralelo
    const addPromises = categoriesToAdd.map(id => agendaStore.assignCategoryToContact(props.contactCedula, id));
    const removePromises = categoriesToRemove.map(id => agendaStore.removeCategoryFromContact(props.contactCedula, id));

    await Promise.all([...addPromises, ...removePromises]);
    showSnackbar('Categorías guardadas con éxito.', 'success');
  } catch (error) {
    console.error('Error al guardar las categorías:', error);
    showSnackbar('Error al guardar las categorías.', 'error');
  } finally {
    isSaving.value = false;
  }
};

// Cargar categorías al iniciar y al cambiar de contacto
onMounted(() => {
  agendaStore.fetchAllCategories();
});

watch(() => props.contactCedula, (newCedula) => {
  if (newCedula) {
    fetchContactCategories(newCedula);
  }
}, { immediate: true });

</script>