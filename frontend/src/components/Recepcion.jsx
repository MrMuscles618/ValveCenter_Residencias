import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import CodigoBarras from './CodigoBarras';
import { ListaBolsas, ResumenContenido } from './Contenido';
import { bolsas } from '../utils/contenido';
import { leerEntero } from '../utils/numeros';
import { RECEPCION } from '../hooks/useAlmacen';

// Apartado de Recepción: lo escaneado queda aquí, fuera de los racks,
// hasta que se arrastra (o se selecciona y se toca) una ranura.
export default function Recepcion({ articulos, seleccionado, onSeleccionar, onActualizar, onEliminar, onDetalle, coincidencias }) {
    const { setNodeRef, isOver, active } = useDroppable({ id: RECEPCION });
    const vieneDeRack = active && active.data.current?.ubicacion !== RECEPCION;

    return (
        <section
            ref={setNodeRef}
            className={`glass recepcion ${isOver && vieneDeRack ? 'sobre' : ''} ${vieneDeRack ? 'acepta' : ''}`}
            aria-labelledby="titulo-recepcion"
        >
            <div className="seccion-encabezado">
                <h2 id="titulo-recepcion" className="seccion-titulo">Recepción</h2>
                <span className="etiqueta">{articulos.length} por ubicar</span>
            </div>

            {articulos.length === 0 ? (
                <div className="recepcion-vacia">
                    {vieneDeRack ? 'Suelta aquí para regresar a Recepción' : 'Sin artículos pendientes de ubicar.'}
                </div>
            ) : (
                <ul className="lista-recepcion">
                    {articulos.map((a) => (
                        <TarjetaArticulo
                            key={a.id}
                            articulo={a}
                            seleccionado={seleccionado === a.id}
                            atenuado={!!coincidencias && !coincidencias.has(a.id)}
                            onSeleccionar={onSeleccionar}
                            onActualizar={onActualizar}
                            onEliminar={onEliminar}
                            onDetalle={onDetalle}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function TarjetaArticulo({ articulo, seleccionado, atenuado, onSeleccionar, onActualizar, onEliminar, onDetalle }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: articulo.id,
        data: { ubicacion: articulo.ubicacion },
    });

    return (
        <li
            ref={setNodeRef}
            className={`tarjeta-articulo ${isDragging ? 'arrastrando' : ''} ${seleccionado ? 'seleccionado' : ''} ${atenuado ? 'atenuado' : ''}`}
        >
            <button
                className="tarjeta-asa"
                {...listeners}
                {...attributes}
                onClick={() => onSeleccionar(seleccionado ? null : articulo.id)}
                aria-label={`Arrastrar ${articulo.codigo} a un rack`}
                aria-pressed={seleccionado}
                title="Arrastra a una ranura, o toca y luego toca la ranura"
            >
                <IconoAsa />
            </button>
            <div className="tarjeta-cuerpo">
                <CodigoBarras valor={articulo.codigo} alto={26} ancho={1.1} mostrarTexto={false} className="mini" />
                <div className="tarjeta-codigo codigo-mono" title={articulo.codigo}>{articulo.codigo}</div>
                {articulo.huerfano && (
                    <span className="etiqueta ambar" title="Su ranura ya no existe en los racks; ubícalo de nuevo">
                        Ranura no encontrada
                    </span>
                )}
                <input
                    className="tarjeta-descripcion"
                    placeholder="Agregar descripción…"
                    value={articulo.descripcion}
                    onChange={(e) => onActualizar(articulo.id, { descripcion: e.target.value })}
                    aria-label={`Descripción de ${articulo.codigo}`}
                />
                <ResumenContenido articulo={articulo} />
                <ListaBolsas articulo={articulo} />
            </div>
            <div className="tarjeta-lado">
                <ControlCantidad articulo={articulo} onActualizar={onActualizar} />
                <button className="btn-plain btn-sm tarjeta-detalles" onClick={() => onDetalle(articulo.id)} aria-label={`Contenido de ${articulo.codigo}`}>
                    Contenido
                </button>
                <button
                    className="btn-plain peligro btn-sm"
                    onClick={() => window.confirm(`¿Quitar ${articulo.codigo} (${bolsas(articulo.cantidad)})? No se puede deshacer.`) && onEliminar(articulo.id)}
                    aria-label={`Eliminar ${articulo.codigo}`}
                >
                    Quitar
                </button>
            </div>
        </li>
    );
}

// Bolsas del artículo. Lo que se escribe en el campo se guarda al pulsar Enter o salir del campo, no con cada
// tecla: cambiar la cantidad agrega o quita bolsas, y escribir "12" sobre un 3 pasaría por 1 (borraría las
// bolsas 2 y 3 con sus piezas, peso y fecha). Los botones − y + guardan al momento.
// Si el campo se deja en 0 o vacío queda en blanco, no se guarda (se conserva la cantidad anterior) y avisa.
const MAX_BOLSAS = 500; // mismo límite que el backend (PATCH /api/articulos/:id)

export function ControlCantidad({ articulo, onActualizar }) {
    const [borrador, setBorrador] = useState(null); // texto que se está escribiendo; null = muestra la cantidad guardada
    const [aviso, setAviso] = useState(null); // 'vacio' | 'maximo'
    const guardar = (n) => {
        setBorrador(null);
        setAviso(null);
        if (n !== articulo.cantidad) onActualizar(articulo.id, { cantidad: n });
    };
    const confirmar = () => {
        if (borrador === null) return;
        const n = leerEntero(borrador);
        if (n === null) {
            setBorrador('');
            setAviso('vacio');
        } else if (n > MAX_BOLSAS) {
            setAviso('maximo');
        } else {
            guardar(n);
        }
    };
    const vacio = aviso === 'vacio' && borrador === '';
    return (
        <div className="control-cantidad">
            <div className={`cantidad ${aviso ? 'en-blanco' : ''}`} role="group" aria-label="Bolsas">
                <button onClick={() => guardar(vacio ? 1 : Math.max(1, articulo.cantidad - 1))} disabled={!vacio && articulo.cantidad <= 1} aria-label="Restar bolsa">−</button>
                <input
                    type="number"
                    min="1"
                    max={MAX_BOLSAS}
                    placeholder="—"
                    value={borrador ?? articulo.cantidad}
                    onChange={(e) => {
                        setBorrador(e.target.value);
                        setAviso(null);
                    }}
                    onBlur={confirmar}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            confirmar();
                        } else if (e.key === 'Escape') {
                            setBorrador(null);
                            setAviso(null);
                        }
                    }}
                    aria-label="Bolsas"
                    aria-invalid={!!aviso || undefined}
                />
                <button onClick={() => guardar(vacio ? 1 : Math.min(MAX_BOLSAS, articulo.cantidad + 1))} disabled={!vacio && articulo.cantidad >= MAX_BOLSAS} aria-label="Sumar bolsa">+</button>
            </div>
            {aviso === 'vacio' && (
                <p className="aviso-campo" role="alert">
                    Sin cantidad: se conservan {bolsas(articulo.cantidad)}.
                </p>
            )}
            {aviso === 'maximo' && (
                <p className="aviso-campo" role="alert">
                    Máximo {MAX_BOLSAS} bolsas: se conservan {bolsas(articulo.cantidad)}.
                </p>
            )}
            {borrador !== null && !aviso && Number(borrador) !== articulo.cantidad && (
                <p className="nota-campo">Enter para guardar</p>
            )}
        </div>
    );
}

export function IconoAsa() {
    return (
        <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">
            {[3, 10, 17].flatMap((y) => [<circle key={`a${y}`} cx="4" cy={y} r="1.6" />, <circle key={`b${y}`} cx="10" cy={y} r="1.6" />])}
        </svg>
    );
}
