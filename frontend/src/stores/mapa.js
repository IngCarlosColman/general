import { defineStore } from 'pinia';
import { reactive } from 'vue';

export const useMapaStore = defineStore('mapa', () => {
    // Estado reactivo para las propiedades a mostrar en el mapa
    const propiedadesMapa = reactive([]);

    // Estado reactivo para el centro del mapa y el zoom
    const centroMapa = reactive({
        lat: -23.4425,
        lng: -58.4418,
        zoom: 6.5,
    });

    /**
     * @description Establece las propiedades que se mostrarán en el mapa.
     * @param {Array} nuevasPropiedades - Un array de objetos de propiedades.
     */
    const setPropiedadesMapa = (nuevasPropiedades) => {
        // Filtramos las propiedades que tienen coordenadas válidas
        const propiedadesConCoordenadas = nuevasPropiedades.filter(p => p.lat && p.lng);
        propiedadesMapa.splice(0, propiedadesMapa.length, ...propiedadesConCoordenadas);
    };

    /**
     * @description Actualiza el centro y el zoom del mapa.
     * @param {Object} nuevoCentro - Objeto con { lat, lng, zoom }.
     */
    const setCentroMapa = (nuevoCentro) => {
        centroMapa.lat = nuevoCentro.lat;
        centroMapa.lng = nuevoCentro.lng;
        centroMapa.zoom = nuevoCentro.zoom;
    };
    
    // Devolvemos el estado y las acciones del store
    return {
        propiedadesMapa,
        centroMapa,
        setPropiedadesMapa,
        setCentroMapa,
    };
});