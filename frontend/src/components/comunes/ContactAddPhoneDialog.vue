<template>
  <v-dialog v-model="dialog" max-width="500px">
    <v-card rounded="xl" class="pa-4">
      <v-card-title class="headline text-center font-weight-bold">Añadir Teléfono</v-card-title>
      <v-divider class="my-3"></v-divider>
      <v-card-text>
        <v-form ref="form" v-model="valid" @submit.prevent="save">
          <v-text-field
            v-model="newPhoneNumber"
            label="Nuevo número de teléfono"
            required
            :rules="phoneRules"
            prepend-inner-icon="mdi-phone"
            variant="solo-filled"
            rounded="lg"
            bg-color="surface-light"
            class="mb-4"
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions class="d-flex justify-center">
        <v-btn
          color="surface-light"
          class="text-on-surface font-weight-bold"
          rounded="lg"
          variant="flat"
          @click="close"
          :disabled="loading"
        >
          Cancelar
        </v-btn>
        <v-btn
          color="primary"
          class="text-white font-weight-bold"
          rounded="lg"
          variant="flat"
          @click="save"
          :loading="loading"
          :disabled="!valid"
        >
          Guardar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';
import apiClient from '@/api/axiosClient';
import { useSnackbar } from '@/composables/useSnackbar';

const props = defineProps({
  modelValue: Boolean
});

// El evento 'phone-added' ahora acepta la cédula
const emit = defineEmits(['phone-added']);

const dialog = ref(false);
const newPhoneNumber = ref('');
const contactId = ref(null);
const contactCedula = ref('');
const loading = ref(false);
const valid = ref(false);
const form = ref(null);

const { showSnackbar } = useSnackbar();

const phoneRules = [
  v => !!v || 'El número de teléfono es obligatorio.',
  v => /^\+?\d+$/.test(v) || 'El número de teléfono no es válido.'
];

const open = (item) => {
  contactId.value = item.id;
  contactCedula.value = item.cedula;
  newPhoneNumber.value = '';
  dialog.value = true;
};

const save = async () => {
  if (!form.value.validate()) return;
  
  loading.value = true;
  try {
    const url = `/general/${contactCedula.value}/add-phone`;
    const payload = {
      telefono: newPhoneNumber.value,
    };

    await apiClient.patch(url, payload);
    showSnackbar('Número de teléfono añadido con éxito.', 'success');
    
    // Ahora emitimos la cédula para que el componente padre sepa qué registro actualizar
    emit('phone-added', contactCedula.value);
    
    close();
  } catch (error) {
    console.error('Error al añadir teléfono:', error);
    showSnackbar('Error al añadir el número de teléfono.', 'error');
  } finally {
    loading.value = false;
  }
};

const close = () => {
  dialog.value = false;
};

watch(() => dialog.value, (val) => {
  if (!val) {
    form.value.resetValidation();
  }
});

defineExpose({ open });
</script>
<style scoped>
.v-dialog {
  transition: all 0.3s ease-in-out;
}
.v-card {
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  border: 1px solid rgba(0,0,0,0.05);
}
.headline {
  color: #1a237e;
}
.v-btn {
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
</style>
