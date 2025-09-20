// abogados.controller.js
const { pool } = require('../db/db');
// Se importa la función principal de gestión de registros generales.
const { upsertGeneral } = require('./general.controller'); 

/**
 * Obtiene los datos de abogados.
 * La validación de permisos ahora se realiza en el middleware.
 */
const getAbogadosData = async (req, res) => {
    // Se ha eliminado la verificación de roles, ahora se hace en el middleware
    try {
        const { page = 1, itemsPerPage = 10, search = '' } = req.query;
        let sortBy = [];
        if (req.query.sortBy) {
            try {
                sortBy = JSON.parse(req.query.sortBy);
            } catch (error) {
                console.error("Error al parsear el parámetro sortBy:", error);
            }
        }
        const limit = Math.min(parseInt(itemsPerPage), 100);
        const offset = (parseInt(page) - 1) * limit;
        let whereClause = '';
        const queryParams = [];
        let paramIndex = 1;
        if (search) {
            const searchTerms = search.split(/\s+/).filter(term => term);
            if (searchTerms.length > 0) {
                whereClause = `WHERE g.search_vector @@ to_tsquery('spanish', $${paramIndex})`;
                queryParams.push(searchTerms.map(t => `${t}:*`).join(' & '));
                paramIndex++;
            }
        }
        let orderByClause = 'ORDER BY g.nombres ASC';
        if (sortBy.length) {
            const sortKey = sortBy[0].key;
            const sortOrder = sortBy[0].order === 'desc' ? 'DESC' : 'ASC';
            const validSortFields = {
                'cedula': 'a.cedula',
                'nombres': 'g.nombres',
                'apellidos': 'g.apellidos',
            };
            if (validSortFields[sortKey]) {
                orderByClause = `ORDER BY ${validSortFields[sortKey]} ${sortOrder}`;
            }
        }
        const countQuery = `
            SELECT COUNT(*) 
            FROM abogados AS a 
            JOIN general AS g ON a.cedula = g.cedula 
            ${whereClause} 
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count);
        const dataQuery = `
            SELECT 
                a.id, 
                a.cedula, 
                g.nombres, 
                g.apellidos, 
                json_agg(t.numero) FILTER (WHERE t.numero IS NOT NULL) AS telefonos,
                g.completo AS nom_completo,
                g.created_by
            FROM 
                abogados AS a 
            JOIN 
                general AS g ON a.cedula = g.cedula 
            LEFT JOIN
                telefonos AS t ON g.cedula = t.cedula_persona
            ${whereClause}
            GROUP BY 
                a.id, a.cedula, g.nombres, g.apellidos, g.completo, g.created_by
            ${orderByClause} 
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
        `;
        queryParams.push(limit);
        queryParams.push(offset);
        const dataResult = await pool.query(dataQuery, queryParams);
        const items = dataResult.rows;
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json({ items, totalItems });
    } catch (err) {
        console.error('Error al obtener los datos de abogados:', err);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

/**
 * Crea un nuevo registro de abogado.
 * OPTIMIZADO: Ahora usa la función upsertGeneral.
 */
const createAbogado = async (req, res) => {
    const { nombres, apellidos, cedula, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Se usa la función centralizada para manejar la inserción/actualización en la tabla general
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);

        const insertAbogadoQuery = `
            INSERT INTO abogados (cedula)
            VALUES ($1)
            RETURNING *;
        `;
        const resultAbogado = await client.query(insertAbogadoQuery, [cedula]);

        await client.query('COMMIT');
        res.status(201).json(resultAbogado.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al crear el registro de abogado:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe un registro con esa cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Actualiza un registro de abogado.
 * OPTIMIZADO: Ahora usa la función upsertGeneral.
 */
const updateAbogado = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, cedula, telefonos } = req.body;
    const { id: id_usuario } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Se usa la función centralizada para manejar la actualización en la tabla general
        await upsertGeneral(cedula, `${apellidos}, ${nombres}`, telefonos, id_usuario, client);
        
        // Si la cédula ha cambiado, se actualiza también en la tabla de abogados
        const oldCedulaQuery = 'SELECT cedula FROM abogados WHERE id = $1';
        const oldCedulaResult = await client.query(oldCedulaQuery, [id]);
        if (oldCedulaResult.rowCount > 0 && cedula !== oldCedulaResult.rows[0].cedula) {
            const updateAbogadoCedulaQuery = `
                UPDATE abogados SET cedula = $1 WHERE id = $2;
            `;
            await client.query(updateAbogadoCedulaQuery, [cedula, id]);
        }
        
        await client.query('COMMIT');
        res.json({ message: 'Registro actualizado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar el registro de abogado:', err);
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ya existe otro registro con esa cédula.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

/**
 * Elimina un registro de abogado.
 * La validación de permisos ahora se realiza en el middleware.
 */
const deleteAbogado = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // La consulta de eliminación ahora solo afecta a la tabla 'abogados'.
        const deleteAbogadoQuery = `
            DELETE FROM abogados WHERE id = $1 RETURNING *;
        `;
        const result = await client.query(deleteAbogadoQuery, [id]);
        
        await client.query('COMMIT');
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Registro de abogado no encontrado.' });
        }
        res.json({ message: 'Registro de abogado eliminado exitosamente.', deletedRecord: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar el registro de abogado:', err);
        if (err.code === '23503') {
            res.status(409).json({ error: 'No se puede eliminar este registro porque está vinculado a otra tabla.', details: err.detail });
        } else {
            res.status(500).json({ error: 'Error del servidor', details: err.detail });
        }
    } finally {
        client.release();
    }
};

module.exports = {
    getAbogadosData,
    createAbogado,
    updateAbogado,
    deleteAbogado
};