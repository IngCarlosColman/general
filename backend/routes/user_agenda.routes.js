// user_agenda.routes.js

const express = require('express');
const router = express.Router();
const userAgendaController = require('../controllers/user_agenda.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// --- Definición de Roles ---
const allValidRoles = ['administrador', 'editor'];
// ----------------------------

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT); 

// Rutas de LECTURA (GET)
// Permite que 'administrador' y 'editor' vean su propia agenda.
router.get(
    '/', 
    checkRoles(allValidRoles), 
    userAgendaController.getUserAgenda
);

// Rutas de ESCRITURA (POST, PUT, DELETE)
// No es necesario usar canAccessRecord aquí, porque el controlador usa 
// req.user.id para forzar la propiedad en las tablas user_agendas y contact_notes.
// Solo necesitas garantizar que sean roles con permiso de escritura.

// Añadir contacto: Permite crear en 'general' (si no existe) y añadir a la agenda.
router.post(
    '/', 
    checkRoles(allValidRoles), // Ambos pueden crear/añadir
    userAgendaController.addContactToUserAgenda
);

// Actualizar contacto: Ambos pueden actualizar SU PROPIA entrada de agenda (categoría, notas).
router.put(
    '/:contact_cedula', 
    checkRoles(allValidRoles), 
    userAgendaController.updateContactInUserAgenda
);

// Eliminar contacto: Ambos pueden eliminar de SU PROPIA agenda.
router.delete(
    '/:contact_cedula', 
    checkRoles(allValidRoles), 
    userAgendaController.removeContactFromUserAgenda
);

module.exports = router;