const { pool } = require('../db/db');

// ===================================================================
// 1. OBTENER DATOS DE FACTURACIÓN (READ)
// ===================================================================
const getBillingData = async (req, res) => {
    // --- LOGS INICIO ---
    console.log('--- GET: Iniciando getBillingData ---');
    console.log('User ID (req.user.id):', req.user?.id); // Verificamos si la autenticación adjuntó el ID
    // --- LOGS FIN ---
    
    // Si req.user es undefined, el middleware authenticateJWT no funcionó, lo cual causará un error aquí.
    if (!req.user || !req.user.id) {
        console.error('ERROR: Autenticación JWT fallida o incompleta. req.user.id no existe.');
        return res.status(401).json({ error: 'Usuario no autenticado o token inválido.' });
    }
    
    const userId = req.user.id;

    try {
        const query = `
            SELECT ruc_fiscal, razon_social, direccion_fiscal, metodo_entrega, email_facturacion 
            FROM facturacion_datos 
            WHERE id_usuario = $1;
        `;
        const result = await pool.query(query, [userId]);
        
        if (result.rowCount === 0) {
            // --- LOGS 404 ---
            console.log(`INFO: No se encontraron datos para el usuario ${userId}. Devolviendo 404.`);
            // --- LOGS FIN ---
            return res.status(404).json({ error: 'Datos de facturación no registrados.' });
        }
        
        // --- LOGS ÉXITO ---
        console.log(`ÉXITO: Datos de facturación obtenidos para el usuario ${userId}.`);
        // --- LOGS FIN ---

        res.json(result.rows[0]);

    } catch (err) {
        // --- LOGS ERROR ---
        console.error('Error al obtener datos de facturación:', err);
        // --- LOGS FIN ---
        res.status(500).json({ error: 'Error del servidor al obtener datos de facturación.' });
    }
};

// ===================================================================
// 2. CREAR/ACTUALIZAR DATOS DE FACTURACIÓN (UPSERT)
// ===================================================================
const upsertBillingData = async (req, res) => {
    // --- LOGS INICIO ---
    console.log('--- POST: Iniciando upsertBillingData ---');
    console.log('User ID (req.user.id):', req.user?.id); // Verificamos el ID
    console.log('Datos recibidos (req.body):', req.body); // Verificamos la carga de datos
    // --- LOGS FIN ---

    if (!req.user || !req.user.id) {
        console.error('ERROR: Autenticación JWT fallida o incompleta. req.user.id no existe.');
        return res.status(401).json({ error: 'Usuario no autenticado o token inválido.' });
    }

    const userId = req.user.id;
    const { ruc_fiscal, razon_social, direccion_fiscal, metodo_entrega, email_facturacion } = req.body;

    if (!ruc_fiscal || !razon_social || !metodo_entrega) {
        // --- LOGS BAD REQUEST ---
        console.log('ADVERTENCIA: Campos obligatorios faltantes (ruc_fiscal, razon_social, metodo_entrega).');
        // --- LOGS FIN ---
        return res.status(400).json({ error: 'RUC, Razón Social y Método de Entrega son obligatorios.' });
    }

    try {
        // La consulta usa ON CONFLICT (id_usuario) DO UPDATE para manejar la creación y actualización
        // **********************************************************************************************
        // CORRECCIÓN/VERIFICACIÓN: 
        // Para que ON CONFLICT funcione, la columna 'id_usuario' DEBE ser una clave única (UNIQUE)
        // o la clave primaria (PRIMARY KEY) de la tabla 'facturacion_datos'. Si no lo es, esto fallará con 500.
        // **********************************************************************************************
        const query = `
            INSERT INTO facturacion_datos (
                id_usuario, ruc_fiscal, razon_social, direccion_fiscal, metodo_entrega, email_facturacion
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id_usuario) DO UPDATE SET
                ruc_fiscal = EXCLUDED.ruc_fiscal,
                razon_social = EXCLUDED.razon_social,
                direccion_fiscal = EXCLUDED.direccion_fiscal,
                metodo_entrega = EXCLUDED.metodo_entrega,
                email_facturacion = EXCLUDED.email_facturacion,
                updated_at = NOW()
            RETURNING *;
        `;
        const result = await pool.query(query, [
            userId, ruc_fiscal, razon_social, direccion_fiscal, metodo_entrega, email_facturacion
        ]);

        // --- LOGS ÉXITO ---
        console.log(`ÉXITO: Datos de facturación (UPSERT) completado para el usuario ${userId}.`);
        // --- LOGS FIN ---

        res.status(201).json({ 
            message: 'Datos de facturación guardados/actualizados con éxito.',
            data: result.rows[0]
        });

    } catch (err) {
        // --- LOGS ERROR REAL ---
        console.error('Error REAL al guardar datos de facturación:', err.message || err); 
        // --- LOGS FIN ---
        res.status(500).json({ error: 'Error del servidor al guardar los datos de facturación.' });
    }
};

module.exports = {
    getBillingData,
    upsertBillingData,
};
