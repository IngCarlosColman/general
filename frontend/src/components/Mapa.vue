<template>
  <div class="map-container-wrapper">
    <div class="map-controls">
      <v-switch
        v-model="showCatastroLayer"
        label="Parcelas Pais (Todas)"
        color="primary"
        hide-details
        density="compact"
        class="map-switch"
      ></v-switch>
      <v-switch
        v-model="showFilteredParcelsLayer"
        :label="`Mostrar Resultados (${totalFeatures})`"
        color="teal-darken-2"
        hide-details
        density="compact"
        class="map-switch"
      ></v-switch>
      <v-btn
        :color="isDrawing ? 'error' : 'warning'"
        :loading="mapStore.isQueryingSpatial"
        @click="toggleDrawingMode"
        prepend-icon="mdi-selection-drag"
        size="small"
        class="mt-2"
      >
        {{ isDrawing ? 'Cancelar Dibujo' : 'Filtrar por Área' }}
      </v-btn>
    </div>
    <div ref="mapContainer" class="map-container"></div>
    <div class="map-zoom-bar">
      <v-btn
        icon="mdi-plus"
        size="small"
        @click="zoomIn"
        elevation="0"
      ></v-btn>
      <v-slider
        v-model="selectedZoom"
        :min="minZoomLevel"
        :max="maxZoomLevel"
        :step="0.5"
        direction="vertical"
        class="zoom-slider"
        color="primary"
        hide-details
        thumb-label
      ></v-slider>
      <v-btn
        icon="mdi-minus"
        size="small"
        @click="zoomOut"
        elevation="0"
      ></v-btn>
    </div>
    <v-btn
      :text="buttonText"
      class="layer-switcher-button"
      @click="toggleBaseMap"
      elevation="2"
    ></v-btn>
    <div class="coordinates-display">
      Coordenadas: {{ coordinates.lat.toFixed(6) }}, {{ coordinates.lon.toFixed(6) }}
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed, onUnmounted } from 'vue';
import { useMapaStore } from '../stores/mapa.js';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import OSM from 'ol/source/OSM.js';
import TileWMS from 'ol/source/TileWMS.js';
import XYZ from 'ol/source/XYZ.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { defaults as defaultControls } from 'ol/control.js';
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style.js';
import Draw from 'ol/interaction/Draw.js';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import 'ol/ol.css';

// === REGISTRO DE PROYECCIÓN EPSG:32721 ===
proj4.defs('EPSG:32721', '+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs');
register(proj4);

// === STORE ===
const mapStore = useMapaStore();

// === PROPS ===
const props = defineProps({
  properties: {
    type: Array,
    required: true
  }
});

// === ESTADO LOCAL ===
const mapContainer = ref(null);
const map = ref(null);
const drawInteraction = ref(null);
const showCatastroLayer = ref(false);
const showFilteredParcelsLayer = ref(false);
const coordinates = ref({ lat: 0, lon: 0 });
const currentBaseMap = ref('OpenStreetMap');
const minZoomLevel = 2.5;
const maxZoomLevel = 18;
const initialZoomLevel = 6.5;
const selectedZoom = ref(initialZoomLevel);
const isDrawing = ref(false);
const totalFeatures = computed(() => {
  return filteredPropertiesSource.getFeatures().length;
});

const buttonText = computed(() => {
  return currentBaseMap.value === 'OpenStreetMap' ? 'Satélite' : 'Mapa';
});

// === CAPAS DEL MAPA ===
const osmLayer = new TileLayer({ source: new OSM() });
const sentinelLayer = new TileLayer({
  source: new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributions: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
  }),
});
const catastroLayer = new TileLayer({
  source: new TileWMS({
    url: 'https://www.catastro.gov.py/geoserver/snc/wms',
    params: {
      'LAYERS': 'snc:parcelas_activas',
      'TILED': true,
      'VERSION': '1.1.1',
      'FORMAT': 'image/png'
    },
    serverType: 'geoserver',
  }),
  visible: false
});
catastroLayer.set('name', 'catastro_layer');

// Fuente y Capa para el Dibujo del Usuario
const drawSource = new VectorSource({ wrapX: false });
const drawLayer = new VectorLayer({
  source: drawSource,
  style: new Style({
    fill: new Fill({
      color: 'rgba(25, 118, 210, 0.2)' // Azul menos oscuro
    }),
    stroke: new Stroke({
      color: '#1976D2',
      width: 4
    }),
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({
        color: '#1976D2'
      })
    })
  })
});
drawLayer.set('name', 'draw_layer');

// Fuente y capa para las propiedades filtradas por ATRIBUTO (EXISTENTE)
const filteredPropertiesSource = new VectorSource();
const filteredPropertiesLayer = new VectorLayer({
  source: filteredPropertiesSource,
  style: (feature) => {
    const nombre = feature.get('propietario_completo');
    // Estilo para los resultados de FILTRO POR ATRIBUTO o ESPACIAL
    return new Style({
      stroke: new Stroke({
        color: 'rgba(255, 0, 0, 1.0)',
        width: 3
      }),
      fill: new Fill({
        color: 'rgba(255, 0, 0, 0.3)'
      }),
      text: new Text({
        font: '14px sans-serif',
        text: nombre || '',
        fill: new Fill({ color: '#000' }),
        stroke: new Stroke({ color: '#fff', width: 2 }),
        overflow: true
      })
    });
  },
  visible: false,
});
filteredPropertiesLayer.set('name', 'filtered_properties_layer');

// === MÉTODOS Y ACCIONES ===
const toggleBaseMap = () => {
  currentBaseMap.value = currentBaseMap.value === 'OpenStreetMap' ? 'Sentinel-2' : 'OpenStreetMap';
};

const zoomIn = () => {
  if (map.value) map.value.getView().setZoom(map.value.getView().getZoom() + 1);
};

const zoomOut = () => {
  if (map.value) map.value.getView().setZoom(map.value.getView().getZoom() - 1);
};

/**
 * Maneja el inicio y fin de la interacción de dibujo para la consulta espacial.
 */
const toggleDrawingMode = () => {
  if (!map.value) return;

  if (isDrawing.value) {
    // Detener el modo de dibujo
    map.value.removeInteraction(drawInteraction.value);
    drawInteraction.value = null;
    drawSource.clear(); // Limpiar el dibujo
    isDrawing.value = false;
    console.log('🛑 Modo de dibujo desactivado.');
  } else {
    // Iniciar el modo de dibujo
    isDrawing.value = true;
    drawSource.clear(); // Asegurar que no haya geometrías previas
    filteredPropertiesSource.clear(); // Limpiar resultados de filtros anteriores
    mapStore.queryResults = []; // Limpiar resultados del store

    // Usamos 'Polygon' para el filtro de área
    drawInteraction.value = new Draw({
      source: drawSource,
      type: 'Polygon',
      freehand: true, // Permite dibujo a mano alzada
    });

    // Evento que se dispara al finalizar el dibujo
    drawInteraction.value.on('drawend', handleDrawEnd);

    map.value.addInteraction(drawInteraction.value);
    console.log('✏️ Modo de dibujo activado. Dibuja un polígono para filtrar.');
  }
};

/**
 * Se ejecuta cuando el usuario termina de dibujar el polígono.
 */
const handleDrawEnd = async (event) => {
  if (!map.value) return;

  // 1. Detener la interacción de dibujo inmediatamente
  map.value.removeInteraction(drawInteraction.value);
  isDrawing.value = false;

  const drawnFeature = event.feature;
  const geometry = drawnFeature.getGeometry();

  // 2. Convertir la geometría de 'EPSG:3857' (mapa) a 'EPSG:4326' (backend/PostGIS espera)
  geometry.transform('EPSG:3857', 'EPSG:4326');

  // 3. Crear el GeoJSON de la geometría dibujada
  const geoJsonFormat = new GeoJSON();
  const geoJson = geoJsonFormat.writeGeometryObject(geometry); // El objeto GeoJSON de la geometría

  // 4. Crear el payload de la consulta.
  const payload = {
    geojson_search: geoJson,
    filters: {
      // Aquí se pueden añadir filtros atributivos adicionales (ej: tipo_propiedad: 'rural')
    }
  };

  // 🚀 LOG AÑADIDO: Muestra exactamente lo que se va a enviar
  console.log('--- [FRONTEND LOG] Payload de consulta enviado ---');
  console.log(payload);
  console.log('-------------------------------------------------');

  // 5. Llamar a la acción del store para ejecutar la consulta espacial
  const result = await mapStore.queryGeoSpatial(payload);

  if (result.success) {
    console.log('✅ Consulta espacial enviada. Resultados en el store.');
  } else {
    // Si falla, limpiar el dibujo y dar feedback
    drawSource.clear();
    alert(result.message || 'Error desconocido al realizar la consulta espacial.');
  }
};

// === FUNCIÓN CLAVE: ACTUALIZA Y RENDERIZA LOS DATOS (EXISTENTE) ===
const updateMapData = (sourceArray) => {
  if (!map.value) return;
  filteredPropertiesSource.clear();

  const SOURCE_PROJ = 'EPSG:32721';
  const TARGET_PROJ = 'EPSG:3857';

  const allFeatures = sourceArray.flatMap(item => {
    // Verificación robusta: GeoJSON debe ser un objeto y tener datos de geometría.
    if (!item.geojson) {
      return [];
    }
    try {
      // 1. Leer las features del GeoJSON
      // OpenLayers puede leer una GeoJSON Geometry o FeatureCollection.
      const features = new GeoJSON().readFeatures(item.geojson);

      features.forEach(f => {
        // 2. Determinar la proyección de origen y transformar a la del mapa (EPSG:3857)
        // Asumimos 32721 para WFS/Cache (prop.padron_ccc) y 4326 para PostGIS Query.
        const isWFSorCache = item.geojson.crs?.properties?.name?.includes('32721') || !!item.padron_ccc;
        const inputProjection = isWFSorCache ? SOURCE_PROJ : 'EPSG:4326';

        f.getGeometry().transform(inputProjection, TARGET_PROJ);
        f.setProperties({
          ...item,
          propietario_completo: item.propietario_completo || 'Sin Nombre' // Asegurar que tenga un nombre para la etiqueta
        });
      });

      return features;
    } catch (e) {
      console.warn('❌ Error al convertir o transformar GeoJSON:', item.id_display || item.id, e);
      return [];
    }
  });

  // 3. Agregar todas las features al VectorSource
  filteredPropertiesSource.addFeatures(allFeatures);

  if (allFeatures.length > 0) {
    // Hacemos la capa explícitamente visible
    filteredPropertiesLayer.setVisible(true);
    showFilteredParcelsLayer.value = true;

    // Desactivar la capa de Catastro completa si activamos las filtradas
    catastroLayer.setVisible(false);
    showCatastroLayer.value = false;

    const extent = filteredPropertiesSource.getExtent();
    if (!extent.some(isNaN)) {
      map.value.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 16,
        duration: 1000
      });
    } else {
      console.log('⚠️ No se pudo obtener el extent de las features (coordenadas inválidas después de la transformación).');
    }
  } else {
    // Si no hay features, limpiamos y ocultamos la capa
    filteredPropertiesSource.clear();
    filteredPropertiesLayer.setVisible(false);
    showFilteredParcelsLayer.value = false;
  }
};

// === CICLO DE VIDA ===
onMounted(() => {
  if (mapContainer.value) {
    const mapView = new View({
      center: fromLonLat([-58.4418, -23.4425]), // Centro de Paraguay
      zoom: initialZoomLevel,
      maxZoom: maxZoomLevel,
      minZoom: minZoomLevel,
    });

    map.value = new Map({
      target: mapContainer.value,
      layers: [
        osmLayer,
        sentinelLayer,
        catastroLayer,
        filteredPropertiesLayer, // La capa de datos filtrados (atributos O espacial)
        drawLayer, // Capa para dibujar
      ],
      view: mapView,
      controls: defaultControls({ zoom: false, attribution: false })
    });
    map.value.on('pointermove', function(event) {
      const lonLat = toLonLat(event.coordinate);
      coordinates.value = { lat: lonLat[1], lon: lonLat[0] };
    });

    map.value.on('moveend', () => {
      selectedZoom.value = mapView.getZoom();
    });

    // Si ya hay propiedades al montar (ej: navegando hacia atrás), las renderiza
    if (props.properties.length > 0) {
        updateMapData(props.properties);
    }
  }
});

// Limpieza al desmontar para evitar fugas de memoria, especialmente con interacciones
onUnmounted(() => {
  if (map.value && drawInteraction.value) {
    map.value.removeInteraction(drawInteraction.value);
  }
  if (map.value) {
    map.value.setTarget(null);
    map.value = null;
  }
});

// === WATCHERS ===
watch(currentBaseMap, (newBaseMap) => {
  osmLayer.setVisible(newBaseMap === 'OpenStreetMap');
  sentinelLayer.setVisible(newBaseMap === 'Sentinel-2');
}, { immediate: true });

// El watcher del switch `showCatastroLayer` funciona para mutualizar la exclusión
watch(showCatastroLayer, (newValue) => {
  catastroLayer.setVisible(newValue);
  if (newValue) showFilteredParcelsLayer.value = false;
});

// El watcher del switch `showFilteredParcelsLayer` se mantiene para control manual
watch(showFilteredParcelsLayer, (newValue) => {
  filteredPropertiesLayer.setVisible(newValue);
  if (newValue) showCatastroLayer.value = false;
});

// WATCHER EXISTENTE: Reacciona a las propiedades filtradas por ATRIBUTO (prop)
watch(() => props.properties, (newPropiedades) => {
  // Esta función sigue siendo válida para las consultas por atributos.
  updateMapData(newPropiedades);
}, { deep: true });

// NUEVO WATCHER: Reacciona a los resultados de la CONSULTA ESPACIAL (store)
watch(() => mapStore.queryResults, (newResults) => {
  // Si hay resultados de la consulta espacial, renderizarlos y limpiar el dibujo
  if (newResults.length > 0) {
    updateMapData(newResults);
    drawSource.clear(); // Limpiar el polígono dibujado
  } else if (newResults.length === 0 && !mapStore.isQueryingSpatial && !isDrawing.value) {
    // Si la consulta terminó sin resultados, limpiamos la capa de resultados
    filteredPropertiesSource.clear();
    showFilteredParcelsLayer.value = false;
  }
}, { deep: true });

watch(selectedZoom, (newZoom) => {
  if (map.value) map.value.getView().setZoom(newZoom);
});

// Watcher para limpiar resultados y dibujo si se desactiva el modo filtrado
watch(showFilteredParcelsLayer, (newValue) => {
  if (!newValue) {
    filteredPropertiesSource.clear();
    // También limpiamos el store, para que al reactivar la capa (toggle) no reaparezcan
    mapStore.queryResults = [];
  }
});
</script>

<style scoped>
.map-container-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
}
.map-container {
  width: 100%;
  height: 100%;
}
.map-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  background-color: white;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.map-switch {
  margin: 0;
  padding: 0;
}
.coordinates-display {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.9rem;
  z-index: 1000;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}
.map-zoom-bar {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0px;
  background-color: rgba(255, 255, 255, 0.432);
  padding: 5px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.zoom-slider {
  height: 290px;
}
:deep(.v-slider-track__background) {
  height: 10px !important;
  border-radius: 5px !important;
}
:deep(.v-slider-track__fill) {
  height: 100% !important;
  border-radius: 5px !important;
}
.map-zoom-bar .v-slider {
  margin-top: 5px;
  margin-bottom: +15px;
}
:deep(.v-slider-thumb) {
  width: 16px !important;
  height: 16px !important;
}
.map-zoom-bar .v-btn {
  min-width: 36px;
  height: 36px;
  border-radius: 50%;
}
.layer-switcher-button {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
}
</style>