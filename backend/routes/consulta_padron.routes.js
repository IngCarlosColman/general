const express = require('express');
const axios = require('axios');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');

// 🔐 API externa (Usa una variable de entorno)
const API_URL = "https://plra.org.py/public/buscar_padron.php";
const API_KEY = process.env.API_KEY; // Se mantiene, pero se usa localmente

// 🔧 Normaliza texto eliminando tildes y reemplazando ñ (Funciones auxiliares OK)
function normalizarTexto(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ñ/g, "n")
        .replace(/Ñ/g, "N")
        .trim();
}

// 🔁 Genera variantes del nombre para reintento inteligente (Funciones auxiliares OK)
function generarVariantes(nombre) {
    const tokens = normalizarTexto(nombre).split(/\s+/);
    const variantes = new Set();

    variantes.add(nombre); // original
    variantes.add(normalizarTexto(nombre)); // normalizada

    // Se mantiene la lógica de reordenamiento de palabras (Apellido Nombre)
    if (tokens.length === 2) {
        variantes.add(`${tokens[1]} ${tokens[0]}`);
    }

    if (tokens.length >= 3) {
        // Generar variantes para nombres/apellidos compuestos.
        variantes.add(`${tokens[0]} ${tokens[1]}`);
        variantes.add(`${tokens[0]} ${tokens[tokens.length - 1]}`);
        variantes.add(`${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`);
        // Se pueden añadir más combinaciones aquí, dependiendo de la necesidad real
    }

    return Array.from(variantes);
}

// 🚀 Construye los encabezados con la clave de API solo en la función
const buildHeaders = () => {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
        "Referer": "https://plra.org.py/public/buscar_enrcp.php",
        // 🚨 BLINDAJE: La API_KEY se inyecta justo antes de la llamada
        "Authorization": `Bearer ${API_KEY}`
    };
};

// -------------------------------------------------------------
// RUTA BLINDADA
// -------------------------------------------------------------

/**
 * Consulta el padrón (PLRA) por cédula o nombre usando un proxy.
 * Protegida con autenticación JWT.
 */
router.get('/consulta_padron', authenticateJWT, async (req, res) => {
    const { cedula, nombre } = req.query;

    if (!cedula && !nombre) {
        return res.status(400).json({ error: 'Debe proporcionar un número de cédula o un nombre para la búsqueda.' });
    }

    // 1. Obtener los encabezados que contienen la clave de API
    const headers = buildHeaders(); 

    // 🔍 Búsqueda por cédula directa
    if (cedula) {
        // 🚨 BLINDAJE: Asegurar que la cédula sea un valor numérico simple
        if (!/^\d+$/.test(cedula)) {
             return res.status(400).json({ error: 'La cédula debe contener solo dígitos.' });
        }
        
        try {
            const response = await axios.get(API_URL, {
                params: { cedula },
                headers: headers // Usa los encabezados construidos localmente
            });

            console.log(`✅ Búsqueda por cédula ${cedula} → ${response.data.length} resultados`);
            return res.json(response.data);
        } catch (error) {
            console.error(`❌ Error al buscar por cédula ${cedula}:`, error.message);
            // Manejo de errores más específico si es posible
            return res.status(500).json({ error: 'Error al consultar la API externa por cédula.' });
        }
    }

    // 2. 🔁 Búsqueda por nombre con variantes
    const variantes = generarVariantes(nombre);
    for (const variante of variantes) {
        try {
            const response = await axios.get(API_URL, {
                params: { nombre: variante },
                headers: headers // Usa los encabezados construidos localmente
            });

            if (Array.isArray(response.data) && response.data.length > 0) {
                console.log(`✅ Coincidencia con variante: "${variante}" → ${response.data.length} resultados`);
                return res.json(response.data);
            }
        } catch (error) {
            console.warn(`⚠️ Variante fallida: "${variante}" → ${error.message}`);
        }
    }

    console.log(`❌ No se encontraron coincidencias para ninguna variante de "${nombre}"`);
    return res.status(404).json({ error: 'No se encontraron coincidencias con ninguna variante.' });
});

module.exports = router;