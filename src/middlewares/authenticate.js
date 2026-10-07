import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header || !header.startsWith('Bearer '))
            return res.status(401).json({ message: 'No autorizado' });

        const token = header.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

        // El ticket temporal de MFA no es un token de acceso
        if (payload.purpose) return res.status(401).json({ message: 'Token no válido o caducado' });

        // Rol y tienda se leen de la base de datos en cada petición, así un cambio
        // hecho por el administrador aplica sin esperar a que expire el token.
        const user = await User.findById(payload.sub);
        if (!user) return res.status(401).json({ message: 'Token no válido o caducado' });

        req.user = {
            id: user._id.toString(),
            role: user.role,
            store: user.store ? user.store.toString() : null
        };
        next();

    } catch (err) {
        return res.status(401).json({ message: 'Token no válido o caducado' });
    }
}
