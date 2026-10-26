import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import articulosRouter from './src/routes/articulos.js';
import historialRouter from './src/routes/historial.js';
import racksRouter from './src/routes/racks.js';
import coloresRouter from './src/routes/colores.js';
import { actualizarIndices, migrarBolsas, migrarCompartimentos } from './src/migraciones.js';

const app = express();
// Orígenes permitidos: los de FRONTEND_ORIGIN (varios, separados por comas) y cualquier puerto de localhost,
// porque Vite sube de puerto (5174, 5175…) cuando el 5173 está ocupado.
const origenes = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean);
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({ origin: (origen, permitir) => permitir(null, !origen || origenes.includes(origen) || LOCAL.test(origen)) }));
app.use(express.json({ limit: '32kb' }));
// Express 5 deja req.body en undefined si la petición no trae JSON
app.use((req, _res, next) => {
    req.body ??= {};
    next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/articulos', articulosRouter);
app.use('/api/historial', historialRouter);
app.use('/api/racks', racksRouter);
app.use('/api/colores', coloresRouter);
app.use((err, _req, res, _next) => {
    // Datos inválidos de Mongoose: es error del cliente, no del servidor. DocumentNotFoundError: otro equipo
    // eliminó el artículo mientras se editaba. 11000: otro equipo hizo el mismo cambio al mismo tiempo.
    const status =
        err.status ||
        (err.name === 'ValidationError' || err.name === 'CastError'
            ? 400
            : err.name === 'DocumentNotFoundError'
              ? 404
              : err.code === 11000
                ? 409
                : 500);
    const mensaje =
        err.name === 'DocumentNotFoundError'
            ? 'El artículo ya no existe; otro equipo lo retiró'
            : err.code === 11000 && !err.status
              ? 'Otro equipo hizo un cambio al mismo tiempo; intenta de nuevo'
              : err.message;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Error interno del servidor' : mensaje });
});

const port = Number(process.env.PORT || 3000);
if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI en backend/.env');

try {
    await mongoose.connect(process.env.MONGODB_URI);
    await actualizarIndices();
    await migrarBolsas();
    await migrarCompartimentos();
    app.listen(port, () => console.log(`API lista en http://localhost:${port}`));
} catch (error) {
    console.error('No se pudo conectar con MongoDB:', error.message);
    process.exit(1);
}