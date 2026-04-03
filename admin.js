// ============================================================
//  admin.js  –  Panel de administración
// ============================================================

let supabase;
let currentUser = null;
let allAdminProviders = [];
let allAdminReviews = [];
let editingProviderId = null;
let reviewFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  supabase = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);

  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    showAdminPanel();
  }

  // Date
  document.getElementById('adminDate').textContent = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
});

// ---- AUTH ----
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!email || !password) {
    errEl.textContent = 'Ingresá email y contraseña.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.querySelector('#loginScreen .btn-submit');
  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Ingresar';

  if (error) {
    errEl.textContent = 'Email o contraseña incorrectos.';
    errEl.classList.remove('hidden');
    return;
  }
  currentUser = data.user;
  showAdminPanel();
}

// Enter key on login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen') &&
      !document.getElementById('loginScreen').classList.contains('hidden')) {
    doLogin();
  }
});

async function doLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function showAdminPanel() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');
  loadDashboard();
  loadAdminProviders();
  loadAdminReviews();
}

// ---- SECTIONS ----
function showSection(name, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.querySelectorAll('.as-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const target = document.querySelector(`[data-section="${name}"]`);
    if (target) target.classList.add('active');
  }
}

// ---- DASHBOARD ----
async function loadDashboard() {
  const { data: providers } = await supabase.from('providers').select('id').eq('active', true);
  const { data: reviews } = await supabase.from('reviews').select('id, rating, status, author_name, text, created_at, provider_id');

  const totalProviders = providers?.length || 0;
  const totalReviews = reviews?.length || 0;
  const pending = reviews?.filter(r => r.status === 'pending').length || 0;
  const approved = reviews?.filter(r => r.status === 'approved') || [];
  const avg = approved.length ? (approved.reduce((a, r) => a + r.rating, 0) / approved.length).toFixed(1) : '–';

  document.getElementById('ds-providers').textContent = totalProviders;
  document.getElementById('ds-reviews').textContent = totalReviews;
  document.getElementById('ds-pending').textContent = pending;
  document.getElementById('ds-avg').textContent = avg + (avg !== '–' ? '★' : '');

  // Latest reviews
  const latest = (reviews || []).slice(0, 5);
  const providerMap = {};
  if (allAdminProviders.length) {
    allAdminProviders.forEach(p => providerMap[p.id] = p.name);
  } else {
    const { data: plist } = await supabase.from('providers').select('id, name');
    (plist || []).forEach(p => providerMap[p.id] = p.name);
  }

  document.getElementById('latestReviews').innerHTML = latest.length
    ? latest.map(r => `
      <div class="lr-item">
        <div>
          <div class="lr-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
          <div class="lr-text">${escHtml(r.text)}</div>
          <div class="lr-meta">${escHtml(r.author_name)} · <span class="lr-prov">${escHtml(providerMap[r.provider_id] || 'Desconocido')}</span></div>
        </div>
        <span class="lr-status ${r.status}">${statusLabel(r.status)}</span>
      </div>`).join('')
    : '<p style="color:var(--muted);font-size:.88rem">No hay reseñas aún.</p>';
}

// ---- PROVIDERS ----
async function loadAdminProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .order('created_at', { ascending: false });

  allAdminProviders = data || [];
  renderAdminProviders(allAdminProviders);
}

function renderAdminProviders(list) {
  const el = document.getElementById('adminProvidersList');
  if (!list.length) {
    el.innerHTML = '<div class="loading-state"><p>No hay proveedores cargados aún.</p></div>';
    return;
  }
  el.innerHTML = list.map(p => {
    const initials = (p.name || 'XX').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarContent = p.avatar_url
      ? `<img src="${escHtml(p.avatar_url)}" alt="">`
      : initials;
    const avatarStyle = p.avatar_url ? '' : `style="background:${escHtml(p.color || '#00897b')}"`;
    return `<div class="apl-item">
      <div class="apl-avatar" ${avatarStyle}>${avatarContent}</div>
      <div class="apl-info">
        <h4>${escHtml(p.name)}</h4>
        <p>${escHtml(p.zone || '')} · ${escHtml((Array.isArray(p.categories) ? p.categories : (p.categories||'').split(',')).slice(0,2).join(', '))}</p>
      </div>
      <div class="apl-meta">
        <span class="apl-status ${p.active ? 'active' : 'inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span>
        <div class="apl-actions">
          <button class="btn-icon btn-view" title="Ver perfil" onclick="window.open('proveedor.html?id=${p.id}','_blank')">👁</button>
          <button class="btn-icon btn-edit" title="Editar" onclick="editProvider('${p.id}')">✏️</button>
          <button class="btn-icon btn-toggle ${p.active ? '' : 'off'}" title="${p.active ? 'Desactivar' : 'Activar'}" onclick="toggleProvider('${p.id}', ${p.active})">
            ${p.active ? '✓' : '✗'}
          </button>
          <button class="btn-icon btn-delete" title="Eliminar" onclick="deleteProvider('${p.id}', '${escHtml(p.name)}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterAdminProviders() {
  const q = document.getElementById('adminSearchProv').value.toLowerCase();
  const filtered = allAdminProviders.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.zone || '').toLowerCase().includes(q)
  );
  renderAdminProviders(filtered);
}

// ---- TOGGLE / DELETE ----
async function toggleProvider(id, currentActive) {
  const { error } = await supabase.from('providers').update({ active: !currentActive }).eq('id', id);
  if (!error) {
    toast(`Proveedor ${!currentActive ? 'activado' : 'desactivado'}.`, 'success');
    await loadAdminProviders();
    loadDashboard();
  }
}

async function deleteProvider(id, name) {
  if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
  const { error } = await supabase.from('providers').delete().eq('id', id);
  if (!error) {
    toast('Proveedor eliminado.', 'success');
    await loadAdminProviders();
    loadDashboard();
  } else {
    toast('Error al eliminar.', 'error');
  }
}

// ---- OPEN / CLOSE MODAL ----
function openNewProvider() {
  editingProviderId = null;
  document.getElementById('modalTitle').textContent = 'Nuevo proveedor';
  resetProviderForm();
  openModal();
  showSection('providers', document.querySelector('[data-section=providers]'));
}

function editProvider(id) {
  const p = allAdminProviders.find(x => x.id === id);
  if (!p) return;
  editingProviderId = id;
  document.getElementById('modalTitle').textContent = 'Editar proveedor';
  fillProviderForm(p);
  openModal();
}

function openModal() {
  document.getElementById('providerModal').classList.remove('hidden');
  document.getElementById('providerModalOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  switchTab('basic', document.querySelector('.am-tab'));
}

function closeProviderModal() {
  document.getElementById('providerModal').classList.add('hidden');
  document.getElementById('providerModalOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- TABS ----
function switchTab(name, btn) {
  document.querySelectorAll('.am-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.am-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
  if (btn) btn.classList.add('active');
}

// ---- FORM ----
function resetProviderForm() {
  ['pName','pZone','pDesc','pAbout','pWhatsapp','pEmail','pYears','pAvatar','pGallery','pPriceFrom','pPriceTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('pActive').value = 'true';
  document.querySelectorAll('#serviceChecks input[type=checkbox]').forEach(cb => cb.checked = false);
  document.getElementById('pColor').value = '#00897b';
  document.querySelectorAll('#colorPalette .cp-item').forEach(c => c.classList.toggle('selected', c.dataset.color === '#00897b'));
  document.getElementById('extraInfoList').innerHTML = '';
  // Color palette click
  initColorPalette();
}

function fillProviderForm(p) {
  resetProviderForm();
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pZone').value = p.zone || '';
  document.getElementById('pDesc').value = p.description || '';
  document.getElementById('pAbout').value = p.about || '';
  document.getElementById('pWhatsapp').value = p.whatsapp || '';
  document.getElementById('pEmail').value = p.email || '';
  document.getElementById('pYears').value = p.years_experience || '';
  document.getElementById('pAvatar').value = p.avatar_url || '';
  document.getElementById('pActive').value = p.active ? 'true' : 'false';
  document.getElementById('pPriceFrom').value = p.price_from || '';
  document.getElementById('pPriceTo').value = p.price_to || '';

  // Categories
  const cats = Array.isArray(p.categories) ? p.categories : (p.categories || '').split(',').map(c => c.trim()).filter(Boolean);
  document.querySelectorAll('#serviceChecks input[type=checkbox]').forEach(cb => {
    cb.checked = cats.includes(cb.value);
  });

  // Gallery
  const gallery = Array.isArray(p.gallery) ? p.gallery : [];
  document.getElementById('pGallery').value = gallery.join('\n');

  // Color
  const color = p.color || '#00897b';
  document.getElementById('pColor').value = color;
  document.querySelectorAll('#colorPalette .cp-item').forEach(c => c.classList.toggle('selected', c.dataset.color === color));

  // Extra info
  const extra = Array.isArray(p.extra_info) ? p.extra_info : [];
  extra.forEach(e => addExtraInfo(e.key, e.value));
}

function initColorPalette() {
  document.querySelectorAll('#colorPalette .cp-item').forEach(item => {
    item.onclick = () => {
      document.querySelectorAll('#colorPalette .cp-item').forEach(c => c.classList.remove('selected'));
      item.classList.add('selected');
      document.getElementById('pColor').value = item.dataset.color;
    };
  });
}

// Extra info rows
function addExtraInfo(key = '', value = '') {
  const list = document.getElementById('extraInfoList');
  const div = document.createElement('div');
  div.className = 'ei-item';
  div.innerHTML = `
    <input type="text" placeholder="Etiqueta (ej: Días)" value="${escHtml(key)}" class="ei-key">
    <input type="text" placeholder="Valor (ej: Lun a Sáb)" value="${escHtml(value)}" class="ei-val">
    <button class="ei-remove" onclick="this.parentElement.remove()" title="Eliminar">✕</button>`;
  list.appendChild(div);
}

// ---- SAVE PROVIDER ----
async function saveProvider() {
  const name = document.getElementById('pName').value.trim();
  const zone = document.getElementById('pZone').value.trim();
  const desc = document.getElementById('pDesc').value.trim();
  const whatsapp = document.getElementById('pWhatsapp').value.trim().replace(/\D/g, '');

  if (!name || !zone || !desc) {
    toast('Completá los campos obligatorios (nombre, zona, descripción).', 'error');
    switchTab('basic', document.querySelector('.am-tab'));
    return;
  }
  if (!whatsapp) {
    toast('El WhatsApp es obligatorio.', 'error');
    switchTab('basic', document.querySelector('.am-tab'));
    return;
  }

  const cats = Array.from(document.querySelectorAll('#serviceChecks input[type=checkbox]:checked')).map(cb => cb.value);
  const galleryRaw = document.getElementById('pGallery').value.trim();
  const gallery = galleryRaw ? galleryRaw.split('\n').map(u => u.trim()).filter(Boolean) : [];
  const extraItems = Array.from(document.querySelectorAll('#extraInfoList .ei-item')).map(row => ({
    key: row.querySelector('.ei-key').value.trim(),
    value: row.querySelector('.ei-val').value.trim()
  })).filter(e => e.key && e.value);

  const payload = {
    name,
    zone,
    description: desc,
    about: document.getElementById('pAbout').value.trim() || null,
    whatsapp,
    email: document.getElementById('pEmail').value.trim() || null,
    years_experience: parseInt(document.getElementById('pYears').value) || null,
    avatar_url: document.getElementById('pAvatar').value.trim() || null,
    color: document.getElementById('pColor').value,
    active: document.getElementById('pActive').value === 'true',
    categories: cats,
    gallery,
    price_from: parseInt(document.getElementById('pPriceFrom').value) || null,
    price_to: parseInt(document.getElementById('pPriceTo').value) || null,
    extra_info: extraItems,
  };

  const btn = document.querySelector('.am-footer .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  let error;
  if (editingProviderId) {
    ({ error } = await supabase.from('providers').update(payload).eq('id', editingProviderId));
  } else {
    ({ error } = await supabase.from('providers').insert(payload));
  }

  btn.disabled = false;
  btn.textContent = 'Guardar proveedor';

  if (error) {
    console.error(error);
    toast('Error al guardar: ' + error.message, 'error');
    return;
  }

  closeProviderModal();
  toast(editingProviderId ? 'Proveedor actualizado.' : 'Proveedor creado.', 'success');
  await loadAdminProviders();
  loadDashboard();
}

// ---- REVIEWS ----
async function loadAdminReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, providers(name)')
    .order('created_at', { ascending: false });

  allAdminReviews = data || [];
  renderAdminReviews();
}

function filterReviews(filter, btn) {
  reviewFilter = filter;
  document.querySelectorAll('.reviews-filter-row .chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAdminReviews();
}

function renderAdminReviews() {
  const list = document.getElementById('adminReviewsList');
  let filtered = [...allAdminReviews];
  if (reviewFilter !== 'all') filtered = filtered.filter(r => r.status === reviewFilter);

  if (!filtered.length) {
    list.innerHTML = '<div class="loading-state"><p>No hay reseñas en esta categoría.</p></div>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const provName = r.providers?.name || 'Proveedor desconocido';
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('es-AR') : '';
    return `<div class="ar-item" id="ar-${r.id}">
      <div class="ar-header">
        <span class="ar-name">${escHtml(r.author_name)}</span>
        <span class="ar-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
        <span class="ar-prov">${escHtml(provName)}</span>
        <span class="ar-date">${date}</span>
      </div>
      <div class="ar-text">${escHtml(r.text)}</div>
      <div class="ar-actions">
        <span class="ar-status ${r.status}">${statusLabel(r.status)}</span>
        ${r.status !== 'approved' ? `<button class="btn-approve" onclick="updateReview('${r.id}','approved')">✓ Aprobar</button>` : ''}
        ${r.status !== 'rejected' ? `<button class="btn-reject" onclick="updateReview('${r.id}','rejected')">✗ Rechazar</button>` : ''}
        <button class="btn-delete-review" onclick="deleteReview('${r.id}')" title="Eliminar">🗑 Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

async function updateReview(id, status) {
  const { error } = await supabase.from('reviews').update({ status }).eq('id', id);
  if (!error) {
    toast(`Reseña ${status === 'approved' ? 'aprobada' : 'rechazada'}.`, 'success');
    allAdminReviews = allAdminReviews.map(r => r.id === id ? { ...r, status } : r);
    renderAdminReviews();
    loadDashboard();
  }
}

async function deleteReview(id) {
  if (!confirm('¿Eliminar esta reseña?')) return;
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (!error) {
    toast('Reseña eliminada.', 'success');
    allAdminReviews = allAdminReviews.filter(r => r.id !== id);
    renderAdminReviews();
    loadDashboard();
  }
}

// ---- HELPERS ----
function statusLabel(s) {
  return { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }[s] || s;
}

function toast(msg, type = '') {
  const t = document.getElementById('adminToast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 4000);
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Init color palette on first load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initColorPalette, 100);
});
