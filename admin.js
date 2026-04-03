(() => {
  if (window.__LIMPIX_ADMIN_V2__) return;
  window.__LIMPIX_ADMIN_V2__ = true;

  const state = {
    client: null,
    currentUser: null,
    providers: [],
    reviews: [],
    editingProviderId: null,
    reviewFilter: 'all'
  };

  const $ = (id) => document.getElementById(id);
  const escHtml = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function getClient() {
    if (state.client) return state.client;
    if (!window.supabase || !window.SUPA_URL || !window.SUPA_KEY) {
      throw new Error('Supabase no está inicializado. Revisá supabase.js');
    }
    state.client = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);
    return state.client;
  }

  function toast(msg, type='') {
    const t = $('adminToast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 4000);
  }

  function setLoginError(message='') {
    const el = $('loginError');
    if (!el) return;
    if (!message) return el.classList.add('hidden');
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function setLoginLoading(loading) {
    const btn = $('loginBtn');
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = loading ? 'Ingresando...' : 'Ingresar';
  }

  async function init() {
    try {
      bindUI();
      getClient();
      const adminDate = $('adminDate');
      if (adminDate) {
        adminDate.textContent = new Date().toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      }
      const { data: { session }, error } = await state.client.auth.getSession();
      if (error) throw error;
      if (session?.user) {
        state.currentUser = session.user;
        await showAdminPanel();
      }
    } catch (err) {
      console.error(err);
      setLoginError(err.message || 'Error al inicializar el panel');
    }
  }

  function bindUI() {
    $('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await doLogin();
    });
    $('adminSearchProv')?.addEventListener('input', filterAdminProviders);
  }

  async function doLogin() {
    setLoginError('');
    const email = $('loginEmail')?.value.trim() || '';
    const password = $('loginPassword')?.value || '';
    if (!email || !password) {
      setLoginError('Ingresá email y contraseña.');
      return;
    }
    try {
      setLoginLoading(true);
      const { data, error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.currentUser = data.user;
      await showAdminPanel();
    } catch (err) {
      console.error(err);
      setLoginError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function doLogout() {
    try { await state.client.auth.signOut(); } catch (e) { console.error(e); }
    state.currentUser = null;
    $('adminPanel')?.classList.add('hidden');
    $('loginScreen')?.classList.remove('hidden');
  }

  async function showAdminPanel() {
    $('loginScreen')?.classList.add('hidden');
    $('adminPanel')?.classList.remove('hidden');
    await Promise.all([loadAdminProviders(), loadAdminReviews()]);
    await loadDashboard();
  }

  function showSection(name, btn) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    $(`section-${name}`)?.classList.remove('hidden');
    document.querySelectorAll('.as-item').forEach(b => b.classList.remove('active'));
    (btn || document.querySelector(`[data-section="${name}"]`))?.classList.add('active');
  }

  async function loadDashboard() {
    try {
      const activeProviders = state.providers.filter(p => p.active).length;
      const pending = state.reviews.filter(r => r.status === 'pending').length;
      const approved = state.reviews.filter(r => r.status === 'approved');
      const avg = approved.length ? (approved.reduce((a, r) => a + r.rating, 0) / approved.length).toFixed(1) : '–';
      $('ds-providers').textContent = activeProviders;
      $('ds-reviews').textContent = state.reviews.length;
      $('ds-pending').textContent = pending;
      $('ds-avg').textContent = avg === '–' ? avg : `${avg}★`;

      const providerMap = Object.fromEntries(state.providers.map(p => [p.id, p.name]));
      const latest = [...state.reviews].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,5);
      $('latestReviews').innerHTML = latest.length ? latest.map(r => `
        <div class="lr-item">
          <div>
            <div class="lr-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
            <div class="lr-text">${escHtml(r.text)}</div>
            <div class="lr-meta">${escHtml(r.author_name)} · <span class="lr-prov">${escHtml(providerMap[r.provider_id] || 'Proveedor')}</span></div>
          </div>
          <span class="lr-status ${r.status}">${statusLabel(r.status)}</span>
        </div>`).join('') : '<p style="color:var(--muted);font-size:.88rem">No hay reseñas aún.</p>';
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAdminProviders() {
    try {
      const { data, error } = await state.client.from('providers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      state.providers = data || [];
      renderAdminProviders(state.providers);
    } catch (err) {
      console.error(err);
      $('adminProvidersList').innerHTML = `<div class="loading-state"><p style="color:#ef4444">${escHtml(err.message || 'Error cargando proveedores')}</p></div>`;
    }
  }

  function renderAdminProviders(list) {
    const el = $('adminProvidersList');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="loading-state"><p>No hay proveedores cargados aún.</p></div>';
      return;
    }
    el.innerHTML = list.map(p => {
      const initials = (p.name || 'XX').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      const avatar = p.avatar_url ? `<img src="${escHtml(p.avatar_url)}" alt="">` : initials;
      const avatarStyle = p.avatar_url ? '' : `style="background:${escHtml(p.color || '#00897b')}"`;
      const cats = Array.isArray(p.categories) ? p.categories : [];
      return `<div class="apl-item">
        <div class="apl-avatar" ${avatarStyle}>${avatar}</div>
        <div class="apl-info">
          <h4>${escHtml(p.name)}</h4>
          <p>${escHtml(p.zone || '')} · ${escHtml(cats.slice(0,3).join(', '))}</p>
        </div>
        <div class="apl-meta">
          <span class="apl-status ${p.active ? 'active' : 'inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span>
          <div class="apl-actions">
            <button class="btn-icon btn-view" title="Ver perfil" onclick="window.open('proveedor.html?id=${p.id}','_blank')">👁</button>
            <button class="btn-icon btn-edit" title="Editar" onclick="editProvider('${p.id}')">✏️</button>
            <button class="btn-icon btn-toggle ${p.active ? '' : 'off'}" title="${p.active ? 'Desactivar' : 'Activar'}" onclick="toggleProvider('${p.id}', ${p.active})">${p.active ? '✓' : '✗'}</button>
            <button class="btn-icon btn-delete" title="Eliminar" onclick="deleteProvider('${p.id}', '${escHtml((p.name || '').replace(/'/g, "&#39;"))}')">🗑</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function filterAdminProviders() {
    const q = ($('adminSearchProv')?.value || '').toLowerCase().trim();
    if (!q) return renderAdminProviders(state.providers);
    const filtered = state.providers.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.zone || '').toLowerCase().includes(q) ||
      (Array.isArray(p.categories) ? p.categories.join(' ') : '').toLowerCase().includes(q)
    );
    renderAdminProviders(filtered);
  }

  async function toggleProvider(id, currentActive) {
    try {
      const { error } = await state.client.from('providers').update({ active: !currentActive }).eq('id', id);
      if (error) throw error;
      toast(`Proveedor ${!currentActive ? 'activado' : 'desactivado'}.`, 'success');
      await loadAdminProviders();
      await loadDashboard();
    } catch (err) {
      console.error(err);
      toast(err.message || 'No se pudo actualizar el proveedor.', 'error');
    }
  }

  async function deleteProvider(id, name) {
    if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const { error } = await state.client.from('providers').delete().eq('id', id);
      if (error) throw error;
      toast('Proveedor eliminado.', 'success');
      await Promise.all([loadAdminProviders(), loadAdminReviews()]);
      await loadDashboard();
    } catch (err) {
      console.error(err);
      toast(err.message || 'No se pudo eliminar el proveedor.', 'error');
    }
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

  function switchTab(name, btn) {
    document.querySelectorAll('.am-tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.am-tab').forEach(t => t.classList.remove('active'));
    $(`tab-${name}`)?.classList.remove('hidden');
    btn?.classList.add('active');
  }

  function resetProviderForm() {
    state.editingProviderId = null;
    ['pName','pZone','pDesc','pAbout','pWhatsapp','pEmail','pYears','pAvatar','pGallery','pPriceFrom','pPriceTo'].forEach(id => { if ($(id)) $(id).value = ''; });
    $('pActive').value = 'true';
    $('pFeatured').value = 'false';
    $('pColor').value = '#00897b';
    document.querySelectorAll('#serviceChecks input[type=checkbox]').forEach(cb => cb.checked = false);
    $('extraInfoList').innerHTML = '';
  }

  function fillProviderForm(p) {
    resetProviderForm();
    state.editingProviderId = p.id;
    $('pName').value = p.name || '';
    $('pZone').value = p.zone || '';
    $('pDesc').value = p.description || '';
    $('pAbout').value = p.about || '';
    $('pWhatsapp').value = p.whatsapp || '';
    $('pEmail').value = p.email || '';
    $('pYears').value = p.years_experience || '';
    $('pAvatar').value = p.avatar_url || '';
    $('pGallery').value = Array.isArray(p.gallery) ? p.gallery.join('\n') : '';
    $('pPriceFrom').value = p.price_from || '';
    $('pPriceTo').value = p.price_to || '';
    $('pActive').value = p.active ? 'true' : 'false';
    $('pFeatured').value = p.featured ? 'true' : 'false';
    $('pColor').value = p.color || '#00897b';
    const cats = Array.isArray(p.categories) ? p.categories : [];
    document.querySelectorAll('#serviceChecks input[type=checkbox]').forEach(cb => cb.checked = cats.includes(cb.value));
    const extra = Array.isArray(p.extra_info) ? p.extra_info : [];
    extra.forEach(e => addExtraInfo(e.key, e.value));
  }

  function openNewProvider() {
    resetProviderForm();
    $('modalTitle').textContent = 'Nuevo proveedor';
    openModal();
  }

  function editProvider(id) {
    const p = state.providers.find(x => x.id === id);
    if (!p) return;
    $('modalTitle').textContent = 'Editar proveedor';
    fillProviderForm(p);
    openModal();
  }

  function addExtraInfo(key='', value='') {
    const list = $('extraInfoList');
    const div = document.createElement('div');
    div.className = 'ei-item';
    div.innerHTML = `
      <input type="text" placeholder="Etiqueta" value="${escHtml(key)}" class="ei-key">
      <input type="text" placeholder="Valor" value="${escHtml(value)}" class="ei-val">
      <button class="ei-remove" type="button" title="Eliminar">✕</button>`;
    div.querySelector('.ei-remove').addEventListener('click', () => div.remove());
    list.appendChild(div);
  }

  async function saveProvider() {
    const name = $('pName').value.trim();
    const zone = $('pZone').value.trim();
    const desc = $('pDesc').value.trim();
    const whatsapp = $('pWhatsapp').value.trim().replace(/\D/g, '');
    if (!name || !zone || !desc || !whatsapp) {
      toast('Completá nombre, zona, descripción y WhatsApp.', 'error');
      switchTab('basic', document.querySelector('.am-tab'));
      return;
    }
    const categories = Array.from(document.querySelectorAll('#serviceChecks input[type=checkbox]:checked')).map(cb => cb.value);
    const gallery = ($('pGallery').value || '').split('\n').map(x => x.trim()).filter(Boolean);
    const extra_info = Array.from(document.querySelectorAll('#extraInfoList .ei-item')).map(row => ({
      key: row.querySelector('.ei-key')?.value.trim(),
      value: row.querySelector('.ei-val')?.value.trim()
    })).filter(x => x.key && x.value);

    const payload = {
      name,
      zone,
      description: desc,
      about: $('pAbout').value.trim() || null,
      whatsapp,
      email: $('pEmail').value.trim() || null,
      years_experience: parseInt($('pYears').value, 10) || null,
      active: $('pActive').value === 'true',
      featured: $('pFeatured').value === 'true',
      color: $('pColor').value.trim() || '#00897b',
      avatar_url: $('pAvatar').value.trim() || null,
      categories,
      gallery,
      price_from: parseInt($('pPriceFrom').value, 10) || null,
      price_to: parseInt($('pPriceTo').value, 10) || null,
      extra_info
    };

    try {
      let error;
      if (state.editingProviderId) {
        ({ error } = await state.client.from('providers').update(payload).eq('id', state.editingProviderId));
      } else {
        ({ error } = await state.client.from('providers').insert(payload));
      }
      if (error) throw error;
      closeProviderModal();
      toast(state.editingProviderId ? 'Proveedor actualizado.' : 'Proveedor creado.', 'success');
      await loadAdminProviders();
      await loadDashboard();
    } catch (err) {
      console.error(err);
      toast(err.message || 'No se pudo guardar el proveedor.', 'error');
    }
  }

  async function loadAdminReviews() {
    try {
      const { data, error } = await state.client.from('reviews').select('*, providers(name)').order('created_at', { ascending: false });
      if (error) throw error;
      state.reviews = data || [];
      renderAdminReviews();
    } catch (err) {
      console.error(err);
      $('adminReviewsList').innerHTML = `<div class="loading-state"><p style="color:#ef4444">${escHtml(err.message || 'Error cargando reseñas')}</p></div>`;
    }
  }

  function filterReviews(filter, btn) {
    state.reviewFilter = filter;
    document.querySelectorAll('.reviews-filter-row .chip').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    renderAdminReviews();
  }

  function renderAdminReviews() {
    const list = $('adminReviewsList');
    if (!list) return;
    let filtered = [...state.reviews];
    if (state.reviewFilter !== 'all') filtered = filtered.filter(r => r.status === state.reviewFilter);
    if (!filtered.length) {
      list.innerHTML = '<div class="loading-state"><p>No hay reseñas en esta categoría.</p></div>';
      return;
    }
    list.innerHTML = filtered.map(r => `
      <div class="ar-item">
        <div class="ar-header">
          <span class="ar-name">${escHtml(r.author_name)}</span>
          <span class="ar-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
          <span class="ar-prov">${escHtml(r.providers?.name || 'Proveedor desconocido')}</span>
          <span class="ar-date">${r.created_at ? new Date(r.created_at).toLocaleDateString('es-AR') : ''}</span>
        </div>
        <div class="ar-text">${escHtml(r.text)}</div>
        <div class="ar-actions">
          <span class="ar-status ${r.status}">${statusLabel(r.status)}</span>
          ${r.status !== 'approved' ? `<button class="btn-approve" type="button" onclick="updateReview('${r.id}','approved')">✓ Aprobar</button>` : ''}
          ${r.status !== 'rejected' ? `<button class="btn-reject" type="button" onclick="updateReview('${r.id}','rejected')">✗ Rechazar</button>` : ''}
          <button class="btn-delete-review" type="button" onclick="deleteReview('${r.id}')">🗑 Eliminar</button>
        </div>
      </div>`).join('');
  }

  async function updateReview(id, status) {
    try {
      const { error } = await state.client.from('reviews').update({ status }).eq('id', id);
      if (error) throw error;
      toast(`Reseña ${status === 'approved' ? 'aprobada' : 'rechazada'}.`, 'success');
      await loadAdminReviews();
      await loadDashboard();
    } catch (err) {
      console.error(err);
      toast(err.message || 'No se pudo actualizar la reseña.', 'error');
    }
  }

  async function deleteReview(id) {
    if (!confirm('¿Eliminar esta reseña?')) return;
    try {
      const { error } = await state.client.from('reviews').delete().eq('id', id);
      if (error) throw error;
      toast('Reseña eliminada.', 'success');
      await loadAdminReviews();
      await loadDashboard();
    } catch (err) {
      console.error(err);
      toast(err.message || 'No se pudo eliminar la reseña.', 'error');
    }
  }

  function statusLabel(s) {
    return { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }[s] || s;
  }

  window.doLogin = doLogin;
  window.doLogout = doLogout;
  window.showSection = showSection;
  window.openNewProvider = openNewProvider;
  window.editProvider = editProvider;
  window.closeProviderModal = closeProviderModal;
  window.switchTab = switchTab;
  window.saveProvider = saveProvider;
  window.filterReviews = filterReviews;
  window.updateReview = updateReview;
  window.deleteReview = deleteReview;
  window.toggleProvider = toggleProvider;
  window.deleteProvider = deleteProvider;
  window.filterAdminProviders = filterAdminProviders;
  window.addExtraInfo = addExtraInfo;

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
