import { useCallback, useEffect, useRef, useState } from 'react';
import CodigoBarras from './CodigoBarras';
import { ListaBolsas, ResumenContenido } from './Contenido';
import { RECEPCION } from '../hooks/useAlmacen';
import { describirUbicacion } from '../data/kanbans';
import { interpretarContenido, numeroParte, piezasDelCodigo } from '../utils/contenido';
import { useCamaraSick } from '../hooks/useCamaraSick';
import { REGION_LECTURA } from '../utils/camaraSick';

// Los lectores USB/Bluetooth funcionan como teclado: escriben el código muy rápido
// y casi siempre terminan con Enter. Se detectan por la velocidad; si el lector no manda
// Enter, el código se envía solo cuando deja de escribir (PAUSA_FIN ms sin teclas).
const MS_ENTRE_TECLAS = 45;
const MIN_LARGO = 4;
const PAUSA_FIN = 120;
const CLAVE_MODO = 'escaner-modo';

const esRapido = (inicio, fin, largo) => (fin - inicio) / Math.max(largo - 1, 1) < MS_ENTRE_TECLAS;

// Devuelve un campo de texto controlado por React a un valor: React solo se entera del cambio si se usa el
// setter nativo y se dispara el evento `input`, como si lo hubiera escrito el usuario.
function restaurar(campo, valor) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(campo), 'value')?.set;
    if (!setter) return;
    setter.call(campo, valor);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
}

// El usuario elige cómo leer: 'escaner' (USB/Bluetooth, el modo por omisión), 'camara' (cámara SICK) o 'manual'.
// Solo se recuerda 'manual': la cámara NUNCA se enciende sola al abrir la app, hay que elegirla.
function leerModo() {
    try {
        return localStorage.getItem(CLAVE_MODO) === 'manual' ? 'manual' : 'escaner';
    } catch {
        return 'escaner';
    }
}

const ESTADOS_CAMARA = {
    apagada: { punto: 'gris', texto: 'Cámara apagada' },
    conectando: { punto: 'amarillo', texto: 'Conectando con la cámara SICK…' },
    leyendo: { punto: 'verde', texto: 'Cámara SICK leyendo' },
    sinimagen: { punto: 'amarillo', texto: 'Cámara conectada, esperando imagen…' },
    reconectando: { punto: 'rojo', texto: 'Sin conexión con la cámara, reintentando…' },
    sinlector: { punto: 'rojo', texto: 'No se pudo cargar el lector de códigos' },
};

export default function Escaner({ onLectura }) {
    const [modo, setModo] = useState(leerModo);
    const [texto, setTexto] = useState('');
    const [ultima, setUltima] = useState(null);
    const [leyendo, setLeyendo] = useState(false);
    const [avisoCamara, setAvisoCamara] = useState('');
    const lienzo = useRef(null); // imagen de la cámara

    // `procesar` no cambia aunque cambie `onLectura`: la escucha del lector depende de él, y volver a crearla a
    // media lectura perdería las teclas ya recibidas
    const onLecturaRef = useRef(onLectura);
    useEffect(() => {
        onLecturaRef.current = onLectura;
    });
    const procesar = useCallback(async (codigo, formato) => {
        const limpio = codigo.trim();
        if (!limpio) return;
        const hora = new Date();
        setUltima({ codigo: limpio, formato, hora, resultado: null });
        setLeyendo(true);
        setTimeout(() => setLeyendo(false), 700);
        const resultado = await onLecturaRef.current(limpio, formato);
        setUltima((u) => (u?.hora === hora ? { ...u, resultado } : u));
    }, []);

    // Cámara SICK: solo conectada mientras se tenga elegido ese modo (ver hooks/useCamaraSick.js)
    const camaraActiva = modo === 'camara';
    const { estado: estadoCamara } = useCamaraSick({
        activa: camaraActiva,
        lienzo,
        onCodigo: (codigo) => procesar(codigo, 'Cámara SICK'),
        onLimite: (mensaje) => {
            setAvisoCamara(mensaje);
            setModo('escaner');
        },
    });

    // Captura global del lector tipo teclado. Con la cámara elegida no escucha.
    // También dentro de un campo de texto (descripción, LOTE, bolsas…): si llega una lectura de lector terminada en
    // Enter, se registra como escaneo y el campo vuelve a lo que tenía, en lugar de quedarse con el código escrito.
    // Sin Enter, dentro de un campo no se distingue de una persona escribiendo rápido, así que ahí no cuenta.
    // Escucha en fase de captura para atender el Enter antes que el propio campo (p. ej. guardar las bolsas).
    useEffect(() => {
        if (camaraActiva) return undefined;
        let buffer = '';
        let inicio = 0;
        let ultimaTecla = 0;
        let espera = null;
        let campo = null; // campo de texto donde empezó la lectura
        let valorAntes = '';
        const terminar = () => {
            clearTimeout(espera);
            // Solo cuenta como lectura si el ritmo fue de lector, no de persona
            const ok = buffer.length >= MIN_LARGO && esRapido(inicio, ultimaTecla, buffer.length);
            if (ok) {
                if (campo) restaurar(campo, valorAntes);
                procesar(buffer, 'Lector');
            }
            buffer = '';
            return ok;
        };
        const alPresionar = (e) => {
            const editable = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
            // El campo del propio panel de lectura tiene su lógica; listas y textos enriquecidos no se tocan
            if (editable && (editable.id === 'codigo-manual' || editable.tagName === 'SELECT' || !('value' in editable))) return;
            // Una tecla mantenida se repite muy rápido, pero no es un lector
            if (e.repeat) {
                buffer = '';
                return;
            }
            const ahora = performance.now();
            if (ahora - ultimaTecla > MS_ENTRE_TECLAS * 3) {
                buffer = '';
                inicio = ahora;
                campo = editable;
                valorAntes = editable ? editable.value : '';
            }
            if (e.key === 'Enter') {
                if (terminar()) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } else if (e.key.length === 1) {
                ultimaTecla = ahora;
                buffer += e.key;
                clearTimeout(espera);
                if (!editable) espera = setTimeout(terminar, PAUSA_FIN);
            }
        };
        window.addEventListener('keydown', alPresionar, true);
        return () => {
            clearTimeout(espera);
            window.removeEventListener('keydown', alPresionar, true);
        };
    }, [procesar, camaraActiva]);

    // Campo del modo escáner: lo que escribe el escáner se envía solo, sin botón
    const campoLector = useRef(null);
    const [escritoAMano, setEscritoAMano] = useState(false);
    const ritmo = useRef({ inicio: 0, ultima: 0, espera: null });
    const enviarLector = useCallback(
        (valor, porEnter) => {
            clearTimeout(ritmo.current.espera);
            const limpio = valor.trim();
            if (!limpio) return;
            const rapido = esRapido(ritmo.current.inicio, ritmo.current.ultima, limpio.length);
            // Con Enter siempre se envía; por pausa, solo si lo escribió un lector
            if (!porEnter && (!rapido || limpio.length < MIN_LARGO)) {
                setEscritoAMano(true);
                return;
            }
            procesar(limpio, rapido ? 'Lector' : 'Teclado');
            setTexto('');
            setEscritoAMano(false);
        },
        [procesar],
    );
    const alEscribirLector = (e) => {
        const valor = e.target.value;
        const ahora = performance.now();
        const r = ritmo.current;
        if (!texto || ahora - r.ultima > MS_ENTRE_TECLAS * 3) r.inicio = ahora;
        r.ultima = ahora;
        setTexto(valor);
        setEscritoAMano(false);
        clearTimeout(r.espera);
        r.espera = setTimeout(() => enviarLector(valor, false), PAUSA_FIN);
    };
    useEffect(() => () => clearTimeout(ritmo.current.espera), []);

    const cambiarModo = (nuevo) => {
        setModo(nuevo);
        setTexto('');
        setEscritoAMano(false);
        setAvisoCamara('');
        try {
            if (nuevo !== 'camara') localStorage.setItem(CLAVE_MODO, nuevo); // la cámara nunca se recuerda
        } catch {
            /* sin almacenamiento: el modo solo dura esta sesión */
        }
        if (nuevo !== 'camara') setTimeout(() => (nuevo === 'manual' ? document.getElementById('codigo-manual') : campoLector.current)?.focus(), 0);
    };

    const enviar = (e) => {
        e.preventDefault();
        procesar(texto, 'Manual');
        setTexto('');
    };

    const res = ultima?.resultado;
    const estado = camaraActiva
        ? ESTADOS_CAMARA[estadoCamara]
        : modo === 'manual'
          ? { punto: 'gris', texto: 'Modo manual' }
          : { punto: 'verde', texto: 'Escáner listo' };

    return (
        <section className="glass escaner" aria-labelledby="titulo-escaner">
            <div className="seccion-encabezado">
                <h2 id="titulo-escaner" className="seccion-titulo">Lectura de código</h2>
                <span className="etiqueta-lector" role="status">
                    <span className={`estado-punto ${estado.punto}`} />
                    {estado.texto}
                </span>
            </div>

            <div className="salida-modo escaner-modos" role="radiogroup" aria-label="Forma de lectura">
                <button
                    type="button"
                    role="radio"
                    aria-checked={modo === 'escaner'}
                    className={modo === 'escaner' ? 'activo' : ''}
                    onClick={() => cambiarModo('escaner')}
                >
                    <b><IconoEscaner /> Escáner</b>
                    <span>USB o Bluetooth, sin botón</span>
                </button>
                <button
                    type="button"
                    role="radio"
                    aria-checked={camaraActiva}
                    className={camaraActiva ? 'activo' : ''}
                    onClick={() => cambiarModo('camara')}
                >
                    <b><IconoCamara /> Cámara SICK</b>
                    <span>Se enciende al elegirla</span>
                </button>
                <button
                    type="button"
                    role="radio"
                    aria-checked={modo === 'manual'}
                    className={modo === 'manual' ? 'activo' : ''}
                    onClick={() => cambiarModo('manual')}
                >
                    <b><IconoTeclado /> Manual</b>
                    <span>Escribe y pulsa Registrar</span>
                </button>
            </div>

            {camaraActiva ? (
                // La caja tiene la proporción de la cámara (16:9) y el recuadro marca exactamente la zona que se lee
                <div className="escaner-video" style={{ '--proporcion': '16 / 9' }}>
                    <canvas ref={lienzo} aria-label="Imagen de la cámara SICK" />
                    <div
                        className="escaner-mira"
                        aria-hidden="true"
                        style={{
                            left: `${REGION_LECTURA.x * 100}%`,
                            top: `${REGION_LECTURA.y * 100}%`,
                            width: `${REGION_LECTURA.ancho * 100}%`,
                            height: `${REGION_LECTURA.alto * 100}%`,
                            maxHeight: 'none',
                            aspectRatio: 'auto',
                            transform: 'none',
                        }}
                    />
                </div>
            ) : modo === 'escaner' ? (
                <div className="escaner-form">
                    <label className="sr-only" htmlFor="codigo-manual">Código leído por el escáner</label>
                    <input
                        id="codigo-manual"
                        ref={campoLector}
                        className={`campo-input campo-lector ${texto ? 'codigo-mono' : ''}`}
                        placeholder="Apunta el escáner al código…"
                        value={texto}
                        onChange={alEscribirLector}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                enviarLector(texto, true);
                            }
                        }}
                        autoComplete="off"
                    />
                </div>
            ) : (
                <form className="escaner-form" onSubmit={enviar}>
                    <label className="sr-only" htmlFor="codigo-manual">Código de barras</label>
                    <input
                        id="codigo-manual"
                        className={`campo-input ${texto ? 'codigo-mono' : ''}`}
                        placeholder="Escribe un código…"
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        autoComplete="off"
                    />
                    <button className="btn-primary" type="submit" disabled={!texto.trim()}>Registrar</button>
                </form>
            )}
            {modo === 'escaner' && texto && escritoAMano && (
                <p className="nota-campo">¿Lo escribiste a mano? Pulsa Enter para registrarlo o usa el modo Manual.</p>
            )}
            {avisoCamara && <div className="aviso aviso-error">{avisoCamara}</div>}
            {camaraActiva && estadoCamara === 'sinlector' && (
                <p className="nota-campo">
                    La imagen se ve, pero los códigos no se pueden leer. Recarga la página (Ctrl + F5); mientras tanto usa Escáner o Manual.
                </p>
            )}
            {camaraActiva && estadoCamara === 'reconectando' && (
                <p className="nota-campo">
                    No se alcanza la cámara. Este equipo debe estar en su misma red y la cámara encendida; también puedes cambiar a Escáner o Manual.
                </p>
            )}
            <div className={`lectura ${leyendo ? 'leyendo' : ''} ${ultima ? '' : 'vacia'}`} aria-live="polite">
                {ultima ? (
                    <>
                        <div className="lectura-barras">
                            <CodigoBarras valor={ultima.codigo} alto={52} mostrarTexto={false} />
                            <span className="lectura-laser" aria-hidden="true" />
                        </div>
                        {res?.articulo && <ContenidoContenedor res={res} />}
                        <ContenidoLeido codigo={ultima.codigo} />
                        <div className="lectura-meta">
                            <span>{ultima.formato}</span>
                            <span>{ultima.hora.toLocaleTimeString('es-MX')}</span>
                        </div>
                        {res && (
                            <div className={`aviso ${res.tipo === 'nuevo' ? 'aviso-exito' : 'aviso-info'}`}>
                                {res.tipo === 'nuevo'
                                    ? 'Nuevo artículo en Recepción. Arrástralo a un rack para ubicarlo.'
                                    : res.tipo === 'salida'
                                      ? `Salida: -1 bolsa de ${describirUbicacion(res.articulo.ubicacion)} · ${
                                            res.eliminado ? 'contenedor vacío, se liberó la ranura' : `quedan ${res.articulo.cantidad}`
                                        }`
                                      : `Ya registrado: +1 bolsa (total ${res.articulo.cantidad}) · ${
                                            res.articulo.ubicacion === RECEPCION
                                                ? 'en Recepción'
                                                : describirUbicacion(res.articulo.ubicacion)
                                        }`}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="lectura-vacia">
                        {camaraActiva
                            ? 'Pasa el código frente a la cámara SICK: se registra al leerlo.'
                            : modo === 'escaner'
                              ? 'Escanea el código con el lector: se registra al instante.'
                              : 'Escribe el código y pulsa Registrar. El escáner también funciona aquí.'}
                    </p>
                )}
            </div>
        </section>
    );
}

// Lo que está guardado del contenedor del código leído (descripción, FECHA, LOTE…, bolsas),
// para que al escanear se vea su contenido sin abrir el detalle
function ContenidoContenedor({ res }) {
    const { articulo } = res;
    const titulo =
        res.tipo === 'nuevo'
            ? 'Contenedor nuevo'
            : res.tipo === 'salida'
              ? res.eliminado
                  ? 'Contenido que salió'
                  : 'Contenido que queda'
              : 'Contenido del contenedor';
    const sinDatos = !articulo.descripcion && !(articulo.bolsas ?? []).some((b) => b.piezas !== null || b.peso !== null);
    return (
        <div className="lectura-contenedor">
            <div className="lectura-contenido-encabezado">
                <span>{titulo}</span>
            </div>
            {articulo.descripcion && <p className="lectura-descripcion">{articulo.descripcion}</p>}
            <ResumenContenido articulo={articulo} />
            {!res.eliminado && <ListaBolsas articulo={articulo} />}
            {sinDatos && <p className="nota-campo">Sin contenido capturado: agrégalo en el detalle del contenedor.</p>}
        </div>
    );
}

// Muestra el contenido decodificado; si trae datos estructurados los separa en campos
function ContenidoLeido({ codigo }) {
    const [copiado, setCopiado] = useState(false);
    const campos = interpretarContenido(codigo);
    // Del propio código: lo anterior al apóstrofe o guion es el número de parte y lo posterior, las piezas
    const parte = numeroParte(codigo);
    const piezas = piezasDelCodigo(codigo);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
        } catch {
            /* sin permiso de portapapeles */
        }
    };

    return (
        <div className="lectura-contenido">
            <div className="lectura-contenido-encabezado">
                <span>Código leído</span>
                <button type="button" className="lectura-copiar" onClick={copiar}>
                    {copiado ? 'Copiado' : 'Copiar'}
                </button>
            </div>
            <p className="lectura-texto codigo-mono">
                {/^https?:\/\//i.test(codigo) ? (
                    <a href={codigo} target="_blank" rel="noreferrer">{codigo}</a>
                ) : (
                    codigo
                )}
            </p>
            {(parte || piezas !== null) && (
                <dl className="lectura-campos">
                    {parte && (
                        <div>
                            <dt>No. de parte</dt>
                            <dd className="codigo-mono">{parte}</dd>
                        </div>
                    )}
                    {piezas !== null && (
                        <div>
                            <dt>Piezas</dt>
                            <dd className="codigo-mono">{piezas}</dd>
                        </div>
                    )}
                </dl>
            )}
            {campos && (
                <dl className="lectura-campos">
                    {campos.map(([clave, valor], i) => (
                        <div key={i}>
                            <dt>{clave}</dt>
                            <dd className="codigo-mono">{valor}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}

function IconoCamara() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 8v8M10 8v8M13 8v8M17 8v8" />
        </svg>
    );
}

// Pistola lectora de códigos
function IconoEscaner() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3H7l-1 7H3z" />
            <path d="M16 9.5h5M16 12h4M16 7h3" />
        </svg>
    );
}

function IconoTeclado() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
        </svg>
    );
}
