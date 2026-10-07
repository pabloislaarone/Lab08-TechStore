import express from 'express';
import ProductController from '../controllers/ProductController.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';

const router = express.Router();

// Matriz de permisos (el alcance por tienda se valida en ProductService):
//                 admin   gerente        empleado       auditor
// consultar        sí     su tienda      sí             sí
// crear/editar     sí     su tienda      no             no
// cambiar stock    sí     su tienda      su tienda      no
// eliminar         sí     su tienda      no             no
// reportes         sí     su tienda      no             sí

router.get('/', authenticate, authorize([]), ProductController.getAll);
router.get('/report', authenticate, authorize(['admin', 'gerente', 'auditor']), ProductController.report);

router.post('/', authenticate, authorize(['admin', 'gerente']), ProductController.create);
router.put('/:id', authenticate, authorize(['admin', 'gerente']), ProductController.update);
router.patch('/:id/stock', authenticate, authorize(['admin', 'gerente', 'empleado']), ProductController.updateStock);
router.delete('/:id', authenticate, authorize(['admin', 'gerente']), ProductController.remove);

export default router;
