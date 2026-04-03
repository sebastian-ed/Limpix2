// ============================================================
//  profile.js  –  Perfil del proveedor (proveedor.html)
// ============================================================

let supabase;
let currentProvider = null;
let selectedRating = 0;

document.addEventListener('DOMContentLoaded', async () => {
  supabase = window.supabase.createClient(window.SUPA_URL, window.SUPA_KEY);

  initNav();
  initStarPicker();

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return showError();
  await loadProvider(id);
});

// ---- LOAD PROVIDER ----
async function loadProvider(id) {
  try {
    const { data: provider, error } = await supabase
      .from('providers')
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .single();

    if (error || !provider) return showError();

    currentProvider = provider;
    document.title = `${provider.name} – Limpix`;

    // Load approved reviews separately
    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('provider_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    currentProvider.approvedReviews = reviews || [];
    renderProfile();
  } catch (e) {
    console.error(e);
    showError();
  }
}

// ---- RENDER PROFILE ----
function renderProfile() {
  const p = currentProvider;
  document.getElementById('profileLoading').classList.add('hidden');
  document.getElementById('profileContent').classList.remove('hidden');

  // Avatar
  const avatarEl = document.getElementById('phAvatar');
  const initials = (p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (p.avatar_url) {
    avatarEl.innerHTML = `<img src="${escHtml(p.avatar_url)}" alt="${escHtml(p.name)}">`;
  } else {
    avatarEl.textContent = initials;
    avatarEl.style.background = p.color || '#00897b';
  }

  // Categories badge
  const cats = Array.isArray(p.categories) ? p.categories : (p.categories || '').split(',').map(c => c.trim()).filter(Boolean);
  document.getElementById('phCategories').textContent = cats.slice(0, 2).join(' · ');

  // Name
  document.getElementById('phName').textContent = p.name || '';

  // Zone
  document.getElementById('phZone').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    ${escHtml(p.zone || '')}`;

  // Rating
  const reviews = currentProvider.approvedReviews || [];
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  document.getElementById('phRating').innerHTML = renderStarsFull(avg);
  document.getElementById('phReviewCount').textContent = `${avg.toFixed(1)} (${reviews.length} reseñas)`;

  // Description
  document.getElementById('phDesc').textContent = p.description || '';

  // About
  const about = p.about || p.long_description || p.description || '';
  document.getElementById('phAbout').textContent = about;
  if (!about) document.getElementById('aboutCard').classList.add('hidden');

  // Services tags
  document.getElementById('phServices').innerHTML = cats.map(c =>
    `<span class="svc-tag">${escHtml(c)}</span>`
  ).join('');

  // Gallery
  const gallery = Array.isArray(p.gallery) ? p.gallery : [];
  if (gallery.length) {
    document.getElementById('galleryCard').classList.remove('hidden');
    document.getElementById('phGallery').innerHTML = gallery.map(url =>
      `<img src="${escHtml(url)}" alt="Trabajo" loading="lazy" onclick="openImg('${escHtml(url)}')">`
    ).join('');
  }

  // CTAs
  const waMsg = encodeURIComponent(`Hola ${p.name}! Los contacto desde Limpix para pedir un presupuesto de ${cats[0] || 'limpieza'}.`);
  const waLink = p.whatsapp ? `https://wa.me/${p.whatsapp}?text=${waMsg}` : '#';
  const emailLink = p.email ? `mailto:${p.email}?subject=Consulta desde Limpix – ${p.name}&body=Hola, los contacto desde Limpix para pedir un presupuesto.` : '#';

  document.getElementById('ctaWhatsapp').href = waLink;
  document.getElementById('ctaEmail').href = emailLink;
  document.getElementById('sbWa').href = waLink;
  document.getElementById('sbEmail').href = emailLink;

  if (!p.whatsapp) {
    document.getElementById('ctaWhatsapp').classList.add('hidden');
    document.getElementById('sbWa').classList.add('hidden');
  }
  if (!p.email) {
    document.getElementById('ctaEmail').classList.add('hidden');
    document.getElementById('sbEmail').classList.add('hidden');
  }

  // Sidebar price
  let priceText = 'Consultar';
  if (p.price_from) {
    priceText = `$${Number(p.price_from).toLocaleString('es-AR')}`;
    if (p.price_to) priceText += ` – $${Number(p.price_to).toLocaleString('es-AR')}`;
  }
  document.getElementById('sbPrice').textContent = priceText;

  // Sidebar zone
  document.getElementById('sbZone').textContent = p.zone || 'Consultar disponibilidad';

  // Sidebar info
  const extra = Array.isArray(p.extra_info) ? p.extra_info : [];
  const infoItems = [];
  if (p.years_experience) infoItems.push({ label: 'Experiencia', value: `${p.years_experience} años` });
  extra.forEach(e => { if (e.key && e.value) infoItems.push({ label: e.key, value: e.value }); });

  if (infoItems.length) {
    document.getElementById('sbInfoList').innerHTML = infoItems.map(i =>
      `<li><span>${escHtml(i.label)}</span><strong>${escHtml(i.value)}</strong></li>`
    ).join('');
  } else {
    document.getElementById('sbInfoCard').classList.add('hidden');
  }

  // Reviews
  renderReviewsSummary(reviews);
  renderReviewsList(reviews);
}

// ---- REVIEWS SUMMARY ----
function renderReviewsSummary(reviews) {
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const counts = [5, 4, 3, 2, 1].map(star => reviews.filter(r => r.rating === star).length);

  document.getElementById('rsScore').innerHTML = `
    <strong>${avg.toFixed(1)}</strong>
    <div class="rs-stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</div>
    <span>${reviews.length} reseñas</span>`;

  document.getElementById('rsBars').innerHTML = [5, 4, 3, 2, 1].map((star, i) => {
    const pct = reviews.length ? Math.round((counts[i] / reviews.length) * 100) : 0;
    return `<div class="rs-bar-row">
      <span>${star}</span>
      <div class="rs-bar-bg"><div class="rs-bar-fill" style="width:${pct}%"></div></div>
      <span>${counts[i]}</span>
    </div>`;
  }).join('');
}

// ---- REVIEWS LIST ----
function renderReviewsList(reviews) {
  const list = document.getElementById('reviewsList');
  if (!reviews.length) {
    list.innerHTML = `<p class="no-reviews">Todavía no hay reseñas. ¡Sé el primero en opinar!</p>`;
    return;
  }
  list.innerHTML = reviews.map(r => {
    const initials = (r.author_name || '?').slice(0, 2).toUpperCase();
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    return `<div class="review-item">
      <div class="ri-header">
        <div class="ri-avatar">${initials}</div>
        <div>
          <div class="ri-name">${escHtml(r.author_name)}</div>
          <div class="ri-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        </div>
        <span class="ri-date">${date}</span>
      </div>
      <p class="ri-text">${escHtml(r.text)}</p>
    </div>`;
  }).join('');
}

// ---- STAR PICKER ----
function initStarPicker() {
  const picker = document.getElementById('starPicker');
  const stars = picker.querySelectorAll('span');
  stars.forEach((star, i) => {
    star.addEventListener('mouseenter', () => highlightStars(i + 1));
    star.addEventListener('mouseleave', () => highlightStars(selectedRating));
    star.addEventListener('click', () => {
      selectedRating = i + 1;
      highlightStars(selectedRating);
    });
  });
}

function highlightStars(count) {
  document.querySelectorAll('#starPicker span').forEach((s, i) => {
    s.style.color = i < count ? '#f59e0b' : '#d1d5db';
  });
}

// ---- SUBMIT REVIEW ----
async function submitReview() {
  const name = document.getElementById('reviewName').value.trim();
  const text = document.getElementById('reviewText').value.trim();

  if (!name) return showToast('Ingresá tu nombre.', 'error');
  if (!selectedRating) return showToast('Elegí una calificación.', 'error');
  if (!text) return showToast('Escribí tu experiencia.', 'error');
  if (text.length < 10) return showToast('La reseña es muy corta.', 'error');

  const btn = document.querySelector('.btn-submit-review');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const { error } = await supabase.from('reviews').insert({
      provider_id: currentProvider.id,
      author_name: name,
      rating: selectedRating,
      text: text,
      status: 'pending'
    });

    if (error) throw error;

    document.getElementById('reviewName').value = '';
    document.getElementById('reviewText').value = '';
    selectedRating = 0;
    highlightStars(0);
    showToast('¡Gracias! Tu reseña fue enviada y será revisada antes de publicarse.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Error al enviar. Intentá de nuevo.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publicar reseña';
  }
}

// ---- HELPERS ----
function renderStarsFull(rating) {
  const r = Math.round(rating * 2) / 2;
  return Array.from({ length: 5 }, (_, i) => i + 1)
    .map(i => `<span style="color:${i <= r ? '#f59e0b' : '#d1d5db'};font-size:1.1rem">★</span>`)
    .join('');
}

function showError() {
  document.getElementById('profileLoading').classList.add('hidden');
  document.getElementById('profileError').classList.remove('hidden');
}

function showToast(msg, type = '') {
  const t = document.getElementById('adminToast') || createToast();
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 4000);
}

function createToast() {
  const t = document.createElement('div');
  t.className = 'toast';
  document.body.appendChild(t);
  return t;
}

function openImg(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:12px';
  overlay.appendChild(img);
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initNav() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
  const h = document.getElementById('hamburger');
  if (h) h.addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('open'));
}
