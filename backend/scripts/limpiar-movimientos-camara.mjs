// Limpia del historial los movimientos basura que dejó la primera versión de la cámara SICK: "Registrado …" y
// "+1 bolsa de …" con códigos que en realidad eran fragmentos de imágenes JPEG. Llegaron en dos ráfagas, y solo se
// borra lo que cae dentro de ellas: fuera de esas ventanas, los mismos textos son escaneos reales.
//   · 22-oct-2026 13:02–13:04 hora local (19:02–19:04 UTC)
//   · 23-oct-2026 07:29–07:31 hora local (13:29–13:31 UTC)
//
// Uso (desde la carpeta backend):
//   node scripts/limpiar-movimientos-camara.mjs            → solo MUESTRA lo que borraría (no cambia nada)
//   node scripts/limpiar-movimientos-camara.mjs --borrar   → guarda un respaldo del historial y borra
//
// Antes de borrar se escribe un respaldo completo del historial en ../respaldo-movimientos-<fecha y hora>.json.gz
import 'dotenv/config';
import fs from 'node:fs';
import zlib from 'node:zlib';
import mongoose from 'mongoose';

const borrar = process.argv.includes('--borrar');
const RAFAGAS = [
    [new Date('2026-10-22T19:00:00Z'), new Date('2026-10-22T19:05:00Z')],
    [new Date('2026-10-23T13:29:00Z'), new Date('2026-10-23T13:32:00Z')],
];
const CORTE = RAFAGAS[0][0]; // primer arranque de la cámara
const FILTRO = {
    $or: RAFAGAS.map(([desde, hasta]) => ({ fecha: { $gte: desde, $lt: hasta } })),
    texto: /^(Registrado|\+1 bolsa de) /,
};

await mongoose.connect(process.env.MONGODB_URI);
const movimientos = mongoose.connection.db.collection('movimientos');

const total = await movimientos.countDocuments();
const desdeElCorte = await movimientos.countDocuments({ fecha: { $gte: CORTE } });
const aBorrar = await movimientos.countDocuments(FILTRO);
const otros = desdeElCorte - aBorrar;
console.log(`Historial: ${total} movimientos`);
console.log(`Desde el ${CORTE.toISOString()}: ${desdeElCorte}`);
console.log(`  coinciden con la basura de la cámara ("Registrado …" / "+1 bolsa de …"): ${aBorrar}`);
console.log(`  otros (se conservan): ${otros}`);

if (!borrar) {
    console.log('\nNo se cambió nada. Para borrar: node scripts/limpiar-movimientos-camara.mjs --borrar');
} else {
    // Fecha y hora en el nombre: no reemplaza un respaldo anterior del mismo día
    const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const archivo = new URL(`../../respaldo-movimientos-${sello}.json.gz`, import.meta.url);
    fs.writeFileSync(archivo, zlib.gzipSync(JSON.stringify(await movimientos.find().toArray())));
    console.log(`\nRespaldo escrito: ${archivo.pathname.replace(/^\//, '')}`);
    const r = await movimientos.deleteMany(FILTRO);
    console.log(`Borrados: ${r.deletedCount} · quedan ${await movimientos.countDocuments()}`);
}
await mongoose.disconnect();
