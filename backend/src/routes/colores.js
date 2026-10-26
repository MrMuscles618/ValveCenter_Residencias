import { Router } from 'express';
import ColorRanura from '../models/ColorRanura.js';
import { errorHttp } from '../utils.js';
import { ranuraExiste } from '../ranuras.js';

const router = Router();
const COLORES = ['azul', 'verde', 'cafe'];

router.get('/', async (_req, res, next) => {
    try {
        const colores = await ColorRanura.find().lean();
        res.json(colores.map(({ ranura, color }) => ({ ranura, color })));
    } catch (error) { next(error); }
});

// Cambios en lote: { cambios: [{ ranura, color }] }; color null regresa la ranura a su color original
router.put('/', async (req, res, next) => {
    try {
        const { cambios } = req.body;
        if (!Array.isArray(cambios) || cambios.length < 1 || cambios.length > 1000) throw errorHttp(400, 'Envía entre 1 y 1000 cambios de color');
        const operaciones = cambios.map((c) => {
            const ranura = typeof c?.ranura === 'string' ? c.ranura.trim() : '';
            if (!ranura || ranura.length > 100) throw errorHttp(400, 'Ranura inválida');
            if (c.color === null) return { deleteOne: { filter: { ranura } } };
            if (!COLORES.includes(c.color)) throw errorHttp(400, `Color inválido: ${c.color}`);
            return { updateOne: { filter: { ranura }, update: { $set: { color: c.color } }, upsert: true } };
        });
        // Pintar solo ranuras que existen (quitar un color guardado de una ranura que ya no existe sí se permite)
        const racks = new Map();
        for (const c of cambios) {
            if (c.color !== null && !(await ranuraExiste(c.ranura.trim(), racks))) throw errorHttp(400, `La ranura ${c.ranura} no existe`);
        }
        await ColorRanura.bulkWrite(operaciones);
        res.json({ actualizadas: operaciones.length });
    } catch (error) { next(error); }
});

export default router;
