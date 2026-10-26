import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import CodigoBarras from './CodigoBarras';
import { ResumenContenido } from './Contenido';
import { RECEPCION } from '../hooks/useAlmacen';
import { describirUbicacion } from '../data/kanbans';
import { bolsas, ordenarBolsasFifo, pesoTexto, pz, resumenTotales } from '../utils/contenido';
import { avisoVacio, leerEntero } from '../utils/numeros';

export const SALIDA = 'salida';

// Zona donde se suelta un contenedor (de un rack o de Recepción) para registrar su salida.
// También acepta el modo "tocar": con un artículo seleccionado, se toca la zona.
export function ZonaSalida({ seleccionado, onTocar }) {
    const { setNodeRef, isOver, active } = useDroppable({ id: SALIDA });
    const arrastrando = !!active;

    return (
        <section
            ref={setNodeRef}
            className={`glass zona-salida ${arrastrando ? 'acepta' : ''} ${isOver ? 'sobre' : ''} ${seleccionado ? 'destino' : ''}`}
            aria-labelledby="titulo-salida"
            onClick={seleccionado ? onTocar : undefined}
            role={seleccionado ? 'button' : undefined}
            tabIndex={seleccionado ? 0 : undefined}
            onKeyDown={seleccionado ? (e) => (e.key === 'Enter' || e.key === ' ') && onTocar() : undefined}
        >
            <span className="zona-salida-icono" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 8l-4 4 4 4M5 12h11" />
                </svg>
            </span>
            <div>
                <h2 id="titulo-salida" className="seccion-titulo">Salida</h2>
                <p className="zona-salida-texto">
                    {isOver
                        ? 'Suelta para registrar la salida'
                        : seleccionado
                          ? 'Toca aquí para dar salida al artículo seleccionado'
                          : 'Arrastra aquí un contenedor para registrar su salida'}
                </p>
            </div>
        </section>
    );
}

// Piezas y peso de un grupo de bolsas, p. ej. "460 pz · 24 kg"; '' si no hay nada capturado
const totales = (lista) => resumenTotales({ bolsas: lista });

// Confirmación de salida. Cada bolsa es independiente:
// · Bolsas completas: se tocan las bolsas que salen (por defecto todas) o se escribe cuántas (las más antiguas).
// · Piezas: se toca la bolsa y se indica cuántas piezas salen; las demás bolsas no cambian.
// Un campo en 0 o vacío queda en blanco con una advertencia (no salta a 1).
export function ConfirmarSalida({ articulo, onCancelar, onConfirmar }) {
    const lista = articulo.bolsas ?? [];
    const conPiezas = lista.filter((b) => b.piezas > 0);
    const [modo, setModo] = useState('bolsas');
    const [seleccion, setSeleccion] = useState(() => new Set(lista.map((b) => b.id)));
    const [idBolsa, setIdBolsa] = useState(conPiezas[0]?.id ?? null);
    const [piezas, setPiezas] = useState(null);
    const [tocado, setTocado] = useState({ bolsas: false, piezas: false });
    const [enviando, setEnviando] = useState(false);

    const enPiezas = modo === 'piezas';
    const marcar = () => setTocado((t) => ({ ...t, [modo]: true }));

    // Bolsas completas
    const elegidas = lista.filter((b) => seleccion.has(b.id));
    const quedanBolsas = lista.filter((b) => !seleccion.has(b.id));
    const elegirPrimeras = (n) => {
        // Escribir N elige las N bolsas más antiguas (FIFO)
        setSeleccion(new Set(n === null ? [] : ordenarBolsasFifo(lista).slice(0, n).map((b) => b.id)));
        marcar();
    };
    const alternar = (id) => {
        setSeleccion((s) => {
            const nueva = new Set(s);
            if (nueva.has(id)) nueva.delete(id);
            else nueva.add(id);
            return nueva;
        });
        marcar();
    };

    // Piezas de una bolsa
    const nBolsa = lista.findIndex((b) => b.id === idBolsa);
    const bolsa = lista[nBolsa];
    const maxPiezas = bolsa?.piezas ?? 0;
    const fijarPiezas = (n) => {
        setPiezas(n === null ? null : Math.min(maxPiezas, Math.max(1, n)));
        marcar();
    };
    const restante = maxPiezas - (piezas ?? 0);
    const elegirBolsa = (id) => {
        setIdBolsa(id);
        const nueva = lista.find((b) => b.id === id);
        if (piezas !== null && nueva?.piezas) setPiezas(Math.min(piezas, nueva.piezas));
    };

    const valor = enPiezas ? piezas : elegidas.length || null;
    const valida = enPiezas ? !!bolsa && piezas !== null && piezas >= 1 && piezas <= maxPiezas : elegidas.length > 0;
    const enBlanco = tocado[modo] && valor === null;
    const saleTodo = enPiezas ? valida && lista.length === 1 && piezas === maxPiezas : elegidas.length === lista.length;

    const confirmar = async () => {
        setEnviando(true);
        await onConfirmar(enPiezas ? { bolsa: idBolsa, piezas } : { bolsas: elegidas.map((b) => b.id) });
        setEnviando(false);
    };

    // Altura de cada bolsa en el dibujo: proporcional a sus piezas frente a la bolsa más llena
    const escala = Math.max(1, ...lista.map((b) => b.piezas ?? 0));
    const alto = (b) => (b.piezas === null ? 100 : (b.piezas / escala) * 100);

    let nota;
    if (enPiezas && !bolsa) nota = 'Toca la bolsa de la que salen las piezas.';
    else if (enPiezas && piezas === null) nota = `Escribe cuántas piezas salen de la bolsa ${nBolsa + 1}, desliza la barra o elige un atajo.`;
    else if (enPiezas && restante === 0)
        nota = `La bolsa ${nBolsa + 1} se vacía y sale.${saleTodo ? ' Era la única: la ranura queda libre.' : ' Las demás bolsas no cambian.'}`;
    else if (enPiezas)
        nota = `La bolsa ${nBolsa + 1} queda con ${pz(restante)} y su peso pasa a NA (ya no se podrá modificar). Las demás bolsas no cambian.`;
    else if (!elegidas.length) nota = 'Toca las bolsas que salen o escribe cuántas.';
    else if (saleTodo) nota = 'Salen todas las bolsas: el contenedor se retira y la ranura queda libre.';
    else nota = `Quedan ${bolsas(quedanBolsas.length)} en su lugar${totales(quedanBolsas) ? ` (${totales(quedanBolsas)})` : ''}.`;

    return (
        <div className="modal-overlay" onClick={onCancelar}>
            <div
                className="glass-strong modal salida-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-confirmar-salida"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-encabezado">
                    <div>
                        <h2 id="titulo-confirmar-salida" className="modal-titulo">Registrar salida</h2>
                        <p className="txt3">
                            {articulo.ubicacion === RECEPCION ? 'Recepción' : describirUbicacion(articulo.ubicacion)}
                        </p>
                    </div>
                </div>
                <div className="modal-barras">
                    <CodigoBarras valor={articulo.codigo} alto={52} />
                </div>
                {articulo.descripcion && <p className="txt2 salida-descripcion">{articulo.descripcion}</p>}
                <ResumenContenido articulo={articulo} />

                <div className="salida-modo" role="radiogroup" aria-label="Qué sale">
                    <button role="radio" aria-checked={!enPiezas} className={!enPiezas ? 'activo' : ''} onClick={() => setModo('bolsas')}>
                        <b>Bolsas completas</b>
                        <span>{bolsas(lista.length)}</span>
                    </button>
                    <button
                        role="radio"
                        aria-checked={enPiezas}
                        className={enPiezas ? 'activo' : ''}
                        onClick={() => setModo('piezas')}
                        disabled={!conPiezas.length}
                        title={conPiezas.length ? undefined : 'Captura primero las piezas de las bolsas'}
                    >
                        <b>Piezas de una bolsa</b>
                        <span>{conPiezas.length ? 'Las demás no cambian' : 'Captura piezas por bolsa'}</span>
                    </button>
                </div>

                {/* Con varios códigos parecidos: queda claro de cuál contenedor salen las piezas */}
                {enPiezas && (
                    <p className="salida-origen" aria-live="polite">
                        <span>Piezas del código</span>
                        <b className="codigo-mono">{articulo.codigo}</b>
                        {bolsa && <span>· bolsa {nBolsa + 1} de {lista.length}</span>}
                    </p>
                )}

                {/* Cada bolsa por separado: en color lo que queda, rayado lo que sale. Se tocan para elegirlas. */}
                <p className="salida-instruccion txt3">
                    {enPiezas ? 'Toca la bolsa de la que salen las piezas:' : 'Toca las bolsas que salen:'}
                </p>
                <div className="salida-bolsas" role="group" aria-label="Bolsas">
                    {lista.map((b, i) => {
                        const elegida = enPiezas ? b.id === idBolsa : seleccion.has(b.id);
                        const sale = enPiezas ? (elegida ? (piezas ?? 0) : 0) : elegida ? (b.piezas ?? 1) : 0;
                        const total = enPiezas ? b.piezas ?? 0 : b.piezas ?? 1;
                        const saleToda = elegida && sale > 0 && sale >= total;
                        const queda = b.piezas === null ? null : b.piezas - (enPiezas && elegida ? piezas ?? 0 : 0);
                        return (
                            <button
                                key={b.id}
                                type="button"
                                className={`salida-bolsa ${elegida ? 'elegida' : ''} ${saleToda ? 'sale-toda' : ''}`}
                                onClick={() => (enPiezas ? elegirBolsa(b.id) : alternar(b.id))}
                                disabled={enPiezas && !(b.piezas > 0)}
                                aria-pressed={elegida}
                                aria-label={`Bolsa ${i + 1}: ${b.piezas !== null ? pz(b.piezas) : 'piezas sin capturar'}${pesoTexto(b) ? `, peso ${pesoTexto(b)}` : ''}`}
                            >
                                <span className="salida-bolsa-numero">{i + 1}</span>
                                <span className="salida-bolsa-cuerpo">
                                    <span className="salida-bolsa-relleno" style={{ height: `${alto(b)}%` }}>
                                        <span className="salida-bolsa-sale" style={{ height: `${total ? (sale / total) * 100 : 0}%` }} />
                                        <span className="salida-bolsa-queda" />
                                    </span>
                                </span>
                                <span className="salida-bolsa-texto">
                                    {saleToda ? 'sale' : queda !== null ? queda.toLocaleString('es-MX') : '—'}
                                </span>
                                {/* Al sacar piezas, el peso de esa bolsa pasará a NA */}
                                <span className={`salida-bolsa-peso ${enPiezas && elegida && piezas && !saleToda ? 'pasa-na' : ''}`}>
                                    {enPiezas && elegida && piezas && !saleToda ? 'NA' : pesoTexto(b)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="salida-cuentas">
                    {enPiezas ? (
                        <>
                            <div>
                                <span>{bolsa ? `Bolsa ${nBolsa + 1} tiene` : 'Bolsa'}</span>
                                <b>{bolsa ? pz(maxPiezas) : '—'}</b>
                                {bolsa && pesoTexto(bolsa) && <small>{pesoTexto(bolsa)}</small>}
                            </div>
                            <div className="sale">
                                <span>Salen</span>
                                <b>{piezas === null ? '—' : pz(piezas)}</b>
                            </div>
                            <div className="queda">
                                <span>Quedan en la bolsa</span>
                                <b>{piezas === null || !bolsa ? '—' : pz(restante)}</b>
                                {piezas !== null && restante > 0 && <small>Peso: NA</small>}
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <span>Hay</span>
                                <b>{bolsas(lista.length)}</b>
                                {totales(lista) && <small>{totales(lista)}</small>}
                            </div>
                            <div className="sale">
                                <span>Salen</span>
                                <b>{elegidas.length ? bolsas(elegidas.length) : '—'}</b>
                                {totales(elegidas) && <small>{totales(elegidas)}</small>}
                            </div>
                            <div className="queda">
                                <span>Quedan</span>
                                <b>{bolsas(quedanBolsas.length)}</b>
                                {totales(quedanBolsas) && <small>{totales(quedanBolsas)}</small>}
                            </div>
                        </>
                    )}
                </div>

                <div className="campo campo-fila">
                    <label className="campo-label" htmlFor="salida-valor">
                        {enPiezas ? `Piezas que salen${bolsa ? ` de la bolsa ${nBolsa + 1}` : ''}` : 'Bolsas que salen'}
                    </label>
                    <div className={`cantidad ${enBlanco ? 'en-blanco' : ''}`} role="group">
                        <button
                            onClick={() => (enPiezas ? fijarPiezas(piezas === null ? 1 : piezas - 1) : elegirPrimeras(Math.max(1, elegidas.length - 1)))}
                            disabled={valor !== null && valor <= 1}
                            aria-label={enPiezas ? 'Restar pieza' : 'Restar bolsa'}
                        >
                            −
                        </button>
                        <input
                            key={modo}
                            id="salida-valor"
                            type="number"
                            min="1"
                            max={enPiezas ? maxPiezas : lista.length}
                            placeholder="—"
                            value={valor ?? ''}
                            onChange={(e) =>
                                enPiezas ? fijarPiezas(leerEntero(e.target.value, maxPiezas)) : elegirPrimeras(leerEntero(e.target.value, lista.length))
                            }
                            aria-invalid={enBlanco || undefined}
                            disabled={enPiezas && !bolsa}
                        />
                        <button
                            onClick={() => (enPiezas ? fijarPiezas(piezas === null ? 1 : piezas + 1) : elegirPrimeras(elegidas.length + 1))}
                            disabled={enPiezas ? !bolsa || piezas === maxPiezas : elegidas.length === lista.length}
                            aria-label={enPiezas ? 'Sumar pieza' : 'Sumar bolsa'}
                        >
                            +
                        </button>
                    </div>
                </div>
                {enPiezas && maxPiezas > 1 && (
                    <input
                        type="range"
                        className="salida-deslizador"
                        min="1"
                        max={maxPiezas}
                        value={piezas ?? 1}
                        onChange={(e) => fijarPiezas(Number(e.target.value))}
                        aria-label="Piezas que salen"
                    />
                )}
                <div className="filtro-chips salida-atajos">
                    {enPiezas
                        ? bolsa && (
                              <>
                                  {maxPiezas >= 2 && (
                                      <button className={`filtro-chip ${piezas === Math.floor(maxPiezas / 2) ? 'activo' : ''}`} onClick={() => fijarPiezas(Math.floor(maxPiezas / 2))}>
                                          ½ bolsa · {pz(Math.floor(maxPiezas / 2))}
                                      </button>
                                  )}
                                  <button className={`filtro-chip ${piezas === maxPiezas ? 'activo' : ''}`} onClick={() => fijarPiezas(maxPiezas)}>
                                      Toda la bolsa · {pz(maxPiezas)}
                                  </button>
                              </>
                          )
                        : lista.length > 1 && (
                              <>
                                  <button className="filtro-chip" onClick={() => elegirPrimeras(1)}>La más antigua</button>
                                  <button className="filtro-chip" onClick={() => elegirPrimeras(lista.length)}>Todas</button>
                              </>
                          )}
                </div>

                {enBlanco ? (
                    <p className="aviso-campo" role="alert">{avisoVacio(enPiezas ? 'Las piezas que salen' : 'Las bolsas que salen')}</p>
                ) : (
                    <p className="txt3 modal-nota">{nota}</p>
                )}

                <div className="modal-acciones">
                    <button className="btn-secondary" onClick={onCancelar} disabled={enviando}>Cancelar</button>
                    <button className="btn-primary" onClick={confirmar} disabled={!valida || enviando}>
                        {enviando
                            ? 'Registrando…'
                            : !valida
                              ? 'Dar salida'
                              : saleTodo
                                ? 'Dar salida a todo'
                                : enPiezas
                                  ? `Sacar ${pz(piezas)} de ${articulo.codigo} · bolsa ${nBolsa + 1}`
                                  : `Dar salida a ${bolsas(elegidas.length)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
