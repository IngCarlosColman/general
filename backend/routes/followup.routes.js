const express = require('express');
const router = express.Router();
const followupController = require('../controllers/followup.controller');

// Asume que estas rutas son las correctas
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');
const { canEditRecord, canDeleteRecord } = require('../middlewares/permissions.middleware'); 

// Roles permitidos para esta sección
const allowedRoles = ['administrador', 'editor'];

// Aplica el middleware de autenticación a todas las rutas de este router
router.use(authenticateJWT);

// Rutas protegidas
router.get('/', checkRoles(allowedRoles), followupController.getAllEvents);
router.post('/', checkRoles(allowedRoles), followupController.createEvent);

// Para las rutas PUT y DELETE, la validación de roles y de "propiedad del registro"
// es crucial. Aquí asumimos que los middlewares `canEditRecord` y `canDeleteRecord`
// manejarán la lógica para los eventos de seguimiento.
router.put(
    '/:id',
    checkRoles(allowedRoles),
    canEditRecord('follow_up_events'), // Pasas el nombre de la tabla
    followupController.updateEvent
);

router.delete(
    '/:id',
    checkRoles(allowedRoles),
    canDeleteRecord('follow_up_events'), // Pasas el nombre de la tabla
    followupController.deleteEvent
);

module.exports = router;