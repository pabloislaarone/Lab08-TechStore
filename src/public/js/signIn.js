// Si ya hay una sesión válida, ir directo al inventario
if (Auth.isValid()) {
    window.location.replace(Auth.home());
} else {
    Auth.renderNav();
}

// Mensaje de error que devuelve el login con Google/GitHub
const oauthError = new URLSearchParams(window.location.search).get('error');
if (oauthError) {
    UI.error(oauthError);
    history.replaceState(null, '', '/signIn');
}

document.getElementById('signin-form').addEventListener('submit', async e => {
    e.preventDefault();
    UI.error('');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) return UI.error('El email y password son requeridos');

    try {
        const res = await fetch('/api/auth/signIn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) return UI.error(data.message || 'No se pudo iniciar sesión');

        // Credenciales correctas: falta el segundo factor
        Auth.setMfa(data.mfaTicket, data.enrolled);
        window.location.replace('/mfa');
    } catch (err) {
        UI.error('No se pudo conectar con el servidor');
    }
});
