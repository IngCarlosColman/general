const { pool } = require('../db/db');

// Constante que define el umbral de caducidad en días (30 días)
const CACHE_EXPIRATION_DAYS = 30;

// ====================================================================
// 🎯 1. UPSERT (INSERTAR/ACTUALIZAR) CON GEOMETRÍA Y CÁLCULO DE ÁREA
// ====================================================================
const upsertGeoData = async (req, res) => {
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson } = req.body;

    if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc || !geojson) {
        return res.status(400).json({ 
            error: 'Faltan parámetros: cod_dep, cod_ciu, tipo_propiedad, padron_ccc, y geojson son obligatorios.' 
        });
    }

    try {
        // 1. Guardamos el GeoJSON original completo (FeatureCollection) para la columna 'geojson' (jsonb)
        const originalGeojsonString = JSON.stringify(geojson);
        
        // 2. Extraemos la geometría compatible con ST_GeomFromGeoJSON
        let geometryForPostGIS = null;
        const geometryType = geojson.type;

        if (geometryType === 'FeatureCollection' && geojson.features && geojson.features.length > 1) {
             // Si hay más de un Feature, usamos el primero y avisamos (poco común para un solo padrón)
            const feature = geojson.features[0];
            geometryForPostGIS = JSON.stringify(feature.geometry);
            console.warn(`[UPSERT WARNING] GeoJSON es FeatureCollection con ${geojson.features.length} Features. Solo se usará el primero para la geometría.`);

        } else if (geometryType === 'FeatureCollection' && geojson.features && geojson.features.length === 1) {
            // Caso más común: FeatureCollection con un solo Feature
            const feature = geojson.features[0];
            geometryForPostGIS = JSON.stringify(feature.geometry);
            console.log(`[UPSERT LOG] FeatureCollection detectado. Usando geometría del único Feature (${feature.geometry.type}).`);

        } else if (geometryType === 'Feature') {
            // Caso donde el GeoJSON ya es un Feature
            geometryForPostGIS = JSON.stringify(geojson.geometry);
            console.log(`[UPSERT LOG] Feature detectado. Usando su geometría (${geojson.geometry.type}).`);
        } else if (['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'].includes(geometryType)) {
            // Caso donde el GeoJSON ya es una Geometría
            geometryForPostGIS = originalGeojsonString;
            console.log(`[UPSERT LOG] Tipo Geometría detectado. Usando GeoJSON directamente.`);
        } else {
             // Tipo no válido o estructura inesperada
            console.warn(`[UPSERT WARNING] Tipo GeoJSON desconocido o inválido: ${geometryType}`);
            return res.status(400).json({ error: 'GeoJSON inválido o estructura inesperada. No se pudo extraer la geometría.' });
        }
        
        // Validar que se haya extraído algo
        if (!geometryForPostGIS) {
             return res.status(400).json({ error: 'GeoJSON inválido o vacío. No se pudo extraer la geometría.' });
        }

        // 🚨 LOG 1: Verificar el GeoJSON de entrada
        console.log(`[UPSERT LOG] Iniciando upsert para Padrón/CCC: ${padron_ccc}`);
        console.log(`[UPSERT LOG] Tipo de GeoJSON original: ${geometryType}`); 

        const query = `
            INSERT INTO propiedades_geo (cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson, geometria)
            -- $5: GeoJSON original (jsonb)
            -- $6: Geometría extraída (text para ST_GeomFromGeoJSON)
            VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 32721))
            ON CONFLICT (cod_dep, cod_ciu, tipo_propiedad, padron_ccc) DO UPDATE
            SET 
                geojson = EXCLUDED.geojson, 
                geometria = ST_SetSRID(ST_GeomFromGeoJSON($6), 32721)
                -- El campo updated_at se actualiza automáticamente gracias al TRIGGER de la DB
            RETURNING *, 
                ST_Area(geometria) AS area_m2,
                ST_Area(geometria) / 10000 AS area_has;
        `;
        
        // 🔑 CORRECCIÓN: Duplicamos y separamos los propósitos de los parámetros
        const values = [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, originalGeojsonString, geometryForPostGIS];
        
        const result = await pool.query(query, values);
        
        // 🚀 LOG 2: Verificar el éxito y los datos retornados
        const area = result.rows[0].area_m2 || 'N/A';
        console.log(`[UPSERT LOG] ¡Éxito! Registro guardado.`);
        console.log(`[UPSERT LOG] Área calculada (m²): ${area}`);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        // 🔥 LOG 3: Capturar ERRORES críticos de SQL/DB
        console.error('🔥 ERROR CRÍTICO en upsertGeoData (SQL o DB):', err.message);
        console.error('🔥 Detalle del error (SQL/Geometría):', err.detail || 'No hay detalle SQL adicional.'); 
        res.status(500).json({ error: 'Error del servidor al guardar los datos geoespaciales.' });
    }
};

// ====================================================================
// ⚡ 2. BATCH-CHECK (BÚSQUEDA RÁPIDA DE CACHÉ) CON CADUCIDAD
// ====================================================================
const batchCheckGeoData = async (req, res) => {
    const { padrones } = req.body; 

    if (!Array.isArray(padrones) || padrones.length === 0) {
        return res.status(200).json({});
    }
    
    try {
        // 🔑 CLAVE: Filtra los padrones por ID y por la columna updated_at (frescura)
        const query = `
            SELECT 
                padron_ccc, 
                ST_AsGeoJSON(geometria) AS geojson_data,
                ST_Area(geometria) AS area_m2,
                ST_Area(geometria) / 10000 AS area_has
            FROM 
                propiedades_geo
            WHERE 
                padron_ccc = ANY($1::text[]) 
                AND geometria IS NOT NULL
                -- 🚨 FILTRO DE CADUCIDAD: Solo retorna si el registro es más nuevo que 30 días
                AND updated_at > NOW() - INTERVAL '${CACHE_EXPIRATION_DAYS} days';
        `;
        
        const result = await pool.query(query, [padrones]);
        
        const cacheMap = result.rows.reduce((acc, row) => {
            try {
                // ST_AsGeoJSON retorna un objeto de geometría que convertimos a GeoJSON válido para el frontend
                const geojsonFeature = JSON.parse(row.geojson_data); 
                
                acc[row.padron_ccc] = {
                    geojson: geojsonFeature,
                    area_m2: parseFloat(row.area_m2),
                    area_has: parseFloat(row.area_has)
                };
            } catch (e) {
                console.error("Error al analizar GeoJSON de la base de datos:", e);
            }
            return acc;
        }, {});
        
        // Si no se encuentra nada fresco, retorna un objeto vacío, lo que fuerza al frontend a ir a la API externa.
        res.status(200).json(cacheMap); 

    } catch (err) {
        console.error('Error en batchCheckGeoData:', err);
        res.status(500).json({ error: 'Error del servidor al verificar la caché de GeoJSON.' });
    }
};

// ====================================================================
// 🧹 3. FUNCIÓN DE CRON JOB (ELIMINACIÓN DE REGISTROS ANTIGUOS)
// ====================================================================
const cleanGeoDataCache = async (req, res) => {
    try {
        const query = `
            DELETE FROM propiedades_geo
            WHERE updated_at < NOW() - INTERVAL '${CACHE_EXPIRATION_DAYS} days'
            RETURNING padron_ccc;
        `;
        
        const result = await pool.query(query);
        const count = result.rowCount;
        const padronesEliminados = result.rows.map(row => row.padron_ccc);
        
        console.log(`✅ Cache de GeoData limpiada. Registros eliminados: ${count}`);
        
        res.status(200).json({ 
            success: true, 
            message: `Limpieza de caché completada. ${count} registros eliminados con más de ${CACHE_EXPIRATION_DAYS} días de antigüedad.`,
            count: count,
            padronesEliminados: padronesEliminados
        });

    } catch (err) {
        console.error('🔥 Error al limpiar la caché de geojson:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Error del servidor al ejecutar la limpieza de la caché geoespacial.' 
        });
    }
};

// ====================================================================
// 🔍 4. BÚSQUEDA DETALLADA POR CLAVE DE NEGOCIO (PARA DEPURACIÓN/VERIFICACIÓN)
// ====================================================================
const getGeoData = async (req, res) => {
    // Usamos query parameters para la clave única de negocio (dpto, ciudad, tipo, padrón/ccc)
    // Esto es ideal para depurar si el proceso de 'upsert' funcionó
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc } = req.query; 

    if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc) {
        return res.status(400).json({ 
            error: 'Faltan parámetros de búsqueda: cod_dep, cod_ciu, tipo_propiedad, y padron_ccc son obligatorios.' 
        });
    }
    
    try {
        const query = `
            SELECT 
                id,
                created_at,
                updated_at,
                geojson, 
                ST_AsGeoJSON(geometria) AS geometria_geojson,
                ST_Area(geometria) AS area_m2,
                ST_Area(geometria) / 10000 AS area_has
            FROM propiedades_geo 
            WHERE cod_dep = $1
            AND cod_ciu = $2
            AND tipo_propiedad = $3
            AND padron_ccc = $4;
        `;
        const values = [cod_dep, cod_ciu, tipo_propiedad, padron_ccc];
        const result = await pool.query(query, values);
        
        if (result.rowCount === 0) {
            console.log(`[GET LOG] No se encontraron datos para: ${padron_ccc}`);
            return res.status(404).json({ error: 'Datos geoespaciales no encontrados para la clave de negocio proporcionada.' });
        }
        
        const row = result.rows[0];
        console.log(`[GET LOG] Datos encontrados para ${row.padron_ccc}. Última actualización: ${row.updated_at}`);

        // Parsear la geometría PostGIS a GeoJSON (Geometry Object)
        let geometriaGeojson = null;
        try {
            geometriaGeojson = JSON.parse(row.geometria_geojson);
        } catch (e) {
            console.error("Error al parsear geometria_geojson:", e);
        }

        const isFresh = (new Date(row.updated_at).getTime() > (Date.now() - CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000));

        // Retornamos el geojson original completo, más la información de la geometría procesada y fechas.
        res.status(200).json({
            id: row.id,
            cod_dep, cod_ciu, tipo_propiedad, padron_ccc,
            created_at: row.created_at,
            updated_at: row.updated_at,
            esta_vigente: isFresh, // Indica si cumple el criterio de caché de 30 días
            dias_de_antiguedad: Math.floor((Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24)),
            original_geojson: row.geojson, // El FeatureCollection/Feature completo guardado
            geometria_procesada: {
                tipo: geometriaGeojson?.type || 'N/A',
                geojson: geometriaGeojson, // La geometría extraída por ST_AsGeoJSON
                area_m2: parseFloat(row.area_m2),
                area_has: parseFloat(row.area_has),
            }
        }); 
    } catch (err) {
        console.error('Error al obtener geojson por clave de negocio:', err);
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
    batchCheckGeoData, 
    cleanGeoDataCache, // 👈 Exportación para el CRON job
};
