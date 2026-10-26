import {
    BarcodeFormat,
    BinaryBitmap,
    DecodeHintType,
    HybridBinarizer,
    MultiFormatReader,
    RGBLuminanceSource,
} from '@zxing/library';

// Decodificador de códigos de barras y QR a partir de una imagen: ZXing ("Zebra Crossing", versión JavaScript).
// Se carga solo al encender la cámara (import dinámico) porque pesa varios cientos de KB.

// Solo el formato que usan las etiquetas del almacén: CODE 128. Cada formato extra aumenta las lecturas falsas
// (EAN-8, UPC-E, ITF, Codabar y Code 93 "encuentran" códigos en cualquier textura: piel, ropa, bordes) y el tiempo
// de cada fotograma. Si llegaran etiquetas de otro tipo, basta sumarlo a esta lista (p. ej. BarcodeFormat.QR_CODE).
const FORMATOS = [BarcodeFormat.CODE_128];

export function crearLector() {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS);
    hints.set(DecodeHintType.TRY_HARDER, true); // también prueba códigos girados y con poco contraste
    const lector = new MultiFormatReader();
    lector.setHints(hints);

    // `imagen`: { data: RGBA, width, height } (un ImageData). Devuelve { texto, formato } o null si no hay código.
    return function decodificar(imagen) {
        const { data, width, height } = imagen;
        const gris = new Uint8ClampedArray(width * height);
        for (let i = 0, p = 0; i < gris.length; i++, p += 4) gris[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
        const mapa = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gris, width, height)));
        try {
            const r = lector.decodeWithState(mapa);
            return { texto: r.getText(), formato: BarcodeFormat[r.getBarcodeFormat()] ?? 'Código' };
        } catch {
            return null; // NotFoundException: en este fotograma no hay código legible
        }
    };
}
