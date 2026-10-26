import Rack from './models/Rack.js';
import { RANURAS } from '../../frontend/src/data/kanbans.js';
import { RECEPCION } from './ubicaciones.js';

// Validación de ids de ranura. Los racks fijos (Kanban 1…) se definen solo en frontend/src/data/kanbans.js,
// que es un archivo de datos puros; el backend lo importa de la carpeta vecina. Si algún día el backend se
// despliega sin la carpeta frontend, hay que mover ese archivo a una carpeta compartida.
// Los racks creados desde la app están en la base de datos.

// Racks creados antes de que los módulos tuvieran id: se toma su posición (m1, m2…)
export const idModulo = (m, i) => m.id || `m${i + 1}`;

// Id de ranura de un rack propio, tal como lo arma el frontend: "r<id del rack>-<id del módulo>:<etiqueta>"
const RANURA_PROPIA = /^r([0-9a-f]{24})-([^:]+):(.+)$/;

// `cache` (un Map) evita volver a leer el mismo rack al validar muchas ranuras seguidas
export async function ranuraExiste(ubicacion, cache = new Map()) {
    if (ubicacion === RECEPCION || RANURAS.has(ubicacion)) return true;
    const partes = RANURA_PROPIA.exec(ubicacion);
    if (!partes) return false;
    const [, rackId, moduloId, etiqueta] = partes;
    if (!cache.has(rackId)) cache.set(rackId, await Rack.findById(rackId).lean());
    const rack = cache.get(rackId);
    const modulo = rack?.modulos.find((m, i) => idModulo(m, i) === moduloId);
    return !!modulo?.niveles.flat().some((r) => r.etiqueta === etiqueta);
}
