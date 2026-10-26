import mongoose from 'mongoose';

// Rack agregado desde la app. `niveles` es una lista de filas (de arriba hacia abajo)
// y cada fila una lista de ranuras { etiqueta, color }, igual que en frontend/src/data/kanbans.js.
// `id` del módulo (m1, m2…) es estable al editar: forma parte del id de cada ranura.
// `config` guarda los valores del formulario para poder editarlo después.
const moduloSchema = new mongoose.Schema({
    id: { type: String, required: true },
    nombre: { type: String, required: true, trim: true },
    niveles: { type: mongoose.Schema.Types.Mixed, required: true },
    config: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const rackSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true, unique: true },
    lineas: { type: [String], default: [] },
    modulos: { type: [moduloSchema], required: true },
}, { timestamps: true, versionKey: false });

export default mongoose.model('Rack', rackSchema);
