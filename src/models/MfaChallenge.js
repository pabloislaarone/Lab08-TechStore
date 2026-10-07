import mongoose from 'mongoose';

// Desafío MFA pendiente: se crea cuando las credenciales son correctas y
// vive 5 minutos (índice TTL) o hasta agotar los 3 intentos.
const MfaChallengeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    expiresAt: {
        type: Date,
        required: true,
        expires: 0
    }
}, { timestamps: true });

export default mongoose.model('MfaChallenge', MfaChallengeSchema);
