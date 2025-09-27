import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; 
import axiosClient from '../api/axiosClient';
// Opcional: Si quieres usar otros stores como fuente directa

export const useDashboardStore = defineStore('dashboard', () => {
    
    // === ESTADO (STATE) ===
    
    // 1. KPIs de Alto Nivel (Catastro y Guía)
    const kpis = ref({
        totalPropiedades: 0,
        propiedadesConGeojson: 0,
        registrosGuiaTotal: 0,
        registrosGuiaConTelefono: 0,
        // Valor original (puede venir de backend, pero usaremos el calculado)
        catastroPendiente: 0, 
        propiedadesVinculadas: 0, 
    });

    // 2. Cobertura de Funcionarios (Detallado)
    const funcionariosCobertura = ref([]);
        
    // 🎯 NUEVO: KPI global de cobertura telefónica de funcionarios
    const kpiFuncionariosTelefono = ref({
        totalUsuarios: 0,
        usuariosConTelefono: 0,
        porcentaje: 0,
    });
    
    // 3. Gráficos y Distribución
    const distribucionCatastro = ref({
        rural: 0,
        urbana: 0,
        topDepartamentos: [],
    });

    const isLoadingKpis = ref(false);
    const isLoadingDetails = ref(false);

    // === GETTERS (Propiedades Calculadas) ===
    
    /**
     * Calcula el porcentaje de cobertura GEOJSON.
     */
    const coberturaGeojsonPorcentaje = computed(() => {
        const total = kpis.value.totalPropiedades;
        const conGeo = kpis.value.propiedadesConGeojson;
        return total > 0 ? ((conGeo / total) * 100).toFixed(1) : 0;
    });

    /**
     * Calcula el porcentaje de cobertura telefónica en la Guía.
     */
    const coberturaTelefonoPorcentaje = computed(() => {
        const total = kpis.value.registrosGuiaTotal;
        const conTel = kpis.value.registrosGuiaConTelefono;
        return total > 0 ? ((conTel / total) * 100).toFixed(1) : 0;
    });

    /**
     * 🎯 CÁLCULO DEFINITIVO para Catastro Pendiente:
     * Propiedades Totales - Propiedades Vinculadas Únicas.
     */
    const catastroPendienteCalculado = computed(() => {
        const total = kpis.value.totalPropiedades;
        const vinculadas = kpis.value.propiedadesVinculadas;
        
        // Aseguramos que el resultado no sea negativo
        return Math.max(0, total - vinculadas);
    });


    // === ACCIONES (ACTIONS) ===

    /**
     * Carga los KPIs principales (kpis-secundarios)
     */
    const fetchPrincipalKpis = async () => {
        isLoadingKpis.value = true;
        try {
            const response = await axiosClient.get('/dashboard/kpis-secundarios');
            const data = response.data;

            // Asigna los valores recibidos
            kpis.value.totalPropiedades = data.totalPropiedades || 0;
            kpis.value.propiedadesConGeojson = data.propiedadesConGeojson || 0;
            kpis.value.registrosGuiaTotal = data.registrosGuiaTotal || 0;
            kpis.value.registrosGuiaConTelefono = data.registrosGuiaConTelefono || 0;
            kpis.value.catastroPendiente = data.catastroPendiente || 0;
            kpis.value.propiedadesVinculadas = data.propiedadesVinculadas || 0; 

        } catch (error) {
            console.error('Error al cargar KPIs principales (kpis-secundarios):', error);
        } finally {
            isLoadingKpis.value = false;
        }
    };


    /**
     * Carga la métrica detallada de cobertura de funcionarios.
     */
    const fetchFuncionariosCobertura = async () => {
        isLoadingDetails.value = true;
        try {
            const response = await axiosClient.get('/dashboard/cobertura-funcionarios');
            const data = response.data; // Es un objeto: { coberturaDetalle: [...], kpiTelefono: {...} }

            if (Array.isArray(data.coberturaDetalle)) {
                funcionariosCobertura.value = data.coberturaDetalle.map(item => ({
                    ...item,
                    // 🚨 CORRECCIÓN CLAVE: Mapeamos el valor correcto (propiedades_urbanas) a la clave correcta (propiedadesUrbanas)
                    // Eliminamos el mapeo obsoleto 'conTelefono'
                    propiedadesUrbanas: parseInt(item.propiedades_urbanas) || 0,
                    propiedadesRurales: parseInt(item.propiedades_rurales) || 0, // Opcional, pero buena práctica
                    porcentaje: parseFloat(item.porcentaje), 
                }));
            } else {
                console.warn('El endpoint de cobertura no devolvió "coberturaDetalle" como array.');
                funcionariosCobertura.value = [];
            }
            
            // Almacenar el KPI global de funcionarios con teléfono
            if (data.kpiTelefono) {
                kpiFuncionariosTelefono.value = data.kpiTelefono;
            }


        } catch (error) {
            console.error('Error al cargar cobertura de funcionarios:', error);
            funcionariosCobertura.value = [];
        } finally {
            isLoadingDetails.value = false;
        }
    };

    /**
     * Carga los datos necesarios para los gráficos de distribución.
     */
    const fetchDistribucionCatastro = async () => {
        try {
            const response = await axiosClient.get('/dashboard/distribucion-catastro');
            const data = response.data;
            
            distribucionCatastro.value.rural = data.rural || 0;
            distribucionCatastro.value.urbana = data.urbana || 0;
            distribucionCatastro.value.topDepartamentos = data.topDepartamentos || [];

        } catch (error) {
            console.error('Error al cargar distribución del catastro:', error);
        }
    };
    
    /**
     * Ejecuta todas las cargas para el Panel.
     */
    const loadDashboardData = async () => {
        try {
            await Promise.all([
                fetchPrincipalKpis(),
                fetchFuncionariosCobertura(),
                fetchDistribucionCatastro()
            ]);
        } catch (error) {
            console.error('Error al ejecutar Promise.all en loadDashboardData:', error);
        }
    };

    // === RETORNO ===
    return {
        kpis,
        funcionariosCobertura,
        kpiFuncionariosTelefono, 
        distribucionCatastro,
        isLoadingKpis,
        isLoadingDetails,
        coberturaGeojsonPorcentaje,
        coberturaTelefonoPorcentaje,
        catastroPendienteCalculado,
        loadDashboardData,
        fetchPrincipalKpis, 
        fetchFuncionariosCobertura,
    };
});