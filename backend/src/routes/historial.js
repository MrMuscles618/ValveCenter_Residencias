import { Router } from 'express';
import Movimiento from '../models/Movimiento.js';

const router = Router();
// Por defecto los últimos 50; `?limite=N` pide más (hasta 5000), p. ej. para exportar a Power BI
const MAX_LIMITE = 5000;
router.get('/', async (req, res, next) => {
    try {
        const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 50, 1), MAX_LIMITE);
        const movimientos = await Movimiento.find().sort({ fecha: -1 }).limit(limite).lean();
        res.json(movimientos.map(({ _id, ...m }) => ({ ...m, id: _id.toString() })));
    } catch (error) { next(error); }
});

export default router;
