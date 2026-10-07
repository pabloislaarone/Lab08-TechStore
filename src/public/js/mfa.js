// El login social vuelve con el ticket en el fragmento de la URL (#ticket=...)
const hash = new URLSearchParams(window.location.hash.slice(1));
if (hash.get('ticket')) {
    Auth.setMfa(hash.get('ticket'), hash.get('enrolled') === '1');
    history.replaceState(null, '', '/mfa');
}

const { ticket, enrolled } = Auth.getMfa();

function post(path, body) {
    return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(async res => ({ ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) }));
}

// El ticket ya no sirve (expiró o se agotaron los 3 intentos): volver al paso 1
function restart(message) {
    Auth.clearMfa();
    window.location.replace(`/signIn?error=${encodeURIComponent(message)}`);
}

if (Auth.isValid()) {
    window.location.replace(Auth.home());
} else if (!ticket) {
    window.location.replace('/signIn');
} else {
    Auth.renderNav();

    // Primer ingreso: mostrar el QR para vincular la app de autenticación
    if (!enrolled) {
        post('/api/auth/mfa/setup', { mfaTicket: ticket }).then(({ ok, status, data }) => {
            if (data.restart) return restart(data.message);
            if (status === 409) return;
            if (!ok) return UI.error(data.message || 'No se pudo generar el código QR');

            document.getElementById('mfa-qr').src = data.qr;
            UI.text('mfa-secret', data.secret);
            UI.text('mfa-subtitle', 'Es tu primer ingreso: configura tu segundo factor de autenticación.');
            document.getElementById('mfa-setup').hidden = false;
        }).catch(() => UI.error('No se pudo conectar con el servidor'));
    }

    document.getElementById('mfa-cancel').addEventListener('click', () => Auth.clearMfa());

    document.getElementById('mfa-form').addEventListener('submit', async e => {
        e.preventDefault();
        UI.error('');

        const input = document.getElementById('code');
        const code = input.value.trim();
        if (!/^\d{6}$/.test(code)) return UI.error('El código debe tener 6 dígitos');

        try {
            const { ok, data } = await post('/api/auth/mfa/verify', { mfaTicket: ticket, code });
            if (data.restart) return restart(data.message);
            if (!ok) {
                input.value = '';
                input.focus();
                return UI.error(data.message || 'Código incorrecto');
            }

            // Segundo factor correcto: acceso concedido con el JWT completo
            Auth.clearMfa();
            Auth.setToken(data.token);
            window.location.replace(Auth.home());
        } catch (err) {
            UI.error('No se pudo conectar con el servidor');
        }
    });
}
