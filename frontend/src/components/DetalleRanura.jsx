import CodigoBarras from './CodigoBarras';
import { ListaBolsas, ResumenContenido } from './Contenido';
import { RANURAS, describirUbicacion } from '../data/kanbans';
import { bolsas } from '../utils/contenido';

const TIPO_DE_COLOR = { azul: 'Raw Material', verde: 'Material Ensamblado', cafe: 'Cajas de cartón' };

// Ventana de una ranura con varios códigos:
// lista cada código con su contenido y deja abrirlo, moverlo (o darle salida) o regresarlo a Recepción.
export default function DetalleRanura({ ranuraId, articulos, onCerrar, onAbrir, onMover, onRegresar }) {
    const ranura = RANURAS.get(ranuraId);
    if (!ranura || !articulos.length) return null;
    const total = articulos.reduce((s, a) => s + a.cantidad, 0);

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div
                className="glass-strong modal modal-ancho"
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-detalle-ranura"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-encabezado">
                    <div>
                        <h2 id="titulo-detalle-ranura" className="modal-titulo">Ranura {ranura.etiqueta}</h2>
                        <p className="txt3">
                            {describirUbicacion(ranuraId)} · {TIPO_DE_COLOR[ranura.color]}
                        </p>
                    </div>
                    <button className="btn-plain btn-sm" onClick={onCerrar}>Cerrar</button>
                </div>

                <p className="txt2 ocupacion-ranura">
                    {bolsas(total)} · {articulos.length} código{articulos.length === 1 ? '' : 's'}
                </p>

                <ul className="ranura-lista">
                    {articulos.map((a) => (
                        <li key={a.id} className="ranura-lista-item">
                            <div className="ranura-lista-cabecera">
                                <CodigoBarras valor={a.codigo} alto={28} ancho={1.1} mostrarTexto={false} className="mini" />
                                <span className="codigo-mono ranura-lista-codigo" title={a.codigo}>{a.codigo}</span>
                                <span className="txt3">{bolsas(a.cantidad)}</span>
                            </div>
                            {a.descripcion && <p className="txt2 ranura-lista-descripcion">{a.descripcion}</p>}
                            <ResumenContenido articulo={a} />
                            <ListaBolsas articulo={a} />
                            <div className="ranura-lista-acciones">
                                <button className="btn-secondary btn-sm" onClick={() => onAbrir(a.id)}>Abrir</button>
                                <button className="btn-plain btn-sm" onClick={() => onMover(a.id)} title="Elegir otra ranura o darle salida">
                                    Mover / salida
                                </button>
                                <button className="btn-plain btn-sm" onClick={() => onRegresar(a.id)}>A Recepción</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
