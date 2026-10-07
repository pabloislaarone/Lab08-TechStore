import mongoose from 'mongoose';

export const ROLES = ['admin', 'gerente', 'empleado', 'auditor'];

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // Se guarda el hash; las reglas del password se validan sobre el texto plano
    // en utils/validators.js. Las cuentas creadas con Google/GitHub no tienen password.
    password: {
        type: String
    },
    fullName: {
        type: String,
        required: [true, 'El nombre completo es requerido'],
        trim: true
    },
    role: {
        type: String,
        enum: ROLES,
        default: 'empleado'
    },
    // Tienda asignada (el admin y el auditor pueden no tener una)
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        default: null
    },
    googleId: { type: String, index: true, sparse: true },
    githubId: { type: String, index: true, sparse: true },

    // Bloqueo por intentos fallidos de login
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // MFA con TOTP: el secreto se guarda cifrado (utils/crypto.js)
    mfa: {
        enabled: { type: Boolean, default: false },
        secret: { type: String, default: null },
        // Último intervalo de 30s aceptado, para que un código no se use dos veces
        lastStep: { type: Number, default: 0 }
    }
}, { timestamps: true });

UserSchema.virtual('isLocked').get(function () {
    return !!this.lockUntil && this.lockUntil > new Date();
});

export default mongoose.model('User', UserSchema);
