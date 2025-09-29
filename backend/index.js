require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { connectDbMiddleware } = require('./db/db');

// Importa todas las rutas
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const catastroRoutes = require('./routes/catastro.routes');
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
const telefonosRouter = require('./routes/telefonos.router');
const userAgendaRoutes = require('./routes/user_agenda.routes');
const categoriasRoutes = require('./routes/categorias.routes'); 
const geoRoutes = require('./routes/geo.routes');
const mapaRoutes = require('./routes/mapa.routes'); 
const consultaPadronRoutes = require('./routes/consulta_padron.routes');
const dashboardRoutes = require('./routes/dashboard.routes'); 
const subscriptionRoutes = require('./routes/subscription.routes'); 

// 🔑 Importación de las TRES nuevas rutas
const adminRoutes = require('./routes/admin.routes');
const billingRoutes = require('./routes/billing.routes');
const managementRoutes = require('./routes/management.routes');


const app = express();
const PORT = process.env.PORT || 8000;

// Middlewares
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());
app.use(connectDbMiddleware);

// Rutas API
app.get('/', (req, res) => {
    res.send('¡Servidor del backend en funcionamiento!');
});

// Montaje de rutas existentes
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
app.use('/api', catastroRoutes);
app.use('/api/agenda', userAgendaRoutes);
app.use('/api', telefonosRouter);
app.use('/api/categorias', categoriasRoutes); 
app.use('/api', geoRoutes);
app.use('/api', mapaRoutes);
app.use('/api', consultaPadronRoutes);
app.use('/api', dashboardRoutes);

// Uso de la ruta de Suscripción de Usuario (Comprobantes)
app.use('/api/subscription', subscriptionRoutes);

// ==========================================================
// 🔑 Montaje de las NUEVAS Rutas
// ==========================================================

// Rutas de Administración (Suscripciones, etc.) - Prefijo /api/admin
// Rutas finales: /api/admin/suscripciones/pendientes, etc.
app.use('/api/admin', adminRoutes);

// Rutas de Facturación - Prefijo /api/billing
// Rutas finales: /api/billing/facturacion/datos
app.use('/api/billing', billingRoutes);

// Rutas de Gestión de Licencias/Planes Grupales - Prefijo /api/management
// Rutas finales: /api/management/licencias/estado, etc.
app.use('/api/management', managementRoutes);


// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en el puerto ${PORT}`);
});

// Cierre limpio del servidor
process.on('SIGINT', () => {
    console.log('Servidor cerrado.');
    process.exit(0);
});
