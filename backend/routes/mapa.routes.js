const { Router } = require('express');
const axios = require('axios');
const router = Router();

const WFS_BASE_URL = 'https://www.catastro.gov.py/geoserver/ows';

// 🔧 Construye el filtro CQL según tipo de propiedad
function construirCQL(dpto, dist, tipo, datos) {
  if (tipo === 'rural') {
    return `dist=${dist} AND dpto='${dpto}' AND padron='${datos}'`;
  }

  if (tipo === 'urbana') {
    const partes = datos.split('-');
    if (partes.length !== 3) {
      throw new Error('Formato urbano inválido. Debe ser zona-manzana-lote');
    }
    const [zona, mz, lote] = partes;
    return `dist=${dist} AND dpto='${dpto}' AND zona='${zona}' AND mz='${mz}' AND lote='${lote}'`;
  }

  throw new Error('Tipo desconocido');
}

// 🚀 Ruta proxy para consulta WFS
router.get('/mapa', async (req, res) => {
  try {
    const { dpto, dist, entrada } = req.query;

    if (!dpto || !dist || !entrada) {
      return res.status(400).json({
        error: 'Faltan parámetros obligatorios.',
        required: ['dpto', 'dist', 'entrada']
      });
    }

    const tipo = /^\d+$/.test(entrada) ? 'rural' : 'urbana';
    const cql = construirCQL(dpto, dist, tipo, entrada);

    const params = {
      service: 'WFS',
      version: '1.1.0',
      request: 'GetFeature',
      outputFormat: 'application/json',
      srsname: 'EPSG:32721',
      typename: 'snc:parcelas_activas',
      CQL_FILTER: cql
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
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Error del servidor al conectar con el WFS de Catastro.' });
  }
});

module.exports = router;