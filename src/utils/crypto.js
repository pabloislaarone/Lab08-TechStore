import crypto from 'crypto';

// Cifrado AES-256-GCM para el secreto TOTP: si la base de datos se filtra,
// los secretos no sirven sin MFA_ENC_KEY.
function key() {
    return crypto.createHash('sha256').update(process.env.MFA_ENC_KEY).digest();
}

export function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

export function decrypt(payload) {
    const [iv, tag, data] = payload.split('.').map(p => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
