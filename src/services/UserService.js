import User, { ROLES } from '../models/User.js';
import Store from '../models/Store.js';
import MfaChallenge from '../models/MfaChallenge.js';
import httpError from '../utils/httpError.js';

function notFound() {
    return httpError(404, 'Usuario no encontrado');
}

// Nunca se devuelve el password ni el secreto MFA
function toDTO(user) {
    return {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        store: user.store ? { id: user.store._id, name: user.store.name } : null,
        providers: [
            ...(user.password ? ['password'] : []),
            ...(user.googleId ? ['google'] : []),
            ...(user.githubId ? ['github'] : [])
        ],
        mfaEnabled: user.mfa.enabled,
        locked: user.isLocked,
        lockUntil: user.isLocked ? user.lockUntil : null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

class UserService {

    async getAll() {
        const users = await User.find().populate('store').sort({ fullName: 1 });
        return users.map(toDTO);
    }

    async getById(id) {
        const user = await User.findById(id).populate('store');
        if (!user) throw notFound();
        return toDTO(user);
    }

    // Solo el administrador: cambia nombre, rol y tienda asignada
    async update(adminId, id, { fullName, role, store }) {
        const user = await User.findById(id);
        if (!user) throw notFound();

        if (role !== undefined) {
            if (!ROLES.includes(role)) throw httpError(400, 'Rol no válido');
            if (id === adminId && role !== 'admin')
                throw httpError(400, 'No puedes quitarte tu propio rol de administrador');
            user.role = role;
        }
        if (store !== undefined) {
            if (store && !await Store.exists({ _id: store })) throw httpError(400, 'La tienda seleccionada no existe');
            user.store = store || null;
        }
        if (fullName !== undefined) user.fullName = fullName;

        await user.save();
        return toDTO(await user.populate('store'));
    }

    async unlock(id) {
        const user = await User.findByIdAndUpdate(
            id, { failedLoginAttempts: 0, lockUntil: null }, { new: true }
        ).populate('store');
        if (!user) throw notFound();
        return toDTO(user);
    }

    // Si el usuario pierde su teléfono: vuelve a configurar el MFA en su próximo login
    async resetMfa(id) {
        const user = await User.findByIdAndUpdate(
            id, { mfa: { enabled: false, secret: null, lastStep: 0 } }, { new: true }
        ).populate('store');
        if (!user) throw notFound();
        await MfaChallenge.deleteMany({ user: user._id });
        return toDTO(user);
    }
}

export default new UserService();
