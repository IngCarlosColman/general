const { pool } = require('../db/db');

<<<<<<< HEAD
// Función para insertar o actualizar datos geoespaciales (POST /geo-data)
// Usa la clave compuesta (cod_dep, cod_ciu, tipo_propiedad, padron_ccc) para el UPSERT.
const upsertGeoData = async (req, res) => {
    // Desestructurar todos los campos necesarios de la tabla, excepto 'id' y 'updated_at'
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson } = req.body;

    // 1. Validación Corregida: Ahora exige los campos de la clave única y el geojson
    if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc || !geojson) {
        return res.status(400).json({ 
            error: 'Faltan parámetros: cod_dep, cod_ciu, tipo_propiedad, padron_ccc, y geojson son obligatorios.' 
        });
    }

    try {
        // 2. Consulta Corregida: Usa todas las columnas de la clave única en el INSERT y en el ON CONFLICT
        const query = `
            INSERT INTO propiedades_geo (cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (cod_dep, cod_ciu, tipo_propiedad, padron_ccc) DO UPDATE
            SET geojson = EXCLUDED.geojson, updated_at = NOW()
            RETURNING *;
        `;
        
        const values = [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, JSON.stringify(geojson)];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error al insertar/actualizar geojson:', err);
        res.status(500).json({ error: 'Error del servidor al guardar los datos geoespaciales.' });
    }
};

// Función para obtener un geojson.
// Dado que la URL es GET /geo-data/:id, asumiremos que 'id' es el ID PRIMARIO de la tabla.
const getGeoData = async (req, res) => {
    const { id } = req.params; // Este 'id' es el id primario (integer) de la tabla propiedades_geo
    try {
        const query = 'SELECT geojson FROM propiedades_geo WHERE id = $1;';
        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Datos geoespaciales no encontrados para el ID proporcionado.' });
        }
        res.status(200).json(result.rows[0].geojson);
    } catch (err) {
        console.error('Error al obtener geojson:', err);
        res.status(500).json({ error: 'Error del servidor al obtener los datos geoespaciales.' });
=======
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
>>>>>>> afd2230fa6c5245d15cc8c14eb216d4c7153f574
    }
};

<<<<<<< HEAD
// Función para eliminar un registro geoespacial.
// Usaremos el ID PRIMARIO para asegurar una eliminación directa.
const deleteGeoData = async (req, res) => {
    const { id } = req.params; // Este 'id' es el id primario (integer) de la tabla propiedades_geo
    try {
        const query = 'DELETE FROM propiedades_geo WHERE id = $1 RETURNING *;';
        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Datos geoespaciales no encontrados para eliminar.' });
        }
        res.status(200).json({ message: 'Datos geoespaciales eliminados exitosamente.', deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar geojson:', err);
        res.status(500).json({ error: 'Error del servidor al eliminar los datos geoespaciales.' });
=======
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
>>>>>>> afd2230fa6c5245d15cc8c14eb216d4c7153f574
    }
};

module.exports = {
<<<<<<< HEAD
    upsertGeoData,
    getGeoData,
    deleteGeoData,
};
=======
  upsertGeoData,
  getGeoData,
  deleteGeoData,
};  
>>>>>>> afd2230fa6c5245d15cc8c14eb216d4c7153f574
