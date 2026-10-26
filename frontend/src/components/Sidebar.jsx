import logoZF from '../logos/ZF_logo 1.svg';
import logoSmartFactory from '../logos/logozf-DtEcICS_.svg';
import { KANBANS, textoMovimiento } from '../data/kanbans';

// Sidebar estilo Finder: navegación del almacén y marca en el pie.
export default function Sidebar({ kanbanId, ocupadasPorKanban, onKanban, onCerrar, onNuevoRack, historial = [] }) {
    const totalOcupadas = Object.values(ocupadasPorKanban).reduce((s, n) => s + n, 0);
    return (
        <aside className="sidebar" aria-label="Navegación principal">
            <div className="sidebar-marca">
                <img src={logoZF} alt="ZF" className="sidebar-logo" />
                <div>
                    <div className="sidebar-marca-nombre">Valve Center</div>
                    <div className="sidebar-marca-sub">Almacén Digital</div>
                </div>
                <button className="btn-plain btn-icon sidebar-cerrar" onClick={onCerrar} aria-label="Cerrar menú">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                </button>
            </div>

            <nav className="sidebar-nav">
            


                {/* Racks Kanban, desplegables como los movimientos recientes (abiertos por defecto) */}
                <details className="sidebar-historial sidebar-kanbans" open>
                    <summary className="sidebar-item">
                        <Icono d="M4 3v18M20 3v18M4 8h16M4 13h16M4 18h16" />
                        Racks/Kanban
                        {totalOcupadas > 0 && <span className="sidebar-cuenta" title="Ranuras ocupadas">{totalOcupadas}</span>}
                        <svg className="sidebar-flecha" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m9 6 6 6-6 6" />
                        </svg>
                    </summary>
                    <div className="sidebar-kanbans-lista">
                        {KANBANS.map((k) => (
                            <button
                                key={k.id}
                                className={`sidebar-item ${k.id === kanbanId ? 'activo' : ''}`}
                                aria-current={k.id === kanbanId ? 'page' : undefined}
                                onClick={() => onKanban(k.id)}
                            >
                                <span className="sidebar-item-texto">
                                    {k.nombre}
                                    <small>{k.lineas.join(' · ')}</small>
                                </span>
                                {ocupadasPorKanban[k.id] > 0 && <span className="sidebar-cuenta">{ocupadasPorKanban[k.id]}</span>}
                            </button>
                        ))}
                    </div>
                </details>

                {/* Movimientos recientes, plegados por defecto */}
                
                <details className="sidebar-historial">
                    <summary className="sidebar-item">
                        <Icono d="M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
                        Movimientos recientes
                        <svg className="sidebar-flecha" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m9 6 6 6-6 6" />
                        </svg>
                    </summary>
                    {historial.length === 0 ? (
                        <p className="sidebar-historial-vacio">Sin movimientos todavía.</p>
                    ) : (
                        <ul>
                            {historial.slice(0, 15).map((h) => (
                                <li key={h.id}>
                                    <span className="historial-hora">
                                        {new Date(h.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                    <span>{textoMovimiento(h.texto)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </details>

                <div className="sidebar-seccion"> Agregar Nuevo Rack </div>
                <button className="sidebar-item sidebar-nuevo-rack" onClick={onNuevoRack}>
                    <Icono d="M12 5v14M5 12h14" />
                    <span className="sidebar-item-texto">
                        Nuevo rack
                        <small>Definir módulos y ranuras</small>
                    </span>
                </button>
                
            </nav>

            <div className="sidebar-pie">
                <img src={logoSmartFactory} alt="Smart Factory & Digitalization · ZF ESL" />
            </div>
        </aside>
    );
}

function Icono({ d }) {
    return (
        <svg className="sidebar-icono" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={d} />
        </svg>
    );
}
