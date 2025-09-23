// src/controllers/geo.controller.js
const { pool } = require('../db/db');

// Función para insertar o actualizar datos geoespaciales (POST /geo-data)
const upsertGeoData = async (req, res) => {
  const { id_vinculo, geojson } = req.body;
  if (!id_vinculo || !geojson) {
    return res.status(400).json({ error: 'Faltan parámetros: id_vinculo y geojson son obligatorios.' });
  }

  try {
    const query = `
      INSERT INTO propiedades_geo (id_vinculo, geojson)
      VALUES ($1, $2)
      ON CONFLICT (id_vinculo) DO UPDATE
      SET geojson = EXCLUDED.geojson, updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query(query, [id_vinculo, JSON.stringify(geojson)]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al insertar/actualizar geojson:', err);
    res.status(500).json({ error: 'Error del servidor al guardar los datos geoespaciales.' });
  }
};

// Función para obtener un geojson por id_vinculo (GET /geo-data/:id)
const getGeoData = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'SELECT geojson FROM propiedades_geo WHERE id_vinculo = $1;';
    const result = await pool.query(query, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Datos geoespaciales no encontrados para el id_vinculo proporcionado.' });
    }
    res.status(200).json(result.rows[0].geojson);
  } catch (err) {
    console.error('Error al obtener geojson:', err);
    res.status(500).json({ error: 'Error del servidor al obtener los datos geoespaciales.' });
  }
};

// Función para eliminar un registro geoespacial (DELETE /geo-data/:id)
const deleteGeoData = async (req, res) => {
  const { id } = req.params;
  try {
    const query = 'DELETE FROM propiedades_geo WHERE id_vinculo = $1 RETURNING *;';
    const result = await pool.query(query, [id]);
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