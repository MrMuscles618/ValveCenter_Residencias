// Contenido de los contenedores: campos de la etiqueta (todos opcionales) y lectura
// de esos campos a partir del texto de un código escaneado.

// PESO y PIEZAS (`porBolsa`) se leen de la etiqueta y son el valor inicial de cada bolsa nueva;
// después cada bolsa lleva sus propias piezas y peso (articulo.bolsas) y se editan por separado.
export const CAMPOS_CONTENIDO = [
    { id: 'fecha', etiqueta: 'Fecha', tipo: 'date', bloqueado: true }, // automática, no se edita
    { id: 'peso', etiqueta: 'Peso', tipo: 'number', porBolsa: true },
    { id: 'lote', etiqueta: 'Lote', tipo: 'text' },
    { id: 'piezas', etiqueta: 'Piezas', tipo: 'number', porBolsa: true },
    { id: 'ppp', etiqueta: 'PPP', ayuda: 'peso por pieza', tipo: 'text' },
    { id: 'oper', etiqueta: 'Operación', tipo: 'text' },
];

// La cantidad de cada código son bolsas con material; cada bolsa tiene sus piezas y su peso
export const bolsas = (n) => `${n} bolsa${n === 1 ? '' : 's'}`;
export const pz = (n) => `${n.toLocaleString('es-MX')} pz`;
export const kg = (n) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg`;

// Suma de un campo de las bolsas (piezas o peso); null si ninguna bolsa lo tiene capturado
const sumar = (articulo, campo) => {
    const valores = (articulo?.bolsas ?? []).map((b) => b[campo]).filter((v) => v !== null && v !== undefined);
    return valores.length ? valores.reduce((s, v) => s + v, 0) : null;
};
export const totalPiezas = (articulo) => sumar(articulo, 'piezas');
export const totalPeso = (articulo) => {
    const t = sumar(articulo, 'peso');
    return t === null ? null : Math.round(t * 1000) / 1000;
};

// Peso de una bolsa para mostrar: "NA" si quedó bloqueado tras una salida de piezas, '' si no se capturó
export const pesoTexto = (bolsa) => (bolsa?.pesoBloqueado ? 'NA' : bolsa?.peso !== null && bolsa?.peso !== undefined ? kg(bolsa.peso) : '');

// "690 pz · 37.5 kg" con lo que esté capturado; '' si nada.
// Las bolsas con peso NA no suman: se indica con "+ NA" para que el total no parezca completo.
export const resumenTotales = (articulo) => {
    const p = totalPiezas(articulo);
    const k = totalPeso(articulo);
    const hayNA = (articulo?.bolsas ?? []).some((b) => b.pesoBloqueado);
    const peso = k !== null ? `${kg(k)}${hayNA ? ' + NA' : ''}` : hayNA ? 'peso NA' : '';
    return [p !== null && pz(p), peso].filter(Boolean).join(' · ');
};

// Clave FIFO de una bolsa: su FECHA y cuándo llegó. Sin FECHA se usa el día en que llegó;
// si tampoco se sabe eso, va al final (no debe colarse como la más antigua).
export const fechaBolsa = (bolsa) => bolsa?.fecha || (bolsa?.registrado ? fechaLocal(bolsa.registrado) : '') || '9999-99-99';
export const claveFifoBolsa = (bolsa) => `${fechaBolsa(bolsa)} ${String(bolsa?.registrado ?? '')}`;
export const ordenarBolsasFifo = (lista) => [...(lista ?? [])].sort((a, b) => claveFifoBolsa(a).localeCompare(claveFifoBolsa(b)));

// La bolsa que sale primero de un contenedor (la más antigua que queda)
export const bolsaMasAntigua = (articulo) => ordenarBolsasFifo(articulo?.bolsas)[0] ?? null;

// Clave para ordenar contenedores por antigüedad (FIFO): la de su bolsa más antigua que queda.
// Sin bolsas se usa la FECHA del contenedor.
export const claveFifo = (articulo) => {
    const primera = bolsaMasAntigua(articulo);
    return primera ? claveFifoBolsa(primera) : `${contenidoDe(articulo).fecha} ${String(articulo?.registrado ?? '')}`;
};

// Días transcurridos desde una fecha AAAA-MM-DD (hoy = 0); null si no hay fecha
export const diasDesde = (fecha) => {
    const [a, m, d] = String(fecha ?? '').split('-').map(Number);
    if (!a || !m || !d) return null;
    const hoy = new Date();
    return Math.max(0, Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - new Date(a, m - 1, d)) / 86400000));
};
export const textoDias = (n) => (n === null ? '' : n === 0 ? 'hoy' : n === 1 ? '1 día' : `${n} días`);

// Fecha local en formato AAAA-MM-DD (sin el desfase de toISOString, que usa UTC)
export const fechaLocal = (d = new Date()) => {
    const f = new Date(d);
    if (Number.isNaN(f.getTime())) return '';
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

// Contenido para mostrar: si no tiene FECHA se usa el día en que se registró el contenedor
export const contenidoDe = (articulo) => ({
    ...articulo?.contenido,
    fecha: articulo?.contenido?.fecha || fechaLocal(articulo?.registrado),
});

// Número de parte: lo que va antes del primer apóstrofe o guion del código (004977004631'117 → 004977004631).
// null si el código no trae ninguno de esos separadores.
const SEPARADORES_PARTE = ["'", '’', '‘', '`', '´', '-', '–', '—'];
export const numeroParte = (codigo) => {
    const texto = String(codigo ?? '');
    const pos = texto.split('').findIndex((c) => SEPARADORES_PARTE.includes(c));
    return pos > 0 ? texto.slice(0, pos).trim() || null : null;
};

// Piezas que trae el código: lo que va después del apóstrofe o guion (004977004631'117 → 117).
// Ese valor es la cantidad de piezas de la bolsa (confirmado por el usuario). Solo cuenta con número de parte y
// piezas numéricos (así un código como "ABC-1" no se interpreta como 1 pieza); null si no cumple.
export const piezasDelCodigo = (codigo) => {
    const texto = String(codigo ?? '').trim();
    const parte = numeroParte(texto);
    if (!parte || !/^\d+$/.test(parte)) return null;
    // Lo que sigue al separador (el primer carácter después del número de parte, con o sin espacios antes)
    const resto = texto.slice(texto.indexOf(parte) + parte.length).trim().slice(1).trim();
    return /^\d{1,6}$/.test(resto) && Number(resto) > 0 ? Number(resto) : null;
};

// Valor legible de un campo; '' si está vacío
export const valorCampo = (contenido, id) => {
    const v = contenido?.[id];
    if (v === null || v === undefined || v === '') return '';
    if (id === 'fecha') {
        const [a, m, d] = String(v).split('-');
        return d ? `${d}/${m}/${a}` : String(v);
    }
    return String(v);
};

// Lista corta para mostrar: [['Lote', 'A42'], …] solo con los campos que tienen valor
// (sin PESO ni PIEZAS: esos se muestran por bolsa)
export const resumenContenido = (contenido) =>
    CAMPOS_CONTENIDO.filter((c) => !c.porBolsa)
        .map((c) => [c.etiqueta, valorCampo(contenido, c.id)])
        .filter(([, v]) => v);

// Identificadores de aplicación GS1 más comunes en etiquetas de almacén
export const GS1 = {
    '00': 'SSCC', '01': 'GTIN', '02': 'GTIN contenido', '10': 'Lote', '11': 'Fecha producción',
    '13': 'Fecha empaque', '15': 'Consumir antes de', '17': 'Caducidad', '21': 'Serie',
    '30': 'Cantidad', '37': 'Unidades', '240': 'ID adicional', '241': 'Parte cliente',
    '400': 'Orden de compra', '410': 'Enviar a (GLN)', '414': 'Ubicación (GLN)',
};

// Devuelve [[clave, valor], …] si el texto tiene estructura reconocible, o null si es un código simple
export function interpretarContenido(texto) {
    // JSON plano
    if (/^\s*\{/.test(texto)) {
        try {
            const obj = JSON.parse(texto);
            const pares = Object.entries(obj).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
            if (pares.length) return pares;
        } catch {
            /* no es JSON válido */
        }
    }
    // GS1 legible: (01)07501234567890(10)LOTE42
    const gs1 = [...texto.matchAll(/\((\d{2,4})\)([^(]*)/g)];
    if (gs1.length && gs1.map((m) => m[0]).join('') === texto.trim()) {
        return gs1.map(([, ia, valor]) => [`${GS1[ia] ?? 'IA'} (${ia})`, valor]);
    }
    // clave:valor o clave=valor separados por | ; , o saltos de línea
    const partes = texto.split(/[|;\n\r\t]+|,(?=\s*[^,:=|;\n\r\t]+[:=])/).map((p) => p.trim()).filter(Boolean);
    if (partes.length >= 2) {
        const pares = partes.map((p) => p.match(/^([^:=]{1,30})\s*[:=]\s*(.*)$/));
        if (pares.every(Boolean)) return pares.map(([, k, v]) => [k.trim(), v.trim()]);
        // Campos sin clave, separados por |: se numeran
        if (texto.includes('|')) return partes.map((p, i) => [`Campo ${i + 1}`, p]);
    }
    return null;
}

// Nombres con los que cada campo puede venir en la etiqueta (sin acentos, en mayúsculas)
const ALIAS = {
    fecha: ['FECHA', 'FEC', 'DATE', 'FECHA PRODUCCION', 'F PROD'],
    peso: ['PESO', 'WEIGHT', 'PESO KG', 'KG', 'WT'],
    lote: ['LOTE', 'LOT', 'BATCH', 'NO LOTE'],
    piezas: ['PIEZAS', 'PZS', 'PZ', 'PIEZA', 'PCS', 'QTY', 'CANT', 'CANTIDAD'],
    ppp: ['PPP', 'PESO POR PIEZA', 'PESO PIEZA'],
    oper: ['OPER', 'OPERACION', 'OP', 'OPERATION'],
};
const CAMPO_DE_ALIAS = new Map(Object.entries(ALIAS).flatMap(([campo, nombres]) => nombres.map((n) => [n, campo])));
// Identificadores GS1 que corresponden a un campo
const CAMPO_DE_GS1 = { 10: 'lote', 11: 'fecha', 30: 'piezas', 37: 'piezas' };

const normalizarClave = (k) =>
    k.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

// Acepta AAAA-MM-DD, DD/MM/AAAA, DD-MM-AA y AAMMDD (GS1); devuelve AAAA-MM-DD o ''
export function normalizarFecha(texto) {
    const t = String(texto).trim();
    let a, m, d;
    let r;
    if ((r = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [, a, m, d] = r;
    else if ((r = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) [, d, m, a] = r;
    else if ((r = t.match(/^(\d{2})(\d{2})(\d{2})$/))) [, a, m, d] = r;
    else return '';
    if (a.length === 2) a = `20${a}`;
    const fecha = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const prueba = new Date(`${fecha}T00:00:00Z`);
    return !Number.isNaN(prueba.getTime()) && prueba.toISOString().startsWith(fecha) ? fecha : '';
}

// Número de un texto como "12.5 kg" o "12,5"; null si no hay
const numero = (texto) => {
    const r = String(texto).replace(',', '.').match(/\d+(\.\d+)?/);
    return r ? Number(r[0]) : null;
};

// Convierte un valor leído al tipo del campo; undefined si no es válido
function convertir(campo, valor) {
    const v = String(valor ?? '').trim();
    if (!v) return undefined;
    if (campo === 'fecha') return normalizarFecha(v) || undefined;
    if (campo === 'peso') return numero(v) ?? undefined;
    if (campo === 'piezas') {
        const n = numero(v);
        return n !== null && Number.isInteger(n) ? n : undefined;
    }
    return v.slice(0, 60);
}

// Campos de contenido reconocidos en el texto escaneado: { lote: 'A42', piezas: 10, … } o null
export function extraerContenido(texto) {
    const contenido = {};
    const gs1 = [...String(texto).matchAll(/\((\d{2,4})\)([^(]*)/g)];
    if (gs1.length && gs1.map((m) => m[0]).join('') === String(texto).trim()) {
        for (const [, ia, valor] of gs1) {
            const campo = CAMPO_DE_GS1[ia];
            const v = campo && convertir(campo, valor);
            if (v !== undefined && contenido[campo] === undefined) contenido[campo] = v;
        }
    } else {
        for (const [clave, valor] of interpretarContenido(texto) ?? []) {
            const campo = CAMPO_DE_ALIAS.get(normalizarClave(clave));
            const v = campo && convertir(campo, valor);
            if (v !== undefined && contenido[campo] === undefined) contenido[campo] = v;
        }
    }
    // Sin PIEZAS explícitas en la etiqueta, se usan las del propio código (lo que va tras el apóstrofe o guion)
    if (contenido.piezas === undefined) {
        const delCodigo = piezasDelCodigo(texto);
        if (delCodigo !== null) contenido.piezas = delCodigo;
    }
    return Object.keys(contenido).length ? contenido : null;
}
