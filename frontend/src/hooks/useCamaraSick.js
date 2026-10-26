import { useEffect, useRef, useState } from 'react';
import { MIN_LARGO_CAMARA, REGION_LECTURA, crearConfirmador, crearFiltroLecturas, extraerCodigos } from '../utils/camaraSick';

// Cámara SICK: transmite imágenes JPEG por WebSocket (no manda el código ya leído). Esta pantalla se conecta SOLO
// mientras el usuario tiene elegido el modo "Cámara", dibuja la imagen en un canvas y decodifica los códigos
// con ZXing (utils/lectorImagen.js). Al elegir otro modo se cierra la conexión: nada se enciende por su cuenta.
export const URL_CAMARA = import.meta.env.VITE_SICK_WS_URL || 'ws://192.168.136.100:8888/ws';

const MS_ENTRE_LECTURAS = 300; // cada cuánto se intenta decodificar el último fotograma
const SIN_IMAGEN_MS = 5000; // conectada pero sin recibir imágenes
const MAX_ANCHO = 2200; // la región de lectura más ancha que esto se reduce antes de decodificar

// Estados: apagada · conectando · leyendo · sinimagen · reconectando · sinlector (no cargó el decodificador)
export function useCamaraSick({ activa, lienzo, onCodigo, onLimite }) {
    const [estado, setEstado] = useState('apagada');
    const onCodigoRef = useRef(onCodigo);
    const onLimiteRef = useRef(onLimite);
    useEffect(() => {
        onCodigoRef.current = onCodigo;
        onLimiteRef.current = onLimite;
    });

    useEffect(() => {
        if (!activa) {
            setEstado('apagada');
            return undefined;
        }
        let cerrado = false;
        let ws = null;
        let reintento = null;
        let espera = 1000;
        let decodificar = null; // se asigna cuando carga ZXing
        let ocupado = false; // dibujando o decodificando: los fotogramas que llegan mientras tanto se descartan
        let nuevoCuadro = false;
        let ultimoCuadro = 0;
        let conectado = false; // el WebSocket está abierto ahora mismo
        let fase = 'conectando';
        const filtro = crearFiltroLecturas();
        const confirmador = crearConfirmador();
        const cambiar = (nueva) => {
            // Sin lector de códigos la imagen se sigue viendo, pero el aviso no debe volver a "leyendo"
            if (fase === 'sinlector') return;
            if (fase !== nueva) {
                fase = nueva;
                setEstado(nueva);
            }
        };
        setEstado('conectando');

        // Un código leído (de la imagen o de un mensaje de texto): antirrebote y freno de seguridad
        const aceptar = (codigo) => {
            const veredicto = filtro.aceptar(codigo);
            if (veredicto === 'nuevo') onCodigoRef.current(codigo);
            else if (veredicto === 'freno') {
                cerrado = true;
                ws?.close();
                onLimiteRef.current?.('Demasiadas lecturas seguidas: la cámara se apagó por seguridad. Revisa la imagen y vuelve a elegirla.');
            }
        };

        const dibujar = async (datos) => {
            const canvas = lienzo.current;
            if (!canvas) return;
            let bitmap;
            try {
                bitmap = await createImageBitmap(datos instanceof Blob ? datos : new Blob([datos]));
            } catch {
                return; // no era una imagen
            }
            if (cerrado || !lienzo.current) {
                bitmap.close();
                return;
            }
            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
            }
            canvas.getContext('2d', { willReadFrequently: true }).drawImage(bitmap, 0, 0);
            bitmap.close();
            nuevoCuadro = true;
            ultimoCuadro = Date.now();
            if (conectado) cambiar('leyendo'); // un fotograma que llega justo al caerse la conexión no cuenta
        };

        const conectar = () => {
            ws = new WebSocket(URL_CAMARA);
            ws.binaryType = 'blob';
            ws.onopen = () => {
                conectado = true;
                espera = 1000;
                cambiar('sinimagen');
                ultimoCuadro = Date.now();
            };
            ws.onmessage = async (evento) => {
                if (typeof evento.data === 'string') {
                    // Texto: una imagen en base64 o, si la cámara los manda, códigos ya leídos
                    const base64 = evento.data.replace(/^data:image\/[a-z]+;base64,/, '');
                    if (base64.startsWith('/9j/') && !ocupado) {
                        ocupado = true;
                        try {
                            await dibujar(await (await fetch(`data:image/jpeg;base64,${base64}`)).blob());
                        } finally {
                            ocupado = false;
                        }
                    } else {
                        for (const codigo of extraerCodigos(evento.data)) aceptar(codigo);
                    }
                    return;
                }
                if (ocupado) return; // la cámara manda más imágenes de las que se pueden mostrar: se usa la más reciente que alcance
                ocupado = true;
                try {
                    await dibujar(evento.data);
                } finally {
                    ocupado = false;
                }
            };
            ws.onerror = () => {};
            ws.onclose = () => {
                conectado = false;
                if (cerrado) return;
                cambiar('reconectando');
                reintento = setTimeout(conectar, espera);
                espera = Math.min(espera * 2, 10000);
            };
        };

        // Decodificación periódica del último fotograma
        const reloj = setInterval(() => {
            if (cerrado || !decodificar) return;
            if (fase === 'leyendo' && Date.now() - ultimoCuadro > SIN_IMAGEN_MS) cambiar('sinimagen');
            const canvas = lienzo.current;
            if (!nuevoCuadro || ocupado || !canvas || !canvas.width) return;
            nuevoCuadro = false;
            ocupado = true;
            try {
                // Solo se lee la región del recuadro (REGION_LECTURA), no toda la imagen
                const rx = Math.round(canvas.width * REGION_LECTURA.x);
                const ry = Math.round(canvas.height * REGION_LECTURA.y);
                const rw = Math.round(canvas.width * REGION_LECTURA.ancho);
                const rh = Math.round(canvas.height * REGION_LECTURA.alto);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                let imagen;
                if (rw > MAX_ANCHO) {
                    const reducido = document.createElement('canvas');
                    reducido.width = MAX_ANCHO;
                    reducido.height = Math.round((rh * MAX_ANCHO) / rw);
                    reducido.getContext('2d').drawImage(canvas, rx, ry, rw, rh, 0, 0, reducido.width, reducido.height);
                    imagen = reducido.getContext('2d').getImageData(0, 0, reducido.width, reducido.height);
                } else {
                    imagen = ctx.getImageData(rx, ry, rw, rh);
                }
                const leido = decodificar(imagen);
                const texto = leido?.texto.trim();
                // Un texto corto o que no se repite en lecturas seguidas es ruido, no una etiqueta
                if (texto && texto.length >= MIN_LARGO_CAMARA && confirmador.ver(texto)) aceptar(texto);
            } finally {
                ocupado = false;
            }
        }, MS_ENTRE_LECTURAS);

        // ZXing pesa bastante: se carga al encender la cámara, no al abrir la app
        import('../utils/lectorImagen')
            .then(({ crearLector }) => {
                if (!cerrado) decodificar = crearLector();
            })
            .catch(() => cambiar('sinlector')); // p. ej. el servidor se actualizó y el archivo del lector cambió de nombre
        conectar();

        return () => {
            cerrado = true;
            clearTimeout(reintento);
            clearInterval(reloj);
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, [activa, lienzo]);

    return { estado };
}
