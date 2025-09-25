const { pool } = require('../db/db');

const upsertGeoData = async (req, res) => {
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson } = req.body;

    if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc || !geojson) {
        return res.status(400).json({ 
            error: 'Faltan parámetros: cod_dep, cod_ciu, tipo_propiedad, padron_ccc, y geojson son obligatorios.' 
        });
    }

    try {
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

const getGeoData = async (req, res) => {
    const { id } = req.params;
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

const deleteGeoData = async (req, res) => {
    const { id } = req.params;
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