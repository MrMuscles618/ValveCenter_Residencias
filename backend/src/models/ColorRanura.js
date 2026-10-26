import mongoose from 'mongoose';

// Color de contenedor cambiado a mano en un rack mixto. Solo se guardan las ranuras
// cuyo color difiere del original del rack; `ranura` es el id de ranura del frontend.
const colorRanuraSchema = new mongoose.Schema({
    ranura: { type: String, required: true, trim: true, unique: true },
    color: { type: String, required: true, enum: ['azul', 'verde', 'cafe'] },
}, { timestamps: true, versionKey: false });

export default mongoose.model('ColorRanura', colorRanuraSchema);
