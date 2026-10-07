const PROVIDER_LABELS = { password: 'Password', google: 'Google', github: 'GitHub' };

const isAdmin = Auth.hasRole('admin');
let users = [];
let selected = null;
let modal = null;

function userCell(row, user) {
    const wrap = document.createElement('div');
    wrap.className = 'user-cell';

    const initials = document.createElement('span');
    initials.className = 'mini-initials';
    initials.textContent = UI.initials(user);

    const name = document.createElement('span');
    name.textContent = user.fullName || '—';

    wrap.append(initials, name);
    UI.cell(row, '').replaceChildren(wrap);
}

function render() {
    UI.text('total', users.length);
    UI.text('total-mfa', users.filter(u => u.mfaEnabled).length);
    UI.text('total-locked', users.filter(u => u.locked).length);

    const body = document.getElementById('users-body');
    body.innerHTML = '';
    for (const user of users) {
        const row = document.createElement('tr');
        userCell(row, user);
        UI.cell(row, user.email);
        UI.cell(row, '').replaceChildren(UI.chip(user.role));
        UI.cell(row, user.store && user.store.name);
        UI.cell(row, user.providers.map(p => PROVIDER_LABELS[p]).join(', '));
        UI.cell(row, user.mfaEnabled ? 'Activo' : 'Pendiente');

        const status = UI.cell(row, user.locked ? `Bloqueado hasta ${UI.dateTime(user.lockUntil)}` : 'Activo');
        if (user.locked) status.className = 'low-stock';

        const actions = UI.cell(row, '');
        actions.textContent = '';
        if (isAdmin) {
            const button = document.createElement('button');
            button.className = 'btn-small btn-brand waves-effect waves-light';
            button.textContent = 'Gestionar';
            button.addEventListener('click', () => openModal(user));
            actions.appendChild(button);
        }

        body.appendChild(row);
    }
}

function openModal(user) {
    selected = user;
    UI.error('');
    UI.text('m-full-name', user.fullName);
    UI.text('m-email', user.email);
    document.getElementById('m-role').value = user.role;
    document.getElementById('m-store').value = user.store ? user.store.id : '';
    document.getElementById('m-unlock').hidden = !user.locked;
    document.getElementById('m-reset-mfa').hidden = !user.mfaEnabled;
    modal.open();
}

async function run(action, message) {
    UI.error('');
    try {
        await action();
        modal.close();
        M.toast({ html: message });
        await load();
    } catch (err) {
        UI.error(err.message);
    }
}

async function load() {
    users = await Auth.api('/api/users');
    render();
}

// Admin: gestiona usuarios y roles. Auditor: solo lectura.
if (Auth.guard(['admin', 'auditor'])) {
    if (!isAdmin) UI.text('admin-subtitle', 'Vista de solo lectura para auditoría.');

    modal = M.Modal.init(document.getElementById('user-modal'));

    fetch('/api/stores')
        .then(res => res.json())
        .then(stores => UI.options(document.getElementById('m-store'), stores, 'Sin tienda asignada'));

    document.getElementById('user-form').addEventListener('submit', e => {
        e.preventDefault();
        const payload = {
            role: document.getElementById('m-role').value,
            store: document.getElementById('m-store').value || null
        };
        run(() => Auth.api(`/api/users/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload) }),
            'Usuario actualizado');
    });

    document.getElementById('m-unlock').addEventListener('click', e => {
        e.preventDefault();
        run(() => Auth.api(`/api/users/${selected.id}/unlock`, { method: 'POST' }), 'Cuenta desbloqueada');
    });

    document.getElementById('m-reset-mfa').addEventListener('click', e => {
        e.preventDefault();
        run(() => Auth.api(`/api/users/${selected.id}/reset-mfa`, { method: 'POST' }), 'MFA reiniciado');
    });

    load().catch(err => M.toast({ html: err.message }));
}
