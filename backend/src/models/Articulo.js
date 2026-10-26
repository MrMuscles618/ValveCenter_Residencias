import mongoose from 'mongoose';

// Datos de la etiqueta del contenedor; todos opcionales.
// PESO y PIEZAS son los de la etiqueta y sirven de valor inicial para cada bolsa nueva;
// las piezas y el peso reales de cada bolsa van en `bolsas`.
const contenidoSchema = new mongoose.Schema({
    fecha: { type: String, default: '', trim: true }, // AAAA-MM-DD
    peso: { type: Number, default: null, min: 0 },
    lote: { type: String, default: '', trim: true },
    piezas: { type: Number, default: null, min: 0 },
    ppp: { type: String, default: '', trim: true }, // peso por pieza
    oper: { type: String, default: '', trim: true }, // operación
}, { _id: false });

// Cada bolsa es independiente: se le pueden sacar piezas sin afectar a las demás
// Tras una salida de piezas el peso de la bolsa queda en NA (null) y bloqueado: ya no se puede modificar.
// `fecha` (la de su etiqueta, o el día en que llegó) y `registrado` ordenan las bolsas en FIFO.
const bolsaSchema = new mongoose.Schema({
    piezas: { type: Number, default: null, min: 0 },
    peso: { type: Number, default: null, min: 0 },
    pesoBloqueado: { type: Boolean, default: false },
    fecha: { type: String, default: '', trim: true }, // AAAA-MM-DD
    registrado: { type: Date, default: Date.now },
});

const articuloSchema = new mongoose.Schema({
    // Un código puede estar en varias ubicaciones a la vez (ranuras llenas), pero una sola vez en cada una
    codigo: { type: String, required: true, trim: true },
    formato: { type: String, default: 'Manual', trim: true },
    descripcion: { type: String, default: '', trim: true },
    contenido: { type: contenidoSchema, default: () => ({}) },
    // Bolsas en orden de llegada (la primera es la más antigua); `cantidad` es siempre bolsas.length
    bolsas: { type: [bolsaSchema], default: [] },
    cantidad: { type: Number, required: true, min: 1, default: 1 },
    registrado: { type: Date, default: Date.now },
    ubicacion: { type: String, default: 'recepcion', trim: true, index: true },
}, { timestamps: true, versionKey: false });

articuloSchema.index({ codigo: 1, ubicacion: 1 }, { unique: true });

export default mongoose.model('Articulo', articuloSchema);
