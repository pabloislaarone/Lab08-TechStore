import express from 'express';

const router = express.Router();

// El token vive en sessionStorage, por eso la protección de estas páginas
// se hace en el navegador (public/js/auth.js) y los datos se protegen en la API.
router.get('/', (req, res) => res.redirect('/signIn'));

router.get('/signIn', (req, res) => res.render('signIn', { title: 'Iniciar sesión', script: 'signIn', auth: true }));
router.get('/signUp', (req, res) => res.render('signUp', { title: 'Registro', script: 'signUp', auth: true }));
router.get('/mfa', (req, res) => res.render('mfa', { title: 'Verificación en dos pasos', script: 'mfa', auth: true }));
router.get('/dashboard', (req, res) => res.render('dashboard', { title: 'Inventario', script: 'dashboard' }));
router.get('/admin', (req, res) => res.render('admin', { title: 'Usuarios', script: 'admin' }));
router.get('/403', (req, res) => res.status(403).render('403', { title: 'Acceso denegado' }));

export default router;
