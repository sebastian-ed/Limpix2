// ============================================================
//  admin.js  –  Panel de administración
// ============================================================

let supabase;
let currentUser = null;
let allAdminProviders = [];
let allAdminReviews = [];
let editingProviderId = null;
let reviewFilter = 'all';
let adminBootError = null;

const $ = (id) => document.getElementById(id);

function setLoginState(isLoading, label = 'Ingresar') {
  const btn = document.querySelector('#loginScreen .btn-submit');
  if (!btn) return;
  btn.disabled = !!isLoading;
  btn.textContent = isLoading ? 'Ingresando...' : label;
}

function showLoginError(message) {
  const errEl = $('loginError');
  if (!errEl) return;
  errEl.textContent = message;
  errEl.classList.remove('hidden');
}

function hideLoginError() {
  const errEl = $('loginError');
  if (!errEl) return;
  errEl.classList.add('hidden');
}

function ensureSupabaseReady() {
  if (!window.supabase || !window.SUPA_URL || !window.SUPA_KEY) {
    adminBootError = 'No se pudo inicializar Supabase. Revisá supabase.js y que el CDN esté cargando correctamente.';
    return false;
  }
  if (!supabase) {
    supabase = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);
  }
  return true;
}

async function bootAdmin() {
  try {
    bindUI();

    if (!ensureSupabaseReady()) {
      showLoginError(adminBootError);
      return;
    }

    const adminDate = $('adminDate');
    if (adminDate) {
      adminDate.textContent = new Date().toLocaleDateString('es-AR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error leyendo sesión:', error);
      return;
    }

    if (data?.session) {
      currentUser = data.session.user;
      await showAdminPanel();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        await showAdminPanel();
      }
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        $('adminPanel')?.classList.add('hidden');
        $('loginScreen')?.classList.remove('hidden');
      }
    });
  } catch (err) {
    console.error('Fallo iniciando panel admin:', err);
    showLoginError('Se produjo un error cargando el panel. Abrí la consola y verificá que no haya errores de JavaScript o configuración.');
  }
}

document.addEventListener('DOMContentLoaded', bootAdmin);

function bindUI() {
  const loginBtn = document.querySelector('#loginScreen .btn-submit');
  if (loginBtn) {
    loginBtn.addEventListener('click', doLogin);
  }

  const passwordInput = $('loginPassword');
  const emailInput = $('loginEmail');
  [passwordInput, emailInput].forEach((input) => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doLogin();
      }
    });
  });
}

// ---- AUTH ----
async function doLogin() {
  hideLoginError();

  if (!ensureSupabaseReady()) {
    showLoginError(adminBootError);
    return;
  }

  const email = $('loginEmail')?.value.trim() || '';
  const password = $('loginPassword')?.value || '';

  if (!email || !password) {
    showLoginError('Ingresá email y contraseña.');
    return;
  }

  setLoginState(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('Error de login:', error);
      let message = 'No se pudo iniciar sesión.';
      if (error.message?.toLowerCase().includes('invalid login credentials')) {
        message = 'Email o contraseña incorrectos.';
      } else if (error.message?.toLowerCase().includes('email not confirmed')) {
        message = 'El email no está confirmado en Supabase.';
      } else if (error.message) {
        message = error.message;
      }
      showLoginError(message);
      return;
    }

    currentUser = data?.user || null;
    await showAdminPanel();
  } catch (err) {
    console.error('Excepción en login:', err);
    showLoginError('Ocurrió un error inesperado al intentar ingresar.');
  } finally {
    setLoginState(false);
  }
}

async function doLogout() {
  if (!ensureSupabaseReady()) return;
  await supabase.auth.signOut();
  currentUser = null;
  $('adminPanel')?.classList.add('hidden');
  $('loginScreen')?.classList.remove('hidden');
}

async function showAdminPanel() {
  $('loginScreen')?.classList.add('hidden');
  $('adminPanel')?.classList.remove('hidden');
  await Promise.all([
    loadAdminProviders(),
    loadAdminReviews(),
    loadDashboard()
  ]);
}

// ---- SECTIONS ----
function showSection(name, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  $(`section-${name}`)?.classList.remove('hidden');
  document.querySelectorAll('.as-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const target = document.querySelector(`[data-section="${name}"]`);
    if (target) target.classList.add('active');
  }
}

// ---- DASHBOARD ----
async function loadDashboard() {
  if (!ensureSupabaseReady()) return;
  const [{ data: providers }, { data: reviews }] = await Promise.all([
    supabase.from('providers').select('id').eq('active', true),
    supabase.from('reviews').select('id, rating, status, author_name, text, created_at, provider_id').order('created_at', { ascending: false })
  ]);

  const totalProviders = providers?.length || 0;
  const totalReviews = reviews?.length || 0;
  const pending = reviews?.filter(r => r.status === 'pending').length || 0;
  const approved = reviews?.filter(r => r.status === 'approved') || [];
  const avg = approved.length ? (approved.reduce((a, r) => a + r.rating, 0) / approved.length).toFixed(1) : '–';

  if ($('ds-providers')) $('ds-providers').textContent = totalProviders;
  if ($('ds-reviews')) $('ds-reviews').textContent = totalReviews;
  if ($('ds-pending')) $('ds-pending').textContent = pending;
  if ($('ds-avg')) $('ds-avg').textContent = avg + (avg !== '–' ? '★' : '');

  const latest = (reviews || []).slice(0, 5);
  const providerMap = {};
  if (allAdminProviders.length) {
    allAdminProviders.forEach(p => providerMap[p.id] = p.name);
  } else {
    const { data: plist } = await supabase.from('providers').select('id, name');
    (plist || []).forEach(p => providerMap[p.id] = p.name);
  }

  const latestReviews = $('latestReviews');
  if (!latestReviews) return;
  latestReviews.innerHTML = latest.length
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
  if (!ensureSupabaseReady()) return;
  const { data } = await supabase
    .from('providers')
    .select('*')
    .order('created_at', { ascending: false });

  allAdminProviders = data || [];
  renderAdminProviders(allAdminProviders);
}

function renderAdminProviders(list) {
  const el = $('adminProvidersList');
  if (!el) return;
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
    const catText = (Array.isArray(p.categories) ? p.categories : (p.categories || '').split(',')).filter(Boolean).slice(0,2).join(', ');
    return `<div class="apl-item">
      <div class="apl-avatar" ${avatarStyle}>${avatarContent}</div>
      <div class="apl-info">
        <h4>${escHtml(p.name)}</h4>
        <p>${escHtml(p.zone || '')}${catText ? ` · ${escHtml(catText)}` : ''}</p>
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
  const q = ($('adminSearchProv')?.value || '').toLowerCase();
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
    await loadDashboard();
  } else {
    toast(error.message || 'Error al actualizar proveedor.', 'error');
  }
}

async function deleteProvider(id, name) {
  if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
  const { error } = await supabase.from('providers').delete().eq('id', id);
  if (!error) {
    toast('Proveedor eliminado.', 'success');
    await loadAdminProviders();
    await loadDashboard();
  } else {
    toast(error.message || 'Error al eliminar.', 'error');
  }
}

// ---- OPEN / CLOSE MODAL ----
function openNewProvider() {
  editingProviderId = null;
  $('modalTitle').textContent = 'Nuevo proveedor';
  resetProviderForm();
  openModal();
  showSection('providers', document.querySelector('[data-section=providers]'));
}

function editProvider(id) {
  const p = allAdminProviders.find(x => x.id === id);
  if (!p) return;
  editingProviderId = id;
  $('modalTitle').textContent = 'Editar proveedor';
  fillProviderForm(p);
  openModal();
}

function openModal() {
  $('providerModal')?.classList.remove('hidden');
  $('providerModalOverlay')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  switchTab('basic', document.querySelector('.am-tab'));
}

function closeProviderModal() {
  $('providerModal')?.classList.add('hidden');
  $('providerModalOverlay')?.classList.add('hidden');
  document.body.style.overflow = '';
}

// ---- TABS ----
function switchTab(name, btn) {
  document.querySelectorAll('.am-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.am-tab').forEach(t => t.classList.remove('active'));
  $(`tab-${name}`)?.classList.remove('hidden');
  if (btn) btn.classList.add('active');
}

// ---- FORM ----
function resetProviderForm() {
  ['pName','pZone','pDesc','pAbout','pWhatsapp','pEmail','pYears','pAvatar','pGallery','pPriceFrom','pPriceTo'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
  $('pActive').value = 'true';
  document.querySelectorAll('#serviceChecks input[type=checkbox]').forEach(cb => cb.checked = false);
  $('pColor').value = '#00897b';
  document.querySelectorAll('#colorPalette .cp-item').forEach(c => c.classList.toggle('selected', c.dataset.color === '#00897b'));
  $('extraInfoList').innerHTML = '';
  initColorPalette();
}

function fillProviderForm(p) {
  resetProviderForm();
  $('pName').value = p.name || '';
  $('pZone').value = p.zone || '';
  $('pDesc').value = p.description || '';
  $('pAbout').value = p.about || '';
  $('pWhatsapp').value = p.whatsapp || '';
  $('pEmail').value = p.email || '';
  $('pYears').value = p.years_experience || '';
  $('pAvatar').value = p.avatar_url || '';
  $('pActive').value = p.active ? 'true' : 'false';
  $('pPriceFrom').value = p.price_from || '';
  $('pPriceTo').value = p.price_to || '';

  const cats = Array.isArray(p.categories) ? p.categories : (p.categories || '').split(',').map(c => c.trim()).filter(Boolean);
  document.querySelectorAll('#serviceChecks input[type=checkbox]').forEach(cb => {
    cb.checked = cats.includes(cb.value);
  });

  const gallery = Array.isArray(p.gallery) ? p.gallery : [];
  $('pGallery').value = gallery.join('\n');

  const color = p.color || '#00897b';
  $('pColor').value = color;
  document.querySelectorAll('#colorPalette .cp-item').forEach(c => c.classList.toggle('selected', c.dataset.color === color));

  const extra = Array.isArray(p.extra_info) ? p.extra_info : [];
  extra.forEach(e => addExtraInfo(e.key, e.value));
}

function initColorPalette() {
  document.querySelectorAll('#colorPalette .cp-item').forEach(item => {
    item.onclick = () => {
      document.querySelectorAll('#colorPalette .cp-item').forEach(c => c.classList.remove('selected'));
      item.classList.add('selected');
      $('pColor').value = item.dataset.color;
    };
  });
}

function addExtraInfo(key = '', value = '') {
  const list = $('extraInfoList');
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
  const name = $('pName').value.trim();
  const zone = $('pZone').value.trim();
  const desc = $('pDesc').value.trim();
  const whatsapp = $('pWhatsapp').value.trim().replace(/\D/g, '');

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
  const galleryRaw = $('pGallery').value.trim();
  const gallery = galleryRaw ? galleryRaw.split('\n').map(u => u.trim()).filter(Boolean) : [];
  const extraItems = Array.from(document.querySelectorAll('#extraInfoList .ei-item')).map(row => ({
    key: row.querySelector('.ei-key').value.trim(),
    value: row.querySelector('.ei-val').value.trim()
  })).filter(e => e.key && e.value);

  const payload = {
    name,
    zone,
    description: desc,
    about: $('pAbout').value.trim() || null,
    whatsapp,
    email: $('pEmail').value.trim() || null,
    years_experience: parseInt($('pYears').value) || null,
    avatar_url: $('pAvatar').value.trim() || null,
    color: $('pColor').value,
    active: $('pActive').value === 'true',
    categories: cats,
    gallery,
    price_from: parseInt($('pPriceFrom').value) || null,
    price_to: parseInt($('pPriceTo').value) || null,
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
  await loadDashboard();
}

// ---- REVIEWS ----
async function loadAdminReviews() {
  if (!ensureSupabaseReady()) return;
  const { data } = await supabase
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
  const list = $('adminReviewsList');
  if (!list) return;
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
    await loadDashboard();
  } else {
    toast(error.message || 'Error al actualizar reseña.', 'error');
  }
}

async function deleteReview(id) {
  if (!confirm('¿Eliminar esta reseña?')) return;
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (!error) {
    toast('Reseña eliminada.', 'success');
    allAdminReviews = allAdminReviews.filter(r => r.id !== id);
    renderAdminReviews();
    await loadDashboard();
  } else {
    toast(error.message || 'Error al eliminar reseña.', 'error');
  }
}

// ---- HELPERS ----
function statusLabel(s) {
  return { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }[s] || s;
}

function toast(msg, type = '') {
  const t = $('adminToast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 4000);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

window.doLogin = doLogin;
window.doLogout = doLogout;
window.showSection = showSection;
window.openNewProvider = openNewProvider;
window.editProvider = editProvider;
window.closeProviderModal = closeProviderModal;
window.switchTab = switchTab;
window.addExtraInfo = addExtraInfo;
window.saveProvider = saveProvider;
window.filterReviews = filterReviews;
window.updateReview = updateReview;
window.deleteReview = deleteReview;
window.filterAdminProviders = filterAdminProviders;
window.toggleProvider = toggleProvider;
window.deleteProvider = deleteProvider;
