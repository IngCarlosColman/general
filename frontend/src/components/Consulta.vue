<template>
  <v-container fluid class="pa-2">
    <v-card class="pa-4 elevation-12" width="100%" rounded="lg">
      <div class="text-center mb-6">
        <v-icon size="64" color="primary">mdi-card-account-details</v-icon>
        <h2 class="text-h4 font-weight-bold text-primary mt-2">
          Consulta de Datos Personales
        </h2>
        <p class="text-body-1 text-medium-emphasis">
          Verifica la información de una persona por cédula o nombre.
        </p>
      </div>

      <v-form @submit.prevent="consultarDatos">
        <v-text-field
          v-model="busqueda"
          label="Cédula o Nombre completo"
          prepend-inner-icon="mdi-account-search-outline"
          clearable
          rounded="xl"
          variant="solo"
          class="mb-4"
          bg-color="surface-light"
        ></v-text-field>
        <v-btn
          type="submit"
          block
          color="primary"
          :loading="isLoading"
          :disabled="!busqueda"
          size="large"
          rounded="xl"
          class="font-weight-bold"
        >
          <v-icon left>mdi-magnify</v-icon>
          Consultar
        </v-btn>
      </v-form>

      <v-divider class="my-6"></v-divider>

      <v-fade-transition hide-on-leave>
        <div v-if="!isLoading && !resultado" class="text-center">
          <v-icon size="72" color="grey-lighten-1">mdi-search-web</v-icon>
          <p class="text-body-1 text-medium-emphasis mt-2">
            ¡Inicia tu búsqueda!
          </p>
        </div>
        <div v-if="!isLoading && resultado && resultado.length === 0" class="text-center">
          <v-icon size="72" color="warning">mdi-alert-circle-outline</v-icon>
          <p class="text-body-1 text-medium-emphasis mt-2">
            No se encontraron coincidencias.
          </p>
        </div>
        <div v-if="error && !isLoading" class="text-center">
          <v-icon size="72" color="error">mdi-close-circle-outline</v-icon>
          <p class="text-body-1 text-medium-emphasis mt-2">
            Ocurrió un error. Intenta de nuevo más tarde.
          </p>
        </div>
      </v-fade-transition>

      <v-fade-transition group>
        <div v-if="resultado && resultado.length > 0" class="mt-6">
          <v-alert
            type="success"
            variant="tonal"
            class="mb-4 text-center font-weight-bold"
            rounded="lg"
            :title="`Se encontraron ${resultado.length} resultados`"
          >
            <template v-slot:prepend>
              <v-icon>mdi-check-circle-outline</v-icon>
            </template>
          </v-alert>

          <v-expansion-panels variant="accordion">
            <v-expansion-panel
              v-for="(persona, index) in resultado"
              :key="persona.cedula || index"
            >
              <v-expansion-panel-title class="font-weight-medium">
                <v-icon left>mdi-account-circle</v-icon>
                <span class="ml-2">{{ persona.nombresYApellido }}</span>
                <v-spacer></v-spacer>
                <span class="text-caption text-medium-emphasis">C.I.: {{ persona.cedula }}</span>
              </v-expansion-panel-title>
              <v-expansion-panel-text class="pa-4">
                <v-card variant="outlined" rounded="lg">
                  <v-list dense>
                    <v-row no-gutters>
                      <v-col cols="12" sm="6">
                        <v-list-item>
                          <template v-slot:prepend>
                            <v-icon color="primary">mdi-calendar-range</v-icon>
                          </template>
                          <v-list-item-title class="font-weight-bold">Fecha de Nacimiento:</v-list-item-title>
                          <v-list-item-subtitle>{{ formatearFecha(persona.fec_nac) }}</v-list-item-subtitle>
                        </v-list-item>

                        <v-list-item>
                          <template v-slot:prepend>
                            <v-icon color="primary">mdi-numeric-1-box-outline</v-icon>
                          </template>
                          <v-list-item-title class="font-weight-bold">Edad:</v-list-item-title>
                          <v-list-item-subtitle>{{ calcularEdad(persona.fec_nac) }} años</v-list-item-subtitle>
                        </v-list-item>

                        <v-list-item>
                          <template v-slot:prepend>
                            <v-icon color="primary">mdi-cake-variant</v-icon>
                          </template>
                          <v-list-item-title class="font-weight-bold">Aniversario:</v-list-item-title>
                          <v-list-item-subtitle>{{ formatearAniversario(persona.fec_nac) }}</v-list-item-subtitle>
                        </v-list-item>

                        <v-list-item>
                          <template v-slot:prepend>
                            <v-icon color="primary">mdi-gender-male-female</v-icon>
                          </template>
                          <v-list-item-title class="font-weight-bold">Sexo:</v-list-item-title>
                          <v-list-item-subtitle>{{ persona.sexo === 'M' ? 'Masculino' : 'Femenino' }}</v-list-item-subtitle>
                        </v-list-item>
                      </v-col>

                      <v-col cols="12" sm="6">
                        <v-list-item>
                          <template v-slot:prepend>
                            <v-icon color="primary">mdi-map-marker-outline</v-icon>
                          </template>
                          <v-list-item-title class="font-weight-bold">Dirección:</v-list-item-title>
                          <v-list-item-subtitle>{{ persona.direcc || 'N/A' }}</v-list-item-subtitle>
                        </v-list-item>

                        <v-list-item>
                          <template v-slot:prepend>
                            <v-icon color="primary">mdi-office-building-outline</v-icon>
                          </template>
                          <v-list-item-title class="font-weight-bold">Departamento:</v-list-item-title>
                          <v-list-item-subtitle>{{ persona.departamento_nombre }}</v-list-item-subtitle>
                        </v-list-item>

                        <v-list-item>
                          <template v-slot:prepend>
                            <v-icon color="primary">mdi-phone-in-talk-outline</v-icon>
                          </template>
                          <v-list-item-title class="font-weight-bold">Teléfonos Registrados:</v-list-item-title>
                          <v-list-item-subtitle class="pt-1">
                            <v-chip-group column>
                              <template v-if="persona.telefonos && persona.telefonos.length > 0">
                                <v-chip
                                  v-for="(tel, telIndex) in persona.telefonos"
                                  :key="telIndex"
                                  size="small"
                                  :color="tel.tipo?.toLowerCase().includes('principal') ? 'success' : 'info'"
                                  label
                                  variant="flat"
                                  class="font-weight-bold me-2 mb-1"
                                >
                                  <v-icon start :icon="tel.tipo?.toLowerCase().includes('principal') ? 'mdi-star' : 'mdi-phone-dial'"></v-icon>
                                  {{ tel.tipo || 'N/A' }}:
                                  <span class="ml-1">{{ tel.numero || 'N/A' }}</span>
                                </v-chip>
                              </template>

                              <v-chip v-else color="error" size="small" label>
                                <v-icon start>mdi-phone-off</v-icon>
                                No registra teléfonos
                              </v-chip>
                            </v-chip-group>
                          </v-list-item-subtitle>
                        </v-list-item>
                        </v-col>
                    </v-row>
                  </v-list>
                </v-card>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>
      </v-fade-transition>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import axios from '@/api/axiosClient';

const busqueda = ref('');
const resultado = ref(null);
const isLoading = ref(false);
const error = ref(null);

const esCedula = (valor) => /^\d+$/.test(valor);

const consultarDatos = async () => {
  if (!busqueda.value) return;

  isLoading.value = true;
  resultado.value = null;
  error.value = null;

  try {
    const params = {};
    if (esCedula(busqueda.value)) {
      params.cedula = busqueda.value;
    } else {
      params.nombre = busqueda.value;
    }

    // 1. Consulta el padrón
    const responsePadron = await axios.get('/consulta_padron', { params });
    const personas = responsePadron.data;

    // Si no se encuentran personas, salimos
    if (personas.length === 0) {
      resultado.value = [];
      return;
    }

    // 2. Extrae las cédulas para la consulta de teléfonos
    const cedulas = personas.map(p => p.cedula).join(',');

    // 3. Consulta los teléfonos
    const responseTelefonos = await axios.get(`/telefonos?cedulas=${cedulas}`);
    const telefonosPorCedula = responseTelefonos.data;

    // 4. Fusiona los teléfonos con los datos del padrón
    const resultadoFinal = personas.map(persona => {
      // Agrega el array de teléfonos a cada objeto de persona
      // Asegúrate de que los datos de teléfono vengan como un array de objetos:
      // [{ numero: '123', tipo: 'Principal' }, { numero: '456', tipo: 'Secundario' }]
      persona.telefonos = telefonosPorCedula[persona.cedula] || [];
      return persona;
    });

    resultado.value = resultadoFinal;

  } catch (err) {
    console.error("Error en la consulta:", err);
    if (err.response && err.response.status === 401) {
      error.value = 'Sesión expirada. Por favor, inicie sesión nuevamente.';
    } else {
      error.value = 'Ocurrió un error al consultar los datos.';
    }
    resultado.value = [];
  } finally {
    isLoading.value = false;
  }
};

const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return 'N/A';
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad;
};

const formatearAniversario = (fecha) => {
  if (!fecha) return 'N/A';
  // Agregar 'T00:00:00' para evitar problemas de zona horaria
  const fechaObj = new Date(fecha + 'T00:00:00');
  const opciones = { day: 'numeric', month: 'long' };
  return fechaObj.toLocaleDateString('es-ES', opciones);
};

const formatearFecha = (fecha) => {
  if (!fecha) return 'N/A';
  const [year, month, day] = fecha.split('-');
  return `${day}/${month}/${year}`;
};

const validarInput = (valor) => {
  if (valor === null || valor.trim() === '') {
    busqueda.value = '';
    resultado.value = null;
    error.value = null;
  }
};
</script>