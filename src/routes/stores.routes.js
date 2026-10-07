import express from 'express';
import Store from '../models/Store.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';

const router = express.Router();

const toDTO = store => ({ id: store._id, name: store.name, city: store.city });

// GET /api/stores (público: lo usa el formulario de registro)
router.get('/', async (req, res, next) => {
    try {
        const stores = await Store.find().sort({ name: 1 });
        res.status(200).json(stores.map(toDTO));
    } catch (err) {
        next(err);
    }
});

// POST /api/stores (solo el rol admin)
router.post('/', authenticate, authorize(['admin']), async (req, res, next) => {
    try {
        const { name, city } = req.body;
        res.status(201).json(toDTO(await Store.create({ name, city })));
    } catch (err) {
        next(err);
    }
});

export default router;
