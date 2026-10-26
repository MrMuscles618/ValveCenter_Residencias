import mongoose from 'mongoose';
import Articulo from './models/Articulo.js';

// Kanban 4 pasó de una ranura por posición (k4-m1:E-4) a 4 contenedores independientes por posición
// (k4-m1:E-4.1 … E-4.4). Lo que estaba en la ranura vieja pasa al primer contenedor de esa posición, igual que su
// color guardado. Solo toca ids con la forma exacta de la ranura vieja, así que es seguro repetirla.
export async function migrarCompartimentos() {
    const vieja = /^k4-m1:[A-Z]-[0-9]+$/;
    const articulos = await Articulo.collection.updateMany({ ubicacion: vieja }, [{ $set: { ubicacion: { $concat: ['$ubicacion', '.1'] } } }]);
    const colores = await mongoose.connection.collection('colorranuras').updateMany({ ranura: vieja }, [{ $set: { ranura: { $concat: ['$ranura', '.1'] } } }]);
    if (articulos.modifiedCount || colores.modifiedCount) {
        console.log(`Kanban 4: ${articulos.modifiedCount} artículo(s) y ${colores.modifiedCount} color(es) pasaron al contenedor 1 de su posición`);
    }
}

// Antes el código era único en todo el almacén (índice `codigo_1`). Ahora puede repetirse en distintas
// ubicaciones: el índice único pasó a ser (codigo, ubicacion), que crea el modelo. Aquí se quita el viejo.
export async function actualizarIndices() {
    try {
        await Articulo.collection.dropIndex('codigo_1');
        console.log('Índice único por código reemplazado por código + ubicación');
    } catch (error) {
        // 27 = el índice ya no existe, 26 = la colección aún no existe
        if (error.code !== 27 && error.code !== 26) throw error;
    }
    await Articulo.createIndexes();
}

// Artículos guardados antes de las bolsas independientes: solo tenían `cantidad`, las PIEZAS y el PESO
// de la etiqueta (por bolsa) y, a veces, `abierta` (piezas que quedaban en una bolsa abierta).
// Se les crean sus bolsas con esos valores. Solo toca artículos cuyas bolsas no cuadran con su cantidad.
export async function migrarBolsas() {
    const pendientes = await Articulo.find({
        $expr: { $ne: [{ $size: { $ifNull: ['$bolsas', []] } }, '$cantidad'] },
    }).lean();
    for (const a of pendientes) {
        const existentes = a.bolsas ?? [];
        const faltan = Math.max(0, a.cantidad - existentes.length);
        const nuevas = Array.from({ length: faltan }, (_, i) => ({
            _id: new mongoose.Types.ObjectId(),
            piezas: existentes.length === 0 && i === 0 && a.abierta ? a.abierta : a.contenido?.piezas ?? null,
            peso: a.contenido?.peso ?? null,
            fecha: a.contenido?.fecha ?? '',
            registrado: a.registrado ?? new Date(),
        }));
        await Articulo.updateOne(
            { _id: a._id },
            { $set: { bolsas: [...existentes, ...nuevas].slice(0, a.cantidad) }, $unset: { abierta: '' } },
            { strict: false },
        );
    }
    if (pendientes.length) console.log(`Bolsas independientes: ${pendientes.length} artículo(s) actualizados`);

    // Bolsas sin fecha de llegada (anteriores al FIFO por bolsa): toman la FECHA y el registro de su contenedor
    const sinFecha = await Articulo.collection.updateMany({ bolsas: { $elemMatch: { registrado: { $exists: false } } } }, [
        {
            $set: {
                bolsas: {
                    $map: {
                        input: '$bolsas',
                        in: {
                            $mergeObjects: [
                                '$$this',
                                {
                                    registrado: { $ifNull: ['$$this.registrado', '$registrado'] },
                                    fecha: { $ifNull: ['$$this.fecha', { $ifNull: ['$contenido.fecha', ''] }] },
                                },
                            ],
                        },
                    },
                },
            },
        },
    ]);
    if (sinFecha.modifiedCount) console.log(`FIFO por bolsa: ${sinFecha.modifiedCount} artículo(s) actualizados`);
}
