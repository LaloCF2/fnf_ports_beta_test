// Navegación (menú píldora), secciones, tema, búsqueda y filtros.
(() => {
const { store, vibrate, openPopup, t } = FNF;

const SECTIONS = ['home', 'apks', 'mods', 'scripts', 'help', 'contact', 'admin'];
const LISTS = { apks: 'apksContainer', mods: 'modsContainer', scripts: 'scriptsContainer' };

const nav = document.getElementById('pillNav');
const indicator = document.getElementById('pillIndicator');
const items = [...nav.querySelectorAll('.nav-item')];
let current = 'home';

const navItemFor = (section) =>
  items.find(b => b.dataset.section === section) ||
  items.find(b => (b.dataset.more || '').split(' ').includes(section));

function placeIndicator(btn) {
  if (!btn || btn.classList.contains('nav-orb')) { indicator.classList.add('off'); return; }
  indicator.classList.remove('off');
  indicator.style.width = btn.offsetWidth + 'px';
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
}

function markActive(section) {
  const btn = navItemFor(section);
  items.forEach(b => b.classList.toggle('active', b === btn));
  placeIndicator(btn);
}

// Cambio de sección animado: la anterior se desliza y desvanece, la nueva entra desde el lado
// hacia el que te mueves en el menú (derecha = avanzar, izquierda = regresar).
let swapTimer = null;
const sinAnimacion = () => document.body.classList.contains('low-end-mode') ||
  (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function cambiarSeccion(from, to) {
  const dir = SECTIONS.indexOf(to) < SECTIONS.indexOf(from) ? 'sec-prev' : 'sec-next';
  const oldEl = document.getElementById(from);
  const mostrar = () => {
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('sec-out', 'sec-prev', 'sec-next');
      s.classList.toggle('active', s.id === to);
    });
    const el = document.getElementById(to);
    if (el && !sinAnimacion()) el.classList.add(dir);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  clearTimeout(swapTimer);
  if (!oldEl || sinAnimacion() || !oldEl.classList.contains('active')) return mostrar();
  oldEl.classList.remove('sec-prev', 'sec-next');
  oldEl.classList.add('sec-out', dir);
  swapTimer = setTimeout(mostrar, 150);
}

window.selectSection = (id, opts = {}) => {
  if (id === 'more') { openPopup('more-popup'); vibrate(10); return; }
  if (!SECTIONS.includes(id) || (id === 'admin' && !window.isSuperUser)) id = 'home';

  if (id !== current) {
    cambiarSeccion(current, id);
    current = id;
    if (!opts.fromHistory) history.pushState({ section: id }, '', id === 'home' ? location.pathname + location.search : '#' + id);
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // tocar la misma sección = subir arriba
  }

  document.getElementById('searchContainer').classList.toggle('hidden', !LISTS[id]);
  if (LISTS[id]) window.filterContent(true);

  markActive(id);
  if (id === 'admin' && window.openAdminPanel) window.openAdminPanel();
  vibrate(12);
};
window.currentSection = () => current;

window.addEventListener('popstate', () => {
  window.selectSection(location.hash.slice(1) || 'home', { fromHistory: true });
});

// ---- Arrastrar el dedo sobre la píldora ----
let drag = null;
let suppressClick = false;

nav.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, moved: false, id: e.pointerId };
});

nav.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.abs(e.clientX - drag.x) < 10) return;
  if (!drag.moved) {
    drag.moved = true;
    nav.setPointerCapture(e.pointerId);
    indicator.classList.remove('off');
    indicator.classList.add('dragging');
  }
  const rect = nav.getBoundingClientRect();
  const w = items[0].offsetWidth;
  const x = Math.max(7, Math.min(e.clientX - rect.left - w / 2, rect.width - w - 7));
  indicator.style.width = w + 'px';
  indicator.style.transform = `translateX(${x}px) scaleY(.9)`;
});

const endDrag = (e) => {
  if (!drag) return;
  if (drag.moved) {
    indicator.classList.remove('dragging');
    const target = items.reduce((best, b) => {
      const r = b.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      return d < best.d ? { b, d } : best;
    }, { b: null, d: Infinity }).b;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    if (target && target.dataset.section !== 'more') window.selectSection(target.dataset.section);
    else markActive(current);
  }
  drag = null;
};
nav.addEventListener('pointerup', endDrag);
nav.addEventListener('pointercancel', () => { drag = null; indicator.classList.remove('dragging'); markActive(current); });

items.forEach(b => b.addEventListener('click', () => {
  if (suppressClick) return;
  window.selectSection(b.dataset.section);
}));

window.addEventListener('resize', () => markActive(current), { passive: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => markActive(current));

window.initNav = function initNav() {
  const start = location.hash.slice(1);
  if (SECTIONS.includes(start) && start !== 'home') window.selectSection(start, { fromHistory: true });
  else markActive('home');
  // Sin animación en la primera colocación del indicador
  requestAnimationFrame(() => indicator.style.removeProperty('transition'));
}
indicator.style.transition = 'none';

// ---- Tema claro / oscuro ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const ic = document.querySelector('#theme-icon use');
  if (ic) ic.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  const label = document.getElementById('theme-label');
  if (label) label.textContent = theme === 'dark' ? t('Oscuro', 'Dark') : t('Claro', 'Light');
  const toggle = document.getElementById('darkToggle');
  if (toggle) toggle.checked = theme === 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#1b1027' : '#f3cdee';
}

window.toggleTheme = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  store.set('fnf_theme', next);
  applyTheme(next);
  vibrate(15);
};
applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

// ---- Filtros (gama, motor, compatibles), orden y búsqueda ----
window.currentFilter = 'all';
let onlyCompat = false;
let currentSort = store.get('fnf_sort', 'recent');

window.setFilter = (filter, btn) => {
  window.currentFilter = filter;
  document.querySelectorAll('#filterContainer .chip[data-gama]').forEach(b => b.classList.toggle('active', b === btn));
  window.filterContent(true);
  vibrate(10);
};

window.toggleOnlyCompat = (btn) => {
  onlyCompat = !onlyCompat;
  btn.classList.toggle('active', onlyCompat);
  window.filterContent(true);
  vibrate(10);
};

// Orden de los mods: recientes (con fijados arriba), populares, mejor valorados, A-Z
window.applySort = () => {
  const num = (el, k) => Number(el.dataset[k]) || 0;
  // Bases y scripts: fijados arriba, luego el orden original
  ['apksContainer', 'scriptsContainer'].forEach(cid => {
    const box = document.getElementById(cid);
    if (!box) return;
    [...box.querySelectorAll('.item-card')]
      .sort((a, b) => (b.classList.contains('pinned-mod') - a.classList.contains('pinned-mod')) || num(a, 'order') - num(b, 'order'))
      .forEach(c => box.appendChild(c));
  });
  const container = document.getElementById('modsContainer');
  if (!container) return;
  const cards = [...container.querySelectorAll('.mod-card')];
  const by = {
    recent: (a, b) => (b.classList.contains('pinned-mod') - a.classList.contains('pinned-mod')) || num(a, 'order') - num(b, 'order'),
    popular: (a, b) => num(b, 'dl') - num(a, 'dl') || num(a, 'order') - num(b, 'order'),
    rated: (a, b) => num(b, 'rating') - num(a, 'rating') || num(b, 'votes') - num(a, 'votes') || num(a, 'order') - num(b, 'order'),
    az: (a, b) => (a.dataset.title || '').localeCompare(b.dataset.title || '')
  };
  cards.sort(by[currentSort] || by.recent).forEach(c => container.appendChild(c));
  const empty = container.querySelector('.empty');
  if (empty) container.appendChild(empty);
};

window.setSort = (value) => {
  currentSort = value;
  store.set('fnf_sort', value);
  window.applySort();
  vibrate(10);
};

document.addEventListener('DOMContentLoaded', () => {
  const sortSel = document.getElementById('sortSelect');
  if (sortSel) sortSel.value = currentSort;
});

let searchTimer;
window.filterContent = (now) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const containerId = LISTS[current];
    if (!containerId) return;
    const q = document.getElementById('globalSearch').value.trim().toLowerCase();
    const container = document.getElementById(containerId);
    const engineSel = document.getElementById('engineFilter');
    const engine = engineSel ? engineSel.value : 'all';
    const isMods = current === 'mods';
    let visible = 0;
    container.querySelectorAll('.item-card').forEach(card => {
      const text = card.dataset.tags || card.querySelector('.item-title').textContent.toLowerCase();
      const okSearch = !q || text.includes(q);
      const okGama = !isMods || window.currentFilter === 'all' || card.dataset.gama === window.currentFilter;
      const okEngine = !isMods || engine === 'all' || card.dataset.engine === engine;
      const okCompat = !isMods || !onlyCompat || card.dataset.compat === 'ok';
      const show = okSearch && okGama && okEngine && okCompat;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    let empty = container.querySelector('.empty');
    if (!visible && !empty) {
      empty = document.createElement('p');
      empty.className = 'empty';
      empty.style.gridColumn = '1 / -1';
      container.appendChild(empty);
    }
    if (empty) {
      empty.textContent = t('No se encontró nada. Prueba con otra búsqueda.', 'Nothing found. Try another search.');
      empty.style.display = visible ? 'none' : '';
    }
  }, now === true ? 0 : 200);
};
})();
