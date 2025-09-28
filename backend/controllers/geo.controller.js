const { pool } = require('../db/db');

// Constante que define el umbral de caducidad en días (1 días)
const CACHE_EXPIRATION_DAYS = 1;

// ====================================================================
// 🎯 1. UPSERT (INSERTAR/ACTUALIZAR) CON GEOMETRÍA Y CÁLCULO DE ÁREA
// ====================================================================
const upsertGeoData = async (req, res) => {
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson } = req.body;

    if (!cod_dep || !cod_ciu || !tipo_propiedad || !padron_ccc || !geojson) {
        // [🛑 LOG 1: Faltan parámetros]
        console.warn('[🛑 VALIDACIÓN FAIL] Faltan parámetros obligatorios en el body.');
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

        if (geometryType === 'FeatureCollection' && geojson.features && geojson.features.length >= 1) {
            // Caso más común: FeatureCollection con uno o más Features
            const feature = geojson.features[0];
            geometryForPostGIS = JSON.stringify(feature.geometry);
            if (geojson.features.length > 1) {
                console.warn(`[UPSERT WARNING] GeoJSON es FeatureCollection con ${geojson.features.length} Features. Solo se usará el primero para la geometría.`);
            } else {
                console.log(`[UPSERT LOG] FeatureCollection detectado. Usando geometría del único Feature (${feature.geometry.type}).`);
            }

        } else if (geometryType === 'Feature') {
            // Caso donde el GeoJSON ya es un Feature
            geometryForPostGIS = JSON.stringify(geojson.geometry);
            console.log(`[UPSERT LOG] Feature detectado. Usando su geometría (${geojson.geometry.type}).`);

        } else if (['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'GeometryCollection'].includes(geometryType)) {
            // Caso donde el GeoJSON ya es una Geometría
            geometryForPostGIS = originalGeojsonString;
            console.log(`[UPSERT LOG] Tipo Geometría detectado (${geometryType}). Usando GeoJSON directamente.`);
        } else {
            // Tipo no válido o estructura inesperada
            console.warn(`[UPSERT WARNING] Tipo GeoJSON desconocido o inválido: ${geometryType}`);
            return res.status(400).json({ error: 'GeoJSON inválido o estructura inesperada. No se pudo extraer la geometría.' });
        }
        
        // Validar que se haya extraído algo
        if (!geometryForPostGIS) {
            console.warn('[🛑 VALIDACIÓN FAIL] El GeoJSON era válido en estructura, pero no se pudo extraer una geometría no nula.');
            return res.status(400).json({ error: 'GeoJSON inválido o vacío. No se pudo extraer la geometría.' });
        }

        // 🚨 LOG 2: Verificar el GeoJSON de entrada y la geometría extraída
        console.log(`--- [UPSERT INICIO] Padrón/CCC: ${padron_ccc} ---`);
        console.log(`[UPSERT LOG] Tipo de GeoJSON original: ${geometryType}`); 
        console.log(`[UPSERT LOG] Geometría extraída para PostGIS ($6): ${geometryForPostGIS.substring(0, 150)}...`);


        const query = `
            INSERT INTO propiedades_geo (cod_dep, cod_ciu, tipo_propiedad, padron_ccc, geojson, geometria)
            -- $5: GeoJSON original (jsonb)
            -- $6: Geometría extraída (text para ST_GeomFromGeoJSON)
            VALUES ($1, $2, $3, $4, $5, 
                -- 🔑 CORRECCIÓN CLAVE: Asumimos entrada 4326 (web) -> ST_MakeValid -> ST_Transform a 32721 (métrica)
                ST_Transform(
                    ST_SetSRID(
                        ST_MakeValid(ST_GeomFromGeoJSON($6)), 
                    4326), 
                32721)
            )
            ON CONFLICT (cod_dep, cod_ciu, tipo_propiedad, padron_ccc) DO UPDATE
            SET 
                geojson = EXCLUDED.geojson, 
                geometria = 
                -- 🔑 CORRECCIÓN CLAVE (UPDATE): Mismo proceso
                ST_Transform(
                    ST_SetSRID(
                        ST_MakeValid(ST_GeomFromGeoJSON($6)), 
                    4326), 
                32721),
                updated_at = NOW() -- Forzar actualización de timestamp aunque la columna tenga trigger
            RETURNING *, 
                ST_Area(geometria) AS area_m2,
                ST_Area(geometria) / 10000 AS area_has;
        `;
        
        // 🚨 LOG 3: Mostrar el SQL final para depuración
        console.log('[UPSERT LOG] SQL de UPSERT a ejecutar (con transformación 4326 -> 32721):', query.replace(/\s+/g, ' ').trim());


        const values = [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, originalGeojsonString, geometryForPostGIS];
        
        const result = await pool.query(query, values);
        
        // 🚀 LOG 4: Verificar el éxito y los datos retornados
        const area = result.rows[0].area_m2 || 'N/A';
        console.log(`[UPSERT LOG] ¡Éxito! Registro guardado/actualizado.`);
        console.log(`[UPSERT LOG] Área calculada (m²): ${area}`);
        console.log('--- [UPSERT FIN] ---');

        res.status(201).json(result.rows[0]);
    } catch (err) {
        // 🔥 LOG 5: Capturar ERRORES críticos de SQL/DB
        console.error('--- [🔥 ERROR CRÍTICO EN UPSERT] Padrón:', padron_ccc, '---');
        console.error('🔥 ERROR: Mensaje del sistema:', err.message);
        console.error('🔥 Detalle del error (SQL/Geometría):', err.detail || 'No hay detalle SQL adicional.'); 
        console.error('🔥 SUGERENCIA: Verificar que el GeoJSON de entrada sea válido (sin auto-intersecciones) y esté en coordenadas Lat/Lng (4326).');
        console.log('--- [UPSERT FIN CON ERROR] ---');
        res.status(500).json({ error: 'Error del servidor al guardar los datos geoespaciales. Verifique el formato de la geometría GeoJSON.' });
    }
};


// ====================================================================
// ⚡ 2. BATCH-CHECK (BÚSQUEDA RÁPIDA DE CACHÉ) CON CADUCIDAD
// ====================================================================
const batchCheckGeoData = async (req, res) => {
    const { padrones } = req.body; 

    if (!Array.isArray(padrones) || padrones.length === 0) {
        console.log('[BATCH CHECK LOG] Petición Batch Check sin padrones. Retornando objeto vacío.');
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
                -- 🚨 FILTRO DE CADUCIDAD: Solo retorna si el registro es más nuevo que 1 día
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
                console.error("[BATCH CHECK ERROR] Error al analizar GeoJSON de la base de datos:", e);
            }
            return acc;
        }, {});
        
        console.log(`[BATCH CHECK LOG] Consulta Batch Check completada. ${result.rowCount} registros frescos encontrados de ${padrones.length} solicitados.`);

        // Si no se encuentra nada fresco, retorna un objeto vacío, lo que fuerza al frontend a ir a la API externa.
        res.status(200).json(cacheMap); 

    } catch (err) {
        console.error('[BATCH CHECK ERROR] Error crítico en batchCheckGeoData:', err.message);
        res.status(500).json({ error: 'Error del servidor al verificar la caché de GeoJSON.' });
    }
};


// ====================================================================
// 🔍 3. CONSULTA ESPACIAL POR ÁREA DIBUJADA Y FILTROS ATRIBUTIVOS (CORREGIDO)
// ====================================================================
/**
 * Realiza una consulta geoespacial avanzada combinando:
 * 1. Un filtro espacial (intersección con el polígono GeoJSON proporcionado).
 * 2. Filtros atributivos de área (m² y hectáreas unificadas).
 * 3. Filtro por tipo de propiedad (Rural/Urbana).
 * @param {object} req.body - Debe contener geojson, min_m2, max_m2, min_has, max_has, y tipo_propiedad.
 */
const queryGeoData = async (req, res) => {
    // 🔑 NUEVOS PARÁMETROS para soportar filtros inteligentes de Has/Mts2
    const { geojson_search:geojson, min_m2, max_m2, min_has, max_has, tipo_propiedad } = req.body; 

    // 🛑 VALIDACIÓN CLAVE: Si falta la geometría de consulta, el backend lanza un 400.
    if (!geojson) {
        console.warn('[🛑 VALIDACIÓN FAIL] Falta geometría de filtro (geojson).');
        return res.status(400).json({ 
            error: 'La geometría (geojson) de filtro es obligatoria para la consulta espacial.' 
        });
    }

    try {
        const geojsonString = JSON.stringify(geojson);
        
        // 1. LÓGICA DE FILTROS INTELIGENTES: Unificar Has y M2 en valores de Mts²
        const floatMinM2 = parseFloat(min_m2);
        const floatMaxM2 = parseFloat(max_m2);
        const floatMinHas = parseFloat(min_has);
        const floatMaxHas = parseFloat(max_has);

        let effectiveMinM2 = (floatMinM2 > 0) ? floatMinM2 : null;
        if (floatMinHas > 0) {
            const minHasM2 = floatMinHas * 10000;
            effectiveMinM2 = (effectiveMinM2 === null) 
                                 ? minHasM2 
                                 : Math.max(effectiveMinM2, minHasM2);
        }

        let effectiveMaxM2 = (floatMaxM2 > 0) ? floatMaxM2 : null;
        if (floatMaxHas > 0) {
            const maxHasM2 = floatMaxHas * 10000;
            effectiveMaxM2 = (effectiveMaxM2 === null) 
                                 ? maxHasM2 
                                 : Math.min(effectiveMaxM2, maxHasM2);
        }

        // 2. Construcción de la consulta base y los parámetros
        let query = `
            SELECT 
                id, 
                cod_dep, 
                cod_ciu, 
                tipo_propiedad, 
                padron_ccc, 
                -- Calculamos el área dinámicamente
                ST_Area(geometria) AS area_m2, 
                ST_Area(geometria) / 10000 AS area_has,
                ST_AsGeoJSON(geometria) AS geometria_geojson,
                updated_at as fecha_cache -- Usamos updated_at para la frescura de caché
            FROM propiedades_geo
            WHERE ST_Intersects(
                geometria, 
                -- 🔑 CORRECCIÓN CLAVE: Transformar el GeoJSON de filtro (asumido 4326) a 32721 para la intersección
                ST_Transform(
                    ST_SetSRID(
                        ST_MakeValid(ST_GeomFromGeoJSON($1)), 
                    4326), 
                32721)
            )
        `;
        const params = [geojsonString];
        let paramIndex = 2;

        // 3. Aplicar filtro Mínimo de Área
        if (effectiveMinM2 !== null) {
            query += ` AND ST_Area(geometria) >= $${paramIndex}`;
            params.push(effectiveMinM2);
            paramIndex++;
        }

        // 4. Aplicar filtro Máximo de Área
        if (effectiveMaxM2 !== null) {
            query += ` AND ST_Area(geometria) <= $${paramIndex}`;
            params.push(effectiveMaxM2);
            paramIndex++;
        }

        // 5. Filtrar por tipo de propiedad
        if (tipo_propiedad && tipo_propiedad !== 'Todos') {
            query += ` AND tipo_propiedad = $${paramIndex}`;
            params.push(tipo_propiedad);
            paramIndex++;
        }

        // 🚨 LOG: Mostrar los filtros aplicados
        console.log(`[QUERY SPATIAL LOG] Filtros aplicados: Min M2: ${effectiveMinM2}, Max M2: ${effectiveMaxM2}, Tipo: ${tipo_propiedad}`);
        console.log('[QUERY SPATIAL LOG] Ejecutando consulta espacial...');
        
        const result = await pool.query(query, params);

        console.log(`[QUERY SPATIAL LOG] Consulta espacial exitosa. Encontrados ${result.rowCount} resultados.`);

        // 6. Formatear y retornar los resultados
        const formattedResults = result.rows.map(row => {
            let geometriaGeojson = row.geometria_geojson;
            try {
                // La función ST_AsGeoJSON retorna un string, debemos parsearlo a objeto
                geometriaGeojson = JSON.parse(geometriaGeojson);
            } catch (e) {
                console.error('[QUERY SPATIAL ERROR] Error al parsear geometria_geojson de un registro:', e);
            }
            
            return {
                id: row.id,
                cod_dep: row.cod_dep,
                cod_ciu: row.cod_ciu,
                tipo_propiedad: row.tipo_propiedad,
                padron_ccc: row.padron_ccc,
                area_m2: parseFloat(row.area_m2),
                area_has: parseFloat(row.area_has),
                geojson: geometriaGeojson,
                fecha_cache: row.fecha_cache,
            };
        });

        res.status(200).json({ 
            message: 'Consulta espacial completada.', 
            count: result.rowCount,
            results: formattedResults 
        });

    } catch (err) {
        console.error('--- [🔥 ERROR CRÍTICO EN QUERY SPATIAL] ---');
        console.error('🔥 ERROR: Mensaje del sistema:', err.message);
        console.error('🔥 Detalle del error (SQL/Geometría de filtro):', err.detail || 'No hay detalle SQL adicional.'); 
        res.status(500).json({ error: 'Error interno del servidor al realizar la consulta espacial.' });
    }
};

// ====================================================================
// 🧹 4. FUNCIÓN DE CRON JOB (ELIMINACIÓN DE REGISTROS ANTIGUOS)
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
        console.error('🔥 Error al limpiar la caché de geojson:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Error del servidor al ejecutar la limpieza de la caché geoespacial.' 
        });
    }
};

// ====================================================================
// 🔍 5. BÚSQUEDA DETALLADA POR CLAVE DE NEGOCIO (PARA DEPURACIÓN/VERIFICACIÓN)
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
        
        // Parsear la geometría PostGIS a GeoJSON (Geometry Object)
        let geometriaGeojson = null;
        try {
            geometriaGeojson = JSON.parse(row.geometria_geojson);
        } catch (e) {
            console.error("[GET ERROR] Error al parsear geometria_geojson:", e);
        }

        // Calculo simple de vigencia (debería coincidir con el filtro de batch-check)
        const cacheLimitMs = CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
        const updatedAtTime = new Date(row.updated_at).getTime();
        const antiquityMs = Date.now() - updatedAtTime;
        const isFresh = (antiquityMs < cacheLimitMs); 

        console.log(`[GET LOG] Datos encontrados para ${row.padron_ccc}. Última actualización: ${row.updated_at}. Vigente (cache): ${isFresh}`);

        // Retornamos el geojson original completo, más la información de la geometría procesada y fechas.
        res.status(200).json({
            id: row.id,
            cod_dep, cod_ciu, tipo_propiedad, padron_ccc,
            created_at: row.created_at,
            updated_at: row.updated_at,
            esta_vigente: isFresh, // Indica si cumple el criterio de caché
            dias_de_antiguedad: (antiquityMs / (1000)).toFixed(2),
            original_geojson: row.geojson, // El FeatureCollection/Feature completo guardado
            geometria_procesada: {
                tipo: geometriaGeojson?.type || 'N/A',
                geojson: geometriaGeojson, // La geometría extraída por ST_AsGeoJSON
                area_m2: parseFloat(row.area_m2),
                area_has: parseFloat(row.area_has),
            }
        }); 
    } catch (err) {
        console.error('Error al obtener geojson por clave de negocio:', err.message);
        res.status(500).json({ error: 'Error del servidor al obtener los datos geoespaciales.' });
    }
};

// ====================================================================
// 🗑️ 6. ELIMINACIÓN POR ID
// ====================================================================
const deleteGeoData = async (req, res) => {
    const { id } = req.params; 
    
    try {
        const query = 'DELETE FROM propiedades_geo WHERE id = $1 RETURNING *;';
        const result = await pool.query(query, [id]);
        
        if (result.rowCount === 0) {
            console.warn(`[DELETE LOG] Intento de eliminación fallido. ID no encontrado: ${id}`);
            return res.status(404).json({ error: 'Datos geoespaciales no encontrados para eliminar.' });
        }

        console.log(`[DELETE LOG] Registro eliminado con éxito. ID: ${id}, Padrón: ${result.rows[0].padron_ccc}`);
        res.status(200).json({ message: 'Datos geoespaciales eliminados exitosamente.', deletedRecord: result.rows[0] });
    } catch (err) {
        console.error('Error al eliminar geojson por ID:', err.message);
        res.status(500).json({ error: 'Error del servidor al eliminar los datos geoespaciales.' });
    }
};

module.exports = {
    upsertGeoData,
    getGeoData,
    deleteGeoData,
    batchCheckGeoData, 
    cleanGeoDataCache,
    queryGeoData, 
};