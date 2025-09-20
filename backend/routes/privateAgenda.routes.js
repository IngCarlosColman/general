// src/routes/privateAgenda.routes.js

const express = require('express');
const router = express.Router();

// Importar los middlewares de autenticación
const { authenticateJWT } = require('../middlewares/auth.middleware');

// Importar los controladores correctos
const userAgendaController = require('../controllers/userAgendas.controller');
const contactDetailsController = require('../controllers/contactDetails.controller');
const userNombresController = require('../controllers/userNombres.controller');
const userTelefonosController = require('../controllers/userTelefonos.controller');
const contactNotesController = require('../controllers/contactNotes.controller');
const followUpEventsController = require('../controllers/followUpEvents.controller');
const categoriasController = require('../controllers/categorias.controller');
const userAgendaCategoriasController = require('../controllers/userAgendaCategorias.controller');

// Aplicar el middleware de autenticación a todas las rutas de la agenda privada
router.use(authenticateJWT);

// --- Rutas para la Agenda Personal (user_agendas) ---
// Obtener todos los contactos de la agenda del usuario
router.get('/agenda', userAgendaController.getUserAgendaData);
// Añadir un contacto de la tabla 'general' a la agenda del usuario
router.post('/agenda', userAgendaController.addContactToAgenda);
// Eliminar un contacto de la agenda del usuario
router.delete('/agenda/:contact_cedula', userAgendaController.removeContactFromAgenda);
// Actualizar el tipo de relación de un contacto
router.put('/agenda/:contact_cedula', userAgendaController.updateAgendaContact);

// --- Rutas para los Detalles del Contacto (contact_details) ---
// Obtener la lista de todos los detalles de contacto personalizados del usuario (con paginación)
router.get('/agenda/details', contactDetailsController.getContactDetailsData);
// Obtener los detalles personalizados de un contacto específico por su cédula
router.get('/agenda/details/:cedula', contactDetailsController.getContactDetail);
// Crear nuevos detalles personalizados para un contacto
router.post('/agenda/details', contactDetailsController.createContactDetail);
// Actualizar los detalles personalizados de un contacto
router.put('/agenda/details/:cedula', contactDetailsController.updateContactDetail);
// Eliminar los detalles personalizados de un contacto
router.delete('/agenda/details/:cedula', contactDetailsController.deleteContactDetail);

// --- Rutas para los Nombres Personalizados (user_nombres) ---
// Obtener el nombre personalizado de un contacto
router.get('/agenda/nombres/:contact_cedula', userNombresController.getUserNombre);
// Crear o actualizar un nombre personalizado para un contacto
router.put('/agenda/nombres/:contact_cedula', userNombresController.upsertUserNombre);
// Eliminar el nombre personalizado de un contacto
router.delete('/agenda/nombres/:contact_cedula', userNombresController.deleteUserNombre);

// --- Rutas para los Teléfonos Personalizados (user_telefonos) ---
// Obtener todos los teléfonos personales de un contacto
router.get('/agenda/telefonos/:contact_cedula', userTelefonosController.getUserTelefonosData);
// Agregar uno o varios teléfonos personales a un contacto
router.post('/agenda/telefonos/:contact_cedula', userTelefonosController.createUserTelefonos);
// Actualizar un teléfono personal por ID
router.put('/agenda/telefonos/:id', userTelefonosController.updateUserTelefono);
// Eliminar un teléfono personal de un contacto
router.delete('/agenda/telefonos/:id', userTelefonosController.deleteUserTelefono);

// --- Rutas para las Notas Personales (contact_notes) ---
// Obtener todas las notas de un contacto
router.get('/agenda/notas/:contact_cedula', contactNotesController.getContactNotesData);
// Crear una nota para un contacto
router.post('/agenda/notas/:contact_cedula', contactNotesController.createNote);
// Obtener una nota específica por ID
router.get('/agenda/notas/id/:id', contactNotesController.getNoteById);
// Actualizar una nota específica
router.put('/agenda/notas/:id', contactNotesController.updateNote);
// Eliminar una nota específica por ID
router.delete('/agenda/notas/:id', contactNotesController.deleteNote);

// --- Rutas para los Eventos de Seguimiento (follow_up_events) ---
// Obtener todos los eventos para un contacto
router.get('/agenda/events/:contact_cedula', followUpEventsController.getFollowUpEventsData);
// Crear un nuevo evento de seguimiento
router.post('/agenda/events/:contact_cedula', followUpEventsController.createEvent);
// Obtener un evento específico por ID
router.get('/agenda/events/id/:id', followUpEventsController.getEventById);
// Actualizar un evento de seguimiento por ID
router.put('/agenda/events/:id', followUpEventsController.updateEvent);
// Eliminar un evento de seguimiento por ID
router.delete('/agenda/events/:id', followUpEventsController.deleteEvent);

// --- Rutas para las Categorías ---
// Obtener la lista de categorías predefinidas
router.get('/categorias', categoriasController.getCategorias);
// Crear una nueva categoría predefinida (ej. solo para admins)
router.post('/categorias', categoriasController.createCategoria);
// Actualizar una categoría predefinida por ID
router.put('/categorias/:id', categoriasController.updateCategoria);
// Eliminar una categoría predefinida por ID
router.delete('/categorias/:id', categoriasController.deleteCategoria);

// --- Rutas para las Categorías de la Agenda Personal ---
// Obtener las categorías asignadas a un contacto específico
router.get('/agenda/categorias/:contact_cedula', userAgendaCategoriasController.getContactCategories);
// Asignar una categoría a un contacto
router.post('/agenda/categorias/:contact_cedula', userAgendaCategoriasController.assignCategoryToContact);
// Eliminar una categoría de un contacto
router.delete('/agenda/categorias/:contact_cedula/:categoria_id', userAgendaCategoriasController.removeCategoryFromContact);

module.exports = router;