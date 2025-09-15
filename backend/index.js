// server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { connectDbMiddleware } = require('./db/db');

// Importa todas las rutas
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const catastroRoutes = require('./routes/catastro.routes'); // <-- Asegúrate de que esta línea esté presente
const generalRoutes = require('./routes/general.routes');
const funcpublicRoutes = require('./routes/funcpublic.routes');
const itaipuRoutes = require('./routes/itaipu.routes');
const abogadosRoutes = require('./routes/abogados.routes');
const docentesRoutes = require('./routes/docentes.routes');
const yacyretaRoutes = require('./routes/yacyreta.routes');
const funcbnfRoutes = require('./routes/funcbnf.routes');
const despachantesRoutes = require('./routes/despachantes.routes');
const departamentosRoutes = require('./routes/departamentos.routes');
const ciudadesRoutes = require('./routes/ciudades.routes');
const propruralesRoutes = require('./routes/proprurales.routes');
const prourbanasRoutes = require('./routes/prourbanas.routes');
const propiedadesPropietariosRoutes = require('./routes/propro.routes');
const privateAgendaRoutes = require('./routes/privateAgenda.routes');
const followupRoutes = require('./routes/followup.routes');

const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());
app.use(connectDbMiddleware);

// Rutas API
app.get('/', (req, res) => {
    res.send('¡Servidor del backend en funcionamiento!');
});

app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', generalRoutes);
app.use('/api', funcpublicRoutes);
app.use('/api', itaipuRoutes);
app.use('/api', abogadosRoutes);
app.use('/api', docentesRoutes);
app.use('/api', yacyretaRoutes);
app.use('/api', funcbnfRoutes);
app.use('/api', despachantesRoutes);
app.use('/api', departamentosRoutes);
app.use('/api', ciudadesRoutes);
app.use('/api', propruralesRoutes);
app.use('/api', prourbanasRoutes);
app.use('/api', propiedadesPropietariosRoutes);
app.use('/api', catastroRoutes); // <-- ¡Agrega esta línea para el proxy de Catastro!

app.use('/api/private-agenda', privateAgendaRoutes); 
app.use('/api/private-agenda/events', followupRoutes);

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en el puerto ${PORT}`);
});

// Cierre limpio del servidor
process.on('SIGINT', () => {
    console.log('Servidor cerrado.');
    process.exit(0);
});