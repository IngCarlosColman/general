Sí, podemos hacer que la capa de parcelas no se cargue automáticamente y solo aparezca al hacer clic en el switch.

El problema actual es que, aunque el switch se inicializa en un estado inactivo (`v-model="false"`), la capa de parcelas se agrega al mapa con su visibilidad por defecto (`true`) cuando el componente se monta.

La solución más limpia y eficiente es simplemente inicializar la capa de parcelas con la propiedad `visible` en `false`. De esta manera, no se cargará visualmente hasta que el switch la active.

-----

### **📝 Código de `Mapa.vue` con la Carga de Parcelas Condicional**

He modificado la definición de la capa `catastroLayer` para que no sea visible al inicio.

```vue
<template>
  <div class="map-container-wrapper">
    <div class="map-controls">
      <v-switch
        v-model="showCatastroLayer"
        label="Mostrar Parcelas"
        color="primary"
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
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import XYZ from 'ol/source/XYZ';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import 'ol/ol.css';

const mapContainer = ref(null);
const map = ref(null);
const showCatastroLayer = ref(false); // ✅ Inicializa en falso

const coordinates = ref({ lat: 0, lon: 0 });

const currentBaseMap = ref('OpenStreetMap');

const minZoomLevel = 2.5;
const maxZoomLevel = 18;
const initialZoomLevel = 6.5;
const selectedZoom = ref(initialZoomLevel);

const buttonText = computed(() => {
  return currentBaseMap.value === 'OpenStreetMap' ? 'Satélite' : 'Mapa';
});

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
  visible: false // ✅ La capa no se carga al inicio
});
catastroLayer.set('name', 'catastro_layer');

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
        catastroLayer
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

watch(currentBaseMap, (newBaseMap) => {
  osmLayer.setVisible(newBaseMap === 'OpenStreetMap');
  sentinelLayer.setVisible(newBaseMap === 'Sentinel-2');
}, { immediate: true });

watch(showCatastroLayer, (newValue) => {
  if (map.value) {
    const layerToToggle = map.value.getLayers().getArray().find(l => l.get('name') === 'catastro_layer');
    if (layerToToggle) {
      layerToToggle.setVisible(newValue);
    }
  }
});

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
