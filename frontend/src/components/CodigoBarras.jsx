import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

// Dibuja el código leído como barras CODE128 (acepta cualquier texto ASCII).
export default function CodigoBarras({ valor, alto = 56, ancho = 1.6, mostrarTexto = true, className = '' }) {
    const svg = useRef(null);
    const [invalido, setInvalido] = useState(false);

    useEffect(() => {
        if (!svg.current || !valor) return;
        try {
            svg.current.replaceChildren(); // limpia el dibujo anterior si el nuevo código falla a medias
            JsBarcode(svg.current, valor, {
                format: 'CODE128',
                height: alto,
                width: ancho,
                margin: 0,
                displayValue: mostrarTexto,
                font: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
                fontSize: 13,
                textMargin: 4,
                lineColor: '#1d1d1f',
                background: 'transparent',
            });
            setInvalido(false);
        } catch {
            setInvalido(true);
        }
    }, [valor, alto, ancho, mostrarTexto]);

    // El <svg> siempre se queda montado: si se quitara, el efecto no podría dibujar el siguiente código válido
    return (
        <>
            {invalido && <span className="codigo-mono">{valor}</span>}
            <svg ref={svg} className={`codigo-barras ${className}`} role="img" aria-label={`Código ${valor}`} hidden={invalido} />
        </>
    );
}
