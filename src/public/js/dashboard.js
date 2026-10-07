const LOW_STOCK = 5;

let me = null;
let products = [];
let editing = null;   // { mode: 'create' | 'edit' | 'stock', product }
let modal = null;

const sameStore = product => !!me.store && product.store.id === me.store.id;

// Los botones solo reflejan los permisos: la API los vuelve a validar en cada petición
const canManage = product => me.role === 'admin' || (me.role === 'gerente' && sameStore(product));
const canStock = product => canManage(product) || (me.role === 'empleado' && sameStore(product));

function actionButton(icon, title, onClick) {
    const button = document.createElement('button');
    button.className = 'btn-flat btn-icon';
    button.title = title;
    button.innerHTML = `<i class="material-icons">${icon}</i>`;
    button.addEventListener('click', onClick);
    return button;
}

function render() {
    UI.text('total-products', products.length);
    UI.text('total-units', products.reduce((sum, p) => sum + p.stock, 0));
    UI.text('total-low', products.filter(p => p.stock <= LOW_STOCK).length);

    const body = document.getElementById('products-body');
    body.innerHTML = '';
    document.getElementById('products-empty').hidden = products.length > 0;

    for (const product of products) {
        const row = document.createElement('tr');
        UI.cell(row, product.sku);
        UI.cell(row, product.name);
        UI.cell(row, product.category);
        UI.cell(row, product.store.name);
        UI.cell(row, UI.money(product.price));

        const stock = UI.cell(row, product.stock);
        if (product.stock <= LOW_STOCK) stock.className = 'low-stock';

        const actions = UI.cell(row, '');
        actions.textContent = '';
        actions.className = 'actions';
        if (canStock(product))
            actions.appendChild(actionButton('exposure', 'Actualizar stock', () => openModal('stock', product)));
        if (canManage(product)) {
            actions.appendChild(actionButton('edit', 'Editar', () => openModal('edit', product)));
            actions.appendChild(actionButton('delete', 'Eliminar', () => removeProduct(product)));
        }

        body.appendChild(row);
    }
}

function setField(id, value) {
    document.getElementById(id).value = value ?? '';
}

function openModal(mode, product = null) {
    editing = { mode, product };
    UI.error('');

    const titles = { create: 'Nuevo producto', edit: 'Editar producto', stock: `Stock de ${product ? product.name : ''}` };
    UI.text('product-modal-title', titles[mode]);

    // El Empleado de Ventas solo ve el campo stock (no puede modificar precios)
    for (const el of document.querySelectorAll('#product-modal .full-only')) el.hidden = mode === 'stock';
    // La tienda solo la elige el administrador al crear
    document.getElementById('p-store-wrap').hidden = !(mode === 'create' && me.role === 'admin');

    setField('p-sku', product && product.sku);
    setField('p-name', product && product.name);
    setField('p-category', product && product.category);
    setField('p-price', product && product.price);
    setField('p-stock', product ? product.stock : 0);

    M.updateTextFields();
    modal.open();
}

async function saveProduct(e) {
    e.preventDefault();
    UI.error('');

    const { mode, product } = editing;
    const stock = Number(document.getElementById('p-stock').value);
    if (!Number.isInteger(stock) || stock < 0) return UI.error('El stock debe ser un número entero mayor o igual a 0');

    try {
        if (mode === 'stock') {
            await Auth.api(`/api/products/${product.id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock }) });
        } else {
            const payload = {
                sku: document.getElementById('p-sku').value.trim(),
                name: document.getElementById('p-name').value.trim(),
                category: document.getElementById('p-category').value.trim(),
                price: Number(document.getElementById('p-price').value),
                stock
            };
            if (!payload.sku || !payload.name || document.getElementById('p-price').value === '')
                return UI.error('SKU, nombre y precio son requeridos');

            if (mode === 'create') {
                payload.store = document.getElementById('p-store').value;
                await Auth.api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
            } else {
                await Auth.api(`/api/products/${product.id}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
        }
        modal.close();
        M.toast({ html: 'Cambios guardados' });
        await load();
    } catch (err) {
        UI.error(err.message);
    }
}

async function removeProduct(product) {
    if (!confirm(`¿Eliminar "${product.name}" de ${product.store.name}?`)) return;
    try {
        await Auth.api(`/api/products/${product.id}`, { method: 'DELETE' });
        M.toast({ html: 'Producto eliminado' });
        await load();
    } catch (err) {
        M.toast({ html: err.message });
    }
}

async function loadReport() {
    const rows = await Auth.api('/api/products/report');
    const body = document.getElementById('report-body');
    body.innerHTML = '';
    for (const r of rows) {
        const row = document.createElement('tr');
        UI.cell(row, r.store.name);
        UI.cell(row, r.store.city);
        UI.cell(row, r.products);
        UI.cell(row, r.units);
        UI.cell(row, UI.money(r.value));
        UI.cell(row, r.lowStock);
        body.appendChild(row);
    }
    document.getElementById('report-panel').hidden = false;
}

async function load() {
    products = await Auth.api('/api/products');
    render();
    // Reportes: admin y auditor (todas las tiendas), gerente (solo la suya)
    if (['admin', 'gerente', 'auditor'].includes(me.role)) await loadReport();
}

async function init() {
    me = await Auth.api('/api/users/me');

    UI.text('welcome-name', me.fullName);
    UI.text('welcome-store', me.store ? me.store.name : (
        ['admin', 'auditor'].includes(me.role)
            ? 'Acceso a todas las tiendas'
            : 'Aún no tienes una tienda asignada: contacta al administrador'
    ));
    UI.text('avatar-initials', UI.initials(me));
    document.getElementById('roles').replaceChildren(UI.chip(me.role));

    modal = M.Modal.init(document.getElementById('product-modal'));
    document.getElementById('product-form').addEventListener('submit', saveProduct);

    // Crear productos: admin (cualquier tienda) y gerente (su tienda)
    if (me.role === 'admin' || (me.role === 'gerente' && me.store)) {
        const button = document.getElementById('new-product');
        button.hidden = false;
        button.addEventListener('click', () => openModal('create'));
    }
    if (me.role === 'admin') {
        const stores = await fetch('/api/stores').then(res => res.json());
        UI.options(document.getElementById('p-store'), stores);
    }

    await load();
}

if (Auth.guard()) {
    init().catch(err => M.toast({ html: err.message }));
}
