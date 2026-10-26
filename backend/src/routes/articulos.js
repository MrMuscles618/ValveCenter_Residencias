import { Router } from 'express';
import mongoose from 'mongoose';
import Articulo from '../models/Articulo.js';
import { crearMovimiento, errorHttp, idValido } from '../utils.js';
import { ranuraExiste } from '../ranuras.js';
import { RECEPCION, etiqueta, reubicar } from '../ubicaciones.js';

const router = Router();
const normalizar = (a) => {
    const o = a.toObject?.() ?? a;
    const bolsas = (o.bolsas ?? []).map((b) => ({
        id: b._id.toString(),
        piezas: b.piezas ?? null,
        peso: b.pesoBloqueado ? null : b.peso ?? null,
        pesoBloqueado: !!b.pesoBloqueado,
        fecha: b.fecha || '',
        registrado: b.registrado ?? null,
    }));
    return { ...o, id: o._id.toString(), _id: undefined, bolsas };
};
const bolsas = (n) => `${n} bolsa${n === 1 ? '' : 's'}`;

// Campos de contenido del contenedor (FECHA, PESO, LOTE, PIEZAS, PPP, OPER), todos opcionales.
// Devuelve solo los campos presentes en `entrada`, ya validados, para mezclarlos con lo guardado.
const CAMPOS_TEXTO = ['lote', 'ppp', 'oper'];
const CAMPOS_NUMERO = ['peso', 'piezas'];

// Número opcional mayor o igual a cero (entero para piezas); null si viene vacío
function leerNumero(campo, valor) {
    if (valor === null || valor === '') return null;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) throw errorHttp(400, `${campo.toUpperCase()} debe ser un número mayor o igual a cero`);
    if (campo === 'piezas' && !Number.isInteger(n)) throw errorHttp(400, 'PIEZAS debe ser un número entero');
    return n;
}

function limpiarContenido(entrada) {
    if (entrada === undefined) return undefined;
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw errorHttp(400, 'El contenido debe ser un objeto');
    const limpio = {};
    if ('fecha' in entrada) {
        const fecha = String(entrada.fecha ?? '').trim();
        if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw errorHttp(400, 'La fecha debe tener formato AAAA-MM-DD');
        limpio.fecha = fecha;
    }
    for (const campo of CAMPOS_TEXTO) {
        if (!(campo in entrada)) continue;
        const valor = String(entrada[campo] ?? '').trim();
        if (valor.length > 60) throw errorHttp(400, `${campo.toUpperCase()} admite hasta 60 caracteres`);
        limpio[campo] = valor;
    }
    for (const campo of CAMPOS_NUMERO) if (campo in entrada) limpio[campo] = leerNumero(campo, entrada[campo]);
    return limpio;
}

// Fecha local AAAA-MM-DD (hoy si no se indica otra)
const fechaLocal = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fechaHoy = () => fechaLocal();

// Bolsas en orden FIFO: FECHA de la etiqueta y, el mismo día, la que llegó primero.
// Sin FECHA se usa el día en que llegó; si tampoco se sabe, va al final (no debe colarse como la más antigua).
const claveFifo = (b) => {
    const llegada = b.registrado ? new Date(b.registrado) : null;
    return `${b.fecha || (llegada ? fechaLocal(llegada) : '9999-99-99')} ${llegada ? llegada.toISOString() : ''}`;
};
const ordenFifo = (lista) => [...lista].sort((a, b) => claveFifo(a).localeCompare(claveFifo(b)));

// Deja el artículo con exactamente `cantidad` bolsas en una sola operación atómica: quita las últimas
// o agrega bolsas nuevas, y fija `cantidad` = número de bolsas. Dos ajustes simultáneos no pueden
// descuadrarlas (gana el último, pero siempre cuadran). Devuelve el artículo actualizado o null.
function ajustarBolsas(id, cantidad, base) {
    const nuevas = Array.from({ length: cantidad }, () => ({ _id: new mongoose.Types.ObjectId(), ...nuevaBolsa(base) }));
    const faltan = { $subtract: [cantidad, { $size: '$bolsas' }] };
    return Articulo.findOneAndUpdate(
        { _id: id },
        [
            {
                $set: {
                    bolsas: {
                        $concatArrays: [
                            { $slice: ['$bolsas', cantidad] },
                            { $cond: [{ $gt: [faltan, 0] }, { $slice: [{ $literal: nuevas }, faltan] }, []] },
                        ],
                    },
                },
            },
            { $set: { cantidad: { $size: '$bolsas' } } },
        ],
        { returnDocument: 'after', updatePipeline: true },
    );
}

// Bolsa nueva con las piezas, el peso y la FECHA de su etiqueta (sin FECHA: el día en que llega)
const nuevaBolsa = (contenido) => ({
    piezas: contenido?.piezas ?? null,
    peso: contenido?.peso ?? null,
    fecha: contenido?.fecha || fechaHoy(),
    registrado: new Date(),
});

// Retira bolsas concretas de forma atómica (si otra operación ya se llevó alguna, no hace nada).
// Si no quedan bolsas el artículo se elimina y su ranura queda libre.
async function quitarBolsas(id, ids) {
    const articulo = await Articulo.findOneAndUpdate(
        { _id: id, 'bolsas._id': { $all: ids } },
        { $pull: { bolsas: { _id: { $in: ids } } }, $inc: { cantidad: -ids.length } },
        { returnDocument: 'after' },
    );
    if (!articulo) return null;
    const eliminado = articulo.bolsas.length === 0;
    if (eliminado) await Articulo.deleteOne({ _id: id, 'bolsas.0': { $exists: false } });
    return { articulo, eliminado };
}

router.get('/', async (_req, res, next) => {
    try {
        const articulos = await Articulo.find().sort({ registrado: -1 });
        res.json(articulos.map(normalizar));
    } catch (error) { next(error); }
});

// Registra un escaneo (lo usa la ruta POST de abajo).
// Devuelve { status, cuerpo }: código nuevo → se crea en Recepción · ya en Recepción → +1 bolsa ·
// ya en algún rack → sale su bolsa más antigua (FIFO).
// Escaneos simultáneos del mismo código (dos equipos, o el lector repitiendo) se reintentan en lugar de rechazarse:
// · código nuevo: los dos ven que no existe y los dos intentan crearlo; el índice único deja pasar uno y el otro,
//   al reintentar, ya lo encuentra en Recepción (+1 bolsa);
// · salida o +1 bolsa: si otro escaneo cambió el contenedor entre la lectura y la escritura, se vuelve a leer.
// Así N escaneos siempre son N operaciones, igual que si llegaran uno tras otro.
export async function registrarEscaneo(datos) {
    for (let intento = 1; ; intento++) {
        try {
            return await intentarEscaneo(datos);
        } catch (error) {
            if (error.code !== 11000 && !error.reintentar) throw error;
            if (intento >= 8) throw errorHttp(409, 'El código se estaba registrando desde otro equipo; vuelve a escanearlo');
        }
    }
}
// Error de "el contenedor cambió mientras tanto": registrarEscaneo lo reintenta
const cambioSimultaneo = (mensaje) => Object.assign(errorHttp(409, mensaje), { reintentar: true });

async function intentarEscaneo({ codigo: crudo, formato, contenido: entrada }) {
    const codigo = String(crudo || '').trim();
    if (!codigo) throw errorHttp(400, 'El código es obligatorio');
    if (codigo.length > 500) throw errorHttp(400, 'El código es demasiado largo');
    const contenido = limpiarContenido(entrada);
    // Un código puede estar en varias ubicaciones (una entrada por ubicación)
    const entradas = await Articulo.find({ codigo });
    const enRacks = entradas.filter((e) => e.ubicacion !== RECEPCION);
    if (enRacks.length) {
        // Ya está en algún rack: sale su bolsa más antigua (FIFO) de entre todas las que tiene en racks
        const [primera] = enRacks
            .flatMap((e) => e.bolsas.map((b) => ({ e, b })))
            .sort((x, y) => claveFifo(x.b).localeCompare(claveFifo(y.b)));
        const r = primera && (await quitarBolsas(primera.e._id, [primera.b._id]));
        if (!primera) throw errorHttp(409, `${codigo} ya no tiene bolsas; vuelve a escanearlo`);
        if (!r) throw cambioSimultaneo(`${codigo} cambió mientras se registraba la salida; vuelve a escanearlo`);
        await crearMovimiento(`Salida de ${codigo}: -1 bolsa (${etiqueta(primera.e.ubicacion)}; quedan ${r.articulo.cantidad})`);
        return { status: 200, cuerpo: { tipo: 'salida', articulo: normalizar(r.articulo), eliminado: r.eliminado } };
    }
    const existente = entradas[0]; // solo puede estar en Recepción
    if (existente) {
        // Bolsa nueva: piezas y peso de su etiqueta o, si no los trae, los del contenedor
        const bolsa = nuevaBolsa({
            piezas: contenido?.piezas ?? existente.contenido?.piezas,
            peso: contenido?.peso ?? existente.contenido?.peso,
            fecha: contenido?.fecha,
        });
        const articulo = await Articulo.findByIdAndUpdate(
            existente._id,
            { $push: { bolsas: bolsa }, $inc: { cantidad: 1 } },
            { returnDocument: 'after' },
        );
        if (!articulo) throw cambioSimultaneo(`${codigo} cambió mientras se registraba; vuelve a escanearlo`);
        await crearMovimiento(`+1 bolsa de ${codigo} (${etiqueta(articulo.ubicacion)})`);
        return { status: 200, cuerpo: { tipo: 'existente', articulo: normalizar(articulo) } };
    }
    // FECHA automática: la de la etiqueta si viene, si no la del registro
    const fecha = contenido?.fecha || fechaHoy();
    const articulo = await Articulo.create({
        codigo,
        formato: String(formato || 'Manual').slice(0, 60),
        ubicacion: RECEPCION,
        contenido: { ...contenido, fecha },
        bolsas: [nuevaBolsa({ ...contenido, fecha })],
        cantidad: 1,
    });
    await crearMovimiento(`Registrado ${codigo} en Recepción`);
    return { status: 201, cuerpo: { tipo: 'nuevo', articulo: normalizar(articulo) } };
}

router.post('/', async (req, res, next) => {
    try {
        const { status, cuerpo } = await registrarEscaneo(req.body);
        res.status(status).json(cuerpo);
    } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
    try {
        if (!idValido(req.params.id)) throw errorHttp(400, 'Id de artículo inválido');
        const { cantidad, descripcion, ubicacion } = req.body;
        if (cantidad !== undefined && (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500)) throw errorHttp(400, 'La cantidad debe ser un entero entre 1 y 500');
        if (descripcion !== undefined && typeof descripcion !== 'string') throw errorHttp(400, 'La descripción debe ser texto');
        if (ubicacion !== undefined && (typeof ubicacion !== 'string' || !ubicacion.trim() || ubicacion.length > 200)) throw errorHttp(400, 'Ubicación inválida');
        const contenido = limpiarContenido(req.body.contenido);

        let articulo = await Articulo.findById(req.params.id);
        if (!articulo) throw errorHttp(404, 'Artículo no encontrado');
        const origen = articulo.ubicacion;
        // Solo se puede mover a Recepción o a una ranura que exista (quedarse donde está siempre es válido)
        if (ubicacion !== undefined && ubicacion !== origen && !(await ranuraExiste(ubicacion))) {
            throw errorHttp(400, 'La ranura no existe');
        }
        // Ajuste manual de bolsas: se agregan con las piezas y el peso de la etiqueta (fecha de hoy)
        // o se quitan las últimas. Es atómico para que `cantidad` siempre sea igual al número de bolsas.
        // Queda en el historial porque cambia el inventario (a diferencia de descripción y contenido)
        if (cantidad !== undefined && cantidad !== articulo.bolsas.length) {
            const base = { piezas: articulo.contenido?.piezas, peso: articulo.contenido?.peso };
            const antes = articulo.bolsas.length;
            articulo = await ajustarBolsas(articulo._id, cantidad, base);
            if (!articulo) throw errorHttp(404, 'Artículo no encontrado');
            await crearMovimiento(`${articulo.codigo}: ajuste manual de bolsas ${antes} → ${articulo.cantidad} (${etiqueta(articulo.ubicacion)})`);
        }
        if (descripcion !== undefined) articulo.descripcion = descripcion.trim();
        if (contenido) {
            const actual = articulo.contenido?.toObject?.() ?? {};
            // FECHA es automática y no se puede editar ni borrar: solo se completa si un registro antiguo no la tenía
            if (actual.fecha || !contenido.fecha) contenido.fecha = actual.fecha || '';
            articulo.contenido = { ...actual, ...contenido };
        }

        if (ubicacion === undefined || ubicacion === origen) {
            await articulo.save();
            return res.json(normalizar(articulo));
        }

        // Movimiento: una ranura admite varios códigos y cualquier cantidad de bolsas; si el mismo código ya está
        // en el destino, sus bolsas se unen
        await articulo.save();
        const movido = await reubicar(articulo, ubicacion);
        res.json(normalizar(movido.articulo));
    } catch (error) { next(error); }
});

// Piezas y peso de una bolsa; cada bolsa se edita por separado
router.patch('/:id/bolsas/:bolsa', async (req, res, next) => {
    try {
        if (!idValido(req.params.id) || !idValido(req.params.bolsa)) throw errorHttp(400, 'Id inválido');
        const cambios = {};
        for (const campo of CAMPOS_NUMERO) if (campo in req.body) cambios[`bolsas.$.${campo}`] = leerNumero(campo, req.body[campo]);
        if (!Object.keys(cambios).length) throw errorHttp(400, 'Indica las piezas o el peso de la bolsa');

        const antes = await Articulo.findOne({ _id: req.params.id, 'bolsas._id': req.params.bolsa });
        if (!antes) throw errorHttp(404, 'La bolsa ya no existe');
        const n = antes.bolsas.findIndex((b) => b._id.equals(req.params.bolsa));
        const previa = antes.bolsas[n];
        const bloqueado = `El peso de la bolsa ${n + 1} quedó en NA por una salida de piezas y ya no se puede modificar`;
        if ('peso' in req.body && previa.pesoBloqueado) throw errorHttp(409, bloqueado);

        // Si cambia el peso, solo se aplica mientras no se haya bloqueado (una salida de piezas al mismo tiempo)
        const bolsaFiltro = 'peso' in req.body ? { _id: req.params.bolsa, pesoBloqueado: { $ne: true } } : { _id: req.params.bolsa };
        const articulo = await Articulo.findOneAndUpdate(
            { _id: req.params.id, bolsas: { $elemMatch: bolsaFiltro } },
            { $set: cambios },
            { returnDocument: 'after' },
        );
        if (!articulo) throw errorHttp(409, 'peso' in req.body ? bloqueado : 'La bolsa ya no existe');

        const nueva = articulo.bolsas.id(req.params.bolsa);
        const partes = [];
        if ('piezas' in req.body && previa.piezas !== nueva.piezas) partes.push(`piezas ${previa.piezas ?? '—'} → ${nueva.piezas ?? '—'}`);
        if ('peso' in req.body && previa.peso !== nueva.peso) partes.push(`peso ${previa.peso ?? '—'} → ${nueva.peso ?? '—'}`);
        if (partes.length) await crearMovimiento(`${articulo.codigo}, bolsa ${n + 1}: ${partes.join(', ')}`);
        res.json(normalizar(articulo));
    } catch (error) { next(error); }
});

// Salida de bolsas completas: `bolsas` (ids) indica cuáles; sin ids salen las `cantidad` más antiguas
// (por defecto todas). Si no queda ninguna, el artículo se elimina y la ranura queda libre.
router.post('/:id/salida', async (req, res, next) => {
    try {
        if (!idValido(req.params.id)) throw errorHttp(400, 'Id de artículo inválido');
        const actual = await Articulo.findById(req.params.id);
        if (!actual) throw errorHttp(404, 'Artículo no encontrado');

        let ids;
        if (req.body.bolsas !== undefined) {
            if (!Array.isArray(req.body.bolsas) || !req.body.bolsas.length || !req.body.bolsas.every(idValido)) throw errorHttp(400, 'Indica las bolsas que salen');
            ids = [...new Set(req.body.bolsas.map(String))];
            if (!ids.every((id) => actual.bolsas.id(id))) throw errorHttp(409, 'Alguna bolsa ya no existe; vuelve a abrir la salida');
        } else {
            const cantidad = req.body.cantidad ?? actual.bolsas.length;
            if (!Number.isInteger(cantidad) || cantidad < 1) throw errorHttp(400, 'La cantidad debe ser un entero mayor que cero');
            if (cantidad > actual.bolsas.length) throw errorHttp(400, `Solo hay ${bolsas(actual.bolsas.length)} de ${actual.codigo}`);
            ids = ordenFifo(actual.bolsas).slice(0, cantidad).map((b) => b._id.toString());
        }

        const r = await quitarBolsas(actual._id, ids);
        if (!r) throw errorHttp(409, `${actual.codigo} cambió mientras se registraba la salida; intenta de nuevo`);
        await crearMovimiento(
            `Salida de ${actual.codigo}: -${bolsas(ids.length)} (${etiqueta(actual.ubicacion)}; quedan ${r.articulo.cantidad})`,
        );
        res.json({ tipo: 'salida', articulo: normalizar(r.articulo), eliminado: r.eliminado, cantidad: ids.length });
    } catch (error) { next(error); }
});

// Salida de piezas de una sola bolsa; las demás bolsas no cambian.
// Ej.: bolsa de 230 pz, salen 30 → esa bolsa queda con 200 pz y su peso en NA, bloqueado.
router.post('/:id/salida-piezas', async (req, res, next) => {
    try {
        if (!idValido(req.params.id) || !idValido(req.body.bolsa)) throw errorHttp(400, 'Indica la bolsa de la que salen las piezas');
        const piezas = req.body.piezas;
        if (!Number.isInteger(piezas) || piezas < 1) throw errorHttp(400, 'Las piezas deben ser un entero mayor que cero');
        const actual = await Articulo.findById(req.params.id);
        if (!actual) throw errorHttp(404, 'Artículo no encontrado');
        const n = actual.bolsas.findIndex((b) => b._id.equals(req.body.bolsa));
        const bolsa = actual.bolsas[n];
        if (!bolsa) throw errorHttp(409, 'La bolsa ya no existe; vuelve a abrir la salida');
        if (!bolsa.piezas) throw errorHttp(400, `Captura primero las piezas de la bolsa ${n + 1}`);
        if (piezas > bolsa.piezas) throw errorHttp(400, `La bolsa ${n + 1} solo tiene ${bolsa.piezas} pz`);
        const restante = bolsa.piezas - piezas;

        let r;
        if (restante === 0) {
            // La bolsa se vació: sale completa
            r = await quitarBolsas(actual._id, [bolsa._id]);
        } else {
            // El peso ya no es el de la etiqueta: queda en NA y no se puede volver a capturar
            const articulo = await Articulo.findOneAndUpdate(
                { _id: actual._id, bolsas: { $elemMatch: { _id: bolsa._id, piezas: bolsa.piezas } } },
                { $set: { 'bolsas.$.piezas': restante, 'bolsas.$.peso': null, 'bolsas.$.pesoBloqueado': true } },
                { returnDocument: 'after' },
            );
            r = articulo && { articulo, eliminado: false };
        }
        if (!r) throw errorHttp(409, `${actual.codigo} cambió mientras se registraba la salida; intenta de nuevo`);

        await crearMovimiento(
            `Salida de ${actual.codigo}: -${piezas} pz de la bolsa ${n + 1} (${etiqueta(actual.ubicacion)}; ${
                restante ? `quedan ${restante} pz en esa bolsa; peso NA` : 'la bolsa se vació'
            })`,
        );
        res.json({ tipo: 'salida', articulo: normalizar(r.articulo), eliminado: r.eliminado, piezas, restante, bolsa: n + 1 });
    } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        if (!idValido(req.params.id)) throw errorHttp(400, 'Id de artículo inválido');
        const articulo = await Articulo.findByIdAndDelete(req.params.id);
        if (!articulo) throw errorHttp(404, 'Artículo no encontrado');
        await crearMovimiento(`Eliminado ${articulo.codigo} (${bolsas(articulo.cantidad)})`);
        res.status(204).end();
    } catch (error) { next(error); }
});

export default router;
