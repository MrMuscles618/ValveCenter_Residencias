import { KANBANS, idRanura, textoMovimiento } from '../data/kanbans';
import { RECEPCION } from '../hooks/useAlmacen';
import { contenidoDe, fechaLocal, totalPeso, totalPiezas, valorCampo } from './contenido';

// Comunicación directa con la API REST de Power BI desde el navegador.
// El usuario inicia sesión con su cuenta Microsoft (MSAL) y se usa su permiso delegado.
// Configuración: variables VITE_POWERBI_* en frontend/.env. Hoy el menú solo ofrece "Exportar archivo".
const CONFIG = {
    clientId: import.meta.env.VITE_POWERBI_CLIENT_ID,
    tenantId: import.meta.env.VITE_POWERBI_TENANT_ID,
    workspaceId: import.meta.env.VITE_POWERBI_WORKSPACE_ID, // vacío = "Mi área de trabajo"
    dataset: import.meta.env.VITE_POWERBI_DATASET_NAME || 'Almacen Valve Center',
};
const API = 'https://api.powerbi.com/v1.0/myorg';
const SCOPES = ['https://analysis.windows.net/powerbi/api/Dataset.ReadWrite.All'];
const FILAS_POR_LOTE = 10000; // límite de la API por petición de filas

// Esquema de las tablas: el mismo para el dataset de Power BI y para el archivo exportado
export const TABLAS = [
    {
        name: 'Articulos',
        columns: [
            { name: 'Id', dataType: 'String' },
            { name: 'Codigo', dataType: 'String' },
            { name: 'Descripcion', dataType: 'String' },
            { name: 'Cantidad', dataType: 'Int64' },
            { name: 'Fecha', dataType: 'DateTime' },
            { name: 'Lote', dataType: 'String' },
            { name: 'PiezasTotales', dataType: 'Int64' },
            { name: 'PesoTotal', dataType: 'Double' },
            { name: 'DetalleBolsas', dataType: 'String' }, // "1: 230 pz 12 kg | 2: 200 pz 10.4 kg"
            { name: 'PPP', dataType: 'String' },
            { name: 'Operacion', dataType: 'String' },
            { name: 'Formato', dataType: 'String' },
            { name: 'Registrado', dataType: 'DateTime' },
            { name: 'Estado', dataType: 'String' },
            { name: 'IdRanura', dataType: 'String' },
            { name: 'Kanban', dataType: 'String' },
            { name: 'Modulo', dataType: 'String' },
            { name: 'Ranura', dataType: 'String' },
        ],
    },
    {
        name: 'Ranuras',
        columns: [
            { name: 'IdRanura', dataType: 'String' },
            { name: 'Kanban', dataType: 'String' },
            { name: 'Lineas', dataType: 'String' },
            { name: 'Modulo', dataType: 'String' },
            { name: 'Ranura', dataType: 'String' },
            { name: 'Nivel', dataType: 'Int64' },
            { name: 'Color', dataType: 'String' },
            { name: 'Ocupada', dataType: 'Boolean' },
            { name: 'Codigo', dataType: 'String' },
            { name: 'Cantidad', dataType: 'Int64' },
        ],
    },
    {
        name: 'Movimientos',
        columns: [
            { name: 'Id', dataType: 'String' },
            { name: 'Fecha', dataType: 'DateTime' },
            { name: 'Descripcion', dataType: 'String' },
        ],
    },
];

// Convierte el estado del almacén en filas planas por tabla
export function construirTablas(articulos, historial) {
    const lista = Object.values(articulos);
    // Una ranura puede tener varios códigos
    const porRanura = new Map();
    for (const a of lista.filter((x) => x.ubicacion !== RECEPCION)) porRanura.set(a.ubicacion, [...(porRanura.get(a.ubicacion) ?? []), a]);
    const infoRanura = new Map();

    const Ranuras = KANBANS.flatMap((kanban) =>
        kanban.modulos.flatMap((modulo) =>
            modulo.niveles.flatMap((nivel, i) =>
                nivel.map((r) => {
                    const id = idRanura(modulo, r.etiqueta);
                    const arts = porRanura.get(id) ?? [];
                    infoRanura.set(id, { Kanban: kanban.nombre, Modulo: modulo.nombre, Ranura: r.etiqueta });
                    return {
                        IdRanura: id,
                        Kanban: kanban.nombre,
                        Lineas: kanban.lineas.join(', '),
                        Modulo: modulo.nombre,
                        Ranura: r.etiqueta,
                        Nivel: i + 1,
                        Color: r.color,
                        Ocupada: arts.length > 0,
                        Codigo: arts.map((a) => a.codigo).join(', ') || null,
                        Cantidad: arts.reduce((t, a) => t + a.cantidad, 0),
                    };
                }),
            ),
        ),
    );

    const Articulos = lista.map((a) => {
        const enRack = a.ubicacion !== RECEPCION;
        return {
            Id: a.id,
            Codigo: a.codigo,
            Descripcion: a.descripcion || null,
            Cantidad: a.cantidad,
            Fecha: contenidoDe(a).fecha || null,
            Lote: valorCampo(a.contenido, 'lote') || null,
            PiezasTotales: totalPiezas(a),
            PesoTotal: totalPeso(a),
            DetalleBolsas:
                (a.bolsas ?? [])
                    .map((b, i) => `${i + 1}: ${b.piezas ?? '—'} pz${b.pesoBloqueado ? ' NA' : b.peso !== null ? ` ${b.peso} kg` : ''}`)
                    .join(' | ') || null,
            PPP: valorCampo(a.contenido, 'ppp') || null,
            Operacion: valorCampo(a.contenido, 'oper') || null,
            Formato: a.formato,
            Registrado: a.registrado,
            Estado: enRack ? 'Ubicado' : 'En recepción',
            IdRanura: enRack ? a.ubicacion : null,
            Kanban: null,
            Modulo: null,
            Ranura: null,
            ...(enRack ? infoRanura.get(a.ubicacion) : {}),
        };
    });

    const Movimientos = historial.map((h) => ({ Id: h.id, Fecha: h.fecha, Descripcion: textoMovimiento(h.texto) }));

    return { Articulos, Ranuras, Movimientos };
}

// ---------- Exportar archivo ----------

// Libro de Excel con una hoja por tabla; Power BI Desktop lo abre con
// "Obtener datos → Libro de Excel" y muestra Articulos, Ranuras y Movimientos una sola vez.
export async function exportarArchivo(articulos, historial) {
    const { default: ExcelJS } = await import('exceljs');
    const datos = construirTablas(articulos, historial);
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Valve Center Digital';
    libro.created = new Date();

    for (const tabla of TABLAS) {
        const hoja = libro.addWorksheet(tabla.name);
        const filas = datos[tabla.name].map((f) =>
            tabla.columns.map((c) => (c.dataType === 'DateTime' && f[c.name] ? new Date(f[c.name]) : f[c.name])),
        );
        // Solo hoja con encabezados (sin "Tabla de Excel"): si hubiera hoja y tabla con el mismo
        // nombre, Power BI mostraría ambas y las duplicaría como "Articulos" y "Articulos1"
        const encabezado = hoja.addRow(tabla.columns.map((c) => c.name));
        encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0071E3' } };
        hoja.addRows(filas);
        hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: tabla.columns.length } };
        tabla.columns.forEach((c, i) => {
            const col = hoja.getColumn(i + 1);
            col.width = Math.max(12, c.name.length + 4);
            if (c.dataType === 'DateTime') col.numFmt = 'yyyy-mm-dd hh:mm:ss';
        });
        hoja.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const nombre = `almacen-powerbi-${fechaLocal()}.xlsx`;
    const blob = new Blob([await libro.xlsx.writeBuffer()], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: nombre }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return nombre;
}

// ---------- Publicar en Power BI ----------

let msal = null;

async function obtenerToken() {
    if (!CONFIG.clientId || !CONFIG.tenantId) {
        throw new Error('Power BI no está configurado (VITE_POWERBI_CLIENT_ID / VITE_POWERBI_TENANT_ID).');
    }
    if (!msal) {
        const { PublicClientApplication } = await import('@azure/msal-browser');
        msal = new PublicClientApplication({
            auth: {
                clientId: CONFIG.clientId,
                authority: `https://login.microsoftonline.com/${CONFIG.tenantId}`,
                redirectUri: window.location.origin,
            },
            cache: { cacheLocation: 'localStorage' },
        });
        await msal.initialize();
    }
    const cuenta = msal.getAllAccounts()[0];
    if (cuenta) {
        try {
            return (await msal.acquireTokenSilent({ scopes: SCOPES, account: cuenta })).accessToken;
        } catch {
            /* sesión vencida: se pide de nuevo con la ventana de inicio de sesión */
        }
    }
    try {
        return (await msal.acquireTokenPopup({ scopes: SCOPES })).accessToken;
    } catch (err) {
        throw new Error(
            err?.errorCode === 'user_cancelled' ? 'Inicio de sesión cancelado.' : 'No se pudo iniciar sesión en Power BI.',
        );
    }
}

async function llamar(token, metodo, ruta, cuerpo) {
    const res = await fetch(`${API}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(`Power BI respondió ${res.status}${json?.error?.code ? ` (${json.error.code})` : ''}.`);
    }
    return res.status === 200 || res.status === 201 ? res.json().catch(() => null) : null;
}

const rutaBase = () => (CONFIG.workspaceId ? `/groups/${encodeURIComponent(CONFIG.workspaceId)}` : '');

// Crea el dataset push si no existe y reemplaza el contenido de cada tabla
export async function publicarEnPowerBI(articulos, historial) {
    const token = await obtenerToken();
    const datos = construirTablas(articulos, historial);

    const lista = await llamar(token, 'GET', `${rutaBase()}/datasets`);
    let id = lista?.value?.find((d) => d.name === CONFIG.dataset)?.id;
    const creado = !id;
    if (creado) {
        const nuevo = await llamar(token, 'POST', `${rutaBase()}/datasets?defaultRetentionPolicy=None`, {
            name: CONFIG.dataset,
            defaultMode: 'Push',
            tables: TABLAS,
        });
        id = nuevo.id;
    }

    const filas = {};
    for (const tabla of TABLAS) {
        const ruta = `${rutaBase()}/datasets/${encodeURIComponent(id)}/tables/${tabla.name}`;
        if (!creado) {
            await llamar(token, 'PUT', ruta, tabla); // mantiene el esquema alineado
            await llamar(token, 'DELETE', `${ruta}/rows`);
        }
        const registros = datos[tabla.name];
        for (let i = 0; i < registros.length; i += FILAS_POR_LOTE) {
            await llamar(token, 'POST', `${ruta}/rows`, { rows: registros.slice(i, i + FILAS_POR_LOTE) });
        }
        filas[tabla.name] = registros.length;
    }
    return { dataset: CONFIG.dataset, creado, filas };
}
