import { useMemo, useState } from 'react';
import { RANURAS } from '../data/kanbans';
import { RECEPCION } from '../hooks/useAlmacen';
import {
    bolsaMasAntigua,
    bolsas,
    claveFifo,
    claveFifoBolsa,
    contenidoDe,
    diasDesde,
    fechaBolsa,
    ordenarBolsasFifo,
    pesoTexto,
    pz,
    resumenTotales,
    textoDias,
    valorCampo,
} from '../utils/contenido';

const UBICACIONES = [
    { id: 'todos', etiqueta: 'Todo el almacén' },
    { id: 'racks', etiqueta: 'En racks' },
    { id: 'recepcion', etiqueta: 'En Recepción' },
];

// Lista FIFO de todo el almacén, del más antiguo al más nuevo, por contenedor o por bolsa.
// Al tocar una fila se ubica el contenedor (su ranura en el rack, o su detalle si está en Recepción).
export default function VistaFifo({ articulos, onElegir, onCerrar }) {
    const [vista, setVista] = useState('contenedores');
    const [donde, setDonde] = useState('todos');

    const filtrados = useMemo(() => {
        const enRack = (a) => a.ubicacion !== RECEPCION && RANURAS.has(a.ubicacion);
        return articulos
            .filter((a) => donde === 'todos' || (donde === 'racks' ? enRack(a) : !enRack(a)))
            .map((a) => ({ articulo: a, ranura: enRack(a) ? RANURAS.get(a.ubicacion) : null }));
    }, [articulos, donde]);

    const contenedores = useMemo(
        () => [...filtrados].sort((x, y) => claveFifo(x.articulo).localeCompare(claveFifo(y.articulo))),
        [filtrados],
    );
    const todasLasBolsas = useMemo(
        () =>
            filtrados
                .flatMap(({ articulo, ranura }) =>
                    ordenarBolsasFifo(articulo.bolsas).map((bolsa) => ({
                        articulo,
                        ranura,
                        bolsa,
                        numero: articulo.bolsas.findIndex((b) => b.id === bolsa.id) + 1,
                    })),
                )
                .sort((x, y) => claveFifoBolsa(x.bolsa).localeCompare(claveFifoBolsa(y.bolsa)) || x.articulo.codigo.localeCompare(y.articulo.codigo)),
        [filtrados],
    );

    const totales = resumenTotales({ bolsas: todasLasBolsas.map((f) => f.bolsa) });
    const filas = vista === 'contenedores' ? contenedores : todasLasBolsas;

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="glass-strong modal modal-ancho fifo" role="dialog" aria-modal="true" aria-labelledby="titulo-fifo" onClick={(e) => e.stopPropagation()}>
                <div className="modal-encabezado">
                    <div>
                        <h2 id="titulo-fifo" className="modal-titulo">FIFO · del más antiguo al más nuevo</h2>
                        <p className="txt3">
                            {bolsas(todasLasBolsas.length)} en {contenedores.length} contenedor{contenedores.length === 1 ? '' : 'es'}
                            {totales && ` · ${totales}`}
                        </p>
                    </div>
                    <button className="btn-plain btn-sm" onClick={onCerrar}>Cerrar</button>
                </div>

                <div className="fifo-controles">
                    <div className="salida-modo fifo-vista" role="radiogroup" aria-label="Ver por">
                        <button role="radio" aria-checked={vista === 'contenedores'} className={vista === 'contenedores' ? 'activo' : ''} onClick={() => setVista('contenedores')}>
                            <b>Por contenedor</b>
                            <span>{contenedores.length} códigos</span>
                        </button>
                        <button role="radio" aria-checked={vista === 'bolsas'} className={vista === 'bolsas' ? 'activo' : ''} onClick={() => setVista('bolsas')}>
                            <b>Por bolsa</b>
                            <span>{bolsas(todasLasBolsas.length)}</span>
                        </button>
                    </div>
                    <div className="filtro-chips" role="radiogroup" aria-label="Ubicación">
                        {UBICACIONES.map((u) => (
                            <button key={u.id} role="radio" aria-checked={donde === u.id} className={`filtro-chip ${donde === u.id ? 'activo' : ''}`} onClick={() => setDonde(u.id)}>
                                {u.etiqueta}
                            </button>
                        ))}
                    </div>
                </div>

                {filas.length === 0 ? (
                    <p className="txt3 fifo-vacio">No hay contenedores {donde === 'racks' ? 'en racks' : donde === 'recepcion' ? 'en Recepción' : 'en el almacén'}.</p>
                ) : (
                    <ol className="fifo-lista">
                        {vista === 'contenedores'
                            ? contenedores.map((f, i) => <FilaContenedor key={f.articulo.id} fila={f} posicion={i + 1} onElegir={() => onElegir(f)} />)
                            : todasLasBolsas.map((f, i) => <FilaBolsa key={f.bolsa.id} fila={f} posicion={i + 1} onElegir={() => onElegir(f)} />)}
                    </ol>
                )}
            </div>
        </div>
    );
}

function Ubicacion({ articulo, ranura }) {
    return ranura ? (
        <span className={`fifo-ubicacion ${ranura.color}`}>
            <b>{ranura.etiqueta}</b> {ranura.kanban.nombre} · {ranura.modulo.nombre}
        </span>
    ) : (
        <span className="fifo-ubicacion recepcion">
            <b>REC</b> {articulo.huerfano ? 'Ranura no encontrada' : 'Recepción'}
        </span>
    );
}

function Antiguedad({ fecha }) {
    const dias = diasDesde(fecha);
    return (
        <span className="fifo-fecha">
            {valorCampo({ fecha }, 'fecha') || '—'}
            {dias !== null && <small>{textoDias(dias)}</small>}
        </span>
    );
}

function FilaContenedor({ fila, posicion, onElegir }) {
    const { articulo, ranura } = fila;
    const contenido = contenidoDe(articulo);
    const totales = resumenTotales(articulo);
    return (
        <li>
            <button className={`fifo-fila ${posicion === 1 ? 'primero' : ''}`} onClick={onElegir}>
                <span className="fifo-posicion">{posicion}</span>
                <Antiguedad fecha={bolsaMasAntigua(articulo) ? fechaBolsa(bolsaMasAntigua(articulo)) : contenido.fecha} />
                <span className="fifo-principal">
                    <span className="codigo-mono fifo-codigo">{articulo.codigo}</span>
                    {posicion === 1 && <span className="buscador-resultado-fifo">Sale primero</span>}
                    <Ubicacion articulo={articulo} ranura={ranura} />
                    {articulo.descripcion && <span className="fifo-descripcion">{articulo.descripcion}</span>}
                    <span className="fifo-bolsas">
                        {ordenarBolsasFifo(articulo.bolsas).map((b) => (
                            <span key={b.id} className="lista-bolsas-chip">
                                {b.piezas !== null ? pz(b.piezas) : '— pz'}
                                {pesoTexto(b) && ` · ${pesoTexto(b)}`}
                            </span>
                        ))}
                    </span>
                </span>
                <span className="fifo-cantidad">
                    <b>{bolsas(articulo.cantidad)}</b>
                    {totales && <small>{totales}</small>}
                </span>
            </button>
        </li>
    );
}

function FilaBolsa({ fila, posicion, onElegir }) {
    const { articulo, ranura, bolsa, numero } = fila;
    return (
        <li>
            <button className={`fifo-fila ${posicion === 1 ? 'primero' : ''}`} onClick={onElegir}>
                <span className="fifo-posicion">{posicion}</span>
                <Antiguedad fecha={fechaBolsa(bolsa)} />
                <span className="fifo-principal">
                    <span className="codigo-mono fifo-codigo">{articulo.codigo}</span>
                    {posicion === 1 && <span className="buscador-resultado-fifo">Sale primero</span>}
                    <Ubicacion articulo={articulo} ranura={ranura} />
                    <span className="fifo-descripcion txt3">
                        Bolsa {numero} de {articulo.cantidad}
                        {articulo.descripcion && ` · ${articulo.descripcion}`}
                    </span>
                </span>
                <span className="fifo-cantidad">
                    <b>{bolsa.piezas !== null ? pz(bolsa.piezas) : '— pz'}</b>
                    {pesoTexto(bolsa) && <small>{pesoTexto(bolsa)}</small>}
                </span>
            </button>
        </li>
    );
}
