// ============================================================
//  app.js  –  Catálogo público (index.html)
// ============================================================

let supabase;
let allProviders = [];
let activeCategory = '';
let activeSearch = '';
let activeSort = 'rating';

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  supabase = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);

  initNav();
  await loadProviders();
  initFilters();
  initSearch();
});

// ---- SUPABASE: cargar proveedores ----
async function loadProviders() {
  const grid = document.getElementById('providersGrid');
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('*, reviews(rating,status)')
      .eq('active', true);

    if (error) throw error;

    // Calcular rating promedio desde reviews
    allProviders = (data || []).map(p => {
      const reviews = p.reviews || [];
      const approved = reviews.filter(r => r.status === 'approved' || r.approved === true);
      const avg = approved.length
        ? approved.reduce((a, r) => a + r.rating, 0) / approved.length
        : (p.rating || 0);
      return { ...p, avg_rating: avg, review_count: approved.length || p.review_count || 0 };
    });

    renderProviders();
    fillHeroPhone();
    updateStats();
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1"><p style="color:#ef4444">Error cargando proveedores. Verificá la configuración de Supabase.</p></div>`;
  }
}

// ---- RENDER PROVIDERS ----
function renderProviders() {
  const grid = document.getElementById('providersGrid');
  const noResults = document.getElementById('noResults');

  let filtered = [...allProviders];

  // Filtro categoría
  if (activeCategory) {
    filtered = filtered.filter(p =>
      Array.isArray(p.categories)
        ? p.categories.includes(activeCategory)
        : (p.categories || '').includes(activeCategory)
    );
  }

  // Filtro búsqueda
  if (activeSearch) {
    const q = activeSearch.toLowerCase();
    filtered = filtered.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.zone || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (Array.isArray(p.categories) ? p.categories.join(' ') : (p.categories || '')).toLowerCase().includes(q)
    );
  }

  // Ordenar
  filtered.sort((a, b) => {
    if (activeSort === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0);
    if (activeSort === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
    if (activeSort === 'price') return (a.price_from || 0) - (b.price_from || 0);
    if (activeSort === 'name') return (a.name || '').localeCompare(b.name || '');
    return 0;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noResults.classList.remove('hidden');
    return;
  }

  noResults.classList.add('hidden');
  grid.innerHTML = filtered.map(p => providerCard(p)).join('');

  // Fade in
  grid.querySelectorAll('.prov-card').forEach((el, i) => {
    el.style.transitionDelay = `${i * 60}ms`;
    el.classList.add('fade-in');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  });
}

function providerCard(p) {
  const cats = Array.isArray(p.categories) ? p.categories : (p.categories ? p.categories.split(',') : []);
  const stars = renderStars(p.avg_rating || 0);
  const initials = (p.name || 'XX').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarContent = p.avatar_url
    ? `<img src="${escHtml(p.avatar_url)}" alt="${escHtml(p.name)}" loading="lazy">`
    : initials;
  const avatarStyle = p.avatar_url ? '' : `style="background:${escHtml(p.color || '#00897b')}"`;
  const price = p.price_from ? `Desde <strong>$${Number(p.price_from).toLocaleString('es-AR')}</strong>` : '<strong>Consultar</strong>';
  const waMsg = encodeURIComponent(`Hola ${p.name}! Los contacto desde Limpix para pedir un presupuesto.`);
  const waLink = `https://wa.me/${p.whatsapp}?text=${waMsg}`;
  const featured = p.featured ? 'featured' : '';

  return `
    <div class="prov-card ${featured}" onclick="goToProfile('${p.id}')">
      <div class="prov-card-top">
        <div class="pc-avatar" ${avatarStyle}>${avatarContent}</div>
        <div class="pc-info">
          <h4>${escHtml(p.name)}</h4>
          <div class="pc-stars">${stars} <span>(${p.review_count || 0} reseñas)</span></div>
          <div class="pc-zone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${escHtml(p.zone || '')}
          </div>
        </div>
        <div class="pc-badge-top"><span class="pc-badge verified">✓ Verificado</span></div>
      </div>
      <div class="pc-tags">
        ${cats.slice(0,3).map(c => `<span class="pc-tag">${escHtml(c.trim())}</span>`).join('')}
        ${cats.length > 3 ? `<span class="pc-tag">+${cats.length - 3}</span>` : ''}
      </div>
      <p class="pc-desc">${escHtml(p.description || '')}</p>
      <div class="pc-footer">
        <div class="pc-price">${price}</div>
        <div class="pc-actions" onclick="event.stopPropagation()">
          <a href="${waLink}" target="_blank" rel="noopener" class="pc-btn-wa">
            <svg viewBox="0 0 24 24" fill="white"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            WhatsApp
          </a>
          <span class="pc-btn-profile">Ver perfil</span>
        </div>
      </div>
    </div>`;
}

function goToProfile(id) {
  window.location.href = `proveedor.html?id=${id}`;
}

// ---- HERO PHONE ----
function fillHeroPhone() {
  const container = document.getElementById('heroPhoneCards');
  const top3 = allProviders.slice(0, 3);
  if (!top3.length) return;
  container.innerHTML = top3.map(p => {
    const initials = (p.name || 'XX').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const avatarContent = p.avatar_url
      ? `<img src="${escHtml(p.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:7px" alt="">`
      : initials;
    const avatarStyle = p.avatar_url ? '' : `style="background:${escHtml(p.color || '#00897b')}"`;
    const stars = '★'.repeat(Math.round(p.avg_rating || 5));
    const price = p.price_from ? `$${Number(p.price_from).toLocaleString('es-AR')}` : 'Consultar';
    return `<div class="hvp-card">
      <div class="hvp-card-avatar" ${avatarStyle}>${avatarContent}</div>
      <div class="hvp-card-info">
        <strong>${escHtml(p.name)}</strong>
        <div class="hvp-card-stars">${stars}</div>
        <span>${price}</span>
      </div>
    </div>`;
  }).join('');
}

// ---- STATS ----
function updateStats() {
  document.getElementById('statProveedores').textContent = allProviders.length + '+';
  const totalReviews = allProviders.reduce((a, p) => a + (p.review_count || 0), 0);
  document.getElementById('statResenas').textContent = totalReviews > 1000
    ? (totalReviews / 1000).toFixed(1) + 'k+'
    : totalReviews + '+';
}

// ---- FILTERS ----
function initFilters() {
  document.querySelectorAll('#categoryChips .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#categoryChips .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      renderProviders();
    });
  });

  document.getElementById('sortSelect').addEventListener('change', e => {
    activeSort = e.target.value;
    renderProviders();
  });
}

function initSearch() {
  let t;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => { activeSearch = e.target.value.trim(); renderProviders(); }, 250);
  });
}

function applyHeroSearch() {
  const q = document.getElementById('heroSearch').value.trim();
  const cat = document.getElementById('heroCategory').value;
  if (cat) {
    activeCategory = cat;
    document.querySelectorAll('#categoryChips .chip').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
    });
    document.getElementById('heroCategory').value = '';
  }
  if (q) {
    activeSearch = q;
    const inp = document.getElementById('searchInput');
    if (inp) inp.value = q;
  }
  document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
  renderProviders();
}

function resetFilters() {
  activeCategory = '';
  activeSearch = '';
  document.querySelectorAll('#categoryChips .chip').forEach(b => b.classList.toggle('active', b.dataset.cat === ''));
  const inp = document.getElementById('searchInput');
  if (inp) inp.value = '';
  renderProviders();
}

// ---- NAV ----
function initNav() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('mobileMenu').classList.toggle('open');
  });
}

// ---- HELPERS ----
function renderStars(rating) {
  const r = Math.round(rating * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= r) s += '<span style="color:#f59e0b">★</span>';
    else s += '<span style="color:#d1d5db">★</span>';
  }
  return s;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
