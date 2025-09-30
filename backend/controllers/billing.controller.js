const { pool } = require('../db/db');

// ===================================================================
// 1. OBTENER DATOS DE FACTURACIÓN (READ)
// ===================================================================
const getBillingData = async (req, res) => {
    const userId = req.user.id;
    try {
        const query = `
            SELECT ruc_fiscal, razon_social, direccion_fiscal, metodo_entrega, email_facturacion 
            FROM facturacion_datos 
            WHERE id_usuario = $1;
        `;
        const result = await pool.query(query, [userId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Datos de facturación no registrados.' });
        }
        
        res.json(result.rows[0]);

    } catch (err) {
        console.error('Error al obtener datos de facturación:', err);
        res.status(500).json({ error: 'Error del servidor al obtener datos de facturación.' });
    }
};

// ===================================================================
// 2. CREAR/ACTUALIZAR DATOS DE FACTURACIÓN (UPSERT)
// ===================================================================
const upsertBillingData = async (req, res) => {
    const userId = req.user.id;
    const { ruc_fiscal, razon_social, direccion_fiscal, metodo_entrega, email_facturacion } = req.body;

    if (!ruc_fiscal || !razon_social || !metodo_entrega) {
        return res.status(400).json({ error: 'RUC, Razón Social y Método de Entrega son obligatorios.' });
    }

    try {
        // La consulta usa ON CONFLICT (id_usuario) DO UPDATE para manejar la creación y actualización
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

        res.status(201).json({ 
            message: 'Datos de facturación guardados/actualizados con éxito.',
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Error al guardar datos de facturación:', err);
        res.status(500).json({ error: 'Error del servidor al guardar los datos de facturación.' });
    }
};

module.exports = {
    getBillingData,
    upsertBillingData,
};
