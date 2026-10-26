import { useState } from 'react';
import { KANBANS, mixto } from '../data/kanbans';
import { leerEntero } from '../utils/numeros';

const MAX_RANURAS = 400; // mismo límite que backend/src/routes/racks.js
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const moduloVacio = (n) => ({
    nombre: `Módulo ${n}`,
    niveles: 4,
    porNivel: 4,
    nomenclatura: 'numerica', // numerica: 1, 2, 3… (con prefijo opcional) · columnas: A-1, B-1…
    prefijo: '',
    inicio: 1,
    color: 'azul',
});

// Genera las filas de ranuras igual que los racks de data/kanbans.js
export function generarNiveles(m) {
    return Array.from({ length: m.niveles }, (_, nivel) =>
        Array.from({ length: m.porNivel }, (_, i) => {
            const num = m.inicio + nivel * m.porNivel + i;
            const etiqueta =
                m.nomenclatura === 'columnas'
                    ? `${LETRAS[i]}-${m.inicio + nivel}`
                    : m.prefijo.trim()
                      ? `${m.prefijo.trim()}-${num}`
                      : String(num);
            return { etiqueta, color: m.color === 'mixto' ? mixto(i, nivel) : m.color };
        }),
    );
}

// Columnas, ranuras por nivel y primer número quedan en null (en blanco) si se dejan en 0 o vacíos
const incompleto = (m) => m.niveles === null || m.porNivel === null || m.inicio === null;

// Valores del formulario de un módulo ya guardado; los racks sin `config` se deducen de sus ranuras
function configDe(modulo) {
    if (modulo.config) return { ...modulo.config, id: modulo.clave, nombre: modulo.nombre };
    const ranuras = modulo.niveles.flat();
    const [primera, segunda] = modulo.niveles[0];
    const columnas = /^[A-Z]-\d+$/.test(primera.etiqueta) && segunda?.etiqueta.split('-')[1] === primera.etiqueta.split('-')[1];
    const [, pre = '', num = '1'] = primera.etiqueta.match(/^(?:(.+)-)?(\d+)$/) ?? [];
    const colores = new Set(ranuras.map((r) => r.base ?? r.color));
    return {
        id: modulo.clave,
        nombre: modulo.nombre,
        niveles: modulo.niveles.length,
        porNivel: Math.max(...modulo.niveles.map((n) => n.length)),
        nomenclatura: columnas ? 'columnas' : 'numerica',
        prefijo: columnas ? '' : pre,
        inicio: parseInt(columnas ? primera.etiqueta.split('-')[1] : num, 10) || 1,
        color: colores.size === 1 ? (primera.base ?? primera.color) : 'mixto',
    };
}

// Crea un rack nuevo o edita uno agregado desde la app (`rack`)
export default function NuevoRack({ rack, porRanura, onCancelar, onGuardar }) {
    const editando = !!rack;
    const [nombre, setNombre] = useState(rack?.nombre ?? `Kanban ${KANBANS.length + 1}`);
    const [lineas, setLineas] = useState(rack?.lineas.join(', ') ?? '');
    const [modulos, setModulos] = useState(() => rack?.modulos.map(configDe) ?? [moduloVacio(1)]);
    const [enviando, setEnviando] = useState(false);

    const total = modulos.reduce((s, m) => s + (m.niveles ?? 0) * (m.porNivel ?? 0), 0);
    const hayVacios = modulos.some(incompleto);
    const nombreLimpio = nombre.trim();
    const repetido = KANBANS.some((k) => k.id !== rack?.id && k.nombre.toLowerCase() === nombreLimpio.toLowerCase());

    // Ranuras ocupadas que dejarían de existir con los cambios
    const retiradas = editando && !hayVacios
        ? (() => {
              const nuevas = new Set(
                  modulos.filter((m) => m.id).flatMap((m) => generarNiveles(m).flat().map((r) => `${rack.id}-${m.id}:${r.etiqueta}`)),
              );
              return [...porRanura.keys()].filter((id) => id.startsWith(`${rack.id}-`) && !nuevas.has(id)).length;
          })()
        : 0;
    const problema = !nombreLimpio
        ? 'Escribe un nombre para el rack.'
        : repetido
          ? 'Ya existe un rack con ese nombre.'
          : modulos.some((m) => !m.nombre.trim())
            ? 'Cada módulo necesita nombre.'
            : hayVacios
              ? 'Hay campos en blanco: columnas, ranuras por nivel y primer número no pueden quedar en 0 ni vacíos.'
              : total > MAX_RANURAS
                ? `Un rack admite hasta ${MAX_RANURAS} ranuras (llevas ${total}).`
                : null;

    const cambiar = (i, cambios) => setModulos((ms) => ms.map((m, j) => (j === i ? { ...m, ...cambios } : m)));

    const guardar = async (e) => {
        e.preventDefault();
        if (problema) return;
        setEnviando(true);
        await onGuardar({
            nombre: nombreLimpio,
            lineas: lineas.split(',').map((l) => l.trim()).filter(Boolean),
            modulos: modulos.map(({ id, nombre: n, ...config }) => ({
                id,
                nombre: n.trim(),
                niveles: generarNiveles(config),
                config,
            })),
        });
        setEnviando(false);
    };

    return (
        <div className="modal-overlay" onClick={onCancelar}>
            <form
                className="glass-strong modal modal-ancho nuevo-rack"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-nuevo-rack"
                onClick={(e) => e.stopPropagation()}
                onSubmit={guardar}
            >
                <div className="modal-encabezado">
                    <div>
                        <h2 id="titulo-nuevo-rack" className="modal-titulo">{editando ? `Editar ${rack.nombre}` : 'Nuevo rack'}</h2>
                        <p className="txt3">Define sus módulos, columnas y ranuras.</p>
                    </div>
                    <button type="button" className="btn-plain btn-sm" onClick={onCancelar}>Cerrar</button>
                </div>

                <div className="nuevo-rack-cuerpo">
                    <div className="nuevo-rack-fila">
                        <div className="campo">
                            <label className="campo-label" htmlFor="rack-nombre">Nombre</label>
                            <input id="rack-nombre" className="campo-input" value={nombre} maxLength={60} autoFocus onChange={(e) => setNombre(e.target.value)} />
                        </div>
                        <div className="campo">
                            <label className="campo-label" htmlFor="rack-lineas">Líneas</label>
                            <input id="rack-lineas" className="campo-input" value={lineas} placeholder="A3, B2" onChange={(e) => setLineas(e.target.value)} />
                        </div>
                    </div>

                    {modulos.map((m, i) => (
                        <fieldset className="nuevo-rack-modulo" key={i}>
                            <legend className="sr-only">Módulo {i + 1}</legend>
                            <div className="nuevo-rack-modulo-encabezado">
                                <span className="seccion-titulo">Módulo {i + 1}</span>
                                {modulos.length > 1 && (
                                    <button type="button" className="btn-plain btn-sm peligro" onClick={() => setModulos((ms) => ms.filter((_, j) => j !== i))}>
                                        Quitar
                                    </button>
                                )}
                            </div>

                            <div className="nuevo-rack-rejilla">
                                <Campo id={`m${i}-nombre`} label="Nombre del módulo" ancho>
                                    <input id={`m${i}-nombre`} className="campo-input" value={m.nombre} maxLength={60} onChange={(e) => cambiar(i, { nombre: e.target.value })} />
                                </Campo>
                                <Campo id={`m${i}-niveles`} label="Columnas" vacio={m.niveles === null}>
                                    <input id={`m${i}-niveles`} className="campo-input" type="number" min="1" max="30" placeholder="—" value={m.niveles ?? ''} aria-invalid={m.niveles === null || undefined} onChange={(e) => cambiar(i, { niveles: leerEntero(e.target.value, 30) })} />
                                </Campo>
                                <Campo id={`m${i}-por-nivel`} label="Ranuras por nivel" vacio={m.porNivel === null}>
                                    <input id={`m${i}-por-nivel`} className="campo-input" type="number" min="1" max={m.nomenclatura === 'columnas' ? 26 : 20} placeholder="—" value={m.porNivel ?? ''} aria-invalid={m.porNivel === null || undefined} onChange={(e) => cambiar(i, { porNivel: leerEntero(e.target.value, m.nomenclatura === 'columnas' ? 26 : 20) })} />
                                </Campo>
                                <Campo id={`m${i}-nomenclatura`} label="Nomenclatura">
                                    <select id={`m${i}-nomenclatura`} className="campo-input" value={m.nomenclatura} onChange={(e) => cambiar(i, { nomenclatura: e.target.value })}>
                                        <option value="numerica">Numérica (1, 2, 3…)</option>
                                        <option value="columnas">Por columnas (A-1, B-1…)</option>
                                    </select>
                                </Campo>
                                {m.nomenclatura === 'numerica' && (
                                    <Campo id={`m${i}-prefijo`} label="Prefijo (opcional)">
                                        <input id={`m${i}-prefijo`} className="campo-input" value={m.prefijo} maxLength={6} placeholder="P" onChange={(e) => cambiar(i, { prefijo: e.target.value })} />
                                    </Campo>
                                )}
                                <Campo id={`m${i}-inicio`} label={m.nomenclatura === 'columnas' ? 'Primer nivel' : 'Primer número'} vacio={m.inicio === null}>
                                    <input id={`m${i}-inicio`} className="campo-input" type="number" min="1" max="999" placeholder="—" value={m.inicio ?? ''} aria-invalid={m.inicio === null || undefined} onChange={(e) => cambiar(i, { inicio: leerEntero(e.target.value, 999) })} />
                                </Campo>
                                <Campo id={`m${i}-color`} label="Contenedores">
                                    <select id={`m${i}-color`} className="campo-input" value={m.color} onChange={(e) => cambiar(i, { color: e.target.value })}>
                                        <option value="azul">Raw Material (azul)</option>
                                        <option value="verde">Material Ensamblado (verde)</option>
                                        <option value="cafe">Cajas de cartón (café)</option>
                                        <option value="mixto">Mixto</option>
                                    </select>
                                </Campo>
                            </div>

                            <Vista modulo={m} />
                        </fieldset>
                    ))}

                    <button
                        type="button"
                        className="btn-secondary btn-sm nuevo-rack-agregar"
                        onClick={() => setModulos((ms) => [...ms, { ...ms[ms.length - 1], id: undefined, nombre: `Módulo ${ms.length + 1}` }])}
                        disabled={modulos.length >= 20}
                    >
                        + Agregar módulo
                    </button>
                </div>

                <p className={`txt3 modal-nota ${problema ? 'nuevo-rack-error' : ''}`} role={problema ? 'alert' : undefined}>
                    {problema ?? `${modulos.length} módulo${modulos.length === 1 ? '' : 's'} · ${total} ranuras`}
                </p>
                {!problema && retiradas > 0 && (
                    <p className="txt3 nuevo-rack-error">
                        {retiradas} ranura{retiradas === 1 ? '' : 's'} ocupada{retiradas === 1 ? '' : 's'} dejará{retiradas === 1 ? '' : 'n'} de
                        existir; sus artículos regresarán a Recepción.
                    </p>
                )}

                <div className="modal-acciones">
                    <button type="button" className="btn-secondary" onClick={onCancelar} disabled={enviando}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={!!problema || enviando}>
                        {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear rack'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// Confirmación para eliminar un rack agregado desde la app
export function EliminarRack({ rack, ocupadas, onCancelar, onConfirmar }) {
    const [enviando, setEnviando] = useState(false);
    const confirmar = async () => {
        setEnviando(true);
        await onConfirmar();
        setEnviando(false);
    };
    return (
        <div className="modal-overlay" onClick={onCancelar}>
            <div
                className="glass-strong modal"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="titulo-eliminar-rack"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="titulo-eliminar-rack" className="modal-titulo">¿Eliminar {rack.nombre}?</h2>
                <p className="txt2 modal-nota">
                    {ocupadas > 0
                        ? `Tiene ${ocupadas} ranura${ocupadas === 1 ? '' : 's'} ocupada${ocupadas === 1 ? '' : 's'}: sus artículos regresarán a Recepción.`
                        : 'El rack está vacío.'}{' '}
                    Esta acción no se puede deshacer.
                </p>
                <div className="modal-acciones">
                    <button className="btn-secondary" onClick={onCancelar} disabled={enviando}>Cancelar</button>
                    <button className="btn-primary btn-peligro" onClick={confirmar} disabled={enviando} autoFocus>
                        {enviando ? 'Eliminando…' : 'Eliminar rack'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Campo({ id, label, ancho, vacio, children }) {
    return (
        <div className={`campo ${ancho ? 'campo-ancho' : ''}`}>
            <label className="campo-label" htmlFor={id}>{label}</label>
            {children}
            {vacio && <p className="aviso-campo" role="alert">No puede quedar en 0 ni vacío.</p>}
        </div>
    );
}

// Vista previa: mismos contenedores del rack en miniatura
function Vista({ modulo }) {
    if (incompleto(modulo)) return <div className="nuevo-rack-vista txt3">Completa los campos en blanco para ver el módulo.</div>;
    const niveles = generarNiveles(modulo);
    return (
        <div className="nuevo-rack-vista" aria-label="Vista previa del módulo">
            {niveles.map((nivel, n) => (
                <div className="nuevo-rack-vista-nivel" key={n} style={{ '--columnas': modulo.porNivel }}>
                    {nivel.map((r) => (
                        <span key={r.etiqueta} className={`nuevo-rack-celda ${r.color}`} title={r.etiqueta}>{r.etiqueta}</span>
                    ))}
                </div>
            ))}
        </div>
    );
}
