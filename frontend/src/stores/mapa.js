import { defineStore } from 'pinia';
import { ref } from 'vue';
import axiosClient from '../api/axiosClient';

export const useMapaStore = defineStore('mapa', () => {
  // === ESTADO (STATE) ===
  // Almacena las propiedades que tienen datos de mapa.
  const propiedadesMapa = ref([]);
  // Indica si el proceso de obtención de mapas está en curso.
  const isGettingMaps = ref(false);

  // === ACCIONES (ACTIONS) ===

  /**
   * Actualiza el estado de las propiedades en el store del mapa.
   * Esta función será llamada desde el componente `Catastro.vue`
   * cada vez que se actualice la lista de propiedades filtradas.
   * @param {Array} propiedades - Array de propiedades con geojson.
   */
  const setPropiedadesMapa = (propiedades) => {
    // *** LOG CLAVE 5: Confirma que el store del mapa recibió los datos. ***
    propiedadesMapa.value = propiedades;
  };

  /**
   * Obtiene y procesa los datos geográficos para una propiedad específica.
   * Esta función realiza la llamada a la API y calcula las coordenadas.
   * @param {Object} prop - El objeto de la propiedad.
   * @returns {Object} El resultado de la operación.
   */
  const fetchGeodataForProperty = async (prop) => {
    try {
      const isRural = prop.padron !== null;
      const entrada = isRural
        ? String(prop.padron)
        : `${prop.zona}-${prop.manzana}-${prop.lote}`;

      const response = await axiosClient.get('/mapa', {
        params: {
          dpto: prop.cod_dep,
          dist: prop.cod_ciu,
          entrada: entrada
        }
      });

      const geoData = response.data;
      if (
        geoData &&
        geoData.features &&
        geoData.features.length > 0 &&
        geoData.features[0].bbox
      ) {
        const feature = geoData.features[0];
        const bbox = feature.bbox;
        const lon = (bbox[0] + bbox[2]) / 2;
        const lat = (bbox[1] + bbox[3]) / 2;

        if (geoData.type !== 'FeatureCollection') {
          console.warn('❌ geojson con tipo inválido:', geoData);
          return { success: false, message: 'GeoJSON con estructura inválida.', originalProp: prop };
        }

        const padronCccValue = isRural ? String(prop.padron) : `${prop.zona}-${prop.manzana}-${prop.lote}`;
        const payload = {
          cod_dep: prop.cod_dep,
          cod_ciu: prop.cod_ciu,
          tipo_propiedad: isRural ? 'rural' : 'urbana',
          padron_ccc: padronCccValue,
          geojson: geoData,
        };
        await axiosClient.post('/geo-data', payload);

        // Retorna la propiedad actualizada, no la modifica directamente.
        // La actualización en el store de catastro se hará en un paso posterior.
        return {
          success: true,
          message: 'Datos geográficos obtenidos y guardados.',
          updatedProp: {
            ...prop,
            lat: lat,
            lng: lon,
            geojson: geoData
          }
        };
      } else {
        console.warn('⚠️ No se encontraron features válidas para:', entrada);
        return { success: false, message: 'No se encontraron datos geográficos.', originalProp: prop };
      }
    } catch (error) {
      console.error('🔥 Error en fetchGeodataForProperty:', error.response?.data || error.message);
      return { success: false, message: 'Error al obtener datos geográficos.', originalProp: prop };
    }
  };

  /**
   * Procesa todas las propiedades de una lista para obtener sus datos de mapa.
   * Este es el orquestador de las peticiones a la API de mapas.
   * @param {Array} propiedades - La lista de propiedades a procesar.
   * @returns {Object} Un resumen del resultado del proceso.
   */
  const getMapsForFilteredProperties = async (propiedades) => {
    isGettingMaps.value = true;
    let successCount = 0;
    let failureCount = 0;

    const propertiesToProcess = propiedades.filter(
      (prop) => !prop.lat || !prop.lng
    );

    if (propertiesToProcess.length === 0) {
      isGettingMaps.value = false;
      return {
        success: true,
        message: 'Todas las propiedades de la lista ya tienen coordenadas.'
      };
    }

    const results = await Promise.all(propertiesToProcess.map(async (prop) => {
      const result = await fetchGeodataForProperty(prop);
      return result;
    }));

    // Actualiza el estado local de propiedadesMapa
    const updatedProperties = propiedades.map(prop => {
      const result = results.find(r => r.originalProp?.id === prop.id || r.updatedProp?.id === prop.id);
      return result?.updatedProp || prop;
    });

    setPropiedadesMapa(updatedProperties);

    results.forEach(result => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });

    isGettingMaps.value = false;
    return {
      success: failureCount === 0,
      message: `Proceso finalizado. Éxitos: ${successCount}, Errores: ${failureCount}.`
    };
  };

  return {
    propiedadesMapa,
    isGettingMaps,
    setPropiedadesMapa,
    fetchGeodataForProperty,
    getMapsForFilteredProperties,
  };
});
