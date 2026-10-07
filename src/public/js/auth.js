// Manejo de sesión con JWT en sessionStorage, protección de rutas y llamadas a la API
const TOKEN_KEY = 'token';
const MFA_TICKET_KEY = 'mfaTicket';
const MFA_ENROLLED_KEY = 'mfaEnrolled';

const ROLE_LABELS = {
    admin: 'Administrador del Sistema',
    gerente: 'Gerente de Tienda',
    empleado: 'Empleado de Ventas',
    auditor: 'Auditor'
};

const Auth = {

    getToken() {
        return sessionStorage.getItem(TOKEN_KEY);
    },

    setToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    },

    // Ticket temporal entre el paso 1 (credenciales) y el paso 2 (código MFA)
    setMfa(ticket, enrolled) {
        sessionStorage.setItem(MFA_TICKET_KEY, ticket);
        sessionStorage.setItem(MFA_ENROLLED_KEY, enrolled ? '1' : '0');
    },

    getMfa() {
        return {
            ticket: sessionStorage.getItem(MFA_TICKET_KEY),
            enrolled: sessionStorage.getItem(MFA_ENROLLED_KEY) === '1'
        };
    },

    clearMfa() {
        sessionStorage.removeItem(MFA_TICKET_KEY);
        sessionStorage.removeItem(MFA_ENROLLED_KEY);
    },

    // Decodifica el payload del JWT (sub, name, roles, store, exp)
    payload() {
        const token = this.getToken();
        if (!token) return null;
        try {
            const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (err) {
            return null;
        }
    },

    isValid() {
        const payload = this.payload();
        return !!payload && !!payload.exp && payload.exp * 1000 > Date.now();
    },

    roles() {
        const payload = this.payload();
        return (payload && payload.roles) || [];
    },

    hasRole(...roles) {
        return this.roles().some(r => roles.includes(r));
    },

    home() {
        return '/dashboard';
    },

    logout() {
        sessionStorage.removeItem(TOKEN_KEY);
        this.clearMfa();
        window.location.replace('/signIn');
    },

    // Protege una página: sin token válido => /signIn, sin rol suficiente => /403
    guard(requiredRoles = []) {
        if (!this.isValid()) {
            this.logout();
            return false;
        }
        if (requiredRoles.length > 0 && !this.hasRole(...requiredRoles)) {
            window.location.replace('/403');
            return false;
        }

        // Cerrar sesión automáticamente cuando el token expire
        const msLeft = this.payload().exp * 1000 - Date.now();
        setTimeout(() => this.logout(), Math.min(msLeft, 2147483647));

        this.renderNav();
        return true;
    },

    // Petición a la API con el token JWT
    async api(path, options = {}) {
        const res = await fetch(path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.getToken()}`,
                ...(options.headers || {})
            }
        });

        if (res.status === 401) {
            this.logout();
            throw new Error('Sesión expirada');
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Ocurrió un error');
        return data;
    },

    renderNav() {
        const nav = document.getElementById('nav-links');
        if (!nav) return;

        const links = this.isValid()
            ? [
                ['/dashboard', 'Inventario'],
                ...(this.hasRole('admin', 'auditor') ? [['/admin', 'Usuarios']] : []),
                ['#logout', 'Cerrar sesión']
            ]
            : [
                ['/signIn', 'Iniciar sesión'],
                ['/signUp', 'Registrarse']
            ];

        nav.innerHTML = '';
        for (const [href, text] of links) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = href;
            a.textContent = text;
            if (href === '#logout') {
                a.addEventListener('click', e => {
                    e.preventDefault();
                    this.logout();
                });
            }
            if (href === window.location.pathname) li.className = 'active';
            li.appendChild(a);
            nav.appendChild(li);
        }

        // En las páginas 403 y 404 el botón lleva al inicio de la sesión
        const homeLink = document.getElementById('home-link');
        if (homeLink) homeLink.href = this.isValid() ? this.home() : '/signIn';
    }
};

// Utilidades de presentación compartidas por las páginas
const UI = {

    text(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value === undefined || value === null || value === '' ? '—' : value;
    },

    dateTime(iso) {
        return iso ? new Date(iso).toLocaleString('es-PE') : '';
    },

    money(value) {
        return `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    initials(user) {
        const letters = (user.fullName || '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('');
        return (letters || user.email[0]).toUpperCase();
    },

    chip(role) {
        const chip = document.createElement('span');
        chip.className = `role-chip ${role}`;
        chip.textContent = ROLE_LABELS[role] || role;
        return chip;
    },

    cell(row, value) {
        const td = document.createElement('td');
        td.textContent = value === undefined || value === null || value === '' ? '—' : value;
        row.appendChild(td);
        return td;
    },

    // Llena un <select> con las tiendas ({ id, name })
    options(select, stores, placeholder) {
        select.innerHTML = '';
        if (placeholder !== undefined) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = placeholder;
            select.appendChild(option);
        }
        for (const store of stores) {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            select.appendChild(option);
        }
    },

    error(message) {
        const el = document.getElementById('form-error');
        if (el) el.textContent = message || '';
    }
};
