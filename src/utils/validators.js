// min 8 caracteres, min 1 mayúscula, min 1 dígito, min 1 caracter especial
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPassword(password) {
    return typeof password === 'string' && PASSWORD_REGEX.test(password);
}

export function isValidEmail(email) {
    return typeof email === 'string' && EMAIL_REGEX.test(email);
}

export const PASSWORD_MESSAGE =
    'El password debe tener mínimo 8 caracteres, 1 mayúscula, 1 número y 1 caracter especial';
