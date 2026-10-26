import Articulo from './models/Articulo.js';
import { crearMovimiento, errorHttp } from './utils.js';

export const RECEPCION = 'recepcion';

export const etiqueta = (ubicacion) => (ubicacion === RECEPCION ? 'Recepción' : ubicacion);

// Mueve un artículo a Recepción o a una ranura.
// · Una ranura admite varios códigos y cualquier cantidad de bolsas (no hay límite).
// · Un código aparece una sola vez por ubicación: si ya hay uno igual en el destino, las bolsas se unen a él.
// `texto` reemplaza el mensaje del historial. Devuelve { articulo, unido }.
export async function reubicar(articulo, destino, texto, intento = 1) {
    const origen = articulo.ubicacion;
    if (destino === origen) return { articulo, unido: false };

    const hayIgual = await Articulo.exists({ codigo: articulo.codigo, ubicacion: destino, _id: { $ne: articulo._id } });
    if (!hayIgual) {
        try {
            const movido = await Articulo.findOneAndUpdate({ _id: articulo._id }, { $set: { ubicacion: destino } }, { returnDocument: 'after' });
            if (!movido) throw errorHttp(404, 'Artículo no encontrado');
            await crearMovimiento(texto ?? `${articulo.codigo}: ${etiqueta(origen)} → ${etiqueta(destino)}`);
            return { articulo: movido, unido: false };
        } catch (error) {
            // Otro equipo acaba de poner el mismo código en el destino (índice único código + ubicación): se unen
            if (error.code !== 11000 || intento > 1) throw error;
            return reubicar(articulo, destino, texto, intento + 1);
        }
    }

    // Unir: se retira el original tal como está AHORA, no como se leyó antes. Así, si otro equipo le acaba de dar
    // salida a una bolsa, esa bolsa no "revive" en el destino.
    const actual = await Articulo.findOneAndDelete({ _id: articulo._id });
    if (!actual) throw errorHttp(404, 'Artículo no encontrado');
    const bolsas = actual.bolsas.map((b) => b.toObject());
    const unido = await Articulo.findOneAndUpdate(
        { codigo: actual.codigo, ubicacion: destino },
        { $push: { bolsas: { $each: bolsas } }, $inc: { cantidad: bolsas.length } },
        { returnDocument: 'after' },
    );
    if (!unido) {
        // El del destino se vació en ese instante: el original ocupa su lugar con todas sus bolsas
        const recreado = await Articulo.create({ ...actual.toObject(), ubicacion: destino });
        await crearMovimiento(texto ?? `${actual.codigo}: ${etiqueta(origen)} → ${etiqueta(destino)}`);
        return { articulo: recreado, unido: false };
    }
    await crearMovimiento(texto ?? `${actual.codigo}: ${etiqueta(origen)} → ${etiqueta(destino)} (se unió a las bolsas que ya había)`);
    return { articulo: unido, unido: true };
}
