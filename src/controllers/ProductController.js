import productService from '../services/ProductService.js';

class ProductController {

    async getAll(req, res, next) {
        try {
            res.status(200).json(await productService.list(req.user, { store: req.query.store }));
        } catch (err) {
            next(err);
        }
    }

    async create(req, res, next) {
        try {
            res.status(201).json(await productService.create(req.user, req.body));
        } catch (err) {
            next(err);
        }
    }

    async update(req, res, next) {
        try {
            res.status(200).json(await productService.update(req.user, req.params.id, req.body));
        } catch (err) {
            next(err);
        }
    }

    async updateStock(req, res, next) {
        try {
            const { stock } = req.body;
            if (!Number.isInteger(stock) || stock < 0)
                return res.status(400).json({ message: 'El stock debe ser un número entero mayor o igual a 0' });

            res.status(200).json(await productService.updateStock(req.user, req.params.id, stock));
        } catch (err) {
            next(err);
        }
    }

    async remove(req, res, next) {
        try {
            await productService.remove(req.user, req.params.id);
            res.status(204).end();
        } catch (err) {
            next(err);
        }
    }

    async report(req, res, next) {
        try {
            res.status(200).json(await productService.report(req.user));
        } catch (err) {
            next(err);
        }
    }
}

export default new ProductController();
