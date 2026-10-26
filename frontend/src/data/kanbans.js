// Configuración de los racks Kanban del almacén.
// Cada módulo es un rack físico: `niveles` es una lista de filas (de arriba
// hacia abajo) y cada fila es una lista de ranuras (contenedores).
// Para ajustar un rack basta con editar este archivo.

// Fila de ranuras numeradas: ranuras('E', [1, 2]) → E-1, E-2
const conPrefijo = (prefijo, numeros, color) =>
    numeros.map((n) => ({ etiqueta: prefijo ? `${prefijo}-${n}` : String(n), color }));

// Rack donde cada columna es una letra y cada nivel un número (p. ej. Kanban 2: E-1, F-1, G-1…)
function porColumnas(columnas, numerosPorNivel, colorDe) {
    return numerosPorNivel.map((n, nivel) =>
        columnas.map((col, i) => ({ etiqueta: `${col}-${n}`, color: colorDe(i, nivel) })),
    );
}

// Como porColumnas, pero cada posición (C-1, D-1…) se divide en `compartimentos` contenedores independientes:
// C-1.1, C-1.2… Son ranuras normales (cada una con su id, sus códigos y su color); `grupo` es la posición a la que
// pertenecen y `corta` el número que se muestra dentro del bloque. En el nivel van una tras otra: C-1.1…C-1.4, D-1.1…
function porColumnasConCompartimentos(columnas, numerosPorNivel, colorDe, compartimentos) {
    return numerosPorNivel.map((n, nivel) =>
        columnas.flatMap((col, i) =>
            Array.from({ length: compartimentos }, (_, c) => ({
                etiqueta: `${col}-${n}.${c + 1}`,
                corta: String(c + 1),
                grupo: `${col}-${n}`,
                color: colorDe(i, nivel),
            })),
        ),
    );
}

// Rack donde cada letra ocupa un bloque de varias ranuras por nivel (p. ej. Kanban 3: A-1 A-2 / A-3 A-4…)
function porBloques(letra, porNivel, niveles, colorDe) {
    return Array.from({ length: niveles }, (_, nivel) =>
        Array.from({ length: porNivel }, (_, i) => ({
            etiqueta: `${letra}-${nivel * porNivel + i + 1}`,
            color: colorDe(i, nivel),
        })),
    );
}

// Patrón verde/azul determinista para los racks con contenedores mixtos (los colores se ajustan desde la app)
export const mixto = (i, nivel) => ((i * 7 + nivel * 3) % 5 < 2 ? 'verde' : 'azul');
const azul = () => 'azul';
const verde = () => 'verde';

export const KANBANS = [
    {
        id: 'k1',
        nombre: 'Kanban 1',
        lineas: ['A3'],
        modulos: [
            {
                id: 'k1-m1',
                nombre: 'Línea A3',
                niveles: [
                    conPrefijo('', [1, 2, 3,4], 'azul'),
                    conPrefijo('', [5, 6,7,8], 'azul'),
                    conPrefijo('', [9, 10, 11, 12], 'azul'),
                    conPrefijo('', [13,14,15], 'azul'),
                ],
            },
                        {
                id: 'k1-m2',
                nombre: 'Línea A3 [Posterior]',
                niveles: [
                    conPrefijo('', [16, 17, 18, 19], 'azul'),
                    conPrefijo('', [20, 21, 22, 23], 'azul'),
                    conPrefijo('', [24, 25, 26, 27], 'azul'),
                    conPrefijo('', [28, 29, 30], 'azul'),
                ],
            },
        ],
    },
    {
        id: 'k2',
        nombre: 'Kanban 2',
        lineas: ['A0', 'A5'],
        modulos: [
            {
                id: 'k2-m2',
                nombre: 'Línea A0 - A5',
                niveles: porColumnas(['E', 'F', 'G', 'H'], [1, 2, 3, 4, 5, 6, 7], mixto),
            },
            
            {
                id: 'k2-m3',
                nombre: 'Línea A0 - A5',
                niveles: porColumnas(['K', 'J', 'I'], [1, 2, 3, 4, 5, 6], mixto),
            },
            {
                id: 'k2-m1',
                nombre: 'Línea A0 - A5 [Posterior]',
                niveles: porColumnas(['A', 'B', 'C', 'D'], [1, 2, 3, 4, 5, 6, 7,], mixto),
            }
            
        ],
    },
    {
        id: 'k3',
        nombre: 'Kanban 3',
        lineas: ['A4', 'A6', 'B4'],
        modulos: [
            { id: 'k3-m1', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('A', 2, 7, mixto) },

            { id: 'k3-m2', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('B', 2, 6, mixto) },

            { id: 'k3-m3', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('C', 2, 7, mixto) },

            { id: 'k3-m4', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('D', 2, 4, mixto) },

            { id: 'k3-m5', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('E', 2, 4, mixto) },

            { id: 'k3-m6', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('F', 2, 3, mixto) },

            { id: 'k3-m7', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('G', 2, 7, mixto) },

            { id: 'k3-m8', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('H', 2, 6, mixto) },

            { id: 'k3-m9', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('I', 2, 7, mixto) },

            { id: 'k3-m10', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('J', 2, 4, mixto) },

            { id: 'k3-m11', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('K', 2, 4, mixto) },

            { id: 'k3-m12', nombre: 'Línea A4 - A6 - B4', niveles: porBloques('L', 2, 3, mixto) },
        ],
    },

    {
        id: 'k4',
        nombre: 'Kanban 4',
        lineas: ['B2'],
        flujo: true, // rack de rodillos (FIFO)
        modulos: [
            {
                id: 'k4-m1',
                nombre: 'Línea B2',
                // 5 letras (C…G) × 4 niveles; cada posición tiene 4 contenedores independientes (C-1.1 … C-1.4)
                compartimentos: 4,
                niveles: porColumnasConCompartimentos(['C', 'D', 'E', 'F', 'G'], [1, 2, 3, 4], azul, 4),
            },
        ],
    },
    {
        id: 'k5',
        nombre: 'Kanban Pistones',
        lineas: ['Pistones'],
        modulos: [
            {
                id: 'k5-m1',
                nombre: 'Pistones',
                niveles: Array.from({ length: 19 }, (_, nivel) =>
                    //lINEA DE PISTONES DE P1 A P74
                    conPrefijo('P', [1, 2, 3, 4].map((n) => nivel * 4 + n), nivel % 2 ? 'verde' : 'azul'),

                ),
            },
        ],
    },
      {
        id:'k6',
        nombre: 'Pistones Carton',
        lineas: ['Pistones'],
        modulos:[
            {
                id: 'k6-m1',
                nombre:'Cajas de Carton',
                //5 NIVELES DE CAJAS DE CARTON SIN NUMENCLATURA
                niveles:[
                    conPrefijo('C', [1,2], 'cafe'),
                    conPrefijo('C', [3,4], 'cafe'),
                    conPrefijo('C', [5,6], 'cafe'),
                    conPrefijo('C', [7,8], 'cafe'),
                    conPrefijo('C', [9,10], 'cafe'),
                ],

            },
            {
                id: 'k6-m2',
                nombre:'Cajas de Carton [Posterior]',
                //5 NIVELES DE CAJAS DE CARTON SIN NUMENCLATURA
                niveles:[
                    conPrefijo('C', [11,12], 'cafe'),
                    conPrefijo('C', [13,14], 'cafe'),
                    conPrefijo('C', [15,16], 'cafe'),
                    conPrefijo('C', [17,18], 'cafe'),
                    conPrefijo('C', [19,20], 'cafe'),
                ],

            }
        ]
    }
];

// Id único de ranura: "k2-m2:E-3"
export const idRanura = (modulo, etiqueta) => `${modulo.id}:${etiqueta}`;

// Índice plano de todas las ranuras, para buscar ubicaciones por id
const indexar = (kanban) =>
    kanban.modulos.flatMap((modulo) =>
        modulo.niveles.flat().map((r) => [
            idRanura(modulo, r.etiqueta),
            { ...r, id: idRanura(modulo, r.etiqueta), kanban, modulo },
        ]),
    );
export const RANURAS = new Map(KANBANS.flatMap(indexar));

// Racks agregados desde la app (guardados en el backend): se suman a los de arriba.
// Si el rack ya estaba (edición), se reemplaza junto con sus ranuras.
export function agregarKanbans(racks) {
    for (const rack of racks) {
        const id = `r${rack.id}`;
        const kanban = {
            id,
            rackId: rack.id,
            nombre: rack.nombre,
            lineas: rack.lineas,
                personalizado: true,
            modulos: rack.modulos.map((m) => ({ id: `${id}-${m.id}`, clave: m.id, nombre: m.nombre, niveles: m.niveles, config: m.config })),
        };
        const i = KANBANS.findIndex((k) => k.id === id);
        if (i >= 0) {
            quitarRanuras(id);
            KANBANS[i] = kanban;
        } else {
            KANBANS.push(kanban);
        }
        for (const [idR, r] of indexar(kanban)) RANURAS.set(idR, r);
    }
}

export function quitarKanban(id) {
    const i = KANBANS.findIndex((k) => k.id === id);
    if (i < 0) return;
    quitarRanuras(id);
    KANBANS.splice(i, 1);
}

function quitarRanuras(idKanban) {
    for (const [idR, r] of RANURAS) if (r.kanban.id === idKanban) RANURAS.delete(idR);
}

// Colores cambiados a mano (backend /api/colores): `color` es el que se ve y `base` el original del rack
export function aplicarColores(colores) {
    for (const kanban of KANBANS) {
        for (const modulo of kanban.modulos) {
            for (const r of modulo.niveles.flat()) {
                const id = idRanura(modulo, r.etiqueta);
                r.base ??= r.color;
                r.color = colores.get(id) ?? r.base;
                const indice = RANURAS.get(id);
                if (indice) Object.assign(indice, { color: r.color, base: r.base });
            }
        }
    }
}

// Rack mixto: sus contenedores originales no son todos del mismo color
export const esMixto = (kanban) =>
    new Set(kanban.modulos.flatMap((m) => m.niveles.flat().map((r) => r.base ?? r.color))).size > 1;

export const totalRanuras = (kanban) =>
    kanban.modulos.reduce((s, m) => s + m.niveles.flat().length, 0);

export const ubicacionCorta = (idR) => {
    const r = RANURAS.get(idR);
    return r ? `${r.kanban.nombre} · ${r.etiqueta}` : '—';
};

// Texto de un movimiento del historial con los ids de ranura cambiados por su nombre:
// "Salida de X: -1 bolsa (k4-m1:C-1.1; quedan 2)" → "Salida de X: -1 bolsa (Kanban 4 · C-1.1; quedan 2)".
// El backend guarda el id; se traduce al mostrarlo, así también se leen bien los movimientos antiguos.
// Si la ranura ya no existe (rack eliminado), el id se deja como está.
const ID_EN_TEXTO = /\b(?:k\d+-m\d+|r[0-9a-f]{24}-m\d+):[^;),\s]+/g;
export const textoMovimiento = (texto) =>
    String(texto ?? '').replace(ID_EN_TEXTO, (id) => (RANURAS.has(id) ? ubicacionCorta(id) : id));

export const describirUbicacion = (idR) => {
    const r = RANURAS.get(idR);
    return r ? `${r.kanban.nombre} · ${r.modulo.nombre} · ${r.etiqueta}` : '—';
};

