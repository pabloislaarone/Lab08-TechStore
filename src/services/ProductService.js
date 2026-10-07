import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import httpError from '../utils/httpError.js';

const LOW_STOCK = 5;

// Campos que puede editar quien gestiona el producto (admin o gerente de la tienda)
const EDITABLE_FIELDS = ['sku', 'name', 'category', 'price', 'stock'];

function toDTO(product) {
    return {
        id: product._id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        store: product.store && product.store.name
            ? { id: product.store._id, name: product.store.name }
            : { id: product.store },
        updatedAt: product.updatedAt
    };
}

class ProductService {

    // El gerente y el empleado solo operan sobre su propia tienda
    assertOwnStore(user, product) {
        if (user.role === 'admin') return;
        if (!user.store || product.store.toString() !== user.store)
            throw httpError(403, 'Prohibido: el producto pertenece a otra tienda');
    }

    async find(id) {
        const product = await Product.findById(id);
        if (!product) throw httpError(404, 'Producto no encontrado');
        return product;
    }

    // Gerente: productos de su tienda. Admin, auditor y empleado: consulta general.
    async list(user, { store } = {}) {
        const filter = {};
        if (user.role === 'gerente') {
            if (!user.store) return [];
            filter.store = user.store;
        } else if (store) {
            filter.store = store;
        }
        const products = await Product.find(filter).populate('store').sort({ name: 1 });
        return products.map(toDTO);
    }

    async create(user, data) {
        const store = user.role === 'admin' ? data.store : user.store;
        if (!store) throw httpError(400, 'La tienda es requerida');
        if (!await Store.exists({ _id: store })) throw httpError(400, 'La tienda seleccionada no existe');

        const product = await Product.create({
            sku: data.sku, name: data.name, category: data.category,
            price: data.price, stock: data.stock, store
        });
        return toDTO(await product.populate('store'));
    }

    async update(user, id, data) {
        const product = await this.find(id);
        this.assertOwnStore(user, product);

        for (const field of EDITABLE_FIELDS) {
            if (data[field] !== undefined) product[field] = data[field];
        }
        await product.save();
        return toDTO(await product.populate('store'));
    }

    // Único cambio permitido al Empleado de Ventas: solo se toca el stock
    async updateStock(user, id, stock) {
        const product = await this.find(id);
        this.assertOwnStore(user, product);

        product.stock = stock;
        await product.save();
        return toDTO(await product.populate('store'));
    }

    async remove(user, id) {
        const product = await this.find(id);
        this.assertOwnStore(user, product);
        await product.deleteOne();
    }

    // Reporte de inventario por tienda (el gerente solo ve la suya)
    async report(user) {
        const match = {};
        if (user.role === 'gerente') {
            if (!user.store) return [];
            match.store = new mongoose.Types.ObjectId(user.store);
        }

        const rows = await Product.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$store',
                    products: { $sum: 1 },
                    units: { $sum: '$stock' },
                    value: { $sum: { $multiply: ['$price', '$stock'] } },
                    lowStock: { $sum: { $cond: [{ $lte: ['$stock', LOW_STOCK] }, 1, 0] } }
                }
            },
            { $lookup: { from: 'stores', localField: '_id', foreignField: '_id', as: 'store' } },
            { $unwind: '$store' },
            { $sort: { 'store.name': 1 } }
        ]);

        return rows.map(r => ({
            store: { id: r._id, name: r.store.name, city: r.store.city },
            products: r.products,
            units: r.units,
            value: Math.round(r.value * 100) / 100,
            lowStock: r.lowStock
        }));
    }
}

export default new ProductService();
