import { useEffect, useRef, useState } from 'react';
import { bolsas, contenidoDe, numeroParte, resumenContenido, resumenTotales } from '../utils/contenido';

const MAX_VISIBLES = 50;
const TIPO_DE_COLOR = { azul: 'Raw Material', verde: 'Material Ensamblado', cafe: 'Cajas de cartón' };

// Buscador de la topbar: lista los contenedores que coinciden, con su rack, módulo, ranura e información.
// `resultados` viene de utils/busqueda.js; al elegir uno, App lo ubica en el rack o abre su detalle.
export default function Buscador({ valor, onCambiar, resultados, onElegir }) {
    const [abierto, setAbierto] = useState(false);
    const [activo, setActivo] = useState(0);
    const contenedor = useRef(null);
    const lista = useRef(null);
    const visibles = resultados.slice(0, MAX_VISIBLES);
    const hayTexto = valor.trim().length > 0;

    // Cerrar al tocar fuera
    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => !contenedor.current?.contains(e.target) && setAbierto(false);
        document.addEventListener('pointerdown', fuera);
        return () => document.removeEventListener('pointerdown', fuera);
    }, [abierto]);

    // La opción activa siempre visible al moverse con el teclado
    useEffect(() => {
        lista.current?.querySelector(`[data-indice="${activo}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activo]);

    const elegir = (r) => {
        onElegir(r);
        setAbierto(false);
    };

    const alTeclear = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setAbierto(true);
            const paso = e.key === 'ArrowDown' ? 1 : -1;
            setActivo((i) => (visibles.length ? (i + paso + visibles.length) % visibles.length : 0));
        } else if (e.key === 'Enter' && abierto && visibles[activo]) {
            e.preventDefault();
            elegir(visibles[activo]);
        } else if (e.key === 'Escape') {
            setAbierto(false);
        }
    };

    return (
        <div className="buscador-caja" ref={contenedor}>
            <label className="buscador">
                <span className="sr-only">Buscar contenedor</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                    type="search"
                    placeholder="Buscar código, lote, descripción…"
                    value={valor}
                    role="combobox"
                    aria-expanded={abierto && hayTexto}
                    aria-controls="resultados-busqueda"
                    aria-activedescendant={abierto && visibles[activo] ? `resultado-${activo}` : undefined}
                    aria-autocomplete="list"
                    onChange={(e) => {
                        onCambiar(e.target.value);
                        setActivo(0);
                        setAbierto(true);
                    }}
                    onFocus={() => setAbierto(true)}
                    onKeyDown={alTeclear}
                />
            </label>

            {abierto && hayTexto && (
                <div className="glass-strong buscador-resultados" id="resultados-busqueda">
                    <div className="buscador-resultados-encabezado">
                        {resultados.length === 0
                            ? `Sin resultados para «${valor.trim()}»`
                            : `${resultados.length} resultado${resultados.length === 1 ? '' : 's'} · del más antiguo al más nuevo (FIFO)${
                                  resultados.length > MAX_VISIBLES ? ` · se muestran ${MAX_VISIBLES}` : ''
                              }`}
                    </div>
                    {visibles.length > 0 && (
                        <ul role="listbox" ref={lista}>
                            {visibles.map((r, i) => (
                                <Resultado
                                    key={r.articulo.id}
                                    resultado={r}
                                    indice={i}
                                    activo={i === activo}
                                    primero={i === 0 && visibles.length > 1}
                                    texto={valor.trim()}
                                    onElegir={() => elegir(r)}
                                    onEnfocar={() => setActivo(i)}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

function Resultado({ resultado, indice, activo, primero, texto, onElegir, onEnfocar }) {
    const { articulo, ranura, campo } = resultado;
    const color = ranura?.color;
    const parte = numeroParte(articulo.codigo);
    const contenido = [...(parte ? [['No. de parte', parte]] : []), ...resumenContenido(contenidoDe(articulo))];
    const totales = resumenTotales(articulo);
    // El campo que coincidió se nombra si no está ya visible en la tarjeta
    const motivo = ['codigo', 'descripcion', 'ranura', 'rack'].includes(campo.id) ? null : campo.etiqueta;

    return (
        <li
            id={`resultado-${indice}`}
            role="option"
            aria-selected={activo}
            data-indice={indice}
            className={`buscador-resultado ${activo ? 'activo' : ''} ${color ?? 'recepcion'}`}
            onPointerDown={(e) => e.preventDefault()} // no quitar el foco del campo de búsqueda
            onClick={onElegir}
            onPointerEnter={onEnfocar}
        >
            <div className="buscador-resultado-fila">
                <span className="buscador-resultado-ranura">{ranura ? ranura.etiqueta : 'REC'}</span>
                <span className="codigo-mono buscador-resultado-codigo">
                    <Resaltado texto={articulo.codigo} buscado={texto} />
                </span>
                {primero && <span className="buscador-resultado-fifo" title="El más antiguo: debe salir primero">Sale primero</span>}
                <span className="buscador-resultado-cantidad">
                    {bolsas(articulo.cantidad)}
                    {totales && ` · ${totales}`}
                </span>
            </div>
            <div className="buscador-resultado-ubicacion">
                {ranura ? (
                    <>
                        <b>{ranura.kanban.nombre}</b> · {ranura.modulo.nombre} · Contenedor {ranura.etiqueta}
                        {color && <span className="buscador-resultado-tipo"> · {TIPO_DE_COLOR[color]}</span>}
                    </>
                ) : (
                    <>
                        <b>Recepción</b> · {articulo.huerfano ? 'su ranura ya no existe' : 'pendiente de ubicar'}
                    </>
                )}
            </div>
            {articulo.descripcion && (
                <div className="buscador-resultado-descripcion">
                    <Resaltado texto={articulo.descripcion} buscado={texto} />
                </div>
            )}
            {(contenido.length > 0 || articulo.bolsas?.length > 1) && (
                <div className="buscador-resultado-contenido">
                    {articulo.bolsas?.length > 1 && (
                        <span>
                            Bolsas <b>{articulo.bolsas.map((b) => (b.piezas ?? '—')).join(' · ')} pz</b>
                        </span>
                    )}
                    {contenido.map(([k, v]) => (
                        <span key={k}>
                            {k} <b><Resaltado texto={v} buscado={texto} /></b>
                        </span>
                    ))}
                </div>
            )}
            {motivo && <div className="buscador-resultado-motivo">Coincide en {motivo}</div>}
        </li>
    );
}

// Marca en el texto la parte buscada (sin distinguir mayúsculas)
function Resaltado({ texto, buscado }) {
    const t = String(texto);
    const i = buscado ? t.toLowerCase().indexOf(buscado.toLowerCase()) : -1;
    if (i < 0) return t;
    return (
        <>
            {t.slice(0, i)}
            <mark>{t.slice(i, i + buscado.length)}</mark>
            {t.slice(i + buscado.length)}
        </>
    );
}
