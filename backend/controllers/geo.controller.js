const { pool } = require('../db/db');

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
    }
};

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
    }
};

module.exports = {
    upsertGeoData,
    getGeoData,
    deleteGeoData,
};