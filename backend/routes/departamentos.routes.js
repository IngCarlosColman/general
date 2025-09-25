const express = require('express');
const router = express.Router();
const departamentosController = require('../controllers/departamentos.controller');

// Importamos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
// El middleware 'canAccessRecord' no se usará si los departamentos son globales.

// Definimos los roles que tienen permiso para MODIFICAR estas rutas
const CUD_ROLES = ['administrador', 'editor'];

// Aplicamos el middleware de autenticación a todas las rutas (Permite acceso a 'readonly' para GET)
router.use(authenticateJWT);

// -------------------------------------------------------------
// RUTAS DE CONSULTA (GET)
// -------------------------------------------------------------
// Cualquier usuario autenticado puede ver la lista de departamentos.
router.get('/departamentos', departamentosController.getDepartamentosData);


// -------------------------------------------------------------
// RUTAS DE MODIFICACIÓN (POST, PUT, DELETE)
// -------------------------------------------------------------
// Estas rutas requieren el blindaje de rol (solo 'administrador' o 'editor').

// Ruta para crear un nuevo departamento
router.post('/departamentos', 
    checkRoles(CUD_ROLES), 
    departamentosController.createDepartamento
);

// Ruta para actualizar un departamento por su ID
// No se usa canAccessRecord porque los departamentos son recursos compartidos.
router.put(
    '/departamentos/:id',
    checkRoles(CUD_ROLES),
    departamentosController.updateDepartamento
);

// Ruta para eliminar un departamento por su ID
// No se usa canAccessRecord porque los departamentos son recursos compartidos.
router.delete(
    '/departamentos/:id',
    checkRoles(CUD_ROLES),
    departamentosController.deleteDepartamento
);

module.exports = router;