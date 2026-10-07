import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import productRoutes from './routes/products.routes.js';
import storeRoutes from './routes/stores.routes.js';
import viewRoutes from './routes/views.routes.js';
import seed from './utils/seed.js';
dotenv.config();

for (const name of ['MONGODB_URI', 'JWT_SECRET', 'MFA_ENC_KEY']) {
    if (!process.env[name]) {
        console.error(`Falta la variable ${name} en el archivo .env`);
        process.exit(1);
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable('x-powered-by');

// Motor de plantillas EJS y archivos estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json({ limit: '10kb' }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/', viewRoutes);

// Validar estado del servidor
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

// Rutas inexistentes
app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Recurso no encontrado' });
    res.status(404).render('404', { title: 'No encontrada' });
});

// Manejador global de errores
app.use((err, req, res, next) => {
    // Errores de validación de mongoose, ids mal formados y valores duplicados
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(e => e.message).join('. ');
        return res.status(400).json({ message });
    }
    if (err.name === 'CastError') return res.status(400).json({ message: 'Dato inválido' });
    if (err.code === 11000) return res.status(400).json({ message: 'Ya existe un registro con esos datos' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON inválido' });

    if (err.status) return res.status(err.status).json({ message: err.message, ...err.extra });

    console.error(err);
    res.status(500).json({ message: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI, { autoIndex: true })
    .then( async () => {
        console.log('Mongo connected');
        await seed();
        app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
    })
    .catch(err => {
        console.error('Error al conectar con Mongo:', err);
        process.exit(1);
    });
