const express = require('express');
const axios = require('axios');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');

// 🔐 API externa
const API_URL = "https://plra.org.py/public/buscar_padron.php";
const API_KEY = process.env.API_KEY;

// 🧠 Encabezados replicados del script oficial
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept": "application/json",
  "Referer": "https://plra.org.py/public/buscar_enrcp.php",
  "Authorization": `Bearer ${API_KEY}`
};

// 🔧 Normaliza texto eliminando tildes y reemplazando ñ
function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .trim();
}

// 🔁 Genera variantes del nombre para reintento inteligente
function generarVariantes(nombre) {
  const tokens = normalizarTexto(nombre).split(/\s+/);
  const variantes = new Set();

  variantes.add(nombre); // original
  variantes.add(normalizarTexto(nombre)); // normalizada

  if (tokens.length === 2) {
    variantes.add(`${tokens[1]} ${tokens[0]}`);
  }

  if (tokens.length === 3) {
    variantes.add(`${tokens[0]} ${tokens[1]}`);
    variantes.add(`${tokens[0]} ${tokens[2]}`);
    variantes.add(`${tokens[1]} ${tokens[2]}`);
    variantes.add(`${tokens[2]} ${tokens[1]}`);
  }

  return Array.from(variantes);
}

// 🚀 Ruta protegida para consulta del padrón
router.get('/consulta_padron', authenticateJWT, async (req, res) => {
  const { cedula, nombre } = req.query;

  if (!cedula && !nombre) {
    return res.status(400).json({ error: 'Debe proporcionar un número de cédula o un nombre para la búsqueda.' });
  }

  // 🔍 Búsqueda por cédula directa
  if (cedula) {
    try {
      const response = await axios.get(API_URL, {
        params: { cedula },
        headers: HEADERS
      });

      console.log(`✅ Búsqueda por cédula ${cedula} → ${response.data.length} resultados`);
      return res.json(response.data);
    } catch (error) {
      console.error(`❌ Error al buscar por cédula ${cedula}:`, error.message);
      return res.status(500).json({ error: 'Error al consultar la API externa por cédula.' });
    }
  }

  // 🔁 Búsqueda por nombre con variantes
  const variantes = generarVariantes(nombre);
  for (const variante of variantes) {
    try {
      const response = await axios.get(API_URL, {
        params: { nombre: variante },
        headers: HEADERS
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