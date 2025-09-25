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

  const createOrUpdateProprietorsBatch = async (proprietors, item, isRural) => {
    const padronCccValue = isRural ? String(item.padron) : `${item.zona}-${item.manzana}-${item.lote}`;

    if (!proprietors || proprietors.length === 0) {
      const proprietorsPayload = [{
        cod_dep: item.cod_dep,
        cod_ciu: item.cod_ciu,
        tipo_propiedad: isRural ? 'rural' : 'urbana',
        cedula_propietario: null,
        nombre_propietario: 'Sin Datos',
        padron_ccc: padronCccValue,
      }];

      try {
        const response = await axiosClient.post('/propiedades_propietarios_batch', proprietorsPayload);
        if (response.data.insertedRecords && response.data.insertedRecords.length > 0) {
            return {
              success: true,
              message: 'Vínculo creado exitosamente con Sin Datos.',
              id_vinculo: response.data.insertedRecords[0].id_vinculo
            };
        }
        return { success: true, message: 'Vínculo creado exitosamente con Sin Datos.' };
      } catch (linkError) {
        console.error('Error al crear el vínculo con Sin Datos:', linkError);
        return { success: false, message: linkError.response?.data?.error || 'Ocurrió un error desconocido.' };
      }
    }

    const proprietorsPayload = proprietors.map(p => ({
      cod_dep: item.cod_dep,
      cod_ciu: item.cod_ciu,
      tipo_propiedad: isRural ? 'rural' : 'urbana',
      cedula_propietario: p.propNroDocumento || null,
      nombre_propietario: p.propNombre || 'Sin Datos',
      padron_ccc: padronCccValue,
    }));

    try {
      const response = await axiosClient.post('/propiedades_propietarios_batch', proprietorsPayload);
      if (response.data.insertedRecords && response.data.insertedRecords.length > 0) {
        return {
          success: true,
          message: 'Vínculo de propiedad-propietario creado/actualizado exitosamente.',
          id_vinculo: response.data.insertedRecords[0].id_vinculo
        };
      }
      return { success: true, message: 'Vínculo de propiedad-propietario creado/actualizado exitosamente.' };
    } catch (linkError) {
      console.error('Error al crear el vínculo de propiedad-propietario:', linkError);
      return { success: false, message: linkError.response?.data?.error || 'Ocurrió un error desconocido.' };
    }
  };

  const searchCadastre = async (item, tipoPropiedad) => {
    if (!item || !item.id) {
      console.error('Error: El objeto de la propiedad o su ID no es válido.');
      return { success: false, message: 'La propiedad no tiene un ID válido.' };
    }

    loadingCadastre[item.id] = true;

    let endpoint = '';
    let params = {};
    const isRural = tipoPropiedad === 'Rural';

    if (isRural) {
      endpoint = '/cuenta-rural';
      params = {
        padron: item.padron,
        idDepartamento: item.cod_dep,
        idCiudad: item.cod_ciu,
      };
    } else {
      endpoint = '/cuenta-corriente';
      params = {
        zona: item.zona,
        manzana: item.manzana,
        lote: item.lote,
        idDepartamento: item.cod_dep,
        idCiudad: item.cod_ciu,
      };
      if (item.piso) params.pisoNivel = item.piso;
      if (item.salon) params.dptoSalon = item.salon;
    }

    try {
      const response = await axiosClient.get(`/catastro`, {
        params: {
          endpoint: endpoint,
          filters: JSON.stringify(params)
        },
      });
      const propietarios = response.data.propietariosList || [];

      const batchResult = await createOrUpdateProprietorsBatch(propietarios, item, isRural);

      if (batchResult.success && batchResult.id_vinculo) {
        const index = propiedades.value.findIndex(p => p.id === item.id);
        if (index !== -1) {
          propiedades.value[index].id_vinculo = batchResult.id_vinculo;
          console.log(`Propiedad ${item.id} actualizada con id_vinculo: ${batchResult.id_vinculo}`);
        }
      }

      if (batchResult.success) {
        let nombrePropietario;
        let cedulaPropietario;
        let telefonosPropietario = '';

        if (propietarios.length > 0) {
          nombrePropietario = propietarios.map(p => p.propNombre || 'Sin Datos').join(' / ');
          cedulaPropietario = propietarios.map(p => p.propNroDocumento || 'Sin Datos').join(' / ');

          const cedulas = propietarios.map(p => p.propNroDocumento).filter(Boolean).join(',');

          if (cedulas) {
            const responseTelefonos = await axiosClient.get(`/telefonos?cedulas=${cedulas}`);
            const telefonosUnicos = new Set();
            for (const cedula in responseTelefonos.data) {
              responseTelefonos.data[cedula].forEach(numero => {
                telefonosUnicos.add(numero);
              });
            }
            telefonosPropietario = Array.from(telefonosUnicos).join(' / ');
          } else {
            telefonosPropietario = 'Sin Datos';
          }
        } else {
          nombrePropietario = 'Sin Datos';
          cedulaPropietario = 'Sin Datos';
          telefonosPropietario = 'Sin Datos';
        }

        const updatedItem = {
          ...item,
          propietario_completo: nombrePropietario,
          cedula_propietario: cedulaPropietario,
          telefono: telefonosPropietario,
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
