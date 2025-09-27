const express = require('express');
const router = express.Router();
// 📌 Importamos el controlador centralizado
const dashboardController = require('../controllers/dashboard.controller'); 

// Importamos todos los middlewares necesarios
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// 📌 Definimos los roles que tienen permiso. Para un dashboard, 
// el 'visualizador' también debería tener acceso.
const allowedRoles = ['administrador', 'editor', 'visualizador'];

// Aplicamos el middleware de autenticación a todas las rutas de este router
router.use(authenticateJWT);


// ====================================================================
// RUTAS DEL PANEL DE CONTROL
// ====================================================================

// 1. RUTA: /api/dashboard/kpis-secundarios (KPIs de Alto Nivel)
// Usado por fetchPrincipalKpis()
router.get(
    '/dashboard/kpis-secundarios', 
    checkRoles(allowedRoles),
    dashboardController.getSecondaryKpis
);

// 2. RUTA: /api/dashboard/cobertura-funcionarios (Tabla de Detalle)
// Usado por fetchFuncionariosCobertura()
router.get(
    '/dashboard/cobertura-funcionarios', 
    checkRoles(allowedRoles),
    dashboardController.getFuncionariosCobertura
);

// 3. RUTA: /api/dashboard/distribucion-catastro (Gráficos)
// Usado por fetchDistribucionCatastro()
router.get(
    '/dashboard/distribucion-catastro', 
    checkRoles(allowedRoles),
    dashboardController.getDistribucionCatastro
);


module.exports = router;