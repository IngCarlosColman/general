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
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import XYZ from 'ol/source/XYZ';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import Style from 'ol/style/Style';
import Circle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import 'ol/ol.css';

// === PROPS ===
const props = defineProps({
  properties: {
    type: Array,
    default: () => [],
  },
});

const mapContainer = ref(null);
const map = ref(null);

const showCatastroLayer = ref(false);
const showFilteredParcelsLayer = ref(false); // ✅ Nuevo estado para la capa filtrada

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

// Capa del catastro nacional (WMS)
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

// ✅ Nueva capa para las propiedades filtradas
const filteredPropertiesSource = new VectorSource();
const filteredPropertiesLayer = new VectorLayer({
  source: filteredPropertiesSource,
  style: new Style({
    image: new Circle({
      radius: 6,
      fill: new Fill({
        color: 'rgba(0, 150, 136, 0.8)', // Un color verde azulado
      }),
      stroke: new Stroke({
        color: 'rgba(255, 255, 255, 0.8)',
        width: 2,
      }),
    }),
  }),
  visible: false,
});
filteredPropertiesLayer.set('name', 'filtered_properties_layer');

// === MÉTODOS Y ACCIONES ===
const toggleBaseMap = () => {
  if (currentBaseMap.value === 'OpenStreetMap') {
    currentBaseMap.value = 'Sentinel-2';
  } else {
    currentBaseMap.value = 'OpenStreetMap';
  }
};

const zoomIn = () => {
  if (map.value) {
    const view = map.value.getView();
    view.setZoom(view.getZoom() + 1);
  }
};

const zoomOut = () => {
  if (map.value) {
    const view = map.value.getView();
    view.setZoom(view.getZoom() - 1);
  }
};

// === CICLO DE VIDA ===
onMounted(() => {
  if (mapContainer.value) {
    const mapView = new View({
      center: fromLonLat([-58.4418, -23.4425]),
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
        filteredPropertiesLayer // ✅ Añade la nueva capa al mapa
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
  }
});

// === WATCHERS ===
watch(currentBaseMap, (newBaseMap) => {
  osmLayer.setVisible(newBaseMap === 'OpenStreetMap');
  sentinelLayer.setVisible(newBaseMap === 'Sentinel-2');
}, { immediate: true });

// Sincroniza el switch "Todas las Parcelas" con la capa de catastro
watch(showCatastroLayer, (newValue) => {
  const layer = map.value.getLayers().getArray().find(l => l.get('name') === 'catastro_layer');
  if (layer) {
    layer.setVisible(newValue);
    if (newValue) {
      showFilteredParcelsLayer.value = false; // Desactiva la capa filtrada
    }
  }
});

// Sincroniza el switch "Parcelas Filtradas" con la nueva capa de marcadores
watch(showFilteredParcelsLayer, (newValue) => {
  const layer = map.value.getLayers().getArray().find(l => l.get('name') === 'filtered_properties_layer');
  if (layer) {
    layer.setVisible(newValue);
    if (newValue) {
      showCatastroLayer.value = false; // Desactiva la capa de catastro nacional
    }
  }
});

// ✅ Actualiza los marcadores cuando las propiedades cambian
watch(() => props.properties, (newProperties) => {
  const features = newProperties.map(p => {
    const feature = new Feature({
      geometry: new Point(fromLonLat([parseFloat(p.lng), parseFloat(p.lat)])),
      ...p // Asigna todas las propiedades de la tabla al feature
    });
    feature.set('id', p.id);
    return feature;
  });
  filteredPropertiesSource.clear();
  filteredPropertiesSource.addFeatures(features);
}, { deep: true });

watch(selectedZoom, (newZoom) => {
  if (map.value) {
    map.value.getView().setZoom(newZoom);
  }
});
</script>

<style scoped>
.map-container-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
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
