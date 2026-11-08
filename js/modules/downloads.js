// Popup de detalle (mods / bases / scripts) + contador de descargas.
window.fbReady.then((FB) => {
const { db, ref, get, update, query, limitToLast } = FB;
const { store, t, esc, icon, vibrate, openPopup, closePopup, toast } = FNF;

// Suma la descarga al total, a la semana (Top de la semana) y al día (gráfica del panel) en UNA sola escritura.
// Las reglas de Firebase solo aceptan +1 por persona y por elemento cada hora (dl_last): así nadie infla el Top.
const UNA_HORA = 3600000;

async function sumarDescarga(id, uid) {
  const paths = [`downloads/${id}`, `downloads_week/${FNF.weekKey()}/${id}`, `downloads_day/${FNF.dayKey()}/${id}`];
  for (let intento = 0; intento < 3; intento++) {
    const [ultima, ...vals] = await Promise.all([`dl_last/${uid}/${id}`, ...paths].map(p => get(ref(db, p)).then(s => Number(s.val()) || 0)));
    if (Date.now() - ultima < UNA_HORA) return true; // ya se contó hace poco
    const upd = { [`dl_last/${uid}/${id}`]: FB.serverTimestamp() };
    paths.forEach((p, i) => { upd[p] = vals[i] + 1; });
    try {
      await update(ref(db), upd);
      return true;
    } catch (err) {
      // Otra persona descargó al mismo tiempo: se vuelve a leer y se intenta otra vez
      if (intento === 2) console.warn('Descarga:', err.message);
    }
  }
  return false;
}

window.trackDownload = (id) => {
  // Historial "Mis descargas" (solo en este celular)
  const hist = store.json('fnf_dl_history', []).filter(h => h.id !== id);
  hist.unshift({ id, ts: Date.now() });
  store.setJson('fnf_dl_history', hist.slice(0, 60));

  const u = window.usuarioActualFirebase;
  if (!u) return;
  const last = store.json('fnf_dl_last', {});
  if (Date.now() - (last[id] || 0) < UNA_HORA) return; // en este celular ya contó hace menos de 1 hora
  sumarDescarga(id, u.uid).then(ok => {
    if (!ok) return;
    const now = Date.now();
    // Se guardan solo las de la última hora para que no crezca
    const fresh = Object.fromEntries(Object.entries(store.json('fnf_dl_last', {})).filter(([, ts]) => now - ts < UNA_HORA));
    fresh[id] = now;
    store.setJson('fnf_dl_last', fresh);
  }).catch(err => console.warn('Descarga:', err.message));
};

const COMPAT_TEXT = {
  ok: ['✅ Debería correr bien en tu celular.', '✅ Should run fine on your phone.'],
  warn: ['⚠️ Tu celular está al límite: puede ir lento. Prueba la versión optimizada si existe.', '⚠️ Your phone is at the limit: it may lag.'],
  bad: ['⛔ Pide más RAM de la que tiene tu celular. Probablemente se cierre.', '⛔ Needs more RAM than your phone has. It will probably crash.']
};
const GAMA = { low: ['Gama baja', 'Low-end', 'var(--gama-low)'], mid: ['Gama media', 'Mid-range', 'var(--gama-mid)'], 'mid-high': ['Media-alta', 'Mid-high', 'var(--gama-mid)'], high: ['Gama alta', 'High-end', 'var(--gama-high)'] };
const $ = (id) => document.getElementById(id);
const live = () => window.live || {};
const sinAnimacion = () => document.body.classList.contains('low-end-mode') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// Nombre del servidor de una descarga (MediaFire, Google Drive...) para mostrarlo debajo del botón
const servidorDe = (u) => {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    const conocidos = { 'mediafire.com': 'MediaFire', 'drive.google.com': 'Google Drive', 'mega.nz': 'MEGA', 'github.com': 'GitHub', 'gamebanana.com': 'GameBanana', 'dropbox.com': 'Dropbox', 'gamejolt.com': 'Game Jolt', 'itch.io': 'itch.io', 'pixeldrain.com': 'Pixeldrain' };
    const k = Object.keys(conocidos).find(s => h === s || h.endsWith('.' + s));
    return k ? conocidos[k] : h;
  } catch (e) { return /^assets\//i.test(u || '') ? t('Archivo de la página', 'Site file') : ''; }
};
const NOTA_ICONO = { info: 'info', warn: 'alert', danger: 'ban', ok: 'check' };
const safeLink = (u) => /^(https?:\/\/|assets\/)/i.test(u || '') ? u : '#';
const safeHttp = (u) => /^https?:\/\//i.test(u || '') ? u : '';

// Texto con **negritas** y listas (líneas que empiezan con "- ")
const negrita = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function fmtTexto(s) {
  let html = '', lista = false;
  String(s || '').replace(/\/n/g, '\n').split('\n').forEach(l => {
    const m = l.match(/^\s*[-•*]\s+(.*)/);
    if (m) {
      if (!lista) { html += '<ul class="dt-list">'; lista = true; }
      html += `<li>${negrita(m[1])}</li>`;
    } else {
      if (lista) { html += '</ul>'; lista = false; }
      if (l.trim()) html += `<p>${negrita(l)}</p>`;
    }
  });
  return html + (lista ? '</ul>' : '');
}

// Botón de enlace (web, sección o mod) para las pestañas personalizadas
const botonLink = (l, i) => {
  const p = FNF.home && FNF.home.parseLink(l.url);
  if (!p || !l.label) return '';
  const cls = ({ primary: 'btn', soft: 'btn btn-soft', outline: 'btn btn-ghost' }[l.style] || (i ? 'btn btn-soft' : 'btn')) + ' btn-sm';
  return p.ext ? `<a class="${cls}" href="${esc(p.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`
    : `<a class="${cls}" href="#" data-hl="${esc(p.act)}">${esc(l.label)}</a>`;
};

const imagenesDe = (d) => {
  let imgs = d.images && d.images.length ? [...d.images] : [d.img];
  if (d.img && !imgs.includes(d.img)) imgs = [d.img, ...imgs];
  return imgs.filter(Boolean);
};

// ==========================================
// PESTAÑAS (las fijas + las que el admin activa en el editor)
// ==========================================
const TIPOS_PESTANA = {
  cambios: ['📝', 'Cambios', 'Changes'],
  instalar: ['🛠️', 'Instalar', 'Install'],
  versiones: ['🗂️', 'Versiones', 'Versions'],
  requisitos: ['📋', 'Requisitos', 'Requirements'],
  creditos: ['👥', 'Créditos', 'Credits'],
  video: ['▶️', 'Video', 'Video'],
  custom: ['✨', 'Extra', 'Extra']
};
FNF.TIPOS_PESTANA = TIPOS_PESTANA;
// Una pestaña extra solo aparece si está activada y tiene algo escrito
const conContenido = (p) => {
  if (!p) return false;
  if (p.type === 'instalar') return (p.steps || []).some(s => s && String(s.text || '').trim());
  if (p.type === 'versiones') return (p.items || []).some(v => v && (v.version || v.text));
  if (p.type === 'creditos') return (p.items || []).some(c => c && c.name);
  if (p.type === 'video') return !!(FNF.home && FNF.home.ytId(p.url));
  return !!(String(p.text || '').trim() || (p.links || []).length);
};
FNF.pestanaConContenido = conContenido;

function pestanasDe(d) {
  const lista = [
    { k: 'info', e: 'ℹ️', label: 'Info' },
    { k: 'descargas', e: '⬇️', label: t('Descargas', 'Downloads'), n: (d.downloads || []).length },
    { k: 'capturas', e: '🖼️', label: t('Capturas', 'Screens'), n: imagenesDe(d).length }
  ];
  let extra = Array.isArray(d.tabs) ? d.tabs : [];
  if (!extra.length && d.changelog) extra = [{ id: 'cambios', type: 'cambios', on: true, text: d.changelog }]; // mods de antes
  extra.filter(p => p && p.on !== false && TIPOS_PESTANA[p.type] && conContenido(p)).forEach((p, i) => {
    const T = TIPOS_PESTANA[p.type];
    lista.push({ k: 'x' + i, e: p.emoji || T[0], label: p.title || t(T[1], T[2]), p });
  });
  lista.push({ k: 'chat', e: '💬', label: 'Chat' });
  return lista;
}

// ==========================================
// ESTADO DEL POPUP
// ==========================================
let actual = null;     // { type, id, d, preview }
let tabs = [];
let activa = 0;
let current = null;    // para el panel de admin

// ---- Cabecera según el tipo ----
function cabeceraHTML(type, id, d) {
  const L = live();
  const imgs = imagenesDe(d);
  const chips = [];
  if (type === 'mod') { const g = GAMA[d.gama] || GAMA.low; chips.push(`<span class="dt-chip"><i style="background:${g[2]}"></i>${t(g[0], g[1])}</span>`); }
  if ((L.newMods || {})['card-' + id] === true) chips.push(`<span class="dt-chip dt-chip-accent">${t('Nuevo', 'New')}</span>`);
  if ((L.pinned || {})[id]) chips.push(`<span class="dt-chip">📌 ${t('Fijado', 'Pinned')}</span>`);
  if (type === 'script' && (L.recomendados || {})[id]) chips.push('<span class="dt-chip">🔥 TOP</span>');
  if (window.isSuperUser) {
    if (d.draft) chips.push('<span class="dt-chip dt-chip-dark">📝 Borrador</span>');
    if (d.hidden) chips.push('<span class="dt-chip dt-chip-dark">🔒 Secreto</span>');
    if (Number(d.publishAt) > Date.now()) chips.push(`<span class="dt-chip dt-chip-dark">⏰ ${FNF.fmtDateTime(d.publishAt)}</span>`);
  }
  const sub = [d.creator ? `${t('por', 'by')} ${esc(d.creator)}` : '', d.updatedAt ? `${t('Actualizado', 'Updated')} ${FNF.timeAgo(d.updatedAt)}` : ''].filter(Boolean).join(' · ');

  if (type === 'apk') {
    const ver = String(d.version || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 2);
    return `
      <div class="dt-logo-head">
        <div class="dt-chips">${chips.join('')}</div>
        ${imgs[0] ? `<img class="dt-logo" src="${esc(imgs[0])}" alt="" onclick="dtGaleria(0)">` : ''}
        <h2 class="dt-title">${esc(d.title)}</h2>
        <div class="dt-vers">${ver.map(v => `<span>${esc(v)}</span>`).join('')}${FNF.langTag(d) ? `<span>${esc(FNF.langTag(d))}</span>` : ''}</div>
        ${sub ? `<small class="dt-sub">${sub}</small>` : ''}
      </div>`;
  }
  const slides = imgs.length ? imgs : [''];
  return `
    <div class="dt-cover${type === 'script' ? ' is-script' : ''}">
      <div class="dt-car" id="dt-car">${slides.map((src, i) => src ? `<img src="${esc(src)}" alt="" loading="${i ? 'lazy' : 'eager'}" onclick="dtGaleria(${i})">` : '<span class="dt-noimg"></span>').join('')}</div>
      <div class="dt-chips">${chips.join('')}</div>
      ${imgs.length > 1 ? `<div class="dt-cover-dots" id="dt-cover-dots">${imgs.map((_, i) => `<span class="${i ? '' : 'on'}"></span>`).join('')}</div>` : ''}
      <div class="dt-cover-info">
        ${type === 'script' && d.version ? `<span class="dt-code">${esc(String(d.version).split('\n')[0])}</span>` : ''}
        <h2 class="dt-title">${esc(d.title)}</h2>
        ${sub ? `<small>${sub}</small>` : ''}
      </div>
    </div>`;
}

// ---- Datos rápidos (cajitas) ----
function datosHTML(type, id, d) {
  const L = live();
  const r = window.ratingOf ? window.ratingOf(id) : { n: 0, avg: 0 };
  const caja = (ic, val, label) => `<div class="dt-dato">${icon(ic, 'icon icon-sm')}<b>${esc(val)}</b><small>${label}</small></div>`;
  const estrellas = caja('star', r.n ? r.avg.toFixed(1) : '—', r.n ? `${r.n} ${t('votos', 'votes')}` : t('Sin votos', 'No votes'));
  const descargas = caja('download', FNF.compact((L.downloads || {})[id] || 0), t('Descargas', 'Downloads'));
  let cajas = [];
  if (type === 'mod') {
    cajas = [
      d.ram && caja('phone', String(d.ram).replace(/\s*RAM/i, ''), 'RAM'),
      d.size && caja('box', d.size, t('Tamaño', 'Size')),
      d.engine && caja('code', FNF.engineOf(d.engine).replace(/\s*Engine/i, '') || d.engine, t('Motor', 'Engine')),
      estrellas
    ];
    if (cajas.filter(Boolean).length < 3) cajas.push(descargas);
  } else if (type === 'apk') {
    const nombre = String(d.title || '').toLowerCase();
    const usan = Object.values(window.MOD_DATA || {}).filter(m => m && m.engine && (String(m.engine).toLowerCase().includes(nombre) || FNF.engineOf(m.engine) === d.title)).length;
    cajas = [descargas, estrellas, usan && caja('music', String(usan), t('Mods la usan', 'Mods use it'))];
  } else {
    cajas = [d.version && caja('code', String(d.version).split('\n')[0].slice(0, 16), t('Compatible', 'Works with')), descargas, estrellas];
  }
  cajas = cajas.filter(Boolean);
  return `<div class="dt-datos-grid" style="--n:${cajas.length}">${cajas.join('')}</div>`;
}

// ---- Contenido de cada pestaña ----
function panelHTML(tab) {
  const { type, id, d, preview } = actual;
  if (tab.k === 'info') {
    const nota = d.note ? (() => {
      const tipo = NOTA_ICONO[d.noteType] ? d.noteType : 'warn';
      return `<div class="detail-note note-${tipo}">${icon(NOTA_ICONO[tipo], 'icon icon-sm')}<span>${esc(d.note)}</span></div>`;
    })() : '';
    const vid = FNF.home && FNF.home.ytId(d.trailer);
    const meta = [];
    if (d.creator) {
      const link = safeHttp(d.creatorLink);
      meta.push(`<span>${FNF.fi('user', 15)} ${t('Creado por', 'Created by')} ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(d.creator)}</a>` : `<b>${esc(d.creator)}</b>`}</span>`);
    }
    if (FNF.langTag(d)) meta.push(`<span>${FNF.fi('globe', 15)} ${esc(FNF.langTag(d))}</span>`);
    if (d.updatedAt) meta.push(`<span>${FNF.fi('calendar', 15)} ${t('Actualizado', 'Updated')} ${FNF.fmtDateTime(d.updatedAt).split(' · ')[0]}</span>`);
    return `
      ${nota}
      <div class="dt-text">${fmtTexto(d.desc) || `<p class="dt-empty">${t('Sin descripción.', 'No description.')}</p>`}</div>
      ${(d.tags || []).length ? `<div class="dt-tags">${d.tags.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
      ${vid ? `<button class="hb-yt dt-trailer" type="button" onclick="homeVideo(this, '${vid}')" aria-label="${t('Ver tráiler', 'Watch trailer')}"><img src="https://i.ytimg.com/vi/${vid}/hqdefault.jpg" alt="" loading="lazy"><span class="hb-play">${icon('play', 'icon')}</span></button>` : ''}
      ${meta.length ? `<div class="detail-meta">${meta.join('')}</div>` : ''}
      ${preview ? '' : `<div class="rating" id="detail-rating">
        <div class="stars">${[1, 2, 3, 4, 5].map(n => `<button onclick="rateAppItem(${n})" aria-label="${n}">★</button>`).join('')}</div>
        <small id="detail-rating-text">${t('Califica este contenido', 'Rate this content')}</small>
      </div>`}`;
  }
  if (tab.k === 'descargas') {
    const dls = d.downloads || [];
    if (!dls.length) return `<p class="dt-empty">${t('Todavía no hay descargas.', 'No downloads yet.')}</p>`;
    return `<div class="dl-list">${dls.map(dl => {
      const srv = servidorDe(dl.link);
      return `<a class="dl-link" href="${esc(safeLink(dl.link))}" target="_blank" rel="noopener"${preview ? '' : ` onclick="trackDownload('${id}')"`}>
        <span class="tile-icon">${icon('download', 'icon icon-sm')}</span><span class="dl-txt">${esc(dl.name)}${srv ? `<small>${esc(srv)}</small>` : ''}</span></a>`;
    }).join('')}</div>
    ${preview ? '' : `<button class="btn btn-ghost btn-block dt-report" onclick="abrirReporte('${id}')">${icon('alert', 'icon icon-sm')} ${t('Reportar un problema', 'Report a problem')}</button>`}`;
  }
  if (tab.k === 'capturas') {
    const imgs = imagenesDe(d);
    if (!imgs.length) return `<p class="dt-empty">${t('Sin capturas.', 'No screenshots.')}</p>`;
    return `<div class="dt-gal">${imgs.map((src, i) => `<button type="button" onclick="dtGaleria(${i})"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>`;
  }
  if (tab.k === 'chat') {
    return `<div id="dt-chat" class="dt-chat"><p class="dt-empty">${t('Cargando comentarios…', 'Loading comments…')}</p></div>
      <button class="btn btn-block" onclick="dtAbrirChat()">${icon('chat', 'icon icon-sm')} ${t('Abrir el chat', 'Open chat')}</button>`;
  }
  // ---- Pestañas extra ----
  const p = tab.p || {};
  if (p.type === 'instalar') {
    return `<ol class="dt-steps">${(p.steps || []).filter(s => s && String(s.text || '').trim()).map((s, i) => `<li><b>${i + 1}</b><span>${negrita(s.text)}</span></li>`).join('')}</ol>${fmtTexto(p.text)}`;
  }
  if (p.type === 'versiones') {
    return `<div class="dt-versions">${(p.items || []).filter(v => v && (v.version || v.text)).map((v, i) => `
      <div class="dt-version${i === 0 ? ' is-last' : ''}">
        <div class="dt-version-head"><b>${esc(v.version || '')}</b>${v.date ? `<small>${esc(v.date)}</small>` : ''}${i === 0 ? `<span class="dt-chip dt-chip-accent">${t('Actual', 'Latest')}</span>` : ''}</div>
        ${fmtTexto(v.text)}
      </div>`).join('')}</div>`;
  }
  if (p.type === 'creditos') {
    return `<div class="dt-credits">${(p.items || []).filter(c => c && c.name).map(c => {
      const link = safeHttp(c.link);
      return `<div class="dt-credit"><span class="dt-credit-av" style="background:${FNF.stringToColor(c.name)}">${esc(c.name.charAt(0).toUpperCase())}</span>
        <span class="grow"><b>${esc(c.name)}</b>${c.role ? `<small>${esc(c.role)}</small>` : ''}</span>
        ${link ? `<a class="btn btn-soft btn-sm" href="${esc(link)}" target="_blank" rel="noopener">${icon('link', 'icon icon-sm')}</a>` : ''}</div>`;
    }).join('')}</div>`;
  }
  if (p.type === 'video') {
    const vid = FNF.home.ytId(p.url);
    return `<button class="hb-yt dt-trailer" type="button" onclick="homeVideo(this, '${vid}')"><img src="https://i.ytimg.com/vi/${vid}/hqdefault.jpg" alt="" loading="lazy"><span class="hb-play">${icon('play', 'icon')}</span></button>${fmtTexto(p.text)}`;
  }
  // cambios, requisitos y personalizadas: texto + botones
  const links = (p.links || []).map(botonLink).join('');
  return `<div class="dt-text">${fmtTexto(p.text)}</div>${links ? `<div class="hb-links">${links}</div>` : ''}`;
}

// ---- Barra fija de abajo ----
function pieHTML() {
  const { type, id, d, preview } = actual;
  const dls = d.downloads || [];
  const liked = !!FNF.store.json('my_liked_items', {})[id];
  const fav = !!FNF.store.json('fnf_favorites', {})[id];
  const likes = (live().likes || {})[id] || 0;
  const texto = type === 'script' ? t('Descargar script', 'Get script') : t('Descargar', 'Download');
  const principal = !dls.length
    ? `<span class="btn dt-dl btn-disabled">${icon('download', 'icon icon-sm')} ${t('Sin descarga', 'No download')}</span>`
    : dls.length === 1
      ? `<a class="btn dt-dl" href="${esc(safeLink(dls[0].link))}" target="_blank" rel="noopener"${preview ? '' : ` onclick="trackDownload('${id}')"`}>${icon('download', 'icon icon-sm')} ${texto}</a>`
      : `<button class="btn dt-dl" onclick="dtMenuDescargas()">${icon('download', 'icon icon-sm')} ${texto} <small>▾</small></button>`;
  if (preview) return principal;
  return `
    <button class="dt-ib${liked ? ' active' : ''}" onclick="handleLike('${id}', this)" aria-label="Like">${icon('heart', 'icon')}<span>${FNF.compact(likes)}</span></button>
    <button class="dt-ib${fav ? ' is-fav' : ''}" data-fav="${id}" onclick="toggleFavorite('${id}')" aria-label="${t('Guardar', 'Save')}">${icon('bookmark', 'icon')}</button>
    <button class="dt-ib" onclick="abrirMenuCompartir('${id}', '${esc(String(d.title || '').replace(/['"\\]/g, ''))}')" aria-label="${t('Compartir', 'Share')}">${icon('share', 'icon')}</button>
    ${principal}`;
}

// ==========================================
// RUEDA 3D DE PESTAÑAS
// ==========================================
function colocarRing() {
  const n = tabs.length;
  $('dt-ring').querySelectorAll('.dt-tab').forEach((b, i) => {
    let off = i - activa;
    if (off > n / 2) off -= n;      // es un círculo: la última está junto a la primera
    if (off < -n / 2) off += n;
    const a = Math.abs(off);
    b.style.transform = `translate(-50%, -50%) translateX(${off * 96}px) translateZ(${-a * 90}px) rotateY(${-off * 40}deg)`;
    b.style.opacity = a > 2 ? 0 : String(1 - a * 0.32);
    b.style.zIndex = String(10 - a);
    b.style.pointerEvents = a > 2 ? 'none' : '';
    b.classList.toggle('on', off === 0);
    b.setAttribute('aria-selected', off === 0 ? 'true' : 'false');
  });
  $('dt-dots').innerHTML = tabs.length > 1 ? tabs.map((_, i) => `<span class="${i === activa ? 'on' : ''}"></span>`).join('') : '';
}

function mostrarPanel(dir = 0) {
  const stage = $('dt-stage');
  const nuevo = document.createElement('div');
  nuevo.className = 'dt-panel activo';
  nuevo.innerHTML = panelHTML(tabs[activa]);
  const viejos = [...stage.querySelectorAll('.dt-panel')];
  stage.appendChild(nuevo);
  viejos.forEach(v => {
    if (dir && !sinAnimacion() && v.classList.contains('activo')) {
      // Giro de cubo: la pestaña de antes se va de lado y la nueva entra del otro
      v.classList.remove('activo');
      v.classList.add('saliendo', dir > 0 ? 'out-next' : 'out-prev');
      nuevo.classList.add(dir > 0 ? 'in-next' : 'in-prev');
      setTimeout(() => v.remove(), 480);
    } else v.remove();
  });
  const tab = tabs[activa];
  if (tab.k === 'info' && !actual.preview && window.loadItemRating) window.loadItemRating(actual.id);
  if (tab.k === 'chat') cargarChat();
}

function irA(i, dir) {
  const n = tabs.length;
  if (!n) return;
  i = ((i % n) + n) % n;
  if (i === activa) return;
  if (dir === undefined) {
    let off = i - activa;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    dir = off > 0 ? 1 : -1;
  }
  activa = i;
  colocarRing();
  mostrarPanel(dir);
  vibrate(8);
}
window.dtPestana = (dir) => irA(activa + dir, dir);
window.dtIrPestana = (k) => { const i = tabs.findIndex(x => x.k === k); if (i >= 0) irA(i); };

// Deslizar el dedo a los lados (sobre las pestañas o su contenido) gira la rueda
function deslizable(el) {
  let x0 = null, y0 = 0;
  const ini = (x, y, target) => { if (target.closest('.dt-car, .no-swipe, input, textarea')) { x0 = null; return; } x0 = x; y0 = y; };
  const fin = (x, y) => {
    if (x0 === null) return;
    const dx = x - x0, dy = y - y0;
    x0 = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) window.dtPestana(dx < 0 ? 1 : -1);
  };
  el.addEventListener('touchstart', (e) => ini(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
  el.addEventListener('touchend', (e) => fin(e.changedTouches[0].clientX, e.changedTouches[0].clientY), { passive: true });
  el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') ini(e.clientX, e.clientY, e.target); });
  el.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') fin(e.clientX, e.clientY); });
}
deslizable($('dt-ring'));
deslizable($('dt-stage'));
$('dt-ring').addEventListener('click', (e) => {
  const b = e.target.closest('.dt-tab');
  if (b) irA(Number(b.dataset.i));
});
// Teclado (compu): flechas izquierda / derecha
document.addEventListener('keydown', (e) => {
  if (!$('detail-popup').classList.contains('show') || e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight') window.dtPestana(1);
  if (e.key === 'ArrowLeft') window.dtPestana(-1);
});
// Los enlaces internos de las pestañas cierran el popup antes de navegar
$('dt-stage').addEventListener('click', (e) => { if (e.target.closest('[data-hl]') && !actual.preview) window.closeDetail(); });

// ---- Chat: los últimos comentarios (se cargan al abrir la pestaña) ----
async function cargarChat() {
  const box = $('dt-chat');
  if (!box || !actual || actual.preview) { if (box) box.innerHTML = `<p class="dt-empty">${t('El chat se ve después de guardar.', 'Chat appears after saving.')}</p>`; return; }
  const id = actual.id;
  try {
    const snap = await get(query(ref(db, `mod_comments/${id}`), limitToLast(3)));
    if (!actual || actual.id !== id || !$('dt-chat')) return;
    const lista = Object.values(snap.val() || {}).filter(c => c && c.text).reverse();
    $('dt-chat').innerHTML = lista.length ? lista.map(c => `
      <div class="dt-chat-item"><span class="dt-credit-av" style="background:${FNF.stringToColor(c.user || '?')}">${esc(String(c.user || '?').charAt(0).toUpperCase())}</span>
        <span class="grow"><b>${esc(c.user || 'Usuario')}</b><small>${FNF.conMenciones ? FNF.conMenciones(String(c.text).slice(0, 120)) : esc(String(c.text).slice(0, 120))}</small></span></div>`).join('')
      : `<p class="dt-empty">${t('Nadie ha comentado todavía. ¡Sé el primero!', 'No comments yet. Be the first!')}</p>`;
  } catch (err) {
    if ($('dt-chat')) $('dt-chat').innerHTML = `<p class="dt-empty">${t('No se pudieron cargar los comentarios.', "Couldn't load comments.")}</p>`;
  }
}
window.dtAbrirChat = () => {
  if (!actual || actual.preview) return;
  window.openModComments(actual.id, actual.d.title);
};

// ---- Galería, carrusel de portada y menú de descargas ----
window.dtGaleria = (i) => { if (actual) window.abrirGaleria(imagenesDe(actual.d), i); };
window.dtMenuDescargas = () => {
  const { id, d, preview } = actual;
  const menu = $('dt-dlmenu');
  menu.innerHTML = `
    <h4>${t('Elige tu descarga', 'Choose your download')}</h4>
    ${(d.downloads || []).map(dl => `<a class="dt-dlop" href="${esc(safeLink(dl.link))}" target="_blank" rel="noopener"${preview ? '' : ` onclick="trackDownload('${id}'); dtCerrarMenu()"`}>
      <span class="tile-icon">${icon('download', 'icon icon-sm')}</span><span class="grow"><b>${esc(dl.name)}</b><small>${esc(servidorDe(dl.link))}</small></span>${icon('right', 'icon icon-sm')}</a>`).join('')}
    <button class="btn btn-ghost btn-block" onclick="dtCerrarMenu()">${t('Cancelar', 'Cancel')}</button>`;
  menu.hidden = false;
  vibrate(10);
};
window.dtCerrarMenu = () => { $('dt-dlmenu').hidden = true; };
document.addEventListener('scroll', (e) => {
  const car = e.target;
  if (!car.id || car.id !== 'dt-car') return;
  const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
  document.querySelectorAll('#dt-cover-dots span').forEach((s, j) => s.classList.toggle('on', j === i));
}, true);

// ==========================================
// ABRIR EL POPUP
// ==========================================
function showDetail(type, id, d, opts = {}) {
  if (!d) return;
  const preview = !!opts.preview;
  actual = { type, id, d, preview };
  window.currentItemRatingId = preview ? null : id;
  window.currentItemType = type;
  $('detail-preview-flag').hidden = !preview;
  $('detail-popup').classList.toggle('popup-top', preview);
  $('detail-popup').dataset.type = type;
  $('dt-dlmenu').hidden = true;

  $('dt-head').innerHTML = cabeceraHTML(type, id, d);
  $('dt-datos').innerHTML = datosHTML(type, id, d);
  const compatEl = $('detail-compat');
  const compat = type === 'mod' ? FNF.compatOf(d.ram) : null;
  compatEl.className = 'detail-compat' + (compat ? ' compat-' + compat : '');
  compatEl.textContent = compat ? t(COMPAT_TEXT[compat][0], COMPAT_TEXT[compat][1]) : '';
  compatEl.hidden = !compat;

  tabs = pestanasDe(d);
  activa = Math.max(0, tabs.findIndex(x => x.k === (opts.tab || 'info')));
  $('dt-ring').innerHTML = tabs.map((tb, i) => `<button type="button" class="dt-tab" data-i="${i}" role="tab"><span class="dt-tab-e">${esc(tb.e)}</span><span>${esc(tb.label)}</span>${tb.n ? `<em>${tb.n}</em>` : ''}</button>`).join('');
  $('dt-stage').innerHTML = '';
  colocarRing();
  mostrarPanel(0);
  $('dt-foot').innerHTML = pieHTML();
  $('dt-scroll').scrollTop = 0;

  current = preview ? null : { id, type };
  window.refreshDetailAdmin();
  openPopup('detail-popup');
}

// Vista previa desde el editor del panel (se abre encima del editor, sin guardar nada)
window.previewDetalle = (type, d) => showDetail(type, 'preview', d, { preview: true });

// ==========================================
// HERRAMIENTAS DE ADMIN DENTRO DEL POPUP
// ==========================================
window.refreshDetailAdmin = () => {
  const box = $('detail-admin');
  if (!box) return;
  if (!window.isSuperUser || !current) { box.hidden = true; box.innerHTML = ''; return; }
  const { id, type } = current;
  const L = live();
  const d = FNF.itemOf(id) || {};
  const pinned = !!(L.pinned || {})[id];
  const led = !!(L.leds || {})[id];
  const isNew = (L.newMods || {})['card-' + id] === true;
  const broken = (L.broken || {})[id];
  const top = !!(L.recomendados || {})[id];
  const r = window.ratingOf ? window.ratingOf(id) : { n: 0, avg: 0 };
  const jsTitle = esc(String(d.title || '').replace(/['"\\]/g, ''));
  const enArchivo = !!(window[FNF.KINDS[type].data + '_BASE'] || {})[id];
  const abierto = FNF.store.get('dt_admin_open', 'true') === 'true';
  const fi = FNF.fi;
  const btn = (ic, label, action, on, cls = '') => `<button class="adm-chip${on ? ' on' : ''} ${cls}" onclick="${action}">${fi(ic, 16)}<span>${label}</span></button>`;
  const sec = (titulo, html) => `<div class="dt-admin-sec"><b>${titulo}</b><div class="detail-admin-grid">${html}</div></div>`;
  box.innerHTML = `
    <details class="dt-admin" ${abierto ? 'open' : ''} ontoggle="FNF.store.set('dt_admin_open', String(this.open))">
      <summary>
        <span>${fi('shield', 18)} Admin</span>
        <small>${fi('download', 13)} ${FNF.compact((L.downloads || {})[id])} · ${fi('bolt', 13)} ${FNF.compact((L.week || {})[id])} sem. · ${fi('like', 13)} ${FNF.compact((L.likes || {})[id])} · ★ ${r.n ? r.avg.toFixed(1) : '—'}</small>
      </summary>
      <div class="dt-admin-id">ID: <code>${esc(id)}</code> ${btn('copy', 'Copiar ID', `FNF.copyText('${id}', 'ID copiado.')`)}</div>
      ${broken ? `<p class="detail-admin-alert">${fi('warning', 16)} Descarga bloqueada · reportado por ${esc(broken.reportedBy || '¿?')} ${broken.timestamp ? FNF.timeAgo(broken.timestamp) : ''}</p>` : ''}
      ${sec('Estado', `
        ${btn('notes', d.draft ? 'Es borrador' : 'Publicado', `adminCampoItem('${id}', 'draft')`, d.draft)}
        ${btn('lock', d.hidden ? 'Secreto' : 'Visible', `adminCampoItem('${id}', 'hidden')`, d.hidden)}
        ${btn('pin', pinned ? 'Fijado' : 'Fijar', `toggleModPin('${id}')`, pinned)}
        ${btn('star', isNew ? 'Es NUEVO' : 'Marcar NUEVO', `toggleNewMod('card-${id}', true)`, isNew)}
        ${btn('led', led ? 'Actualizado' : 'Marcar actualizado', `toggleGreenLed('${id}')`, led)}
        ${type === 'script' ? btn('bolt', top ? 'Es TOP' : 'Marcar TOP', `toggleRecomendarScript('${id}')`, top) : ''}
        ${broken ? btn('check', 'Reparar link', `fixBrokenLink('${id}', true)`, true, 'ok') : btn('ban', 'Bloquear descarga', `adminMarcarCaido('${id}')`)}`)}
      ${sec('Editar', `
        ${btn('edit', 'Editar todo', `closeDetail(); abrirEditorEn('${id}', '${type}')`)}
        ${btn('list', 'Pestañas', `closeDetail(); abrirEditorEn('${id}', '${type}', 'ed-s-tabs')`)}
        ${btn('image', 'Imágenes', `closeDetail(); abrirEditorEn('${id}', '${type}', 'ed-s-media')`)}
        ${btn('download', 'Descargas', `closeDetail(); abrirEditorEn('${id}', '${type}', 'ed-s-dl')`)}
        ${btn('clock', 'Programar', `closeDetail(); abrirEditorEn('${id}', '${type}', 'ed-s-pub')`)}
        ${btn('copy', 'Duplicar', `closeDetail(); adminDuplicarItem('${id}')`)}`)}
      ${sec('Compartir y avisar', `
        ${btn(d.hidden ? 'lock' : 'link', d.hidden ? 'Enlace secreto' : 'Copiar enlace', `adminCopiarEnlace('${id}')`)}
        ${btn('bell', 'Avisar en campana', `adminNotificarItem('${id}')`)}
        ${btn('chat', 'Comentarios', `closeDetail(); openModComments('${id}', '${jsTitle}')`)}
        ${btn('code', 'Ver en el panel', `closeDetail(); adminVerContenido('${id}')`)}`)}
      ${sec('Zona peligrosa', `
        ${btn('hide', 'Ocultar', `adminOcultarItem('${id}', true)`, false, 'danger')}
        ${enArchivo && A_customDe(type, id) ? btn('refresh', 'Volver al original', `closeDetail(); adminRestaurarItem('${id}')`, false, 'danger') : ''}
        ${!enArchivo ? btn('trash', 'Borrar para siempre', `closeDetail(); adminBorrarItem('${id}')`, false, 'danger') : ''}`)}
    </details>`;
  box.hidden = false;
};
const A_customDe = (type, id) => !!(((live().customs || {})[type]) || {})[id];

const guard = () => window.exigirRegistro && window.exigirRegistro();

// Si el link está reportado como caído, los usuarios ven "en mantenimiento" (el admin sí puede entrar)
function openItem(type, id, opts) {
  if (guard()) return;
  const d = FNF.itemOf(id);
  // Borradores, secretos sin enlace y programados que aún no llegan a su hora
  if (d && FNF.puedeVer && !FNF.puedeVer(id)) {
    if (!d.draft && Number(d.publishAt) > Date.now()) {
      return toast(t(`⏳ "${d.title}" se publica el ${FNF.fmtDateTime(d.publishAt)}. ¡Ya casi!`, `⏳ "${d.title}" goes live on ${FNF.fmtDateTime(d.publishAt)}. Almost there!`), 'clock');
    }
    return toast(t('Este contenido no está disponible.', 'This content is not available.'), 'info');
  }
  if (window.brokenLinksData && window.brokenLinksData[id] && !window.isSuperUser) {
    $('maintenance-mod-name').textContent = d ? d.title : '';
    openPopup('maintenance-popup');
    return;
  }
  showDetail(type, id, d, opts);
}

window.openModInfo = (id, opts) => openItem('mod', id, opts);
window.openApkInfo = (id, opts) => openItem('apk', id, opts);
window.openScriptInfo = (id, opts) => openItem('script', id, opts);
// Nombre de antes (lo usaba el carrusel viejo)
window.carouselStep = (dir) => window.dtPestana(dir);

window.closeDetail = () => {
  closePopup('detail-popup');
  $('dt-dlmenu').hidden = true;
  setTimeout(() => $('detail-popup').classList.remove('popup-top'), 400);
  window.currentItemRatingId = null;
  current = null;
  actual = null;
};
// Nombres antiguos (por si quedan enlaces en otros archivos)
window.closeModInfo = window.closeApkInfo = window.closeScriptInfo = window.closeDetail;
}).catch(err => console.error(err));
