import { RANURAS } from '../data/kanbans';
import { RECEPCION } from '../hooks/useAlmacen';
import { claveFifo, contenidoDe, valorCampo } from './contenido';

// Búsqueda de contenedores por código, descripción, contenido (lote, operación, PPP, fecha)
// o por su ubicación (rack, módulo, ranura). Sin distinguir mayúsculas ni acentos.
export const normalizar = (t) =>
    String(t ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();

// Campos donde se busca, en orden de prioridad: el primero que coincide es el que se reporta
const CAMPOS = [
    { id: 'codigo', etiqueta: 'Código', valor: (a) => a.codigo },
    { id: 'descripcion', etiqueta: 'Descripción', valor: (a) => a.descripcion },
    { id: 'lote', etiqueta: 'Lote', valor: (a, c) => valorCampo(c, 'lote') },
    { id: 'oper', etiqueta: 'Operación', valor: (a, c) => valorCampo(c, 'oper') },
    { id: 'ppp', etiqueta: 'PPP', valor: (a, c) => valorCampo(c, 'ppp') },
    { id: 'fecha', etiqueta: 'Fecha', valor: (a, c) => `${valorCampo(c, 'fecha')} ${c.fecha ?? ''}` },
    { id: 'ranura', etiqueta: 'Contenedor', valor: (a, c, r) => r?.etiqueta },
    { id: 'rack', etiqueta: 'Rack', valor: (a, c, r) => (r ? `${r.kanban.nombre} ${r.modulo.nombre}` : 'recepcion') },
];

// Resultados: [{ articulo, ranura (o null si está en Recepción), campo coincidente }],
// en orden FIFO: del más antiguo (FECHA y hora de registro) al más nuevo
export function buscar(articulos, texto) {
    const q = normalizar(texto);
    if (!q) return [];
    const resultados = [];
    for (const articulo of articulos) {
        const ranura = articulo.ubicacion !== RECEPCION ? RANURAS.get(articulo.ubicacion) ?? null : null;
        const contenido = contenidoDe(articulo);
        for (const campo of CAMPOS) {
            const valor = normalizar(campo.valor(articulo, contenido, ranura));
            if (!valor.includes(q)) continue;
            resultados.push({ articulo, ranura, campo, fifo: claveFifo(articulo) });
            break;
        }
    }
    resultados.sort((a, b) => a.fifo.localeCompare(b.fifo) || a.articulo.codigo.localeCompare(b.articulo.codigo));
    return resultados;
}
