const express = require('express');
const router = express.Router();
const userAgendaController = require('../controllers/user_agenda.controller');
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

// Definimos los roles que tienen permiso para acceder a estas rutas
const allowedRoles = ['administrador', 'editor'];

// Todas las rutas de la agenda privada deben estar protegidas
router.use(authenticateJWT);
router.use(checkRoles(allowedRoles));

// Rutas para la agenda privada
// Elimina el prefijo "/agenda" de todas las rutas aquí
router.get('/', userAgendaController.getUserAgenda);
router.post('/', userAgendaController.addContactToUserAgenda);
router.put('/:contact_cedula', userAgendaController.updateContactInUserAgenda);
router.delete('/:contact_cedula', userAgendaController.removeContactFromUserAgenda);

module.exports = router;