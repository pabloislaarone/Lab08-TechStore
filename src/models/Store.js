import mongoose from 'mongoose';

const StoreSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre de la tienda es requerido'],
        unique: true,
        trim: true
    },
    city: {
        type: String,
        trim: true
    }
}, { timestamps: true });

export default mongoose.model('Store', StoreSchema);
