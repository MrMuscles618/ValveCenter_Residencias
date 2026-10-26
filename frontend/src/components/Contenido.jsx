import { useEffect, useRef, useState } from 'react';
import { CAMPOS_CONTENIDO, contenidoDe, numeroParte, pesoTexto, pz, resumenContenido, resumenTotales } from '../utils/contenido';
import { leerDecimal, leerEntero } from '../utils/numeros';

// Campos editables de la etiqueta del contenedor: FECHA, LOTE, PPP, OPER (todos opcionales).
// PESO y PIEZAS se editan en cada bolsa (EditorBolsas).
export function CamposContenido({ articulo, onActualizar }) {
    const contenido = contenidoDe(articulo);
    const cambiar = (id, texto) => {
        // FECHA va siempre con su valor automático (el backend la guarda solo si estaba vacía)
        onActualizar(articulo.id, { contenido: { ...contenido, [id]: texto, fecha: contenido.fecha } });
    };

    return (
        <fieldset className="contenido-campos">
            <legend className="campo-label">Contenido del contenedor</legend>
            {CAMPOS_CONTENIDO.filter((c) => !c.porBolsa).map((c) => (
                <div className="campo" key={c.id}>
                    <label className="campo-label" htmlFor={`cont-${c.id}`}>
                        {c.etiqueta}
                        {c.ayuda && <span className="txt3"> · {c.ayuda}</span>}
                    </label>
                    <input
                        id={`cont-${c.id}`}
                        className="campo-input"
                        type={c.tipo}
                        maxLength={c.tipo === 'text' ? 60 : undefined}
                        placeholder="—"
                        value={contenido[c.id] ?? ''}
                        readOnly={c.bloqueado}
                        aria-readonly={c.bloqueado || undefined}
                        title={c.bloqueado ? 'Se asigna automáticamente al registrar el contenedor' : undefined}
                        onChange={c.bloqueado ? undefined : (e) => cambiar(c.id, e.target.value)}
                    />
                </div>
            ))}
        </fieldset>
    );
}

// Piezas y peso de cada bolsa, cada una por separado
export function EditorBolsas({ articulo, onActualizarBolsa }) {
    const lista = articulo.bolsas ?? [];
    const totales = resumenTotales(articulo);
    return (
        <fieldset className="editor-bolsas">
            <legend className="campo-label">Bolsas · cada una con sus piezas y su peso</legend>
            <div className="editor-bolsas-fila editor-bolsas-encabezado" aria-hidden="true">
                <span>Bolsa</span>
                <span>Piezas</span>
                <span>Peso (kg)</span>
            </div>
            {lista.map((b, i) => (
                <div className="editor-bolsas-fila" key={b.id}>
                    <span className="editor-bolsas-numero">{i + 1}</span>
                    <CampoNumero
                        valor={b.piezas}
                        etiqueta={`Piezas de la bolsa ${i + 1}`}
                        onCambiar={(v) => onActualizarBolsa(articulo.id, b.id, { piezas: v })}
                    />
                    {b.pesoBloqueado ? (
                        <div className="campo-bolsa">
                            <input
                                className="campo-input campo-bloqueado"
                                value="NA"
                                readOnly
                                aria-readonly
                                aria-label={`Peso de la bolsa ${i + 1}: NA, bloqueado`}
                                title="Tras una salida de piezas el peso queda en NA y ya no se puede modificar"
                            />
                            <span className="nota-campo">🔒 Bloqueado por salida de piezas</span>
                        </div>
                    ) : (
                        <CampoNumero
                            valor={b.peso}
                            decimal
                            etiqueta={`Peso de la bolsa ${i + 1}`}
                            onCambiar={(v) => onActualizarBolsa(articulo.id, b.id, { peso: v })}
                        />
                    )}
                </div>
            ))}
            {lista.length === 0 && <p className="txt3">Sin bolsas.</p>}
            {totales && <p className="editor-bolsas-total">Total: {totales}</p>}
        </fieldset>
    );
}

// Campo numérico de una bolsa. Si se deja en 0 o vacío queda en blanco (sin capturar) y avisa.
// Los decimales se pueden escribir con calma ("0.", "0,5"): el 0 se limpia al salir del campo.
function CampoNumero({ valor, decimal = false, etiqueta, onCambiar }) {
    const [texto, setTexto] = useState(valor ?? '');
    const [aviso, setAviso] = useState(false);
    const enfocado = useRef(false);
    const leer = decimal ? leerDecimal : (t) => leerEntero(t);

    // Lo que cambie desde fuera (otra salida, recarga) se refleja si no se está escribiendo
    useEffect(() => {
        if (!enfocado.current) setTexto(valor ?? '');
    }, [valor]);

    const cambiar = (t) => {
        const v = leer(t);
        const parcial = decimal && /^0*([.,]0*)?$/.test(t.trim()) && t.trim() !== '';
        setTexto(v === null && !parcial ? '' : t);
        setAviso(v === null && !parcial);
        if (v !== valor) onCambiar(v);
    };

    return (
        <div className="campo-bolsa">
            <input
                className={`campo-input ${aviso ? 'en-blanco' : ''}`}
                type="text"
                inputMode={decimal ? 'decimal' : 'numeric'}
                placeholder="—"
                value={texto}
                aria-label={etiqueta}
                aria-invalid={aviso || undefined}
                onFocus={() => (enfocado.current = true)}
                onBlur={() => {
                    enfocado.current = false;
                    const v = leer(texto);
                    if (v === null) {
                        setTexto('');
                        setAviso(true);
                    } else if (String(v) !== String(texto).trim()) {
                        setTexto(String(v)); // "1.5" en piezas se guarda como 1, "12abc" como 12: se muestra lo guardado
                    }
                }}
                onChange={(e) => cambiar(e.target.value)}
            />
            {aviso && <span className="aviso-campo">Sin capturar: no puede quedar en 0</span>}
        </div>
    );
}

// Vista corta de las bolsas (solo lectura): "230 pz · 12 kg" por bolsa y el total
const MAX_BOLSAS_LISTA = 8;
export function ListaBolsas({ articulo }) {
    const lista = articulo.bolsas ?? [];
    if (!lista.length) return null;
    const visibles = lista.slice(0, MAX_BOLSAS_LISTA);
    const totales = resumenTotales(articulo);
    return (
        <div className="lista-bolsas">
            {visibles.map((b, i) => (
                <span key={b.id} className="lista-bolsas-chip" title={`Bolsa ${i + 1}`}>
                    <b>{i + 1}</b> {b.piezas !== null ? pz(b.piezas) : '— pz'}
                    {pesoTexto(b) && ` · ${pesoTexto(b)}`}
                </span>
            ))}
            {lista.length > MAX_BOLSAS_LISTA && <span className="lista-bolsas-chip">+{lista.length - MAX_BOLSAS_LISTA}</span>}
            {totales && lista.length > 1 && <span className="lista-bolsas-total">Total {totales}</span>}
        </div>
    );
}

// Resumen de solo lectura: solo los campos con valor
export function ResumenContenido({ articulo, className = '' }) {
    // El número de parte (lo que va antes del apóstrofe o guion del código) encabeza el resumen
    const parte = numeroParte(articulo.codigo);
    const campos = [...(parte ? [['No. de parte', parte]] : []), ...resumenContenido(contenidoDe(articulo))];
    if (!campos.length) return null;
    return (
        <dl className={`contenido-resumen ${className}`}>
            {campos.map(([etiqueta, valor]) => (
                <div key={etiqueta}>
                    <dt>{etiqueta}</dt>
                    <dd>{valor}</dd>
                </div>
            ))}
        </dl>
    );
}
