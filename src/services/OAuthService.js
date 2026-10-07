import crypto from 'crypto';
import User from '../models/User.js';
import httpError from '../utils/httpError.js';

// Flujo OAuth 2.0 Authorization Code contra Google y GitHub
const PROVIDERS = {
    google: {
        idField: 'googleId',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
        clientId: () => process.env.GOOGLE_CLIENT_ID,
        clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,

        async profile(accessToken) {
            const info = await getJson('https://openidconnect.googleapis.com/v1/userinfo', accessToken);
            if (!info.email || !info.email_verified) throw httpError(401, 'Tu cuenta de Google no tiene un email verificado');
            return { id: info.sub, email: info.email, fullName: info.name || info.email };
        }
    },
    github: {
        idField: 'githubId',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        scope: 'read:user user:email',
        clientId: () => process.env.GITHUB_CLIENT_ID,
        clientSecret: () => process.env.GITHUB_CLIENT_SECRET,

        async profile(accessToken) {
            const info = await getJson('https://api.github.com/user', accessToken);
            // El email público puede venir vacío: se usa el principal verificado
            const emails = await getJson('https://api.github.com/user/emails', accessToken);
            const primary = Array.isArray(emails) && emails.find(e => e.primary && e.verified);
            if (!primary) throw httpError(401, 'Tu cuenta de GitHub no tiene un email verificado');
            return { id: String(info.id), email: primary.email, fullName: info.name || info.login };
        }
    }
};

async function getJson(url, accessToken) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': 'TechStore' }
    });
    if (!res.ok) throw httpError(502, 'No se pudo obtener el perfil del proveedor');
    return res.json();
}

class OAuthService {

    get(name) {
        const provider = PROVIDERS[name];
        if (!provider) throw httpError(404, 'Proveedor no soportado');
        if (!provider.clientId() || !provider.clientSecret())
            throw httpError(503, `El login con ${name} no está configurado (revisa el archivo .env)`);
        return provider;
    }

    enabled() {
        return Object.fromEntries(
            Object.entries(PROVIDERS).map(([name, p]) => [name, !!(p.clientId() && p.clientSecret())])
        );
    }

    redirectUri(name) {
        return `${process.env.APP_URL}/api/auth/${name}/callback`;
    }

    // URL de consentimiento + state aleatorio (protección CSRF del flujo)
    authorization(name) {
        const provider = this.get(name);
        const state = crypto.randomBytes(16).toString('hex');
        const params = new URLSearchParams({
            client_id: provider.clientId(),
            redirect_uri: this.redirectUri(name),
            response_type: 'code',
            scope: provider.scope,
            state
        });
        return { state, url: `${provider.authUrl}?${params}` };
    }

    // Canjea el code por un access token y devuelve el usuario local
    async authenticate(name, code) {
        const provider = this.get(name);

        const res = await fetch(provider.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: new URLSearchParams({
                client_id: provider.clientId(),
                client_secret: provider.clientSecret(),
                redirect_uri: this.redirectUri(name),
                grant_type: 'authorization_code',
                code
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) throw httpError(401, 'El proveedor rechazó la autenticación');

        const profile = await provider.profile(data.access_token);
        return this.findOrCreate(provider.idField, profile);
    }

    async findOrCreate(idField, { id, email, fullName }) {
        let user = await User.findOne({ [idField]: id });
        if (user) return user;

        // Mismo email (verificado por el proveedor): se vincula a la cuenta existente
        user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            user[idField] = id;
            return user.save();
        }

        // Cuenta nueva: Empleado sin tienda hasta que el administrador le asigne una
        return User.create({ email, fullName, role: 'empleado', [idField]: id });
    }
}

export default new OAuthService();
