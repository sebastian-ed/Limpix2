(() => {
  if (window.__ADMIN_JS_LOADED__) {
    console.warn('admin.js ya estaba cargado. Se evita doble inicialización.');
    return;
  }
  window.__ADMIN_JS_LOADED__ = true;

  let adminClient = null;
  let currentUser = null;
  let allAdminProviders = [];
  let allAdminReviews = [];
  let editingProviderId = null;
  let reviewFilter = 'all';

  function initSupabaseClient() {
    if (adminClient) return adminClient;

    if (!window.supabase || !window.SUPA_URL || !window.SUPA_KEY) {
      throw new Error('Supabase no está inicializado correctamente.');
    }

    adminClient = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);
    return adminClient;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      initSupabaseClient();

      const loginBtn = document.getElementById('loginBtn');
      const loginForm = document.getElementById('loginForm');

      if (loginBtn) {
        loginBtn.addEventListener('click', doLogin);
      }

      if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          doLogin();
        });
      }

      const adminDate = document.getElementById('adminDate');
      if (adminDate) {
        adminDate.textContent = new Date().toLocaleDateString('es-AR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      const {
        data: { session }
      } = await adminClient.auth.getSession();

      if (session) {
        currentUser = session.user;
        showAdminPanel();
      }
    } catch (err) {
      console.error(err);
      showLoginError(err.message || 'Error al inicializar el panel.');
    }
  });

  async function doLogin() {
    const email = document.getElementById('loginEmail')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value || '';
    const btn = document.getElementById('loginBtn');

    hideLoginError();

    if (!email || !password) {
      showLoginError('Ingresá email y contraseña.');
      return;
    }

    try {
      initSupabaseClient();

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Ingresando...';
      }

      const { data, error } = await adminClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      currentUser = data.user;
      showAdminPanel();
    } catch (err) {
      console.error(err);
      showLoginError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Ingresar';
      }
    }
  }

  async function doLogout() {
    try {
      initSupabaseClient();
      await adminClient.auth.signOut();
    } catch (err) {
      console.error(err);
    }

    currentUser = null;
    document.getElementById('adminPanel')?.classList.add('hidden');
    document.getElementById('loginScreen')?.classList.remove('hidden');
  }

  function showAdminPanel() {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('adminPanel')?.classList.remove('hidden');
    loadDashboard();
    loadAdminProviders();
    loadAdminReviews();
  }

  function showLoginError(message) {
    const errEl = document.getElementById('loginError');
    if (!errEl) return;
    errEl.textContent = message;
    errEl.classList.remove('hidden');
  }

  function hideLoginError() {
    const errEl = document.getElementById('loginError');
    if (!errEl) return;
    errEl.classList.add('hidden');
  }

  function showSection(name, btn) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`section-${name}`)?.classList.remove('hidden');
    document.querySelectorAll('.as-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else document.querySelector(`[data-section="${name}"]`)?.classList.add('active');
  }

  async function loadDashboard() {
    try {
      const { data: providers } = await adminClient.from('providers').select('id').eq('active', true);
      const { data: reviews } = await adminClient.from('reviews').select('id, rating, status, author_name, text, created_at, provider_id');

      const totalProviders = providers?.length || 0;
      const totalReviews = reviews?.length || 0;
      const pending = reviews?.filter(r => r.status === 'pending').length || 0;
      const approved = reviews?.filter(r => r.status === 'approved') || [];
      const avg = approved.length ? (approved.reduce((a, r) => a + r.rating, 0) / approved.length).toFixed(1) : '–';

      setText('ds-providers', totalProviders);
      setText('ds-reviews', totalReviews);
      setText('ds-pending', pending);
      setText('ds-avg', avg !== '–' ? `${avg}★` : avg);

      const latest = (reviews || []).slice(0, 5);
      const providerMap = {};

      if (allAdminProviders.length) {
        allAdminProviders.forEach(p => providerMap[p.id] = p.name);
      } else {
        const { data: plist } = await adminClient.from('providers').select('id, name');
        (plist || []).forEach(p => providerMap[p.id] = p.name);
      }

      const latestReviewsEl = document.getElementById('latestReviews');
      if (!latestReviewsEl) return;

      latestReviewsEl.innerHTML = latest.length
        ? latest.map(r => `
          <div class="lr-item">
            <div>
              <div class="lr-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
              <div class="lr-text">${escHtml(r.text)}</div>
              <div class="lr-meta">${escHtml(r.author_name)} · <span class="lr-prov">${escHtml(providerMap[r.provider_id] || 'Desconocido')}</span></div>
            </div>
            <span class="lr-status ${r.status}">${statusLabel(r.status)}</span>
          </div>
        `).join('')
        : '<p style="color:var(--muted);font-size:.88rem">No hay reseñas aún.</p>';
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAdminProviders() {
    try {
      const { data } = await adminClient
        .from('providers')
        .select('*')
        .order('created_at', { ascending: false });

      allAdminProviders = data || [];
      renderAdminProviders(allAdminProviders);
    } catch (err) {
      console.error(err);
    }
  }

  function renderAdminProviders(list) {
    const el = document.getElementById('adminProvidersList');
    if (!el) return;

    if (!list.length) {
      el.innerHTML = '<div class="loading-state"><p>No hay proveedores cargados aún.</p></div>';
      return;
    }

    el.innerHTML = list.map(p => {
      const initials = (p.name || 'XX').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const avatarContent = p.avatar_url ? `<img src="${escHtml(p.avatar_url)}" alt="">` : initials;
      const avatarStyle = p.avatar_url ? '' : `style="background:${escHtml(p.color || '#00897b')}"`;

      return `
        <div class="apl-item">
          <div class="apl-avatar" ${avatarStyle}>${avatarContent}</div>
          <div class="apl-info">
            <h4>${escHtml(p.name)}</h4>
            <p>${escHtml(p.zone || '')}</p>
          </div>
          <div class="apl-meta">
            <span class="apl-status ${p.active ? 'active' : 'inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadAdminReviews() {
    try {
      const { data } = await adminClient
        .from('reviews')
        .select('*, providers(name)')
        .order('created_at', { ascending: false });

      allAdminReviews = data || [];
      renderAdminReviews();
    } catch (err) {
      console.error(err);
    }
  }

  function renderAdminReviews() {
    const list = document.getElementById('adminReviewsList');
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

      return `
        <div class="ar-item">
          <div class="ar-header">
            <span class="ar-name">${escHtml(r.author_name)}</span>
            <span class="ar-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            <span class="ar-prov">${escHtml(provName)}</span>
            <span class="ar-date">${date}</span>
          </div>
          <div class="ar-text">${escHtml(r.text)}</div>
        </div>
      `;
    }).join('');
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function statusLabel(s) {
    return { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' }[s] || s;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.doLogin = doLogin;
  window.doLogout = doLogout;
  window.showSection = showSection;
})();
