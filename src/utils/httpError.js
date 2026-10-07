// Error con código HTTP, lo traduce el manejador global de server.js
export default function httpError(status, message, extra = {}) {
    const err = new Error(message);
    err.status = status;
    err.extra = extra;
    return err;
}
