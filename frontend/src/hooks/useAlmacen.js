import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KANBANS, RANURAS, agregarKanbans, aplicarColores, quitarKanban } from '../data/kanbans';
import { extraerContenido, fechaLocal } from '../utils/contenido';

// Estado del almacén sincronizado con el backend (backend/server.js, MongoDB).
// Los cambios se aplican primero en pantalla y después se confirman con la API;
// tras cada operación se recarga la lista para reflejar movimientos y bolsas unidas.
// Además se refresca solo cada INTERVALO_REFRESCO ms (y al volver a la pestaña) para ver lo que hacen otros equipos.
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const RECEPCION = 'recepcion';
const INTERVALO_REFRESCO = 5000;

// Escrituras (POST/PATCH/PUT/DELETE) en curso y cuántas han empezado o terminado.
// El refresco automático se salta (o descarta su resultado) mientras haya una escritura,
// para no mostrar un dato viejo encima de un cambio que aún se está guardando.
let escrituras = 0;
let movimientoEscrituras = 0;

async function api(ruta, opciones = {}) {
    const escribe = !!opciones.method && opciones.method !== 'GET';
    if (escribe) {
        escrituras++;
        movimientoEscrituras++;
    }
    try {
        let res;
        try {
            res = await fetch(`${API}${ruta}`, {
                ...opciones,
                headers: opciones.body ? { 'Content-Type': 'application/json' } : undefined,
                body: opciones.body ? JSON.stringify(opciones.body) : undefined,
            });
        } catch {
            throw new Error('No se pudo conectar con el servidor.');
        }
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error ?? `El servidor respondió ${res.status}.`);
        }
        return res.status === 204 ? null : await res.json();
    } finally {
        if (escribe) {
            escrituras--;
            movimientoEscrituras++;
        }
    }
}

// Historial largo (la pantalla solo guarda los últimos 50) para exportar a Power BI
export const obtenerHistorialCompleto = () => api('/historial?limite=5000');

const aMapa = (lista) => Object.fromEntries(lista.map((a) => [a.id, a]));

export function useAlmacen() {
    const [articulos, setArticulos] = useState({});
    const [historial, setHistorial] = useState([]);
    const [error, setError] = useState(null);
    const [racks, setRacks] = useState(0); // versión de los racks agregados desde la app (fuerza el redibujo)
    const [racksCargados, setRacksCargados] = useState(false);
    const colores = useRef(new Map()); // ranura → color cambiado a mano
    const pendientes = useRef({}); // cambios de texto por guardar, por artículo: { timer, cambios }
    const pendientesBolsa = useRef({}); // cambios de piezas/peso por guardar, por "artículo:bolsa": { timer, cambios }

    const fallar = useCallback((err) => setError({ mensaje: err.message, id: Date.now() }), []);

    const secuencia = useRef(0); // recargas pedidas por acciones: solo vale la más reciente
    const firmaArticulos = useRef(''); // lo último que mandó el servidor, para no redibujar si no cambió
    const firmaRacks = useRef('');

    // `periodica`: refresco automático. Se salta si hay escrituras en curso o la pestaña está oculta,
    // y descarta su resultado si durante la espera hubo una acción del usuario (esa trae datos más nuevos).
    const recargar = useCallback(async (modo) => {
        const periodica = modo === 'periodica'; // cualquier otro valor (p. ej. el resultado de un .then) es una recarga normal
        if (periodica && (escrituras > 0 || document.hidden)) return;
        const miSecuencia = periodica ? secuencia.current : ++secuencia.current;
        const miMovimiento = movimientoEscrituras;
        try {
            const [lista, movimientos] = await Promise.all([api('/articulos'), api('/historial')]);
            // Una recarga más reciente ya está en camino o aplicada: esta respuesta quedó vieja
            if (miSecuencia !== secuencia.current) return;
            if (periodica) {
                if (escrituras > 0 || miMovimiento !== movimientoEscrituras) return;
                const firma = JSON.stringify([lista, movimientos]);
                if (firma === firmaArticulos.current) return;
                firmaArticulos.current = firma;
            } else {
                firmaArticulos.current = JSON.stringify([lista, movimientos]);
            }
            // Lo que se está escribiendo y aún no se guarda no debe "regresar" al valor del servidor
            const mapa = aMapa(lista);
            for (const [id, p] of Object.entries(pendientes.current)) if (mapa[id]) mapa[id] = { ...mapa[id], ...p.cambios };
            for (const [clave, p] of Object.entries(pendientesBolsa.current)) {
                const [id, idBolsa] = clave.split(':');
                if (mapa[id]) mapa[id] = { ...mapa[id], bolsas: mapa[id].bolsas.map((b) => (b.id === idBolsa ? { ...b, ...p.cambios } : b)) };
            }
            setArticulos(mapa);
            setHistorial(movimientos);
        } catch (err) {
            if (!periodica) fallar(err); // el refresco automático no avisa cada vez que el servidor no responde
        }
    }, [fallar]);

    // Racks agregados desde la app y colores cambiados a mano (los de kanbans.js son fijos).
    // En el refresco automático solo se redibuja si otro equipo cambió algo.
    const cargarRacks = useCallback(async (modo) => {
        const periodica = modo === 'periodica';
        if (periodica && (escrituras > 0 || document.hidden)) return;
        const miMovimiento = movimientoEscrituras;
        try {
            const [lista, cambios] = await Promise.all([api('/racks'), api('/colores')]);
            if (periodica) {
                if (escrituras > 0 || miMovimiento !== movimientoEscrituras) return;
                const firma = JSON.stringify([lista, cambios]);
                if (firma === firmaRacks.current) return;
                firmaRacks.current = firma;
            } else {
                firmaRacks.current = JSON.stringify([lista, cambios]);
            }
            // Racks que otro equipo eliminó
            const vigentes = new Set(lista.map((r) => `r${r.id}`));
            for (const k of [...KANBANS]) if (k.personalizado && !vigentes.has(k.id)) quitarKanban(k.id);
            agregarKanbans(lista);
            colores.current = new Map(cambios.map((c) => [c.ranura, c.color]));
            aplicarColores(colores.current);
            setRacks((v) => v + 1);
            setRacksCargados(true);
        } catch (err) {
            if (!periodica) fallar(err);
        }
    }, [fallar]);

    useEffect(() => {
        cargarRacks();
        recargar();
        const timers = pendientes.current;
        const timersBolsa = pendientesBolsa.current;
        return () => [...Object.values(timers), ...Object.values(timersBolsa)].forEach((p) => clearTimeout(p.timer));
    }, [recargar, cargarRacks]);

    // Refresco automático: cada pocos segundos y al volver a la pestaña o ventana
    useEffect(() => {
        const refrescar = () => {
            recargar('periodica');
            cargarRacks('periodica');
        };
        const reloj = setInterval(refrescar, INTERVALO_REFRESCO);
        const alVolver = () => !document.hidden && refrescar();
        document.addEventListener('visibilitychange', alVolver);
        window.addEventListener('focus', alVolver);
        return () => {
            clearInterval(reloj);
            document.removeEventListener('visibilitychange', alVolver);
            window.removeEventListener('focus', alVolver);
        };
    }, [recargar, cargarRacks]);

    // Lectura de código de barras. El backend decide:
    // nuevo → se crea en Recepción · existente → +1 en Recepción · salida → -1 si ya está en un rack
    const registrarLectura = useCallback(
        async (codigo, formato = 'Manual') => {
            const limpio = codigo.trim();
            if (!limpio) return null;
            try {
                // Si la etiqueta trae FECHA, LOTE, PIEZAS… se guardan como contenido del contenedor nuevo;
                // sin FECHA en la etiqueta se pone la de hoy (fecha local del equipo que escanea)
                const contenido = { fecha: fechaLocal(), ...extraerContenido(limpio) };
                const res = await api('/articulos', { method: 'POST', body: { codigo: limpio, formato, contenido } });
                await recargar();
                return res;
            } catch (err) {
                fallar(err);
                return null;
            }
        },
        [recargar, fallar],
    );

    // Mueve a Recepción o a una ranura. Una ranura admite varios códigos y cualquier cantidad de bolsas;
    // si ya hay uno igual, el backend junta sus bolsas.
    const mover = useCallback(
        async (idArticulo, destino) => {
            if (destino !== RECEPCION && !RANURAS.has(destino)) return;
            setArticulos((s) => {
                const art = s[idArticulo];
                if (!art || art.ubicacion === destino) return s;
                return { ...s, [idArticulo]: { ...art, ubicacion: destino } };
            });
            try {
                await api(`/articulos/${idArticulo}`, { method: 'PATCH', body: { ubicacion: destino } });
            } catch (err) {
                fallar(err);
            }
            await recargar();
        },
        [recargar, fallar],
    );

    // Cantidad se guarda al momento; descripción y contenido esperan a que se deje de escribir.
    // Los cambios de texto se acumulan: editar LOTE y luego OPER rápido guarda ambos.
    const actualizar = useCallback(
        (idArticulo, cambios) => {
            setArticulos((s) => (s[idArticulo] ? { ...s, [idArticulo]: { ...s[idArticulo], ...cambios } } : s));
            const enviar = (cuerpo) =>
                api(`/articulos/${idArticulo}`, { method: 'PATCH', body: cuerpo }).catch((err) => {
                    fallar(err);
                    recargar();
                });
            if ('descripcion' in cambios || 'contenido' in cambios) {
                const previo = pendientes.current[idArticulo];
                clearTimeout(previo?.timer);
                const acumulado = { ...previo?.cambios, ...cambios };
                pendientes.current[idArticulo] = {
                    cambios: acumulado,
                    timer: setTimeout(() => {
                        delete pendientes.current[idArticulo];
                        enviar(acumulado);
                    }, 500),
                };
            } else {
                // Cambiar la cantidad agrega o quita bolsas en el servidor: se recarga para tenerlas con su id
                enviar(cambios).then(recargar);
            }
        },
        [recargar, fallar],
    );

    // Piezas o peso de una bolsa: se ven al momento y se guardan cuando se deja de escribir
    const actualizarBolsa = useCallback(
        (idArticulo, idBolsa, cambios) => {
            setArticulos((s) =>
                s[idArticulo]
                    ? { ...s, [idArticulo]: { ...s[idArticulo], bolsas: s[idArticulo].bolsas.map((b) => (b.id === idBolsa ? { ...b, ...cambios } : b)) } }
                    : s,
            );
            const clave = `${idArticulo}:${idBolsa}`;
            const previo = pendientesBolsa.current[clave];
            clearTimeout(previo?.timer);
            const acumulado = { ...previo?.cambios, ...cambios };
            pendientesBolsa.current[clave] = {
                cambios: acumulado,
                timer: setTimeout(() => {
                    delete pendientesBolsa.current[clave];
                    api(`/articulos/${idArticulo}/bolsas/${idBolsa}`, { method: 'PATCH', body: acumulado })
                        .then(recargar)
                        .catch((err) => {
                            fallar(err);
                            recargar();
                        });
                }, 500),
            };
        },
        [recargar, fallar],
    );

    // Salida de material: { bolsas: [ids] } saca esas bolsas completas;
    // { bolsa, piezas } saca piezas de una sola bolsa (las demás no cambian).
    // Si no queda ninguna bolsa, el artículo sale y la ranura queda libre.
    const darSalida = useCallback(
        async (idArticulo, { bolsas: ids, bolsa, piezas }) => {
            try {
                const res = piezas
                    ? await api(`/articulos/${idArticulo}/salida-piezas`, { method: 'POST', body: { bolsa, piezas } })
                    : await api(`/articulos/${idArticulo}/salida`, { method: 'POST', body: { bolsas: ids } });
                await recargar();
                return res;
            } catch (err) {
                fallar(err);
                await recargar();
                return null;
            }
        },
        [recargar, fallar],
    );

    // Nuevo rack: se guarda en el backend y se suma a KANBANS
    const crearRack = useCallback(
        async (rack) => {
            try {
                const nuevo = await api('/racks', { method: 'POST', body: rack });
                agregarKanbans([nuevo]);
                aplicarColores(colores.current);
                setRacks((v) => v + 1);
                await recargar();
                return `r${nuevo.id}`;
            } catch (err) {
                fallar(err);
                return null;
            }
        },
        [recargar, fallar],
    );

    // Edición: si se retiran ranuras ocupadas, el backend regresa sus artículos a Recepción
    const editarRack = useCallback(
        async (rackId, rack) => {
            try {
                const res = await api(`/racks/${rackId}`, { method: 'PUT', body: rack });
                agregarKanbans([res.rack]);
                aplicarColores(colores.current);
                setRacks((v) => v + 1);
                await recargar();
                return res;
            } catch (err) {
                fallar(err);
                return null;
            }
        },
        [recargar, fallar],
    );

    const eliminarRack = useCallback(
        async (rackId) => {
            try {
                const res = await api(`/racks/${rackId}`, { method: 'DELETE' });
                quitarKanban(`r${rackId}`);
                setRacks((v) => v + 1);
                await recargar();
                return res;
            } catch (err) {
                fallar(err);
                return null;
            }
        },
        [recargar, fallar],
    );

    // Pinta contenedores: [{ ranura, color }]; si el color es el original del rack se borra el cambio
    const pintar = useCallback(
        async (lista) => {
            const cambios = lista
                .filter((c) => RANURAS.has(c.ranura))
                .map((c) => ({ ranura: c.ranura, color: c.color === (RANURAS.get(c.ranura).base ?? RANURAS.get(c.ranura).color) ? null : c.color }));
            if (!cambios.length) return;
            const anteriores = new Map(colores.current);
            for (const c of cambios) {
                if (c.color) colores.current.set(c.ranura, c.color);
                else colores.current.delete(c.ranura);
            }
            aplicarColores(colores.current);
            setRacks((v) => v + 1);
            try {
                await api('/colores', { method: 'PUT', body: { cambios } });
            } catch (err) {
                fallar(err);
                colores.current = anteriores;
                aplicarColores(colores.current);
                setRacks((v) => v + 1);
            }
        },
        [fallar],
    );

    const eliminar = useCallback(
        async (idArticulo) => {
            setArticulos(({ [idArticulo]: _, ...resto }) => resto);
            try {
                await api(`/articulos/${idArticulo}`, { method: 'DELETE' });
            } catch (err) {
                fallar(err);
            }
            await recargar();
        },
        [recargar, fallar],
    );

    // Índices derivados. Un artículo cuya ranura ya no existe (rack editado en kanbans.js o borrado)
    // no se puede dibujar en ningún rack: se muestra en Recepción para que no quede invisible.
    const huerfano = useCallback((a) => a.ubicacion !== RECEPCION && racksCargados && !RANURAS.has(a.ubicacion), [racksCargados]);

    // ranura → lista de artículos que contiene (puede tener varios códigos), del más antiguo al más nuevo
    const porRanura = useMemo(() => {
        const mapa = new Map();
        for (const a of Object.values(articulos)) {
            if (a.ubicacion === RECEPCION || !RANURAS.has(a.ubicacion)) continue;
            if (!mapa.has(a.ubicacion)) mapa.set(a.ubicacion, []);
            mapa.get(a.ubicacion).push(a);
        }
        for (const lista of mapa.values()) lista.sort((x, y) => String(x.registrado).localeCompare(String(y.registrado)));
        return mapa;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [articulos, racks]);

    const enRecepcion = useMemo(
        () =>
            Object.values(articulos)
                .filter((a) => a.ubicacion === RECEPCION || huerfano(a))
                .map((a) => (huerfano(a) ? { ...a, huerfano: true } : a))
                .sort((a, b) => String(b.registrado).localeCompare(String(a.registrado))),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [articulos, huerfano, racks],
    );

    return {
        articulos,
        historial,
        porRanura,
        enRecepcion,
        error,
        racks,
        crearRack,
        editarRack,
        eliminarRack,
        pintar,
        registrarLectura,
        mover,
        actualizar,
        actualizarBolsa,
        eliminar,
        darSalida,
    };
}
