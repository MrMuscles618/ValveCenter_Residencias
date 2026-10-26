import { useEffect, useRef, useState } from 'react';
import { exportarArchivo, publicarEnPowerBI } from '../utils/powerbi';
import { obtenerHistorialCompleto } from '../hooks/useAlmacen';

// Menú de la topbar: exportar el almacén a archivo o publicarlo en Power BI
export default function BotonPowerBI({ articulos, historial, onAviso }) {
    const [abierto, setAbierto] = useState(false);
    const [ocupado, setOcupado] = useState(null);
    const contenedor = useRef(null);

    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => !contenedor.current?.contains(e.target) && setAbierto(false);
        document.addEventListener('pointerdown', fuera);
        return () => document.removeEventListener('pointerdown', fuera);
    }, [abierto]);

    const ejecutar = async (accion) => {
        setOcupado(accion);
        try {
            if (accion === 'exportar') {
                // El libro lleva todo el historial, no solo los últimos movimientos que muestra la pantalla
                const completo = await obtenerHistorialCompleto().catch(() => historial);
                const nombre = await exportarArchivo(articulos, completo);
                onAviso(`Exportado ${nombre}`);
            } else {
                const r = await publicarEnPowerBI(articulos, historial);
                onAviso(`Publicado en Power BI: ${r.dataset} (${r.filas.Articulos} artículos)`);
            }
            setAbierto(false);
        } catch (err) {
            onAviso(err.message, 'error');
        } finally {
            setOcupado(null);
        }
    };

    return (
        <div className="powerbi" ref={contenedor}>
            <button
                className="btn-secondary btn-sm"
                onClick={() => setAbierto((v) => !v)}
                aria-expanded={abierto}
                aria-haspopup="menu"
                aria-label="Power BI"
                title="Power BI"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="4" y="12" width="4" height="8" rx="1" />
                    <rect x="10" y="8" width="4" height="12" rx="1" />
                    <rect x="16" y="4" width="4" height="16" rx="1" />
                </svg>
                <span className="powerbi-texto">Power BI</span>
            </button>
            {abierto && (
                <div className="glass-strong powerbi-menu" role="menu">
                    <button role="menuitem" disabled={!!ocupado} onClick={() => ejecutar('exportar')}>
                        <b>{ocupado === 'exportar' ? 'Exportando…' : 'Exportar archivo'}</b>
                        <span>Libro .xlsx con tablas para Power BI Desktop</span>
                    </button>
                </div>
            )}
        </div>
    );
}
