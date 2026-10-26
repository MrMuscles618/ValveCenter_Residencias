// Lógica pura (sin navegador) de la cámara SICK: qué se acepta como código y cuándo se frena.
// La cámara transmite imágenes JPEG por WebSocket; el código se decodifica de la imagen (utils/lectorImagen.js).
// Si algún día manda también texto con el código ya leído, extraerCodigos lo aprovecha.

// Lecturas fallidas que una cámara puede mandar en lugar de un código
const SIN_LECTURA = /^(no\s*-?\s*read|noread|no\s*code|error|null|none|undefined|\?+|-+)$/i;
// Separadores de mensaje: NUL, STX, ETX y saltos de línea (el resto, p. ej. GS de GS1, forma parte del código)
const SEPARADORES = /[\u0000\u0002\u0003\r\n]+/;
// Nombres con los que un mensaje JSON puede traer el código
const CAMPOS_CODIGO = new Set(['code', 'codigo', 'barcode', 'data', 'text', 'content', 'value', 'result', 'string', 'decoded', 'codecontent']);

// Un mensaje legible no trae caracteres de reemplazo (bytes que no eran texto) ni de control, salvo los
// separadores de protocolo: NUL, STX, ETX, tabulador, saltos de línea y GS. Una imagen siempre los trae.
function esMensajeLegible(texto) {
    for (const c of texto) {
        const n = c.codePointAt(0);
        const permitido = n === 0 || n === 2 || n === 3 || n === 9 || n === 10 || n === 13 || n === 0x1d;
        if (n === 0xfffd || n === 0x7f || (n < 0x20 && !permitido)) return false;
    }
    return true;
}

// Un código de barras es texto legible: sin caracteres de reemplazo ni de control (salvo GS) y con al menos
// una letra o un número. Así los datos binarios nunca se registran como código.
export function esCodigoValido(codigo) {
    if (typeof codigo !== 'string' || codigo.length === 0 || codigo.length > 500 || !/[\p{L}\p{N}]/u.test(codigo)) return false;
    for (const c of codigo) {
        const n = c.codePointAt(0);
        if ((n < 0x20 && n !== 0x1d) || n === 0x7f || n === 0xfffd) return false;
    }
    return true;
}

function buscarEnJson(valor, salida) {
    if (Array.isArray(valor)) valor.forEach((v) => buscarEnJson(v, salida));
    else if (valor && typeof valor === 'object') {
        for (const [clave, v] of Object.entries(valor)) {
            if (CAMPOS_CODIGO.has(clave.toLowerCase()) && (typeof v === 'string' || typeof v === 'number')) salida.push(String(v));
            else if (v && typeof v === 'object') buscarEnJson(v, salida);
        }
    }
}

// Códigos de un mensaje de texto: texto plano (uno por línea) o JSON con el código en un campo conocido.
// Devuelve [] si no trae ninguno (lectura fallida, estado, datos binarios, formato desconocido).
export function extraerCodigos(crudo) {
    const texto = String(crudo ?? '').trim();
    if (!esMensajeLegible(texto)) return [];
    let candidatos = [];
    if (/^[[{]/.test(texto)) {
        try {
            buscarEnJson(JSON.parse(texto), candidatos);
        } catch {
            candidatos = texto.split(SEPARADORES);
        }
    } else {
        candidatos = texto.split(SEPARADORES);
    }
    return candidatos.map((c) => c.trim()).filter((c) => c && !SIN_LECTURA.test(c) && esCodigoValido(c));
}

// Zona de la imagen donde se lee, en fracciones del ancho y del alto (es el recuadro que se dibuja sobre la imagen).
// Solo se decodifica lo que está dentro: así la piel, la ropa o el fondo no producen lecturas falsas.
export const REGION_LECTURA = { x: 0.1, y: 0.2, ancho: 0.8, alto: 0.6 };
// Los códigos de las etiquetas tienen varios caracteres; uno más corto casi seguro es una lectura falsa
export const MIN_LARGO_CAMARA = 6;

// Confirmación: una lectura solo vale si el MISMO texto se decodifica en `aciertos` intentos dentro de `ventanaMs`.
// Un código de verdad se lee una y otra vez mientras está a la vista; una lectura falsa del ruido casi nunca se repite igual.
export function crearConfirmador({ aciertos = 2, ventanaMs = 1500 } = {}) {
    const vistos = new Map(); // texto → { n, t }
    return {
        ver(texto, ahora = Date.now()) {
            for (const [k, v] of vistos) if (ahora - v.t > ventanaMs) vistos.delete(k);
            const previo = vistos.get(texto);
            const n = (previo?.n ?? 0) + 1;
            if (n >= aciertos) {
                vistos.delete(texto);
                return true;
            }
            vistos.set(texto, { n, t: ahora });
            return false;
        },
    };
}

// Antirrebote y freno de la cámara. `aceptar(codigo, ahora)` devuelve:
//   'nuevo'   → registrar la lectura
//   'repetido'→ la misma lectura sigue a la vista: se ignora (cada repetición alarga la espera)
//   'freno'   → demasiadas lecturas seguidas: algo anda mal, hay que apagar la cámara
// Una cámara no lee más de unas pocas bolsas por segundo; si llegan muchas, no se llena la base de datos.
export function crearFiltroLecturas({ repetidoMs = 3000, maxLecturas = 10, ventanaMs = 10000 } = {}) {
    let ultima = { codigo: '', t: 0 };
    let recientes = [];
    return {
        aceptar(codigo, ahora = Date.now()) {
            const repetido = codigo === ultima.codigo && ahora - ultima.t < repetidoMs;
            ultima = { codigo, t: ahora };
            if (repetido) return 'repetido';
            recientes = recientes.filter((t) => ahora - t < ventanaMs);
            recientes.push(ahora);
            return recientes.length > maxLecturas ? 'freno' : 'nuevo';
        },
    };
}
