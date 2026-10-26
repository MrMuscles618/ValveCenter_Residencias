import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    pointerWithin,
    rectIntersection,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import Escaner from './components/Escaner';
import Recepcion, { ControlCantidad } from './components/Recepcion';
import Rack from './components/Rack';
import Sidebar from './components/Sidebar';
import VistaFifo from './components/VistaFifo';
import BotonPowerBI from './components/BotonPowerBI';
import Buscador from './components/Buscador';
import { buscar } from './utils/busqueda';
import NuevoRack, { EliminarRack } from './components/NuevoRack';
import { ConfirmarSalida, SALIDA, ZonaSalida } from './components/Salida';
import logoZF from './logos/ZF_logo 1.svg';
import CodigoBarras from './components/CodigoBarras';
import { CamposContenido, EditorBolsas } from './components/Contenido';
import { bolsas, numeroParte } from './utils/contenido';
import { RECEPCION, useAlmacen } from './hooks/useAlmacen';
import { KANBANS, RANURAS, describirUbicacion, idRanura, totalRanuras } from './data/kanbans';
import DetalleRanura from './components/DetalleRanura';

const COLORES = [
    { id: 'azul', nombre: 'Raw Material' },
    { id: 'verde', nombre: 'Material Ensamblado' },
    { id: 'cafe', nombre: 'Cajas de cartón' },
];

// Primero el puntero; si no está sobre nada, el área que más se cruce
const deteccion = (args) => {
    const bajoPuntero = pointerWithin(args);
    return bajoPuntero.length ? bajoPuntero : rectIntersection(args);
};

export default function App() {
    const almacen = useAlmacen();
    const { articulos, porRanura, enRecepcion, historial, mover, actualizar, eliminar, registrarLectura, darSalida, crearRack, editarRack, eliminarRack, pintar } = almacen;

    const [kanbanId, setKanbanId] = useState(KANBANS[0].id);
    const [arrastrado, setArrastrado] = useState(null);
    const [seleccionado, setSeleccionado] = useState(null);
    const [resaltada, setResaltada] = useState(null);
    const [detalle, setDetalle] = useState(null);
    const [ranuraDetalle, setRanuraDetalle] = useState(null); // ranura con varios códigos cuya lista se muestra
    const [salida, setSalida] = useState(null); // id del artículo en confirmación de salida
    const [formRack, setFormRack] = useState(null); // 'nuevo' o el kanban en edición
    const [borrarRack, setBorrarRack] = useState(false);
    const [pincel, setPincel] = useState(null); // color con el que se pintan contenedores; null = modo normal
    const [busqueda, setBusqueda] = useState('');
    const [fifoAbierto, setFifoAbierto] = useState(false); // lista FIFO de todo el almacén
    const [aviso, setAviso] = useState(null);
    const [menuAbierto, setMenuAbierto] = useState(() => window.matchMedia('(min-width: 861px)').matches);
    const temporizadores = useRef({});

    const kanban = KANBANS.find((k) => k.id === kanbanId) ?? KANBANS[0];
    const pintando = !!pincel; // cualquier Kanban admite cambiar el color de sus contenedores

    // Búsqueda en todos los contenedores (racks y Recepción); `coincidencias` resalta en racks y tarjetas
    const resultados = useMemo(
        () => buscar([...porRanura.values()].flat().concat(enRecepcion), busqueda),
        [porRanura, enRecepcion, busqueda],
    );
    const coincidencias = useMemo(
        () => (busqueda.trim() ? new Set(resultados.map((r) => r.articulo.id)) : null),
        [resultados, busqueda],
    );

    const notificar = useCallback((texto, tipo = 'exito') => {
        setAviso({ texto, tipo, id: Date.now() });
        clearTimeout(temporizadores.current.aviso);
        temporizadores.current.aviso = setTimeout(() => setAviso(null), 2600);
    }, []);

    const resaltar = useCallback((idRanura) => {
        const r = RANURAS.get(idRanura);
        if (!r) return;
        setKanbanId(r.kanban.id);
        setResaltada(idRanura);
        clearTimeout(temporizadores.current.resaltar);
        temporizadores.current.resaltar = setTimeout(() => setResaltada(null), 2600);
        requestAnimationFrame(() =>
            document.querySelector(`[data-ranura="${CSS.escape(idRanura)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        );
    }, []);

    useEffect(() => () => Object.values(temporizadores.current).forEach(clearTimeout), []);

    // Errores de la API se muestran en el aviso flotante
    useEffect(() => {
        if (almacen.error) notificar(almacen.error.mensaje, 'error');
    }, [almacen.error, notificar]);

    // Lectura: si el artículo ya está en un rack, se muestra dónde
    const alLeer = useCallback(
        async (codigo, formato) => {
            const res = await registrarLectura(codigo, formato);
            if (res && res.tipo !== 'nuevo' && !res.eliminado && res.articulo.ubicacion !== RECEPCION) {
                resaltar(res.articulo.ubicacion);
            }
            return res;
        },
        [registrarLectura, resaltar],
    );

    // Resultado de búsqueda: si está en un rack se abre ese rack y se resalta su ranura (tocarla muestra su contenido); si no, su detalle
    const irAResultado = ({ articulo, ranura }) => {
        setSeleccionado(null);
        setPincel(null);
        if (ranura) {
            resaltar(articulo.ubicacion);
            if (esMovil()) setMenuAbierto(false);
        } else {
            setDetalle(articulo.id);
        }
    };

    // Ubica en una ranura (caben varios códigos y cualquier cantidad de bolsas) o regresa a Recepción
    const ubicar = (idArticulo, destino) => {
        const art = articulos[idArticulo];
        if (!art || art.ubicacion === destino) return;
        const otros = destino !== RECEPCION ? (porRanura.get(destino) ?? []).filter((a) => a.id !== art.id) : [];
        const mismoCodigo = otros.some((a) => a.codigo === art.codigo);
        mover(idArticulo, destino);
        notificar(
            destino === RECEPCION
                ? `${art.codigo} regresó a Recepción`
                : mismoCodigo
                  ? `${art.codigo} se unió a sus bolsas en ${RANURAS.get(destino).etiqueta}`
                  : otros.length
                    ? `${art.codigo} ubicado en ${RANURAS.get(destino).etiqueta}, con ${otros.map((a) => a.codigo).join(', ')}`
                    : `${art.codigo} ubicado en ${RANURAS.get(destino).etiqueta}`,
        );
    };

    // Drag and drop
    const sensores = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
        useSensor(KeyboardSensor),
    );

    const alIniciar = ({ active }) => {
        setArrastrado(articulos[active.id] ?? null);
        setSeleccionado(null);
    };
    const alTerminar = ({ active, over }) => {
        setArrastrado(null);
        if (!over || !articulos[active.id]) return;
        if (over.id === SALIDA) setSalida(active.id);
        else ubicar(active.id, over.id);
    };

    // `que` es { bolsas: [ids] } (bolsas completas) o { bolsa, piezas } (piezas de una bolsa)
    const confirmarSalida = async (que) => {
        const art = articulos[salida];
        const res = await darSalida(salida, que);
        setSalida(null);
        if (!res) return;
        const sale = que.piezas ? `${que.piezas.toLocaleString('es-MX')} pz de la bolsa ${res.bolsa}` : bolsas(res.cantidad);
        const quedan = que.piezas && res.restante ? `${res.restante.toLocaleString('es-MX')} pz en esa bolsa` : bolsas(res.articulo.cantidad);
        notificar(res.eliminado ? `Salida de ${art.codigo}: ${sale} · ranura liberada` : `Salida de ${art.codigo}: ${sale} · quedan ${quedan}`);
    };

    // Tocar una ranura: pinta, coloca el artículo seleccionado o abre su contenido en una ventana emergente
    // (con varios códigos, primero la lista de la ranura para elegir uno)
    const alTocarRanura = (idRanura, lista) => {
        if (pintando) {
            pintar([{ ranura: idRanura, color: pincel }]);
        } else if (seleccionado) {
            ubicar(seleccionado, idRanura);
            setSeleccionado(null);
        } else if (lista.length === 1) {
            setDetalle(lista[0].id);
        } else if (lista.length > 1) {
            setRanuraDetalle(idRanura);
        }
    };

    useEffect(() => {
        const alEscape = (e) => {
            if (e.key !== 'Escape') return;
            setSeleccionado(null);
            setDetalle(null);
            setRanuraDetalle(null);
            setSalida(null);
            setFifoAbierto(false);
            setFormRack(null);
            setBorrarRack(false);
            setPincel(null);
        };
        window.addEventListener('keydown', alEscape);
        return () => window.removeEventListener('keydown', alEscape);
    }, []);

    const resumen = useMemo(() => {
        const total = KANBANS.reduce((s, k) => s + totalRanuras(k), 0);
        const ocupadas = porRanura.size;
        const enKanban = [...porRanura.keys()].filter((id) => RANURAS.get(id)?.kanban.id === kanbanId).length;
        const ocupadasPorKanban = {};
        for (const id of porRanura.keys()) {
            const k = RANURAS.get(id)?.kanban.id;
            if (k) ocupadasPorKanban[k] = (ocupadasPorKanban[k] ?? 0) + 1;
        }
        return {
            ocupadasPorKanban,
            total,
            ocupadas,
            enKanban,
            totalKanban: totalRanuras(kanban),
            bolsas: Object.values(articulos).reduce((s, a) => s + a.cantidad, 0),
        };
    }, [porRanura, articulos, kanbanId, kanban, almacen.racks]);

    // Navegación desde el sidebar; en móvil el menú se cierra al elegir
    const esMovil = () => window.matchMedia('(max-width: 860px)').matches;
    const irAKanban = (id) => {
        setKanbanId(id);
        if (esMovil()) setMenuAbierto(false);
        document.querySelector('.almacen-racks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const guardarRack = async (rack) => {
        if (formRack === 'nuevo') {
            const id = await crearRack(rack);
            if (!id) return;
            setFormRack(null);
            irAKanban(id);
            notificar(`${rack.nombre} agregado`);
            return;
        }
        const res = await editarRack(formRack.rackId, rack);
        if (!res) return;
        setFormRack(null);
        notificar(
            res.regresados
                ? `${rack.nombre} actualizado · ${res.regresados} artículo${res.regresados === 1 ? '' : 's'} a Recepción`
                : `${rack.nombre} actualizado`,
        );
    };

    // Regresa todos los contenedores del rack a su color original
    const restablecerColores = () => {
        pintar(
            kanban.modulos.flatMap((m) =>
                m.niveles.flat().map((r) => ({ ranura: idRanura(m, r.etiqueta), color: r.base ?? r.color })),
            ),
        );
        notificar(`Colores de ${kanban.nombre} restablecidos`);
    };

    const confirmarBorrarRack = async () => {
        const { nombre, rackId } = kanban;
        const res = await eliminarRack(rackId);
        setBorrarRack(false);
        if (!res) return;
        setKanbanId(KANBANS[0].id);
        notificar(
            res.regresados
                ? `${nombre} eliminado · ${res.regresados} artículo${res.regresados === 1 ? '' : 's'} a Recepción`
                : `${nombre} eliminado`,
        );
    };

    const articuloDetalle = detalle ? articulos[detalle] : null;
    // Ocupación de la ranura del artículo abierto (null si está en Recepción): bolsas en total y códigos que comparten la ranura
    const ranuraDelDetalle = articuloDetalle && RANURAS.has(articuloDetalle.ubicacion) ? articuloDetalle.ubicacion : null;
    const listaRanuraDetalle = ranuraDetalle ? porRanura.get(ranuraDetalle) ?? [] : [];
    const articuloSeleccionado = seleccionado ? articulos[seleccionado] : null;

    return (
        <DndContext sensors={sensores} collisionDetection={deteccion} onDragStart={alIniciar} onDragEnd={alTerminar} onDragCancel={() => setArrastrado(null)}>
            <div className={`app-shell ${menuAbierto ? 'menu-abierto' : 'menu-cerrado'}`}>
                <Sidebar
                    kanbanId={kanbanId}
                    ocupadasPorKanban={resumen.ocupadasPorKanban}
                    onKanban={irAKanban}
                    historial={historial}
                    onNuevoRack={() => {
                        if (esMovil()) setMenuAbierto(false);
                        setFormRack('nuevo');
                    }}
                    onCerrar={() => setMenuAbierto(false)}
                />
                <div className="sidebar-fondo" onClick={() => setMenuAbierto(false)} aria-hidden="true" />

                <div className="app-main">
                <header className="topbar">
                    <div className="marca">
                        <button
                            className="btn-plain btn-icon boton-menu"
                            onClick={() => setMenuAbierto((v) => !v)}
                            aria-label={menuAbierto ? 'Ocultar menú' : 'Mostrar menú'}
                            aria-expanded={menuAbierto}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                                <rect x="3" y="4" width="18" height="16" rx="3" />
                                <path d="M9 4v16" />
                            </svg>
                        </button>
                        <img src={logoZF} alt="ZF" className="marca-logo-topbar" />
                    </div>
                    <div className="topbar-acciones">
                    <BotonPowerBI articulos={articulos} historial={historial} onAviso={notificar} />
                    <button className="btn-secondary btn-sm boton-fifo" onClick={() => setFifoAbierto(true)} title="Todos los contenedores y bolsas, del más antiguo al más nuevo">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18M3 12h12M3 18h6M19 14v6M16 17l3 3 3-3" />
                        </svg>
                        FIFO
                    </button>
                    <Buscador valor={busqueda} onCambiar={setBusqueda} resultados={resultados} onElegir={irAResultado} />
                    </div>
                </header>

                <main className="app-content">
                    <div className="page-heading">
                        <h1 className="page-title">Almacén Digital</h1>
                        <p className="page-subtitle">
                            Escanea el material, revísalo en recepción y arrástralo a su rack Kanban correspondiente.
                        </p>
                    </div>

                    <div className="resumen-grid">
                        <Tile label="Ranuras ocupadas" valor={`${resumen.ocupadas}/${resumen.total}`} nota={`${Math.round((resumen.ocupadas / resumen.total) * 100)}% del almacén`} />
                        <Tile label={kanban.nombre} valor={`${resumen.enKanban}/${resumen.totalKanban}`} nota={`Línea ${kanban.lineas.join(', ')}`} />
                        <Tile label="En Recepción" valor={enRecepcion.length} nota="Pendientes de ubicar" />
                        <Tile label="Bolsas registradas" valor={resumen.bolsas} nota={`${Object.keys(articulos).length} códigos`} />
                    </div>

                    <div className="almacen">
                        <aside className="almacen-lateral">
                            <Escaner onLectura={alLeer} />
                            <Recepcion
                                articulos={enRecepcion}
                                seleccionado={seleccionado}
                                onSeleccionar={setSeleccionado}
                                onActualizar={actualizar}
                                onEliminar={eliminar}
                                onDetalle={setDetalle}
                                coincidencias={coincidencias}
                            />
                            <ZonaSalida
                                seleccionado={seleccionado}
                                onTocar={() => {
                                    setSalida(seleccionado);
                                    setSeleccionado(null);
                                }}
                            />
                        </aside>

                        <section className={`glass almacen-racks ${pintando ? 'pintando' : ''}`} aria-label="Racks Kanban">
                            <div className="racks-encabezado">
                                <div className="filtro-chips" role="tablist" aria-label="Kanban">
                                    {KANBANS.map((k) => {
                                        const ocupadas = [...porRanura.keys()].filter((id) => RANURAS.get(id)?.kanban.id === k.id).length;
                                        // Con búsqueda activa, la cuenta del chip son los encontrados en ese rack
                                        const encontrados = coincidencias && resultados.filter((r) => r.ranura?.kanban.id === k.id).length;
                                        return (
                                            <button
                                                key={k.id}
                                                role="tab"
                                                aria-selected={k.id === kanbanId}
                                                className={`filtro-chip ${k.id === kanbanId ? 'activo' : ''}`}
                                                onClick={() => setKanbanId(k.id)}
                                            >
                                                {k.nombre}
                                                {coincidencias
                                                    ? encontrados > 0 && <span className="chip-cuenta coincide" title="Resultados de la búsqueda">{encontrados}</span>
                                                    : ocupadas > 0 && <span className="chip-cuenta">{ocupadas}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="leyenda">
                                    <span><i className="muestra verde" /> Material Ensamblado</span>
                                    <span><i className="muestra azul" /> Raw Material</span>
                                    <span><i className="muestra cafe" /> Cajas de cartón</span>
                                    <span><i className="muestra vacia" /> Ranura libre</span>
                                    <span className="txt3">Toca un contenedor para ver su contenido. Arrastra entre ranuras para reubicar; una ranura puede guardar varios códigos.</span>
                                </div>
                                <div className="racks-info">
                                    <span className="kanban-letrero">{kanban.nombre.toUpperCase()}</span>
                                    <span className="txt2">Línea {kanban.lineas.join(' · ')}</span>
                                    <span className="racks-acciones">
                                        <button
                                            className={`btn-secondary btn-sm ${pintando ? 'activo' : ''}`}
                                            aria-pressed={pintando}
                                            onClick={() => {
                                                setPincel(pintando ? null : 'azul');
                                                setSeleccionado(null);
                                            }}
                                        >
                                            Editar colores
                                        </button>
                                        {kanban.personalizado && (
                                            <>
                                                <button className="btn-secondary btn-sm" onClick={() => setFormRack(kanban)}>Editar</button>
                                                <button className="btn-plain btn-sm peligro" onClick={() => setBorrarRack(true)}>Eliminar</button>
                                            </>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {pintando && (
                                <div className="aviso aviso-info barra-seleccion barra-colores">
                                    <span>Elige un color y toca los contenedores que quieras cambiar.</span>
                                    <div className="barra-colores-acciones" role="radiogroup" aria-label="Color del contenedor">
                                        {COLORES.map((c) => (
                                            <button
                                                key={c.id}
                                                role="radio"
                                                aria-checked={pincel === c.id}
                                                className={`filtro-chip ${pincel === c.id ? 'activo' : ''}`}
                                                onClick={() => setPincel(c.id)}
                                            >
                                                <i className={`muestra ${c.id}`} /> {c.nombre}
                                            </button>
                                        ))}
                                        <button className="btn-plain btn-sm" onClick={restablecerColores}>Restablecer</button>
                                        <button className="btn-primary btn-sm" onClick={() => setPincel(null)}>Listo</button>
                                    </div>
                                </div>
                            )}

                            {articuloSeleccionado && (
                                <div className="aviso aviso-info barra-seleccion">
                                    <span>
                                        Toca una ranura para ubicar <b className="codigo-mono">{articuloSeleccionado.codigo}</b>
                                    </span>
                                    <button className="btn-plain btn-sm" onClick={() => setSeleccionado(null)}>Cancelar</button>
                                </div>
                            )}

                            <Rack
                                kanban={kanban}
                                porRanura={porRanura}
                                seleccionado={seleccionado}
                                resaltada={resaltada}
                                coincidencias={coincidencias}
                                onTocarRanura={alTocarRanura}
                            />
                        </section>
                    </div>
                </main>
                </div>
            </div>

            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
                {arrastrado && (
                    <div className="arrastre-fantasma">
                        <CodigoBarras valor={arrastrado.codigo} alto={22} ancho={1} mostrarTexto={false} className="mini" />
                        <span className="codigo-mono">{arrastrado.codigo}</span>
                        <span className="txt3">{bolsas(arrastrado.cantidad)}</span>
                    </div>
                )}
            </DragOverlay>

            {formRack && (
                <NuevoRack
                    key={formRack === 'nuevo' ? 'nuevo' : formRack.id}
                    rack={formRack === 'nuevo' ? null : formRack}
                    porRanura={porRanura}
                    onCancelar={() => setFormRack(null)}
                    onGuardar={guardarRack}
                />
            )}

            {borrarRack && kanban.personalizado && (
                <EliminarRack
                    rack={kanban}
                    ocupadas={resumen.enKanban}
                    onCancelar={() => setBorrarRack(false)}
                    onConfirmar={confirmarBorrarRack}
                />
            )}

            {salida && articulos[salida] && (
                <ConfirmarSalida
                    key={salida}
                    articulo={articulos[salida]}
                    onCancelar={() => setSalida(null)}
                    onConfirmar={confirmarSalida}
                />
            )}

            {fifoAbierto && (
                <VistaFifo
                    articulos={[...porRanura.values()].flat().concat(enRecepcion)}
                    onCerrar={() => setFifoAbierto(false)}
                    onElegir={(fila) => {
                        setFifoAbierto(false);
                        irAResultado(fila);
                    }}
                />
            )}

            {ranuraDetalle && (
                <DetalleRanura
                    ranuraId={ranuraDetalle}
                    articulos={listaRanuraDetalle}
                    onCerrar={() => setRanuraDetalle(null)}
                    onAbrir={(id) => {
                        setRanuraDetalle(null);
                        setDetalle(id);
                    }}
                    onMover={(id) => {
                        setRanuraDetalle(null);
                        setSeleccionado(id);
                    }}
                    onRegresar={(id) => {
                        ubicar(id, RECEPCION);
                        // Si solo queda un código, la lista deja de hacer falta
                        if (listaRanuraDetalle.length <= 2) setRanuraDetalle(null);
                    }}
                />
            )}

            {articuloDetalle && (
                <DetalleArticulo
                    articulo={articuloDetalle}
                    companeros={ranuraDelDetalle ? (porRanura.get(ranuraDelDetalle) ?? []).filter((a) => a.id !== articuloDetalle.id).map((a) => a.codigo) : []}
                    onCerrar={() => setDetalle(null)}
                    onActualizar={actualizar}
                    onActualizarBolsa={almacen.actualizarBolsa}
                    onRegresar={() => {
                        ubicar(articuloDetalle.id, RECEPCION);
                        setDetalle(null);
                    }}
                    onMover={() => {
                        setSeleccionado(articuloDetalle.id);
                        setDetalle(null);
                    }}
                />
            )}

            <div className={`aviso-flotante ${aviso ? 'visible' : ''} ${aviso?.tipo === 'error' ? 'error' : ''}`} role="status">
                <span className="aviso-flotante-icono" aria-hidden="true">{aviso?.tipo === 'error' ? '!' : '✓'}</span>
                {aviso?.texto}
            </div>
        </DndContext>
    );
}

function Tile({ label, valor, nota }) {
    return (
        <div className="glass resumen-tile">
            <div className="resumen-tile-label">{label}</div>
            <div className="resumen-tile-valor">{valor}</div>
            <div className="resumen-tile-nota">{nota}</div>
        </div>
    );
}

// Detalle de un contenedor, en un rack o en Recepción
function DetalleArticulo({ articulo, companeros, onCerrar, onActualizar, onActualizarBolsa, onRegresar, onMover }) {
    const enRack = articulo.ubicacion !== RECEPCION && RANURAS.has(articulo.ubicacion);
    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div
                className="glass-strong modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-detalle"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-encabezado">
                    <div>
                        <h2 id="titulo-detalle" className="modal-titulo">
                            {enRack ? `Ranura ${RANURAS.get(articulo.ubicacion).etiqueta}` : 'Recepción'}
                        </h2>
                        <p className="txt3">
                            {enRack ? describirUbicacion(articulo.ubicacion) : 'Pendiente de ubicar'}
                            {enRack && ` · ${COLORES.find((c) => c.id === RANURAS.get(articulo.ubicacion).color)?.nombre ?? ''}`}
                        </p>
                    </div>
                    <button className="btn-plain btn-sm" onClick={onCerrar}>Cerrar</button>
                </div>
                <div className="modal-barras">
                    <CodigoBarras valor={articulo.codigo} alto={60} />
                </div>
                {numeroParte(articulo.codigo) && (
                    <p className="txt2 modal-parte">
                        No. de parte <b className="codigo-mono">{numeroParte(articulo.codigo)}</b>
                    </p>
                )}
                <div className="campo">
                    <label className="campo-label" htmlFor="det-desc">Descripción</label>
                    <input
                        id="det-desc"
                        className="campo-input"
                        value={articulo.descripcion}
                        placeholder="Sin descripción"
                        onChange={(e) => onActualizar(articulo.id, { descripcion: e.target.value })}
                    />
                </div>
                <div className="campo campo-fila">
                    <span className="campo-label">Bolsas</span>
                    <ControlCantidad articulo={articulo} onActualizar={onActualizar} />
                </div>
                {enRack && companeros.length > 0 && (
                    <p className="txt3 modal-nota">Esta ranura también guarda: {companeros.join(', ')}.</p>
                )}
                <EditorBolsas articulo={articulo} onActualizarBolsa={onActualizarBolsa} />
                <CamposContenido articulo={articulo} onActualizar={onActualizar} />
                <p className="txt3 modal-nota">
                    Registrado {new Date(articulo.registrado).toLocaleString('es-MX')} · {articulo.formato}
                </p>
                <div className="modal-acciones">
                    {enRack && <button className="btn-secondary" onClick={onRegresar}>Regresar a Recepción</button>}
                    <button className="btn-primary" onClick={onMover}>{enRack ? 'Mover a otra ranura' : 'Ubicar en una ranura'}</button>
                </div>
            </div>
        </div>
    );
}
