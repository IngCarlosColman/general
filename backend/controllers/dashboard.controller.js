const { pool } = require('../db/db');

// ====================================================================
// 1. GET /api/dashboard/kpis-secundarios
// (totalPropiedades, propiedadesConGeojson, registrosGuiaTotal, 
// registrosGuiaConTelefono, propiedadesVinculadas)
// ====================================================================
const getSecondaryKpis = async (req, res) => {
    try {
        // Ejecutamos las 6 consultas de forma concurrente para maximizar la velocidad (Promise.all)
        const [
            ruralCountResult,
            urbanaCountResult,
            geojsonResult,
            guiaTotalResult,
            guiaConTelefonoResult,
            propiedadesVinculadasResult, // Variable renombrada para claridad
        ] = await Promise.all([
            
            // 1. Total Rural
            pool.query(`SELECT COUNT(*) AS count FROM proprurales;`), // Añadido AS count para consistencia
            
            // 2. Total Urbana
            pool.query(`SELECT COUNT(*) AS count FROM prourbanas;`), // Añadido AS count para consistencia

            // 3. Cobertura Geojson (usando la tabla 'propiedades_geo' confirmada)
            pool.query(`
                SELECT COUNT(*) AS count FROM propiedades_geo;
            `),
            
            // 4. Registros Guía Total (Total en la tabla 'general')
            pool.query(`
                SELECT COUNT(*) AS count FROM general;
            `),

            // 5. Registros Guía con Teléfono (JOIN entre 'general' y 'telefonos')
            pool.query(`
                SELECT COUNT(DISTINCT g.cedula) AS count
                FROM general g 
                JOIN telefonos t ON g.cedula = t.cedula_persona;
            `),

            // 6. Propiedades Vinculadas (Métrica para Catastro Pendiente)
            pool.query(`
                SELECT COUNT(DISTINCT (cod_dep, cod_ciu, tipo_propiedad, padron_ccc)) AS propiedades_vinculadas
                FROM
                propiedades_propietarios;
            `),
        ]);
        
        // Mapeo y cálculo final
        // Aseguramos que el resultado de COUNT tenga la clave 'count'
        const ruralCount = parseInt(ruralCountResult.rows[0]?.count || 0);
        const urbanaCount = parseInt(urbanaCountResult.rows[0]?.count || 0);
        const totalPropiedades = ruralCount + urbanaCount;

        const kpis = {
            totalPropiedades: totalPropiedades,
            propiedadesConGeojson: parseInt(geojsonResult.rows[0]?.count || 0),
            registrosGuiaTotal: parseInt(guiaTotalResult.rows[0]?.count || 0),
            registrosGuiaConTelefono: parseInt(guiaConTelefonoResult.rows[0]?.count || 0),
            // Usamos el valor real de propiedades vinculadas
            propiedadesVinculadas: parseInt(propiedadesVinculadasResult.rows[0]?.propiedades_vinculadas || 0),
        };
        
        res.json(kpis);

    } catch (err) {
        console.error('Error al obtener los KPIs secundarios del Dashboard:', err.stack); // MEJOR LOGGING
        res.status(500).json({ error: 'Error del servidor al obtener KPIs secundarios' });
    }
};

// ====================================================================
// 2. GET /api/dashboard/cobertura-usuarios
// (Detalle de propiedades creadas por usuario Y KPI de Teléfonos)
// ====================================================================
const getFuncionariosCobertura = async (req, res) => {
    try {
        // 🎯 CORRECCIÓN APLICADA: Consulta de Productividad usando propiedades_propietarios
        const coberturaQuery = `
            SELECT
                u.id,
                -- Usamos first_name y last_name
                COALESCE(u.first_name || ' ' || u.last_name, u.email) AS nombre_completo,
                -- Conteo de vínculos creados para Rurales
                COALESCE(SUM(CASE WHEN pp.tipo_propiedad = 'rural' THEN 1 ELSE 0 END), 0) AS propiedades_rurales,
                -- Conteo de vínculos creados para Urbanas
                COALESCE(SUM(CASE WHEN pp.tipo_propiedad = 'urbana' THEN 1 ELSE 0 END), 0) AS propiedades_urbanas,
                -- Conteo total de vínculos creados (Métrica clave de productividad)
                COUNT(pp.created_by) AS total_propiedades
            FROM
                users u
            LEFT JOIN
                propiedades_propietarios pp ON u.id = pp.created_by
            GROUP BY
                u.id, u.first_name, u.last_name, u.email
            ORDER BY
                total_propiedades DESC;
        `;

        // Consulta para el KPI de Usuarios con Teléfono (se mantiene igual, ya es correcta)
        const telefonoKpiQuery = `
            -- 1. Contar el total de usuarios
            WITH TotalUsuarios AS (
                SELECT COUNT(id) AS total_users FROM users
            ),
            -- 2. Contar los usuarios que tienen un teléfono registrado (Join a través de la tabla 'general')
            UsuariosConTelefono AS (
                SELECT COUNT(DISTINCT u.id) AS users_with_phone
                FROM users u
                INNER JOIN general g ON u.cedula = g.cedula
                INNER JOIN telefonos t ON g.cedula = t.cedula_persona
            )
            -- 3. Devolver ambos conteos en una sola fila
            SELECT
                tf.total_users,
                COALESCE(fct.users_with_phone, 0) AS users_with_phone
            FROM
                TotalUsuarios tf
            LEFT JOIN
                UsuariosConTelefono fct ON true;
        `;

        // Ejecutar ambas consultas concurrentemente
        const [
            coberturaResult,
            telefonoKpiResult
        ] = await Promise.all([
            pool.query(coberturaQuery),
            pool.query(telefonoKpiQuery)
        ]);

        // Mapeo y cálculo del KPI de Teléfonos
        const totalUsers = parseInt(telefonoKpiResult.rows[0]?.total_users || 0);
        const usersWithPhone = parseInt(telefonoKpiResult.rows[0]?.users_with_phone || 0);

        const porcentajeFuncionariosConTelefono = totalUsers > 0 
            ? ((usersWithPhone / totalUsers) * 100).toFixed(0) 
            : 0;
        
        // Mapeo de la Cobertura (Productividad)
        const cobertura = coberturaResult.rows.map(row => {
            const total = parseInt(row.total_propiedades);
            const rurales = parseInt(row.propiedades_rurales);
            
            // Porcentaje de Propiedades Rurales sobre el Total creado por el Usuario (Productividad)
            const porcentaje = total > 0 ? ((rurales / total) * 100).toFixed(0) : 0;

            return {
                nombre: row.nombre_completo, 
                total: total, 
                // Propiedades Urbanas creadas (vínculos)
                propiedadesUrbanas: parseInt(row.propiedades_urbanas),
                porcentaje: parseFloat(porcentaje), 
            };
        });
        
        // Devolver la cobertura detallada Y el KPI global en el JSON
        res.json({
            coberturaDetalle: cobertura,
            kpiTelefono: {
                totalUsuarios: totalUsers,
                usuariosConTelefono: usersWithPhone,
                porcentaje: parseFloat(porcentajeFuncionariosConTelefono)
            }
        }); 

    } catch (err) {
        console.error('Error al obtener la cobertura de usuarios:', err.stack); // MEJOR LOGGING
        res.status(500).json({ error: 'Error del servidor al obtener cobertura' });
    }
};


// ====================================================================
// 3. GET /api/dashboard/distribucion-catastro
// (Datos para gráficos Rural/Urbana y Top Departamentos)
// ====================================================================
const getDistribucionCatastro = async (req, res) => {
    try {
        const [
            ruralCountResult,
            urbanaCountResult,
            topDepartamentosResult,
        ] = await Promise.all([
            // Total Rural
            pool.query(`SELECT COUNT(*) AS count FROM proprurales;`),
            
            // Total Urbana
            pool.query(`SELECT COUNT(*) AS count FROM prourbanas;`),

            // Top 5 Departamentos por Propiedad (Rural + Urbana)
            pool.query(`
                SELECT 
                    d.depart AS name, 
                    COUNT(p.cod_dep) AS count
                FROM
                    departamentos d
                JOIN
                    (
                        SELECT cod_dep FROM proprurales
                        UNION ALL
                        SELECT cod_dep FROM prourbanas
                    ) AS p ON d.cod_dep = p.cod_dep
                GROUP BY 
                    d.depart
                ORDER BY 
                    count DESC
                LIMIT 5;
            `),
        ]);

        const responseData = {
            rural: parseInt(ruralCountResult.rows[0]?.count || 0),
            urbana: parseInt(urbanaCountResult.rows[0]?.count || 0),
            topDepartamentos: topDepartamentosResult.rows.map(row => ({
                name: row.name,
                count: parseInt(row.count)
            })),
        };
        
        res.json(responseData);

    } catch (err) {
        console.error('Error al obtener la distribución del catastro:', err.stack); // MEJOR LOGGING
        res.status(500).json({ error: 'Error del servidor al obtener distribución' });
    }
};

module.exports = {
    getSecondaryKpis,
    getFuncionariosCobertura,
    getDistribucionCatastro,
};