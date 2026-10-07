import express from 'express';
import UserController from '../controllers/UserController.js';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';

const router = express.Router();

// GET /api/users (admin gestiona, auditor solo lectura)
router.get('/', authenticate, authorize(['admin', 'auditor']), UserController.getAll);

// GET /api/users/me (cualquier usuario autenticado)
router.get('/me', authenticate, authorize([]), UserController.getMe);

// Gestión de usuarios y roles (solo el rol admin)
router.put('/:id', authenticate, authorize(['admin']), UserController.update);
router.post('/:id/unlock', authenticate, authorize(['admin']), UserController.unlock);
router.post('/:id/reset-mfa', authenticate, authorize(['admin']), UserController.resetMfa);

export default router;
