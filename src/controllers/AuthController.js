import crypto from 'crypto';
import authService from '../services/AuthService.js';
import oauthService from '../services/OAuthService.js';

const STATE_COOKIE = 'oauth_state';

function readCookie(req, name) {
    const cookies = (req.headers.cookie || '').split(';').map(c => c.trim().split('='));
    const found = cookies.find(([key]) => key === name);
    return found ? found[1] : null;
}

function sameState(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

class AuthController {

    async signUp(req, res, next) {
        try {
            // Solo se aceptan estos campos: el rol nunca viene del formulario público
            const { email, password, fullName, store } = req.body;
            const user = await authService.signUp({ email, password, fullName, store });
            return res.status(201).json(user);
        } catch (err) {
            next(err);
        }
    }

    async signIn(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password)
                return res.status(400).json({ message: 'El email y password son requeridos' });

            return res.status(200).json(await authService.signIn({ email, password }));
        } catch (err) {
            next(err);
        }
    }

    async mfaSetup(req, res, next) {
        try {
            return res.status(200).json(await authService.mfaSetup(req.body.mfaTicket));
        } catch (err) {
            next(err);
        }
    }

    async mfaVerify(req, res, next) {
        try {
            const { mfaTicket, code } = req.body;
            return res.status(200).json(await authService.mfaVerify(mfaTicket, code));
        } catch (err) {
            next(err);
        }
    }

    providers(req, res) {
        res.status(200).json(oauthService.enabled());
    }

    // GET /api/auth/:provider -> redirige a Google o GitHub
    oauthStart(req, res) {
        try {
            const { state, url } = oauthService.authorization(req.params.provider);
            res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
            res.redirect(url);
        } catch (err) {
            res.redirect(`/signIn?error=${encodeURIComponent(err.message)}`);
        }
    }

    // GET /api/auth/:provider/callback -> el login social también pasa por MFA
    async oauthCallback(req, res) {
        try {
            const { code, state } = req.query;
            const expected = readCookie(req, STATE_COOKIE);
            res.clearCookie(STATE_COOKIE);

            if (typeof code !== 'string' || typeof state !== 'string' || !sameState(state, expected))
                throw new Error('No se pudo validar la respuesta del proveedor');

            const user = await oauthService.authenticate(req.params.provider, code);
            const { mfaTicket, enrolled } = await authService.startMfa(user);

            // El ticket viaja en el fragmento (#): no llega al servidor ni a los logs
            res.redirect(`/mfa#ticket=${mfaTicket}&enrolled=${enrolled ? 1 : 0}`);
        } catch (err) {
            console.error(err);
            const message = err.status ? err.message : 'No se pudo iniciar sesión con el proveedor';
            res.redirect(`/signIn?error=${encodeURIComponent(message)}`);
        }
    }
}

export default new AuthController();
