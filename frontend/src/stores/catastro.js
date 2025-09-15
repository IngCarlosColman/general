import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import axiosClient from '../api/axiosClient';

export const useCatastroStore = defineStore('catastro', () => {
  // === ESTADO (STATE) ===
  const departamentos = ref([]);
  const ciudades = ref([]);
  const propiedades = ref([]);
  const totalPropiedades = ref(0);
  const isLoading = ref(false);
  const loadingCities = ref(false);
  const loadingCadastre = reactive({});
  const error = ref(null);

  // === ACCIONES (ACTIONS) ===

  const fetchDepartamentos = async () => {
    try {
      isLoading.value = true;
      const response = await axiosClient.get(`/departamentos`);
      departamentos.value = response.data.items;
      error.value = null;
    } catch (err) {
      console.error('Error al cargar departamentos:', err);
      error.value = 'Error al cargar departamentos. Verifique su backend.';
    } finally {
      isLoading.value = false;
    }
  };

  const fetchCiudades = async (codDep) => {
    if (!codDep) {
      ciudades.value = [];
      return;
    }
    loadingCities.value = true;
    try {
      const response = await axiosClient.get(`/ciudades?cod_dep=${codDep}`);
      ciudades.value = response.data.items.map(city => ({
        ...city,
        value: `${city.cod_dep}-${city.cod_ciu}`,
      }));
      error.value = null;
    } catch (err) {
      console.error('Error al cargar ciudades:', err);
      error.value = 'Error al cargar ciudades.';
    } finally {
      loadingCities.value = false;
    }
  };

  const searchProperties = async (form, options) => {
    isLoading.value = true;
    error.value = null;

    let queryParams = new URLSearchParams();
    queryParams.set('page', options.page);
    queryParams.set('itemsPerPage', options.itemsPerPage);
    queryParams.set('sortBy', JSON.stringify(options.sortBy));

    if (form.departamento) queryParams.set('departamento', form.departamento);
    if (form.ciudad) queryParams.set('ciudad', form.ciudad);
    if (form.padron_ccc) queryParams.set('padron_ccc', form.padron_ccc);
    if (form.tipoPropiedad === 'Rural') {
      if (form.has_min) queryParams.set('has_min', form.has_min);
      if (form.has_max) queryParams.set('has_max', form.has_max);
    } else {
      if (form.m2_min) queryParams.set('mts2_min', form.m2_min);
      if (form.m2_max) queryParams.set('mts2_max', form.m2_max);
    }

    const endpoint = form.tipoPropiedad === 'Rural' ? '/proprurales' : '/prourbanas';

    try {
      const response = await axiosClient.get(`${endpoint}?${queryParams.toString()}`);
      propiedades.value = response.data.items;
      totalPropiedades.value = response.data.totalItems;
    } catch (err) {
      console.error('Error al cargar propiedades:', err);
      error.value = 'Error al cargar propiedades. Verifique su backend.';
      propiedades.value = [];
      totalPropiedades.value = 0;
    } finally {
      isLoading.value = false;
    }
  };

// ====================================================================
// ==================== INICIO DEL CÓDIGO CORREGIDO ===================
// ====================================================================

const createOrUpdateProprietorsBatch = async (proprietors, item, isRural) => {
    // Si la lista de propietarios está vacía, crea un payload con "Sin Datos"
    if (!proprietors || proprietors.length === 0) {
        const padronCccValue = isRural ? String(item.padron) : `${item.zona}-${item.manzana}-${item.lote}`;

        const proprietorsPayload = [{
            cod_dep: item.cod_dep,
            cod_ciu: item.cod_ciu,
            tipo_propiedad: isRural ? 'rural' : 'urbana',
            cedula_propietario: null, // Enviamos null para que el backend lo maneje
            nombre_propietario: 'Sin Datos',
            padron_ccc: padronCccValue,
        }];

        try {
            console.log('Datos que se enviarán al backend (Sin Propietarios):', proprietorsPayload);
            await axiosClient.post('/propiedades_propietarios_batch', proprietorsPayload);
            return { success: true, message: 'Vínculo creado exitosamente con Sin Datos.' };
        } catch (linkError) {
            console.error('Error al crear el vínculo con Sin Datos:', linkError);
            return { success: false, message: linkError.response?.data?.error || 'Ocurrió un error desconocido.' };
        }
    }

    // Si hay propietarios, mapea la lista y envía el batch normalmente
    const proprietorsPayload = proprietors.map(p => {
        const padronCccValue = isRural ? String(item.padron) : `${item.zona}-${item.manzana}-${item.lote}`;

        return {
            cod_dep: item.cod_dep,
            cod_ciu: item.cod_ciu,
            tipo_propiedad: isRural ? 'rural' : 'urbana',
            cedula_propietario: p.propNroDocumento || null,
            nombre_propietario: p.propNombre || 'Sin Datos',
            padron_ccc: padronCccValue,
        };
    });

    try {
        console.log('Datos que se enviarán al backend (Con Propietarios):', proprietorsPayload);
        await axiosClient.post('/propiedades_propietarios_batch', proprietorsPayload);
        return { success: true, message: 'Vínculo de propiedad-propietario creado/actualizado exitosamente.' };
    } catch (linkError) {
        console.error('Error al crear el vínculo de propiedad-propietario:', linkError);
        return { success: false, message: linkError.response?.data?.error || 'Ocurrió un error desconocido.' };
    }
};

const searchCadastre = async (item, tipoPropiedad, isRural) => {
    loadingCadastre[item.id] = true;
    let endpoint = '';
    let params = {};

    if (isRural) {
        params = {
            padron: item.padron,
            idDepartamento: item.cod_dep,
            idCiudad: item.cod_ciu,
        };
        endpoint = '/cuenta-rural';
    } else {
        params = {
            pisoNivel: '00',
            dptoSalon: '000',
            zona: item.zona,
            manzana: item.manzana,
            lote: item.lote,
            idDepartamento: item.cod_dep,
            idCiudad: item.cod_ciu,
        };
        endpoint = '/cuenta-corriente';
    }

    try {
        const response = await axiosClient.get(`/catastro`, {
            params: { 
                endpoint: endpoint,
                filters: JSON.stringify(params) 
            },
        });
        // Lógica de `searchCadastre` simplificada. Ahora solo llama a `createOrUpdateProprietorsBatch`
        // y este se encarga de todo.
        const propietarios = response.data.propietariosList || [];
        const batchResult = await createOrUpdateProprietorsBatch(propietarios, item, isRural);

        if (batchResult.success) {
            let nombrePropietario;
            let cedulaPropietario;

            if (propietarios.length > 0) {
                nombrePropietario = propietarios.map(p => p.propNombre || 'Sin Datos').join(', ');
                cedulaPropietario = propietarios.map(p => p.propNroDocumento || 'Sin Datos').join(', ');
            } else {
                nombrePropietario = 'Sin Datos';
                cedulaPropietario = 'Sin Datos';
            }

            const updatedItem = {
                ...item,
                propietario_completo: nombrePropietario,
                cedula_propietario: cedulaPropietario,
            };
            const index = propiedades.value.findIndex(p => p.id === item.id);
            if (index !== -1) {
                propiedades.value[index] = updatedItem;
            }
        }
        return batchResult;
    } catch (err) {
        console.error('Error al consultar catastro o guardar datos:', err);
        return { success: false, message: err.message || 'Error desconocido al consultar el catastro.' };
    } finally {
        loadingCadastre[item.id] = false;
    }
};

  const updateGeneralData = async (cedula, data) => {
    try {
      await axiosClient.put(`/general/${cedula}`, data);
      return { success: true, message: 'Registro actualizado exitosamente.' };
    } catch (err) {
      console.error('Error al actualizar el registro:', err);
      return { success: false, message: err.response?.data?.error || 'Ocurrió un error desconocido.' };
    }
  };

  return {
    departamentos,
    ciudades,
    propiedades,
    totalPropiedades,
    isLoading,
    loadingCities,
    loadingCadastre,
    error,
    fetchDepartamentos,
    fetchCiudades,
    searchProperties,
    searchCadastre,
    updateGeneralData,
  };
});