// routes/privateAgenda.routes.js

const express = require('express');
const router = express.Router(); 
const privateAgendaController = require('../controllers/privateAgenda.controller'); 
const { authenticateJWT, checkRoles } = require('../middlewares/auth.middleware');

const allowedRoles = ['administrador', 'editor'];

router.use(authenticateJWT);

// --- Rutas de la agenda personal (Contactos) ---

// Cambia de '/private-agenda/cedulas' a '/cedulas'
router.get('/cedulas', checkRoles(allowedRoles), privateAgendaController.getPrivateAgendaCedulas);

// Cambia de '/private-agenda' a '/'
router.get('/', checkRoles(allowedRoles), privateAgendaController.getPrivateAgenda);

// Rutas con parámetros
router.post('/', checkRoles(allowedRoles), privateAgendaController.addContactToAgenda);
router.put('/:contactCedula', checkRoles(allowedRoles), privateAgendaController.updateContactDetails);
router.delete('/:contactCedula', checkRoles(allowedRoles), privateAgendaController.deleteContactFromAgenda);

module.exports = router;