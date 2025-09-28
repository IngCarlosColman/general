import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import axiosClient from '../api/axiosClient';
import pLimit from 'p-limit';

// Establece el límite de concurrencia para las llamadas lentas a la API externa
const limit = pLimit(3);

export const useMapaStore = defineStore('mapa', () => {
  // === ESTADO (STATE) ===
  const propiedadesMapa = ref([]);
  const isGettingMaps = ref(false);
  // Nuevo estado para evitar reintentar padrones que fallaron en la sesión actual
  const failedPadrones = ref({}); // { 'padron_ccc': true }

  // 🔑 ESTADOS NUEVOS PARA LA CONSULTA ESPACIAL
  const queryResults = ref([]); // Almacena los resultados de la consulta espacial (que ya incluyen GeoJSON)
  const isQueryingSpatial = ref(false); // Estado de carga para la consulta espacial
  
  // === ACCIONES (ACTIONS) ===

  const setPropiedadesMapa = (propiedades) => {
    // *** LOG CLAVE 5: Confirma que el store del mapa recibió los datos. ***
    propiedadesMapa.value = propiedades;
  };
  
  /**
   * Inicia un temporizador de 15 segundos que desactiva el botón
   * para evitar peticiones demasiado frecuentes a la API.
   */
  
  /**
   * UTILIDAD: Calcula Lat/Lng (centroide simple) y actualiza el objeto de la propiedad
   * a partir del GeoJSON. Necesario para las propiedades recuperadas de la caché.
   * @param {Object} prop - El objeto de la propiedad.
   * @param {Object} geojson - El GeoJSON almacenado en la caché.
   * @returns {Object} La propiedad actualizada con lat/lng.
   */
  const getCoordsFromGeoJSON = (prop, geojson) => {
    let lat = null;
    let lng = null;
    
    // 1. Intenta usar el bbox del FeatureCollection para un centrado rápido
    // Nota: El bbox debe estar en el SRID del mapa (32721), lo que puede causar problemas si se interpreta como 4326.
    // Por ahora, mantenemos la lógica pero es un punto a revisar si el centrado es incorrecto.
    if (geojson.bbox && geojson.bbox.length === 4) {
      // Usamos el punto central del BBox 
      lng = (geojson.bbox[0] + geojson.bbox[2]) / 2; 
      lat = (geojson.bbox[1] + geojson.bbox[3]) / 2;
      
      // Si tenemos coordenadas válidas y no son (0,0), las usamos
      if (lat && lng && lat !== 0 && lng !== 0) {
        return {
          ...prop,
          lat: lat,
          lng: lng,
          geojson: geojson
        };
      }
    }
    
    // 2. Fallback: usar el primer punto del primer polígono si el bbox no funciona
    if (geojson.features && geojson.features.length > 0) {
        const feature = geojson.features[0];
        if (feature.geometry && feature.geometry.type.includes('Polygon')) {
            // Coordenadas: [X (Lng), Y (Lat)] en 32721
            const coords = feature.geometry.coordinates[0][0]; 
            lng = coords[0];
            lat = coords[1];
        }
    }

    return {
      ...prop,
      lat: lat,
      lng: lng,
      geojson: geojson
    };
  };

  /**
   * Obtiene y procesa los datos geográficos para una propiedad específica.
   * Esta función SOLO se llama para propiedades que NO están en la CACHÉ.
   * @param {Object} prop - El objeto de la propiedad.
   * @returns {Object} El resultado de la operación.
   */
  const fetchGeodataForProperty = async (prop) => {
    // ... (Lógica existente para fetch de WFS y Upsert) ...
    const isRural = prop.padron !== null;
    // padronCcc es la clave en la BD, entrada es el valor que Catastro espera (padrón o ZONA-MZ-LOTE)
    const padronCcc = isRural 
        ? String(prop.padron) 
        : `${prop.zona}-${prop.manzana}-${prop.lote}`;
    
    // Entrada para la API de Catastro
    const entrada = isRural 
        ? String(prop.padron) 
        : `${prop.zona}-${prop.manzana}-${prop.lote}`; 

    // *** LOG DE INICIO DE FETCH EXTERNO ***
    console.log(`[🚀] Iniciando fetch geodata para Padron/CCC: ${padronCcc}`);

    try {
      // 1. Llamada a la API externa de catastro (WFS)
      const params = {
          dpto: prop.cod_dep,
          dist: prop.cod_ciu,
          entrada: entrada, // Usamos 'entrada' para la API externa
        };
      // *** LOG WFS PARAMS ***
      console.log(`[🌐 WFS] Llamando a /mapa con params:`, params);

      const mapaResponse = await axiosClient.get('/mapa', { params });

      const geoData = mapaResponse.data;
      if (
        !geoData ||
        !geoData.features ||
        geoData.features.length === 0
      ) {
        // 🚨 MARCA LA PROPIEDAD COMO FALLIDA por falta de features
        failedPadrones.value[padronCcc] = true;
        console.warn('⚠️ No se encontraron features válidas en WFS para:', entrada, geoData);
        return { success: false, message: 'No se encontraron datos geográficos en WFS.', originalProp: prop };
      }
      // *** LOG WFS SUCCESS ***
      console.log(`[✅ WFS] Features encontradas (${geoData.features.length}) para: ${padronCcc}.`);

      // 2. 🔑 Llamada a la CACHÉ local (PostGIS upsert) - Guardamos el resultado
      const payload = {
        cod_dep: prop.cod_dep,
        cod_ciu: prop.cod_ciu,
        tipo_propiedad: isRural ? 'rural' : 'urbana',
        padron_ccc: padronCcc,
        geojson: geoData,
      };
      // *** LOG UPSERT PAYLOAD ***
      console.log(`[💾 UPSERT] Guardando datos en caché PostGIS para: ${padronCcc}`);
      
      // La API interna retorna el registro guardado con las áreas calculadas
      const upsertResult = await axiosClient.post('/geo-data', payload);
      const { area_m2, area_has } = upsertResult.data; 

      // *** LOG UPSERT SUCCESS ***
      console.log(`[👍 UPSERT] Guardado exitoso. Áreas calculadas: M2=${area_m2}, Ha=${area_has}`);

      // 3. Obtener coordenadas de centrado del GeoJSON
      const updatedPropWithCoords = getCoordsFromGeoJSON(prop, geoData);
      
      return {
        success: true,
        message: 'Datos geográficos obtenidos de WFS y guardados en caché.',
        updatedProp: {
          ...updatedPropWithCoords,
          area_m2: parseFloat(area_m2),
          area_has: parseFloat(area_has),
        }
      };
    } catch (error) {
      // 🚨 MARCA LA PROPIEDAD COMO FALLIDA en caso de error de red/servidor
      failedPadrones.value[padronCcc] = true; 
      console.error(`[🔥 FAIL] Error en fetchGeodataForProperty para ${padronCcc} (WFS/Upsert):`, error.response?.data || error.message);
      return { success: false, message: 'Error al obtener datos geográficos.', originalProp: prop };
    }
  };

  /**
   * 🔑 NUEVO ORQUESTADOR DE ALTO RENDIMIENTO (EXISTENTE)
   * Utiliza el Batch-Check de la caché local y aplica Throttling a las llamadas externas.
   * @param {Array} propiedades - La lista de propiedades a procesar.
   * @returns {Object} Un resumen del resultado del proceso.
   */
  const getMapsForFilteredProperties = async (propiedades) => {
    // ... (Lógica existente) ...
    // Protección adicional: si ya está en cooldown, salir inmediatamente
    
    isGettingMaps.value = true;
    console.log(`\n--- [🎬 INICIO PROCESO MAPEO] - Total de propiedades recibidas: ${propiedades.length} ---`);

    let successCount = 0;
    let failureCount = 0;
    let cacheHits = 0;
    let skippedFailures = 0;
    let externalSuccess = 0;

    // 1. Preparar lista de padrones para la consulta rápida de caché
    const padronesToProcess = propiedades
      .map(prop => {
        const isRural = prop.padron !== null;
        return isRural ? String(prop.padron) : `${prop.zona}-${prop.manzana}-${prop.lote}`;
      })
      .filter(Boolean);

    console.log(`[1/7] Padrones únicos para Batch-Check (${padronesToProcess.length}):`, padronesToProcess.slice(0, 5));
    
    let cacheMap = {};
    if (padronesToProcess.length > 0) {
      try {
        // 2. ⚡ CONSULTA RÁPIDA A LA CACHÉ LOCAL
        const response = await axiosClient.post('/geo-data/batch-check', { padrones: padronesToProcess });
        cacheMap = response.data; 
        console.log(`[2/7] Resultados del Batch-Check. Cache hits encontrados (Padrones Únicos): ${Object.keys(cacheMap).length}`);
      } catch (e) {
        console.error('[🔥 FAIL] Error en la consulta Batch-Check:', e.message);
      }
    }

    // 3. Separar propiedades en tres grupos: Caché, Externa, y Ya Procesada/Fallida
    const results = [];
    const propertiesToFetchExternal = [];
    
    console.log('[3/7] Clasificando propiedades...');
    
    propiedades.forEach((prop) => {
      const isRural = prop.padron !== null;
      const padronCcc = isRural ? String(prop.padron) : `${prop.zona}-${prop.manzana}-${prop.lote}`;
      
      if (cacheMap[padronCcc]) {
        // A) Propiedad encontrada en CACHÉ (Proceso FAST)
        const cachedData = cacheMap[padronCcc];
        
        // El GeoJSON viene como objeto parseado desde el backend (no necesita parseo adicional)
        const parsedGeojson = cachedData.geojson; 

        // Calcular coordenadas de centrado desde el GeoJSON de la caché
        const updatedPropWithCoords = getCoordsFromGeoJSON(prop, parsedGeojson);
        
        results.push({
          success: true,
          message: 'Datos geográficos obtenidos de caché.',
          updatedProp: {
            ...updatedPropWithCoords,
            area_m2: parseFloat(cachedData.area_m2),
            area_has: parseFloat(cachedData.area_has),
            geojson: parsedGeojson 
          }
        });
        cacheHits++;
        console.log(`[INFO] Propiedad ${prop.id} (${padronCcc}): Encontrada en CACHÉ. FAST LANE.`);
      
      } else if (failedPadrones.value[padronCcc]) {
        // C-1) Propiedad que falló en un intento anterior y se salta (DEDUPLICACIÓN DE FALLOS)
        skippedFailures++;
        results.push({ success: false, message: 'Skipped: Falló en intento anterior.', originalProp: prop });
        console.log(`[INFO] Propiedad ${prop.id} (${padronCcc}): FALLIDA/SALTADA (Previamente fallida).`);
      
      } else {
        // B) Propiedad NO en caché -> Fetch EXTERNO (Proceso SLOW + Throttling)
        propertiesToFetchExternal.push(prop);
        console.log(`[INFO] Propiedad ${prop.id} (${padronCcc}): No está en caché. A COLA EXTERNA.`);
      }
    });

    // 4. Aplicar Throttling a las llamadas EXTERNAS
    console.log(`[4/7] Iniciando llamadas externas con Throttling (Límite: ${limit.concurrency}). Total a procesar: ${propertiesToFetchExternal.length}`);
    const externalPromises = propertiesToFetchExternal.map(prop => 
      limit(() => fetchGeodataForProperty(prop))
    );
    
    // 5. Ejecutar las promesas externas y añadir los resultados a la lista general
    const externalResults = await Promise.all(externalPromises);
    results.push(...externalResults);
    console.log(`[5/7] Todas las promesas externas han finalizado.`);


    // 6. Consolidar resultados y actualizar el store
    console.log(`[6/7] Consolidando resultados y actualizando propiedadesMapa...`);
    const updatedProperties = propiedades.map(prop => {
      // Buscar el resultado, ya sea de caché, de WFS o el original si falló
      const result = results.find(r => r.updatedProp?.id === prop.id || r.originalProp?.id === prop.id);
      
      // Aplicar los datos actualizados, mantener el original si es un fallo sin updateProp
      return result?.updatedProp || prop;
    });

    setPropiedadesMapa(updatedProperties); // Actualiza el store
    
    // 7. Reporte final
    results.forEach(result => {
      if (result.success) {
        successCount++;
        if (result.message.includes('WFS')) {
            externalSuccess++;
        }
      } else {
        // Solo contamos fallos reales (no los saltados)
        if (!result.message.includes('Skipped')) {
          failureCount++;
        }
      }
    });

    isGettingMaps.value = false;
    
    // 🔑 APLICAR EL COOLDOWN DE 15 SEGUNDOS
    // Se inicia el enfriamiento solo si se realizaron llamadas externas o hubo hits de caché

    console.log('--- [✅ FIN PROCESO MAPEO] ---');
    console.log(`Reporte Final: Éxitos Totales: ${successCount} (Caché: ${cacheHits}, WFS+Save: ${externalSuccess}). Fallos Reales: ${failureCount}. Saltados: ${skippedFailures}.`);
    
    return {
      success: failureCount === 0 && skippedFailures === 0,
      message: `Proceso finalizado. Total: ${successCount} éxitos (Caché: ${cacheHits}, WFS + Guardado: ${externalSuccess}). Errores reales: ${failureCount}. Reintentos fallidos saltados: ${skippedFailures}.`
    };
  };
  
  
  /**
   * 🆕 ACCIÓN CORREGIDA: Ejecuta una consulta espacial y atributiva.
   * Los resultados ya vienen con el GeoJSON y los atributos de la BD.
   * @param {Object} payload - Objeto con el polígono (geojson) y filtros atributivos.
   * @returns {Object} Un resumen del resultado del proceso.
   */
  const queryGeoSpatial = async (payload) => {
    isQueryingSpatial.value = true;
    queryResults.value = []; // Limpiar resultados anteriores
    console.log(`\n--- [🎬 INICIO CONSULTA ESPACIAL] ---`);
    console.log(`[INFO] Payload de consulta:`, payload);

    try {
      // La ruta es POST /geo-data/query
      const response = await axiosClient.post('/geo-data/query', payload);
      // El backend retorna el objeto completo con `results`
      const results = response.data.results; 

      // 1. Mapear y parsear los datos
      const parsedResults = results.map(item => ({
        ...item,
        // 🚨 CORRECCIÓN CLAVE: Usamos 'geojson' directamente, ya que el backend lo parseó
        // (La versión previa usaba JSON.parse(item.geojson_data), ahora es solo item.geojson)
        geojson: item.geojson,
        area_m2: parseFloat(item.area_m2),
        area_has: parseFloat(item.area_has),
        // Usamos el padron_ccc como una clave única de negocio si no hay ID
        id_display: item.padron_ccc, 
      }));

      queryResults.value = parsedResults;
      console.log(`[✅ CONSULTA ESPACIAL] Éxito. ${parsedResults.length} parcelas encontradas.`);
      return { success: true, count: parsedResults.length, message: `Consulta espacial finalizada. ${parsedResults.length} resultados encontrados.` };

    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      console.error('[🔥 FAIL] Error en la consulta espacial:', errorMessage);
      return { success: false, message: `Error al ejecutar la consulta espacial: ${errorMessage}` };
    } finally {
      isQueryingSpatial.value = false;
      console.log('--- [✅ FIN CONSULTA ESPACIAL] ---');
    }
  };


  return {
    propiedadesMapa,
    isGettingMaps,
    queryResults, // 🆕 NUEVO: Resultados de la consulta espacial
    isQueryingSpatial, // 🆕 NUEVO: Estado de carga de la consulta espacial
    failedPadrones,
    setPropiedadesMapa,
    fetchGeodataForProperty,
    getMapsForFilteredProperties,
    queryGeoSpatial, // 🆕 NUEVA ACCIÓN
  };
});