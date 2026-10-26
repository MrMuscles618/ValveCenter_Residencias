import mongoose from 'mongoose';

const movimientoSchema = new mongoose.Schema({
    fecha: { type: Date, default: Date.now, index: true },
    texto: { type: String, required: true },
}, { versionKey: false });

export default mongoose.model('Movimiento', movimientoSchema);
