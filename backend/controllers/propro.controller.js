const { pool } = require('../db/db');
const { upsertGeneral } = require('./general.controller');

const getPropiedadesPropietariosData = async (req, res) => {
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
        const limit = Math.min(parseInt(itemsPerPage), 100);
        const offset = (parseInt(page) - 1) * limit;
        let sortBy = [];
        if (req.query.sortBy) {
            try {
                sortBy = JSON.parse(req.query.sortBy);
            } catch (error) {
                console.error("Error al parsear el parámetro sortBy:", error);
            }
        }

        let whereClause = '';
        const queryParams = [];
        let paramIndex = 1;
        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            whereClause = `
                WHERE
                    pp.padron_ccc ILIKE $${paramIndex} OR
                    g.search_vector @@ to_tsquery('spanish', $${paramIndex + 1})
            `;
            queryParams.push(`%${search}%`);
            queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
            paramIndex += queryParams.length;
        }

        let orderByClause = 'ORDER BY pp.fecha_consulta DESC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'id_vinculo': 'pp.id_vinculo',
                'cod_dep': 'pp.cod_dep',
                'cod_ciu': 'pp.cod_ciu',
                'tipo_propiedad': 'pp.tipo_propiedad',
                'padron_ccc': 'pp.padron_ccc',
                'cedula_propietario': 'pp.cedula_propietario',
                'nombre_propietario': 'nombre_propietario', 
                'fecha_consulta': 'pp.fecha_consulta'
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        
        const countQuery = `
            SELECT COUNT(DISTINCT pp.id_vinculo)
            FROM propiedades_propietarios AS pp
            LEFT JOIN general AS g ON pp.cedula_propietario = g.cedula
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);

        const dataQuery = `
            SELECT
                pp.id_vinculo,
                pp.cod_dep,
                pp.cod_ciu,
                pp.tipo_propiedad,
                pp.padron_ccc,
                pp.cedula_propietario,
                COALESCE(g.completo, pp.nombre_propietario, 'No identificado') AS nombre_propietario,
                STRING_AGG(t.telefono, ', ') AS telefonos,
                pp.fecha_consulta,
                pp.created_by
            FROM
                propiedades_propietarios AS pp
            LEFT JOIN
                general AS g ON pp.cedula_propietario = g.cedula
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula
            ${whereClause}
            GROUP BY pp.id_vinculo, g.completo, pp.nombre_propietario
            ${orderByClause}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        const dataParams = [...queryParams, limit, offset];
        const dataResult = await pool.query(dataQuery, dataParams);
        const items = dataResult.rows;

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener datos de la tabla de vínculos:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const updatePropiedadPropietario = async (req, res) => {
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const { id_vinculo } = req.params;
    const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, nombre_propietario } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Llamada simplificada a upsertGeneral, asumiendo que el rol se maneja allí
        if (cedula_propietario) {
             await upsertGeneral(cedula_propietario, nombre_propietario, null, id_usuario, client, rol_usuario);
        }

        const updateQuery = `
            UPDATE propiedades_propietarios
            SET cod_dep = $1, cod_ciu = $2, tipo_propiedad = $3, padron_ccc = $4, cedula_propietario = $5, nombre_propietario = $6, updated_by = $7, updated_at = NOW()
            WHERE id_vinculo = $8
            RETURNING *;
        `;
        const result = await client.query(updateQuery, [cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, nombre_propietario, id_usuario, id_vinculo]);
        await client.query('COMMIT');
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vínculo no encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el vínculo:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'El vínculo actualizado ya existe para otra propiedad y propietario.' });
        }
        res.status(500).json({ error: 'Error del servidor', details: err.detail });
    } finally {
        client.release();
    }
};

const deletePropiedadPropietario = async (req, res) => {
    const { id_vinculo } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleteQuery = `DELETE FROM propiedades_propietarios WHERE id_vinculo = $1 RETURNING *;`;
        const result = await client.query(deleteQuery, [id_vinculo]);
        await client.query('COMMIT');
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vínculo no encontrado' });
        }
        res.json({ message: 'Vínculo eliminado exitosamente', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el vínculo:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar este registro porque está vinculado a otra tabla.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

const createProprietorsBatch = async (req, res) => {
    const { id: id_usuario, rol: rol_usuario } = req.user;
    const batchData = req.body;

    if (!Array.isArray(batchData) || batchData.length === 0) {
        return res.status(400).json({ message: 'El cuerpo de la solicitud debe ser un array no vacío de registros.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertedRecords = [];

        for (const record of batchData) {
            const { cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, nombre_propietario } = record;

            if (!padron_ccc) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Falta el padrón en un registro. Registro: ${JSON.stringify(record)}` });
            }

            if (cedula_propietario) {
                // Se propaga el rol para mantener la consistencia con el upsertGeneral, sin aplicar lógica condicional aquí.
                await upsertGeneral(cedula_propietario, nombre_propietario, null, id_usuario, client, rol_usuario);
            }
            
            const insertQuery = `
                INSERT INTO propiedades_propietarios (
                    cod_dep, cod_ciu, tipo_propiedad, padron_ccc, cedula_propietario, nombre_propietario, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT ON CONSTRAINT unique_vinculo DO NOTHING
                RETURNING *;
            `;
            const result = await client.query(insertQuery, [
                cod_dep,
                cod_ciu,
                tipo_propiedad,
                padron_ccc,
                cedula_propietario,
                nombre_propietario,
                id_usuario
            ]);
            
            if (result.rowCount > 0) {
                insertedRecords.push(result.rows[0]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Lote de registros procesado exitosamente.', insertedRecords });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al insertar el lote de registros:', err);
        res.status(500).json({ error: 'Error del servidor al procesar el lote.', details: err.detail });
    } finally {
        client.release();
    }
};

module.exports = {
    getPropiedadesPropietariosData,
    updatePropiedadPropietario,
    deletePropiedadPropietario,
    createProprietorsBatch,
};