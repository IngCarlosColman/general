// src/controllers/geo.controller.js
const { pool } = require('../db/db');

// Función para insertar o actualizar datos geoespaciales
const upsertGeoData = async (req, res) => {
  // ✅ CAMBIO 1: Desestructuramos los campos de identificación única en lugar de 'id_vinculo'
  const {
    cod_dep,
    cod_ciu,
    tipo_propiedad,
    padron_ccc,
    geojson
  } = req.body;

  // ✅ CAMBIO 2: Validamos los campos de identificación y el geojson
  if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc || !geojson) {
    return res.status(400).json({ error: 'Faltan parámetros: cod_dep, cod_ciu, tipo_propiedad, padron_ccc y geojson son obligatorios.' });
  }

  try {
    const query = `
      INSERT INTO propiedades_geo (cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (cod_dep, cod_ciu, tipo_propiedad, padron_ccc) DO UPDATE
      SET geojson = EXCLUDED.geojson, updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, JSON.stringify(geojson)]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al insertar/actualizar geojson:', err);
    res.status(500).json({ error: 'Error del servidor al guardar los datos geoespaciales.' });
  }
};

// Función para obtener un geojson por la identificación de la propiedad
const getGeoData = async (req, res) => {
  // ✅ CAMBIO 3: Obtenemos los campos de identificación desde los parámetros de la URL
  const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc } = req.query;

  // ✅ CAMBIO 4: Validamos los campos requeridos
  if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc) {
    return res.status(400).json({ error: 'Faltan parámetros: cod_dep, cod_ciu, tipo_propiedad y padron_ccc son obligatorios.' });
  }

  try {
    const query = 'SELECT geojson FROM propiedades_geo WHERE cod_dep = $1 AND cod_ciu = $2 AND tipo_propiedad = $3 AND padron_ccc = $4;';
    const result = await pool.query(query, [cod_dep, cod_ciu, tipo_propiedad, padron_ccc]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Datos geoespaciales no encontrados para la propiedad proporcionada.' });
    }
    res.status(200).json(result.rows[0].geojson);
  } catch (err) {
    console.error('Error al obtener geojson:', err);
    res.status(500).json({ error: 'Error del servidor al obtener los datos geoespaciales.' });
  }
};

// Función para eliminar un registro geoespacial
const deleteGeoData = async (req, res) => {
  // ✅ CAMBIO 5: Obtenemos los campos de identificación desde los parámetros de la URL
  const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc } = req.query;

  // ✅ CAMBIO 6: Validamos los campos requeridos
  if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc) {
    return res.status(400).json({ error: 'Faltan parámetros: cod_dep, cod_ciu, tipo_propiedad y padron_ccc son obligatorios.' });
  }

  try {
    const query = 'DELETE FROM propiedades_geo WHERE cod_dep = $1 AND cod_ciu = $2 AND tipo_propiedad = $3 AND padron_ccc = $4 RETURNING *;';
    const result = await pool.query(query, [cod_dep, cod_ciu, tipo_propiedad, padron_ccc]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Datos geoespaciales no encontrados para eliminar.' });
    }
    res.status(200).json({ message: 'Datos geoespaciales eliminados exitosamente.', deletedRecord: result.rows[0] });
  } catch (err) {
    console.error('Error al eliminar geojson:', err);
    res.status(500).json({ error: 'Error del servidor al eliminar los datos geoespaciales.' });
  }
};

module.exports = {
  upsertGeoData,
  getGeoData,
  deleteGeoData,
};  