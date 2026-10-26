import { Router } from 'express';
import Rack from '../models/Rack.js';
import Articulo from '../models/Articulo.js';
import ColorRanura from '../models/ColorRanura.js';
import { crearMovimiento, errorHttp, idValido } from '../utils.js';
import { RECEPCION, reubicar } from '../ubicaciones.js';
import { idModulo } from '../ranuras.js';

const router = Router();
const COLORES = ['azul', 'verde', 'cafe'];
const MAX_RANURAS = 400;
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizar = (r) => {
    const rack = r.toObject();
    return { ...rack, id: r._id.toString(), _id: undefined, modulos: rack.modulos.map((m, i) => ({ ...m, id: idModulo(m, i) })) };
};
// Ids de ranura tal como los arma el frontend: "r<id del rack>-<id del módulo>:<etiqueta>"
const prefijo = (rackId) => `r${rackId}-`;
const idsRanuras = (rackId, modulos) =>
    new Set(modulos.flatMap((m) => m.niveles.flat().map((r) => `${prefijo(rackId)}${m.id}:${r.etiqueta}`)));

// Valida nombre, líneas y módulos; conserva el id de los módulos que ya existían
function validar(body, idsPrevios = []) {
    const nombre = texto(body.nombre);
    if (!nombre || nombre.length > 60) throw errorHttp(400, 'El nombre del rack es obligatorio (máx. 60 caracteres)');
    const lineas = Array.isArray(body.lineas) ? body.lineas.map(texto).filter(Boolean) : [];
    const modulos = body.modulos;
    if (!Array.isArray(modulos) || modulos.length < 1 || modulos.length > 20) throw errorHttp(400, 'El rack debe tener entre 1 y 20 módulos');

    let siguiente = Math.max(0, ...idsPrevios.map((id) => parseInt(id.slice(1), 10) || 0)) + 1;
    const usados = new Set();
    let total = 0;
    const limpios = modulos.map((m, i) => {
        const nombreModulo = texto(m?.nombre);
        if (!nombreModulo) throw errorHttp(400, `El módulo ${i + 1} necesita nombre`);
        if (!Array.isArray(m.niveles) || m.niveles.length < 1) throw errorHttp(400, `El módulo ${nombreModulo} necesita al menos un nivel`);
        const etiquetas = new Set();
        const niveles = m.niveles.map((nivel) => {
            if (!Array.isArray(nivel) || nivel.length < 1) throw errorHttp(400, `Cada nivel de ${nombreModulo} necesita al menos una ranura`);
            return nivel.map((r) => {
                const etiqueta = texto(r?.etiqueta);
                if (!etiqueta || etiqueta.length > 20) throw errorHttp(400, `Etiqueta de ranura inválida en ${nombreModulo}`);
                if (etiquetas.has(etiqueta)) throw errorHttp(400, `La ranura ${etiqueta} está repetida en ${nombreModulo}`);
                etiquetas.add(etiqueta);
                return { etiqueta, color: COLORES.includes(r.color) ? r.color : 'azul' };
            });
        });
        total += etiquetas.size;
        const id = idsPrevios.includes(m.id) && !usados.has(m.id) ? m.id : `m${siguiente++}`;
        usados.add(id);
        const config = m.config && typeof m.config === 'object' && !Array.isArray(m.config) ? m.config : undefined;
        return { id, nombre: nombreModulo, niveles, config };
    });
    if (total > MAX_RANURAS) throw errorHttp(400, `Un rack admite hasta ${MAX_RANURAS} ranuras`);
    return { nombre, lineas, modulos: limpios, total };
}

// Regresa a Recepción los artículos del rack cuyas ranuras ya no existen
async function regresarArticulos(rackId, nombre, validas = new Set()) {
    const articulos = await Articulo.find({ ubicacion: { $regex: `^${prefijo(rackId)}` } });
    const fuera = articulos.filter((a) => !validas.has(a.ubicacion));
    for (const a of fuera) {
        const origen = a.ubicacion.split(':').pop();
        // Si ya hay un artículo igual en Recepción, reubicar une sus bolsas a él
        await reubicar(a, RECEPCION, `${a.codigo}: ${nombre} ${origen} → Recepción (ranura retirada)`);
    }
    return fuera.length;
}

router.get('/', async (_req, res, next) => {
    try {
        const racks = await Rack.find().sort({ createdAt: 1 });
        res.json(racks.map(normalizar));
    } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
    try {
        const { total, ...datos } = validar(req.body);
        const rack = await Rack.create(datos);
        await crearMovimiento(`Rack agregado: ${datos.nombre} (${total} ranuras)`);
        res.status(201).json(normalizar(rack));
    } catch (error) {
        if (error.code === 11000) return next(errorHttp(409, 'Ya existe un rack con ese nombre'));
        next(error);
    }
});

// Edición: las ranuras que desaparecen devuelven su artículo a Recepción
router.put('/:id', async (req, res, next) => {
    try {
        if (!idValido(req.params.id)) throw errorHttp(400, 'Id de rack inválido');
        const rack = await Rack.findById(req.params.id);
        if (!rack) throw errorHttp(404, 'Rack no encontrado');
        const { total, ...datos } = validar(req.body, rack.modulos.map(idModulo));
        rack.set(datos);
        await rack.save();
        const validas = idsRanuras(rack.id, datos.modulos);
        const regresados = await regresarArticulos(rack.id, datos.nombre, validas);
        await ColorRanura.deleteMany({ ranura: { $regex: `^${prefijo(rack.id)}`, $nin: [...validas] } });
        await crearMovimiento(`Rack editado: ${datos.nombre} (${total} ranuras)`);
        res.json({ rack: normalizar(rack), regresados });
    } catch (error) {
        if (error.code === 11000) return next(errorHttp(409, 'Ya existe un rack con ese nombre'));
        next(error);
    }
});

// Eliminación: todos sus artículos regresan a Recepción
router.delete('/:id', async (req, res, next) => {
    try {
        if (!idValido(req.params.id)) throw errorHttp(400, 'Id de rack inválido');
        const rack = await Rack.findById(req.params.id);
        if (!rack) throw errorHttp(404, 'Rack no encontrado');
        const regresados = await regresarArticulos(rack.id, rack.nombre);
        await ColorRanura.deleteMany({ ranura: { $regex: `^${prefijo(rack.id)}` } });
        await rack.deleteOne();
        await crearMovimiento(`Rack eliminado: ${rack.nombre}`);
        res.json({ regresados });
    } catch (error) { next(error); }
});

export default router;
