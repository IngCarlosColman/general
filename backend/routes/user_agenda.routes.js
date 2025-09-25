const express = require('express');
const router = express.Router();
const userAgendaController = require('../controllers/user_agenda.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
// 🚨 CAMBIO DE ROL: Incluso los usuarios 'readonly' deberían poder ver SU PROPIA agenda.
const allowedRoles = ['administrador', 'editor', 'readonly']; 

// Aplicamos el middleware de autenticación a todas las rutas del router
router.use(authenticateJWT); 
// 🚨 APLICACIÓN DE ROL: Se aplica el rol para que solo usuarios válidos accedan.
router.use(checkRoles(allowedRoles)); 

// Rutas para la agenda privada: El controlador DEBE usar req.user.id para forzar el acceso a SU propia agenda.
// Esto garantiza que el editor A nunca toque la agenda del editor B.

// Leer agenda (solo la propia)
router.get('/', userAgendaController.getUserAgenda);

// Añadir contacto (solo a la propia)
router.post('/', userAgendaController.addContactToUserAgenda);

// Actualizar contacto (solo en la propia)
router.put('/:contact_cedula', userAgendaController.updateContactInUserAgenda);

// Eliminar contacto (solo en la propia)
router.delete('/:contact_cedula', userAgendaController.removeContactFromUserAgenda);

module.exports = router;