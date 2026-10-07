import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
    sku: {
        type: String,
        required: [true, 'El SKU es requerido'],
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'El nombre del producto es requerido'],
        trim: true
    },
    category: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'El precio es requerido'],
        min: [0, 'El precio no puede ser negativo']
    },
    stock: {
        type: Number,
        default: 0,
        min: [0, 'El stock no puede ser negativo'],
        validate: {
            validator: Number.isInteger,
            message: 'El stock debe ser un número entero'
        }
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'La tienda es requerida']
    }
}, { timestamps: true });

// El mismo SKU puede existir en varias tiendas, pero no repetirse dentro de una
ProductSchema.index({ sku: 1, store: 1 }, { unique: true });

export default mongoose.model('Product', ProductSchema);
