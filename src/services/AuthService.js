import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';
import User from '../models/User.js';
import Store from '../models/Store.js';
import MfaChallenge from '../models/MfaChallenge.js';
import httpError from '../utils/httpError.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { isValidEmail, isValidPassword, PASSWORD_MESSAGE } from '../utils/validators.js';

const MFA_MAX_ATTEMPTS = 3;
const MFA_TTL_MS = 5 * 60 * 1000;
const TOTP_STEP_MS = 30 * 1000;

// Código de 6 dígitos cada 30s; se tolera un intervalo de desfase de reloj
authenticator.options = { window: 1 };

const maxLoginAttempts = () => parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? '5', 10);
const lockMinutes = () => parseInt(process.env.LOCK_MINUTES ?? '15', 10);

class AuthService {

    async signUp({ email, password, fullName, store }) {
        if (!email || !password || !fullName || !store)
            throw httpError(400, 'Email, password, nombre completo y tienda son requeridos');
        if (!isValidEmail(email)) throw httpError(400, 'El email no es válido');
        if (!isValidPassword(password)) throw httpError(400, PASSWORD_MESSAGE);

        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) throw httpError(400, 'El email ya se encuentra en uso');

        const storeDoc = await Store.findById(store);
        if (!storeDoc) throw httpError(400, 'La tienda seleccionada no existe');

        // El registro público siempre crea un Empleado de Ventas (mínimo privilegio);
        // solo el administrador puede cambiar el rol después.
        const user = await User.create({
            email,
            password: await this.hashPassword(password),
            fullName,
            store: storeDoc._id,
            role: 'empleado'
        });

        return { id: user._id, email: user.email, fullName: user.fullName, role: user.role };
    }

    hashPassword(password) {
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10);
        return bcrypt.hash(password, saltRounds);
    }

    // Paso 1 del login: valida credenciales y abre el desafío MFA
    async signIn({ email, password }) {
        if (typeof email !== 'string' || typeof password !== 'string')
            throw httpError(400, 'El email y password son requeridos');

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || !user.password) throw httpError(401, 'Credenciales inválidas');

        if (user.isLocked) throw this.lockedError(user.lockUntil);

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            const left = await this.registerFailure(user._id);
            throw httpError(401, `Credenciales inválidas. Te quedan ${left} intento(s) antes del bloqueo`);
        }

        // El contador de fallos no se reinicia aquí sino al completar el MFA: si no,
        // con el password se podrían pedir desafíos nuevos y probar códigos sin límite.
        return this.startMfa(user);
    }

    // Suma un intento fallido (password o código MFA) y devuelve los que quedan;
    // al llegar al máximo bloquea la cuenta y anula el desafío MFA pendiente.
    async registerFailure(userId) {
        const updated = await User.findByIdAndUpdate(
            userId, { $inc: { failedLoginAttempts: 1 } }, { new: true }
        );
        if (updated.failedLoginAttempts < maxLoginAttempts())
            return maxLoginAttempts() - updated.failedLoginAttempts;

        const lockUntil = new Date(Date.now() + lockMinutes() * 60 * 1000);
        await User.findByIdAndUpdate(userId, { lockUntil, failedLoginAttempts: 0 });
        await MfaChallenge.deleteMany({ user: userId });
        throw this.lockedError(lockUntil);
    }

    lockedError(lockUntil) {
        const minutes = Math.max(1, Math.ceil((lockUntil - Date.now()) / 60000));
        return httpError(
            423, `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${minutes} minuto(s)`, { restart: true }
        );
    }

    // Credenciales correctas (password o red social): se almacena el desafío y se
    // entrega un ticket temporal que solo sirve para los endpoints /mfa.
    async startMfa(user) {
        await MfaChallenge.deleteMany({ user: user._id });
        const challenge = await MfaChallenge.create({
            user: user._id,
            expiresAt: new Date(Date.now() + MFA_TTL_MS)
        });

        const mfaTicket = jwt.sign(
            { sub: user._id, purpose: 'mfa', cid: challenge._id },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );

        return { mfaRequired: true, mfaTicket, enrolled: user.mfa.enabled };
    }

    readTicket(ticket) {
        try {
            const payload = jwt.verify(ticket, process.env.JWT_SECRET, { algorithms: ['HS256'] });
            if (payload.purpose !== 'mfa') throw new Error('purpose');
            return payload;
        } catch (err) {
            throw this.restartError('La verificación expiró. Inicia sesión nuevamente');
        }
    }

    restartError(message) {
        return httpError(401, message, { restart: true });
    }

    // Primer ingreso: genera el secreto TOTP y el QR para Google Authenticator
    async mfaSetup(ticket) {
        const { sub, cid } = this.readTicket(ticket);
        const challenge = await MfaChallenge.findOne({ _id: cid, user: sub, expiresAt: { $gt: new Date() } });
        if (!challenge) throw this.restartError('La verificación expiró. Inicia sesión nuevamente');

        const user = await User.findById(sub);
        if (!user) throw this.restartError('Usuario no encontrado');
        // Con MFA activo no se puede volver a generar el secreto solo con el password
        if (user.mfa.enabled) throw httpError(409, 'El MFA ya está configurado para esta cuenta');

        const secret = authenticator.generateSecret();
        user.mfa.secret = encrypt(secret);
        await user.save();

        const otpauth = authenticator.keyuri(user.email, 'TechStore', secret);
        return { secret, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) };
    }

    // Paso 2 del login: valida el código de 6 dígitos y entrega el JWT completo
    async mfaVerify(ticket, code) {
        const { sub, cid } = this.readTicket(ticket);

        // El intento se cuenta antes de validar, de forma atómica
        const challenge = await MfaChallenge.findOneAndUpdate(
            { _id: cid, user: sub, attempts: { $lt: MFA_MAX_ATTEMPTS }, expiresAt: { $gt: new Date() } },
            { $inc: { attempts: 1 } },
            { new: true }
        );
        if (!challenge) throw this.restartError('La verificación expiró. Inicia sesión nuevamente');

        const user = await User.findById(sub).populate('store');
        if (!user) throw this.restartError('Usuario no encontrado');
        if (user.isLocked) throw this.lockedError(user.lockUntil);
        if (!user.mfa.secret) throw httpError(400, 'Primero debes configurar el MFA');

        const delta = /^\d{6}$/.test(code ?? '') ? authenticator.checkDelta(code, decrypt(user.mfa.secret)) : null;
        const step = Math.floor(Date.now() / TOTP_STEP_MS) + (delta ?? 0);
        const valid = delta !== null && step > user.mfa.lastStep;

        if (!valid) {
            // Los códigos incorrectos también cuentan para el bloqueo de la cuenta
            await this.registerFailure(user._id);

            const left = MFA_MAX_ATTEMPTS - challenge.attempts;
            if (left <= 0) {
                await MfaChallenge.deleteOne({ _id: cid });
                throw this.restartError('Superaste los 3 intentos. Inicia sesión nuevamente');
            }
            throw httpError(401, `Código incorrecto. Te quedan ${left} intento(s)`);
        }

        await MfaChallenge.deleteOne({ _id: cid });
        user.mfa.enabled = true;
        user.mfa.lastStep = step;
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        await user.save();

        return { token: this.signToken(user) };
    }

    signToken(user) {
        return jwt.sign(
            {
                sub: user._id,
                name: user.fullName,
                roles: [user.role],
                store: user.store ? { id: user.store._id, name: user.store.name } : null
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );
    }
}

export default new AuthService();
