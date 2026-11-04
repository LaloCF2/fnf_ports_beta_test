// Genera las tarjetas de Bases, MODs y Scripts a partir de data-*.js (+ mods creados desde el panel)
(() => {
const { esc, icon, t, store, compatOf, engineOf } = FNF;

const GAMA = {
  low: ['Baja', 'Low'],
  mid: ['Media', 'Mid'],
  'mid-high': ['Media-Alta', 'Mid-High'],
  high: ['Alta', 'High']
};

// Idioma del contenido (se elige en el editor del panel)
const LANGS = { es: ['Español', 'Spanish'], en: ['Inglés', 'English'], 'es-en': ['Español / Inglés', 'Spanish / English'], otro: ['Otro idioma', 'Other language'] };
const langTag = (d) => d.lang && LANGS[d.lang] ? t(LANGS[d.lang][0], LANGS[d.lang][1]) : '';
// Etiquetas extra: secreto y borrador
const extraBadges = (d) => (d.hidden ? ' <span class="pill-badge">🔒</span>' : '') + (d.draft ? ` <span class="pill-badge badge-draft">${t('Borrador', 'Draft')}</span>` : '');

const COMPAT = {
  ok: ['✅ Compatible', '✅ Compatible'],
  warn: ['⚠️ Puede ir lento', '⚠️ May lag'],
  bad: ['⛔ Muy pesado', '⛔ Too heavy']
};

const isFav = (id) => !!store.json('fnf_favorites', {})[id];
const jsArg = (s) => esc(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));

function card({ id, kind, title, img, logo, badges = '', tags = [], pre = '', openFn, extraAction = '', adminBtns, i }) {
  const tagHtml = pre + tags.filter(Boolean).map(x => `<span class="tag">${esc(x)}</span>`).join('');
  return `
  <article class="item-card glass ${kind}-card${logo ? ' is-logo' : ''}" id="card-${id}" data-id="${id}" data-order="${i}" style="--i:${Math.min(i, 12)}">
    <div class="item-media" onclick="${openFn}('${id}')">
      <img src="${esc(img)}" alt="" loading="lazy" decoding="async" onload="this.classList.add('loaded')">
      <div class="media-badges">${badges}</div>
    </div>
    <div class="item-body">
      <h3 class="item-title">
        <span class="led-dot led-green" id="led-green-${id}"></span><span class="led-dot led-yellow" id="led-yellow-${id}"></span>
        <span>${esc(title)}</span>
      </h3>
      ${tagHtml ? `<div class="tags">${tagHtml}</div>` : ''}
      <div class="item-stats">
        <button class="stat-btn" id="like-${id}" onclick="handleLike('${id}', this)" aria-label="Like">${icon('heart', 'icon icon-sm')}<span id="count-${id}">0</span></button>
        <span class="stat-btn static" title="${t('Descargas', 'Downloads')}">${icon('download', 'icon icon-sm')}<span id="dl-${id}">0</span></span>
        <span class="stat-btn static rate-chip" id="rate-${id}" hidden>★ <span></span></span>
        <span class="spacer"></span>
        <button class="stat-btn${isFav(id) ? ' is-fav' : ''}" data-fav="${id}" onclick="toggleFavorite('${id}')" aria-label="${t('Guardar y seguir', 'Save & follow')}">${icon('bookmark', 'icon icon-sm')}</button>
        <button class="stat-btn" onclick="abrirMenuCompartir('${id}', '${jsArg(title)}')" aria-label="${t('Compartir', 'Share')}">${icon('share', 'icon icon-sm')}</button>
      </div>
      <div class="item-actions">
        <button class="btn" onclick="${openFn}('${id}')">${icon('download', 'icon icon-sm')}<span data-es="Descargar" data-en="Download">${t('Descargar', 'Download')}</span></button>
        ${extraAction}
        <button class="btn btn-ghost" onclick="openModComments('${id}', '${jsArg(title)}')" aria-label="Chat">${icon('chat', 'icon icon-sm')}</button>
      </div>
      <div class="admin-row">${adminBtns}</div>
    </div>
  </article>`;
}

// Botones de admin iguales para mods, bases y scripts
const adminBtns = (kind, id) => `
  <button class="admin-pin-btn" onclick="toggleModPin('${id}', event)">${FNF.fi('pin', 16)}<span>Fijar</span></button>
  <button id="btn-led-${id}" class="admin-led-btn" onclick="toggleGreenLed('${id}', event)">${FNF.fi('led', 16)}<span>LED</span></button>
  <button onclick="toggleNewMod('card-${id}')">${FNF.fi('star', 16)}<span>Nuevo</span></button>
  <button onclick="fixBrokenLink('${id}')">${FNF.fi('tools', 16)}<span>Reparar</span></button>
  <button onclick="abrirEditorMod('${id}', '${kind}')">${FNF.fi('edit', 16)}<span>Editar</span></button>
  ${kind === 'script' ? `<button onclick="toggleRecomendarScript('${id}')">${FNF.fi('bolt', 16)}<span>Top</span></button>` : ''}`;

// Etiquetas de fijado / nuevo / secreto para bases y scripts
const simpleBadges = (d) => `<span></span><span><span class="pill-badge badge-pin">📌 ${t('Fijado', 'Pinned')}</span> <span class="pill-badge badge-new">${t('Nuevo', 'New')}</span>${extraBadges(d)}</span>`;

function renderAll() {
  const unlocked = store.json('unlocked_mods', []);
  const showSecrets = window.isSuperUser;
  // Los borradores solo los ve el admin; los secretos, el admin y quien tenga el enlace
  const visible = ([id, d]) => (!d.draft || showSecrets) && (!d.hidden || showSecrets || unlocked.includes(id));

  // ---- Bases ----
  const apks = Object.entries(window.APK_DATA || {}).filter(visible);
  document.getElementById('apksContainer').innerHTML = apks.map(([id, d], i) => card({
    id, kind: 'apk', title: d.title, img: d.img, logo: true, i, badges: simpleBadges(d),
    tags: [d.version && d.version.split('\n')[0], langTag(d)],
    openFn: 'openApkInfo',
    extraAction: `<button class="btn btn-ghost" onclick="cargarNovedadesTXT('${id}', 'base')" aria-label="${t('Novedades', 'Notes')}">${icon('info', 'icon icon-sm')}</button>`,
    adminBtns: adminBtns('apk', id)
  })).join('');

  // ---- MODs ----
  const mods = Object.entries(window.MOD_DATA || {}).filter(visible);
  document.getElementById('modsContainer').innerHTML = mods.map(([id, d], i) => {
    const g = GAMA[d.gama] || GAMA.low;
    const compat = compatOf(d.ram);
    const badges = `
      <span class="pill-badge gama-${d.gama || 'low'}"><span class="dot"></span>${t(g[0], g[1])}</span>
      <span><span class="pill-badge badge-pin">📌 ${t('Fijado', 'Pinned')}</span> <span class="pill-badge badge-new">${t('Nuevo', 'New')}</span>${extraBadges(d)}</span>`;
    return card({
      id, kind: 'mod', title: d.title, img: d.img, badges, i,
      pre: compat ? `<span class="tag compat-${compat}">${t(COMPAT[compat][0], COMPAT[compat][1])}</span>` : '',
      tags: [d.engine, d.ram, d.size, langTag(d)],
      openFn: 'openModInfo',
      adminBtns: adminBtns('mod', id)
    });
  }).join('');

  // Datos para buscar, filtrar y ordenar
  const engines = new Set();
  mods.forEach(([id, d]) => {
    const el = document.getElementById('card-' + id);
    const engine = engineOf(d.engine);
    if (engine) engines.add(engine);
    el.dataset.gama = d.gama || 'low';
    el.dataset.engine = engine;
    el.dataset.compat = compatOf(d.ram) || '';
    el.dataset.title = d.title.toLowerCase();
    el.dataset.tags = `${d.title} ${d.engine || ''} ${d.ram || ''} ${d.size || ''} ${langTag(d)} ${d.creator || ''}`.toLowerCase();
  });
  const engineSel = document.getElementById('engineFilter');
  if (engineSel) {
    const prev = engineSel.value;
    engineSel.innerHTML = `<option value="all">${t('Todos', 'All')}</option>` +
      [...engines].sort().map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
    engineSel.value = [...engineSel.options].some(o => o.value === prev) ? prev : 'all';
  }

  // ---- Scripts ----
  const scripts = Object.entries(window.SCRIPTS_DATA || {}).filter(visible);
  document.getElementById('scriptsContainer').innerHTML = scripts.map(([id, d], i) => card({
    id, kind: 'script', title: d.title, img: d.img || (d.images || [])[0] || '', i, badges: simpleBadges(d),
    tags: [d.version, langTag(d)],
    openFn: 'openScriptInfo',
    adminBtns: adminBtns('script', id)
  })).join('');

  // Contadores
  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setTxt('tile-mods', `${mods.length} ${t('disponibles', 'available')}`);
  setTxt('tile-apks', `${apks.length} ${t('motores', 'engines')}`);
  setTxt('tile-scripts', `${scripts.length} ${t('utilidades', 'utilities')}`);
  setTxt('count-mods-label', mods.length);
  setTxt('count-apks-label', apks.length);
  setTxt('count-scripts-label', scripts.length);
  setTxt('tile-favs', `${Object.keys(store.json('fnf_favorites', {})).length} ${t('guardados', 'saved')}`);

  if (window.applySort) window.applySort();
}

// Dónde vive cada tipo de contenido (data-*.js) y su versión editada desde el panel (Firebase)
const KINDS = {
  mod: { data: 'MOD_DATA', path: 'mods_custom', cache: 'fnf_mods_custom_cache', label: 'MODs' },
  apk: { data: 'APK_DATA', path: 'apks_custom', cache: 'fnf_apks_custom_cache', label: 'Bases' },
  script: { data: 'SCRIPTS_DATA', path: 'scripts_custom', cache: 'fnf_scripts_custom_cache', label: 'Scripts' }
};
const kindOf = (id) => String(id).startsWith('apk') ? 'apk' : String(id).startsWith('script') ? 'script' : 'mod';
const itemOf = (id) => (window[KINDS[kindOf(id)].data] || {})[id];

// Mezcla lo de data-*.js con lo creado/editado desde el panel (lo nuevo va primero)
function applyCustom(kind, custom) {
  const k = KINDS[kind];
  const base = window[k.data + '_BASE'] || {};
  custom = custom || {};
  const merged = {};
  Object.entries(custom)
    .filter(([id, c]) => !base[id] && c && c.title && !c.removed)
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
    .forEach(([id, c]) => { merged[id] = { ...c, custom: true }; });
  Object.entries(base).forEach(([id, d]) => {
    const c = custom[id];
    if (c && c.removed) return;
    merged[id] = c ? { ...d, ...c, edited: true } : d;
  });
  window[k.data] = merged;
}

window.renderAll = renderAll;
window.applyCustom = applyCustom;
window.applyCustomMods = (custom) => applyCustom('mod', custom);
FNF.KINDS = KINDS;
FNF.LANGS = LANGS;
FNF.langTag = langTag;
FNF.kindOf = kindOf;
FNF.itemOf = itemOf;
})();
