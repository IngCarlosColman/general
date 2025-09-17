// src/controllers/parcelas.controller.js

const { pool } = require('../db/db');

/**
 * Función para guardar o actualizar la geometría y los datos de una propiedad.
 * Usa la lógica ON CONFLICT para manejar la upsertion de forma eficiente.
 */
const guardarPropiedad = async (req, res) => {
    // La autenticación ya se maneja en el middleware
    const { id: id_usuario, rol: rol_usuario } = req.user;

    // Aquí recibimos los datos que nos envía el front-end
    const {
        dpto, distrito, tipo_propiedad, propietario, cedula, hectareas, superficie_tierra, valor_tierra,
        padron, finca, zona, manzana, lote, geometriaGeoJSON
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // La consulta SQL con ON CONFLICT para insertar o actualizar la geometría
        const query = `
            INSERT INTO parcelas_catastro (
                dpto, distrito, tipo_propiedad, propietario, cedula, hectareas, superficie_tierra, valor_tierra,
                padron, finca, zona, manzana, lote, geom, fecha_consulta
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ST_GeomFromGeoJSON($14), NOW()
            )
            ON CONFLICT (dpto, distrito, padron) WHERE padron IS NOT NULL DO UPDATE
            SET
                propietario = $4,
                cedula = $5,
                hectareas = $6,
                superficie_tierra = $7,
                valor_tierra = $8,
                finca = $10,
                geom = ST_GeomFromGeoJSON($14),
                fecha_consulta = NOW()
            WHERE
                parcelas_catastro.dpto = $1 AND parcelas_catastro.distrito = $2 AND parcelas_catastro.padron = $9;
        `;
        
        await client.query(query, [
            dpto, distrito, tipo_propiedad, propietario, cedula, hectareas, superficie_tierra, valor_tierra,
            padron, finca, zona, manzana, lote, JSON.stringify(geometriaGeoJSON)
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Propiedad guardada/actualizada con éxito.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al guardar la propiedad:', err);
        // Manejo de errores específico
        res.status(500).json({ error: 'Error del servidor al guardar la propiedad.', details: err.message });
    } finally {
        client.release();
    }
};

/**
 * Función para buscar propiedades ya guardadas en nuestra base de datos.
 */
const buscarPropiedades = async (req, res) => {
    // La autenticación y permisos se validan en el middleware
    const { dpto, distrito, padron, zona, manzana, lote } = req.query;

    let whereClause = '';
    const queryParams = [];
    let paramIndex = 1;

    try {
        if (padron) {
            whereClause = `WHERE dpto = $1 AND distrito = $2 AND padron = $3`;
            queryParams.push(dpto, parseInt(distrito), padron);
        } else if (zona && manzana && lote) {
            whereClause = `WHERE dpto = $1 AND distrito = $2 AND zona = $3 AND manzana = $4 AND lote = $5`;
            queryParams.push(dpto, parseInt(distrito), zona, manzana, lote);
        } else {
            return res.status(400).json({ error: 'Faltan parámetros de búsqueda (padrón o zona/manzana/lote).' });
        }

        const query = `
            SELECT 
                dpto,
                distrito,
                padron,
                finca,
                zona,
                manzana,
                lote,
                propietario,
                hectareas,
                ST_AsGeoJSON(geom) AS geometria_geojson,
                tipo_propiedad
            FROM parcelas_catastro
            ${whereClause};
        `;
        
        const result = await pool.query(query, queryParams);

        // ST_AsGeoJSON devuelve un string, debemos parsearlo
        const items = result.rows.map(row => ({
            ...row,
            geometria_geojson: JSON.parse(row.geometria_geojson)
        }));

        res.json({ items, totalItems: items.length });

    } catch (err) {
        console.error('Error al buscar propiedades:', err);
        res.status(500).json({ error: 'Error del servidor al buscar propiedades.' });
    }
};

module.exports = {
    guardarPropiedad,
    buscarPropiedades
};