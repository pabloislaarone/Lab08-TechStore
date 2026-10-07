export default function authorize(requiredRoles = []) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'No autorizado' });

        //Si no hay roles requeridos, permitir usuarios autenticados.
        if (requiredRoles.length === 0) return next();

        if (!requiredRoles.includes(req.user.role))
            return res.status(403).json({ message: 'Prohibido: permisos insuficientes' });
        next();
    };
}
