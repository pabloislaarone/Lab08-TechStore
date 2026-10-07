import express from 'express';
import AuthController from '../controllers/AuthController.js';

const router = express.Router();

router.post('/signUp', AuthController.signUp);
router.post('/signIn', AuthController.signIn);

// MFA (TOTP): se llaman con el ticket temporal que entrega signIn
router.post('/mfa/setup', AuthController.mfaSetup);
router.post('/mfa/verify', AuthController.mfaVerify);

// Login con redes sociales (google | github)
router.get('/providers', AuthController.providers);
router.get('/:provider', AuthController.oauthStart);
router.get('/:provider/callback', AuthController.oauthCallback);

export default router;
