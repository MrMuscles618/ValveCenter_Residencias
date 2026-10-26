// Lectura de campos numéricos enteros. Si el campo se deja vacío, en 0 o con algo que no es número,
// devuelve null: el campo queda en blanco (no salta a 1) y la pantalla muestra una advertencia.
export function leerEntero(texto, max = Infinity) {
    const n = parseInt(texto, 10);
    return Number.isFinite(n) && n >= 1 ? Math.min(max, n) : null;
}

// Igual que leerEntero pero admite decimales (peso), con punto o coma
export function leerDecimal(texto) {
    const n = Number(String(texto).replace(',', '.'));
    return String(texto).trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

// Texto de la advertencia para un campo en blanco
export const avisoVacio = (que) => `${que} no puede quedar en 0 ni vacío: escribe un número mayor que 0.`;
