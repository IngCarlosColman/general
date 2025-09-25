<template>
  <div class="map-container-wrapper">
    <div class="map-controls">
      <v-switch
        v-model="showCatastroLayer"
        label="Mostrar Parcelas (Todas)"
        color="primary"
        hide-details
        density="compact"
        class="map-switch"
      ></v-switch>
      <v-switch
        v-model="showFilteredParcelsLayer"
        label="Mostrar Parcelas Filtradas"
        color="teal-darken-2"
        hide-details
        density="compact"
        class="map-switch"
      ></v-switch>
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
import { onMounted, ref, watch, computed } from 'vue';
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
import { Fill, Stroke, Style, Text } from 'ol/style.js';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import 'ol/ol.css';

// === REGISTRO DE PROYECCIÓN EPSG:32721 ===
proj4.defs('EPSG:32721', '+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs');
register(proj4);

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

const showCatastroLayer = ref(false);
const showFilteredParcelsLayer = ref(false);
const coordinates = ref({ lat: 0, lon: 0 });
const currentBaseMap = ref('OpenStreetMap');
const minZoomLevel = 2.5;
const maxZoomLevel = 18;
const initialZoomLevel = 6.5;
const selectedZoom = ref(initialZoomLevel);

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

const filteredPropertiesSource = new VectorSource();
const filteredPropertiesLayer = new VectorLayer({
  source: filteredPropertiesSource,
  style: (feature) => {
    const nombre = feature.get('propietario_completo');
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

// === FUNCIÓN CLAVE: ACTUALIZA Y RENDERIZA LOS DATOS ===
const updateMapData = () => {
  if (!map.value) return;
  filteredPropertiesSource.clear();

  const SOURCE_PROJ = 'EPSG:32721';
  const TARGET_PROJ = 'EPSG:3857';

  const allFeatures = props.properties.flatMap(item => {
    // Verificación robusta: GeoJSON debe ser un objeto y tener datos de geometría.
    if (!item.geojson) {
      return [];
    }
    

    try {
      // 1. Leer las features del GeoJSON
      const features = new GeoJSON().readFeatures(item.geojson);

      features.forEach(f => {
        // 2. Transformar la proyección (vital para que se muestre correctamente en el mapa)
        f.getGeometry().transform(SOURCE_PROJ, TARGET_PROJ); 
        f.setProperties({ ...item });
      });
      
      return features;
    } catch (e) {
      console.warn('❌ Error al convertir o transformar GeoJSON:', item.id, e);
      return [];
    }
  });

  // 3. Agregar todas las features al VectorSource
  filteredPropertiesSource.addFeatures(allFeatures);

  if (allFeatures.length > 0) {
    // 🔑 MEJORA: Hacemos la capa explícitamente visible y actualizamos el switch
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
        filteredPropertiesLayer, // La capa de datos filtrados
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
        updateMapData();
    }
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

watch(() => props.properties, (newPropiedades) => {
  // 2. Log en el Watcher (confirma que se están recibiendo datos)
  updateMapData();
}, { deep: true });

watch(selectedZoom, (newZoom) => {
  if (map.value) map.value.getView().setZoom(newZoom);
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