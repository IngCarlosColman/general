// src/routes/mapa.routes.js

const { Router } = require('express');
const axios = require('axios');
const router = Router();

const { authenticateJWT } = require('../middlewares/auth.middleware');
// ✅ Importación Correcta con desestructuración
const { rateLimitMiddleware } = require('../middlewares/rate_limit.middleware'); 

const WFS_BASE_URL = 'https://www.catastro.gov.py/geoserver/ows';

// 🚨 BLINDAJE: Función de Saneamiento para prevenir Inyección de CQL/SQL
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        // Asegurar que solo trabajamos con strings
        input = String(input); 
    }
    // Escapar todas las comillas simples ('') con dos comillas simples ('')
    return input.replace(/'/g, "''"); 
}

// 🔧 Construye el filtro CQL según tipo de propiedad (AHORA USA EL SANAMIENTO)
function construirCQL(dpto, dist, tipo, datos) {
    // Saneamiento de todos los parámetros antes de usarlos
    const safeDpto = sanitizeInput(dpto);
    const safeDist = sanitizeInput(dist);
    const safeDatos = sanitizeInput(datos);

    if (tipo === 'rural') {
        // Uso de valores saneados
        return `dist='${safeDist}' AND dpto='${safeDpto}' AND padron='${safeDatos}'`;
    }

    if (tipo === 'urbana') {
        const partes = safeDatos.split('-');
        if (partes.length !== 3) {
            throw new Error('Formato urbano inválido. Debe ser zona-manzana-lote');
        }
        const [zona, mz, lote] = partes;
        // Uso de valores saneados
        return `dist='${safeDist}' AND dpto='${safeDpto}' AND zona='${zona}' AND mz='${mz}' AND lote='${lote}'`;
    }

    throw new Error('Tipo desconocido');
}

// 🚀 Ruta proxy para consulta WFS (AHORA BLINDADA)
router.get('/mapa', 
    authenticateJWT, // 1. Restringe el acceso a usuarios logueados
    rateLimitMiddleware(50, 60), // 2. Límite de 50 solicitudes por minuto por usuario
    async (req, res) => {
    try {
        const { dpto, dist, entrada } = req.query;

        if (!dpto || !dist || !entrada) {
            return res.status(400).json({
                error: 'Faltan parámetros obligatorios.',
                required: ['dpto', 'dist', 'entrada']
            });
        }
        
        // 3. Validación de contenido (Asegurar que dpto y dist sean valores seguros, ej. números si son IDs)
        if (!/^\d+$/.test(dpto) || !/^\d+$/.test(dist)) {
            return res.status(400).json({ error: 'Los códigos de departamento y distrito deben ser numéricos.' });
        }

        // Determinar tipo y construir CQL
        const tipo = /^\d+$/.test(entrada) ? 'rural' : 'urbana';
        // La función construirCQL ahora se encarga del saneamiento
        const cql = construirCQL(dpto, dist, tipo, entrada); 

        const params = {
            service: 'WFS',
            version: '1.1.0',
            request: 'GetFeature',
            outputFormat: 'application/json',
            srsname: 'EPSG:32721',
            typename: 'snc:parcelas_activas',
            CQL_FILTER: cql // CQL blindado
        };

        console.log(`🔍 Consulta WFS (${tipo}) →`, cql);

        const response = await axios.get(WFS_BASE_URL, {
            params,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error('❌ Error en proxy WFS:', error.message);
        // Si el error fue por un formato inválido de CQL, devolver 400
        if (error.message.includes('inválido')) {
            return res.status(400).json({ error: error.message });
        }
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ error: 'Error del servidor al conectar con el WFS de Catastro.' });
    }
});

module.exports = router;