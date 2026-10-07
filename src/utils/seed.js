import Store from '../models/Store.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import authService from '../services/AuthService.js';

const STORES = [
    { name: 'TechStore Lima Centro', city: 'Lima' },
    { name: 'TechStore Arequipa', city: 'Arequipa' },
    { name: 'TechStore Trujillo', city: 'Trujillo' }
];

// Un usuario de prueba por perfil; gerente y empleado pertenecen a Lima Centro
const USERS = [
    { email: 'admin@techstore.com', fullName: 'Pablo Isla', role: 'admin', store: null },
    { email: 'gerente@techstore.com', fullName: 'Gabriela Torres', role: 'gerente', store: 0 },
    { email: 'empleado@techstore.com', fullName: 'Ernesto Vargas', role: 'empleado', store: 0 },
    { email: 'auditor@techstore.com', fullName: 'Andrea Quispe', role: 'auditor', store: null }
];

const PRODUCTS = [
    { sku: 'LAP-001', name: 'Laptop Lenovo IdeaPad 5', category: 'Laptops', price: 2899.9, stock: 12, store: 0 },
    { sku: 'CEL-001', name: 'Samsung Galaxy A55', category: 'Celulares', price: 1599, stock: 25, store: 0 },
    { sku: 'AUD-001', name: 'Audífonos Sony WH-CH520', category: 'Audio', price: 229.9, stock: 4, store: 0 },
    { sku: 'MON-001', name: 'Monitor LG 27" IPS', category: 'Monitores', price: 799, stock: 8, store: 0 },
    { sku: 'LAP-001', name: 'Laptop Lenovo IdeaPad 5', category: 'Laptops', price: 2899.9, stock: 5, store: 1 },
    { sku: 'TAB-001', name: 'iPad 10ma generación', category: 'Tablets', price: 1899, stock: 7, store: 1 },
    { sku: 'CEL-002', name: 'Xiaomi Redmi Note 13', category: 'Celulares', price: 899, stock: 18, store: 2 },
    { sku: 'ACC-001', name: 'Mouse Logitech M190', category: 'Accesorios', price: 59.9, stock: 3, store: 2 }
];

// Carga los datos iniciales la primera vez que arranca el servidor
export default async function seed() {

    if (await Store.countDocuments() === 0) {
        await Store.insertMany(STORES);
        console.log('Seeded stores');
    }
    const stores = await Promise.all(STORES.map(s => Store.findOne({ name: s.name })));

    if (await User.countDocuments() === 0) {
        const password = await authService.hashPassword(process.env.SEED_PASSWORD || 'TechStore#2026');
        await User.insertMany(USERS.map(u => ({
            ...u, password, store: u.store === null ? null : stores[u.store]._id
        })));
        console.log(`Seeded users: ${USERS.map(u => u.email).join(', ')}`);
    }

    if (await Product.countDocuments() === 0) {
        await Product.insertMany(PRODUCTS.map(p => ({ ...p, store: stores[p.store]._id })));
        console.log('Seeded products');
    }
}
