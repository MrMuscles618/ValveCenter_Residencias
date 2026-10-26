import mongoose from 'mongoose';
import Movimiento from './models/Movimiento.js';

// Error con código HTTP, lo atiende el manejador de errores de server.js
export const errorHttp = (status, mensaje) => Object.assign(new Error(mensaje), { status });

export const idValido = (id) => mongoose.isValidObjectId(id);

// Registra un movimiento en el historial del almacén
export const crearMovimiento = (texto) => Movimiento.create({ texto });
