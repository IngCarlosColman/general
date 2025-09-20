<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="800px" persistent>
    <v-card :loading="isLoading" :disabled="isLoading">
      <v-card-title class="headline">
        <span class="text-h5">Detalles de {{ displayedName }}</span>
        <v-spacer></v-spacer>
        <v-btn icon @click="closeModal" :disabled="isSaving">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-container>
          <v-form ref="form" v-model="formValid">
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="agendaStore.contactName.nombre_personalizado"
                  label="Nombre Personalizado"
                  variant="outlined"
                  clearable
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="agendaStore.currentContactDetails.cargo"
                  label="Cargo"
                  variant="outlined"
                  clearable
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="agendaStore.currentContactDetails.empresa"
                  label="Empresa"
                  variant="outlined"
                  clearable
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="agendaStore.currentContactDetails.direccion"
                  label="Dirección"
                  variant="outlined"
                  clearable
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="agendaStore.currentContactDetails.fecha_nacimiento"
                  label="Fecha de Nacimiento"
                  type="date"
                  variant="outlined"
                  clearable
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="agendaStore.currentContactDetails.perfil_linkedin"
                  label="Perfil de LinkedIn"
                  variant="outlined"
                  clearable
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="agendaStore.currentContactDetails.area_negocio"
                  label="Área de Negocio"
                  variant="outlined"
                  clearable
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="agendaStore.currentContactDetails.es_padre"
                  label="Es Padre"
                ></v-checkbox>
              </v-col>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="agendaStore.currentContactDetails.es_madre"
                  label="Es Madre"
                ></v-checkbox>
              </v-col>
            </v-row>
          </v-form>

          <v-tabs v-model="tab" align-tabs="center" class="mt-4">
            <v-tab value="notes">Notas Personales</v-tab>
            <v-tab value="phones">Teléfonos</v-tab>
            <v-tab value="events">Eventos de Seguimiento</v-tab>
            <v-tab value="categories">Categorías</v-tab>
          </v-tabs>

          <v-window v-model="tab" class="mt-4">
            <v-window-item value="notes">
              <v-textarea
                v-model="agendaStore.currentContactDetails.notas"
                label="Notas personales"
                rows="3"
                variant="outlined"
                clearable
              ></v-textarea>
            </v-window-item>
            
            <v-window-item value="phones">
              <ContactInfoEditor :contact-cedula="contact.contact_cedula" />
            </v-window-item>
            
            <v-window-item value="events">
              <FollowupEvents :contact-cedula="contact.contact_cedula" />
            </v-window-item>

            <v-window-item value="categories">
              <ContactCategories :contact-cedula="contact.contact_cedula" />
            </v-window-item>
          </v-window>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="grey" variant="text" @click="closeModal" :disabled="isSaving">Cancelar</v-btn>
        <v-btn color="primary" variant="flat" @click="saveDetails" :loading="isSaving" :disabled="!formValid || isSaving">Guardar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed, defineProps, defineEmits } from 'vue';
import { useAgendaStore } from '@/stores/useAgendaStore';
import { useSnackbar } from '@/composables/useSnackbar';

// Importación de componentes hijos
import ContactInfoEditor from './ContactInfoEditor.vue';
import FollowupEvents from './FollowupEvents.vue';
import ContactCategories from './ContactCategories.vue';

// Props y Emits
const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  contact: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'update-agenda']);

// Store y Composables
const agendaStore = useAgendaStore();
const { showSnackbar } = useSnackbar();

// Estado local
const tab = ref('notes');
const form = ref(null);
const formValid = ref(false);
const isLoading = ref(false);
const isSaving = ref(false);

// Propiedad computada para mostrar el nombre correcto (personalizado o de la guía)
const displayedName = computed(() => {
  if (agendaStore.contactName && agendaStore.contactName.nombre_personalizado) {
    return agendaStore.contactName.nombre_personalizado;
  }
  return props.contact?.completo || '';
});

// Watcher para cargar los datos del contacto cuando se abre el modal
watch(() => props.modelValue, async (newVal) => {
  if (newVal && props.contact) {
    isLoading.value = true;
    try {
      // Usamos la nueva acción unificada del store
      await agendaStore.fetchContactData(props.contact.contact_cedula);
    } catch (error) {
      showSnackbar('Error al cargar los detalles del contacto.', 'error');
      closeModal();
    } finally {
      isLoading.value = false;
    }
  }
});

// Guardar los detalles del contacto
const saveDetails = async () => {
  isSaving.value = true;
  try {
    const detailsPayload = {
      cedula: props.contact.contact_cedula,
      ...agendaStore.currentContactDetails,
    };
    
    // Llamar a las acciones del store para guardar los datos
    await agendaStore.upsertContactDetails(detailsPayload);
    
    if (agendaStore.contactName && agendaStore.contactName.nombre_personalizado) {
      await agendaStore.upsertUserNombre({
        contact_cedula: props.contact.contact_cedula,
        nombre_personalizado: agendaStore.contactName.nombre_personalizado,
      });
    }

    if (agendaStore.currentContactDetails.notas) {
      await agendaStore.upsertContactNote({
        contact_cedula: props.contact.contact_cedula,
        cuerpo: agendaStore.currentContactDetails.notas,
      });
    }

    showSnackbar('Detalles guardados con éxito.', 'success');
    emit('update-agenda');
    closeModal();

  } catch (error) {
    showSnackbar('Error al guardar los detalles.', 'error');
    console.error('Error al guardar los detalles:', error);
  } finally {
    isSaving.value = false;
  }
};

const closeModal = () => {
  emit('update:modelValue', false);
};
</script>