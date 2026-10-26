import { useDraggable, useDroppable } from '@dnd-kit/core';
import { idRanura } from '../data/kanbans';
import { bolsas, contenidoDe, numeroParte, resumenContenido } from '../utils/contenido';

// Dibujo de un Kanban: uno o varios módulos (racks físicos) con niveles y ranuras.
// Tocar un contenedor ocupado lo avisa con onTocarRanura; App abre su contenido en una ventana emergente.
//
// Un módulo con `compartimentos` (p. ej. Kanban 4: 4) divide cada posición del rack (C-1, D-1…) en esa cantidad de
// contenedores independientes (C-1.1 … C-1.4). En los datos son ranuras normales, una tras otra dentro del nivel;
// aquí se agrupan de a `compartimentos` para dibujar cada posición como un bloque.
const agrupar = (nivel, tamano) =>
    Array.from({ length: Math.ceil(nivel.length / tamano) }, (_, i) => nivel.slice(i * tamano, (i + 1) * tamano));

export default function Rack({ kanban, porRanura, seleccionado, resaltada, coincidencias, onTocarRanura }) {
    return (
        <div className={`kanban-racks ${kanban.flujo ? 'flujo' : ''}`}>
            {kanban.modulos.map((modulo) => {
                const tamano = modulo.compartimentos ?? 1;
                // Posiciones por nivel: lo que define las columnas de la cuadrícula
                const columnas = Math.max(...modulo.niveles.map((n) => Math.ceil(n.length / tamano)));
                return (
                    <div
                        className={`rack ${tamano > 1 ? 'con-compartimentos' : ''}`}
                        key={modulo.id}
                        style={{ '--columnas': columnas }}
                    >
                        <div className="rack-titulo">
                            <span>{modulo.nombre}</span>
                            <span className="rack-cuenta">
                                {modulo.niveles.flat().filter((r) => porRanura.has(idRanura(modulo, r.etiqueta))).length}/
                                {modulo.niveles.flat().length}
                            </span>
                        </div>
                        <div className="rack-estructura">
                            {modulo.niveles.map((nivel, i) => {
                                const posiciones = agrupar(nivel, tamano);
                                return (
                                    <div
                                        className="rack-nivel"
                                        key={i}
                                        // Misma cuadrícula en todos los niveles del rack, aunque un nivel tenga menos ranuras
                                        style={{ '--columnas': columnas }}
                                    >
                                        <div className="rack-ranuras">
                                            {posiciones.map((grupo) => {
                                                const celdas = grupo.map((r) => {
                                                    const id = idRanura(modulo, r.etiqueta);
                                                    const articulos = porRanura.get(id) ?? [];
                                                    return (
                                                        <Ranura
                                                            key={id}
                                                            id={id}
                                                            ranura={r}
                                                            mini={tamano > 1}
                                                            articulos={articulos}
                                                            destino={!!seleccionado}
                                                            resaltada={resaltada === id || articulos.some((a) => coincidencias?.has(a.id))}
                                                            onTocar={onTocarRanura}
                                                        />
                                                    );
                                                });
                                                return tamano > 1 ? (
                                                    <div className="posicion" key={grupo[0].grupo ?? grupo[0].etiqueta} role="group" aria-label={`Posición ${grupo[0].grupo}`}>
                                                        {celdas}
                                                    </div>
                                                ) : (
                                                    celdas
                                                );
                                            })}
                                        </div>
                                        <div className="rack-riel" aria-hidden="true">
                                            {posiciones.map((grupo) => (
                                                <span key={grupo[0].etiqueta}>{grupo[0].grupo ?? grupo[0].etiqueta}</span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Una ranura admite varios códigos y cualquier cantidad de bolsas. Se arrastra solo si tiene un
// único código; con varios, se toca para ver la lista y elegir cuál mover.
// `mini`: compartimento dentro de una posición (Kanban 4): se dibuja como celda de una bandeja dividida.
function Ranura({ id, ranura, mini, articulos, destino, resaltada, onTocar }) {
    const { setNodeRef: setDrop, isOver, active } = useDroppable({ id });
    const unico = articulos.length === 1 ? articulos[0] : null;
    const { attributes, listeners, setNodeRef: setDrag, isDragging } = useDraggable({
        id: unico?.id ?? `vacia:${id}`,
        data: { ubicacion: id },
        disabled: !unico,
    });
    const arrastrandoOtro = active && !articulos.some((a) => a.id === active.id);
    const total = articulos.reduce((s, a) => s + a.cantidad, 0);
    const detalle = articulos
        .map((a) => {
            const contenido = resumenContenido(contenidoDe(a)).map(([k, v]) => `${k}: ${v}`).join(' · ');
            return [`${a.codigo} (${bolsas(a.cantidad)})`, a.descripcion, contenido].filter(Boolean).join(' · ');
        })
        .join('\n');

    return (
        <div
            ref={setDrop}
            className={[
                'ranura',
                ranura.color,
                mini ? 'mini' : '',
                articulos.length ? 'ocupada' : 'vacia',
                articulos.length > 1 ? 'varios' : '',
                isOver && arrastrandoOtro ? 'sobre' : '',
                isDragging ? 'origen' : '',
                destino ? 'destino' : '',
                resaltada ? 'resaltada' : '',
            ].join(' ')}
            data-ranura={id}
        >
            <button
                ref={setDrag}
                className="contenedor"
                {...(unico ? listeners : {})}
                {...(unico ? attributes : {})}
                onClick={() => onTocar(id, articulos)}
                title={articulos.length ? `${ranura.etiqueta}\n${detalle}` : ranura.etiqueta}
                aria-label={
                    articulos.length
                        ? `${ranura.etiqueta}: ${articulos.map((a) => `${a.codigo}, ${bolsas(a.cantidad)}`).join('; ')}. ${bolsas(total)} en total`
                        : `${ranura.etiqueta}: vacía`
                }
            >
                {!mini && <span className="contenedor-etiqueta">{ranura.etiqueta}</span>}
                {mini ? (
                    // Compartimento: su número en la esquina y, si está ocupado, bolsas y número de parte en grande
                    <>
                        <span className="compartimento-numero">{ranura.corta}</span>
                        {articulos.length > 1 && <span className="compartimento-mas">+{articulos.length - 1}</span>}
                        {articulos.length > 0 && (
                            <>
                                <span className="compartimento-bolsas">
                                    {total}
                                    <small>bol</small>
                                </span>
                                <span className="compartimento-parte codigo-mono">
                                    {numeroParte(articulos[0].codigo) ?? articulos[0].codigo}
                                </span>
                            </>
                        )}
                    </>
                ) : articulos.length ? (
                    <>
                        <span className="contenedor-codigos">
                            <span className="contenedor-codigo codigo-mono">{articulos[0].codigo}</span>
                            {articulos.length > 1 && <span className="contenedor-mas">+{articulos.length - 1}</span>}
                        </span>
                        <span className="contenedor-cantidad">{total} bol</span>
                    </>
                ) : (
                    <span className="contenedor-vacio">{isOver ? 'Soltar' : 'Vacía'}</span>
                )}
            </button>
        </div>
    );
}
