// Popup de detalle (mods / bases / scripts) + contador de descargas.
window.fbReady.then((FB) => {
const { db, auth, googleProvider, ref, get, set, update, remove, push, onValue, runTransaction, signInWithPopup, onAuthStateChanged, signOut, APP_VERSION } = FB;
const { store, t, esc, icon, vibrate, openPopup, closePopup, toast, getProfile, profileName, profilePhoto, stringToColor } = FNF;

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

let images = [];
let imgIndex = 0;

function setImage() {
  const img = document.getElementById('detail-img');
  img.removeAttribute('data-fallback');
  img.classList.remove('img-error');
  img.src = images[imgIndex] || '';
  document.getElementById('carousel-count').textContent = `${imgIndex + 1} / ${images.length}`;
}

window.carouselStep = (dir) => {
  if (images.length < 2) return;
  imgIndex = (imgIndex + dir + images.length) % images.length;
  setImage();
};

// Nombre del servidor de una descarga (MediaFire, Google Drive...) para mostrarlo debajo del botón
const servidorDe = (u) => {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    const conocidos = { 'mediafire.com': 'MediaFire', 'drive.google.com': 'Google Drive', 'mega.nz': 'MEGA', 'github.com': 'GitHub', 'gamebanana.com': 'GameBanana', 'dropbox.com': 'Dropbox', 'gamejolt.com': 'Game Jolt', 'itch.io': 'itch.io', 'pixeldrain.com': 'Pixeldrain' };
    const k = Object.keys(conocidos).find(s => h === s || h.endsWith('.' + s));
    return k ? conocidos[k] : h;
  } catch (e) { return ''; }
};
const NOTA_ICONO = { info: 'info', warn: 'alert', danger: 'ban', ok: 'check' };

function showDetail(type, id, d, opts = {}) {
  if (!d) return;
  const preview = !!opts.preview;
  window.currentItemRatingId = preview ? null : id;
  window.currentItemType = type;
  document.getElementById('detail-preview-flag').hidden = !preview;
  document.getElementById('detail-popup').classList.toggle('popup-top', preview);
  document.getElementById('detail-rating').hidden = preview;

  // Etiquetas propias, nota importante y tráiler
  const tagsEl = document.getElementById('detail-tags');
  tagsEl.innerHTML = (d.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join('');
  tagsEl.hidden = !(d.tags || []).length;
  const nota = document.getElementById('detail-note');
  const tipoNota = NOTA_ICONO[d.noteType] ? d.noteType : 'warn';
  nota.className = 'detail-note note-' + tipoNota;
  nota.innerHTML = d.note ? `${icon(NOTA_ICONO[tipoNota], 'icon icon-sm')}<span>${esc(d.note)}</span>` : '';
  nota.hidden = !d.note;
  const trailer = document.getElementById('detail-trailer');
  const vid = FNF.home && FNF.home.ytId(d.trailer);
  trailer.innerHTML = vid ? `<button class="hb-yt" type="button" onclick="homeVideo(this, '${vid}')" aria-label="${t('Ver tráiler', 'Watch trailer')}">
      <img src="https://i.ytimg.com/vi/${vid}/hqdefault.jpg" alt="" loading="lazy"><span class="hb-play">${icon('play', 'icon')}</span></button>` : '';
  trailer.hidden = !vid;

  document.getElementById('detail-title').textContent = d.title;
  document.getElementById('detail-desc').textContent = (d.desc || '').replace(/\/n/g, '\n');
  const version = document.getElementById('detail-version');
  version.textContent = d.version || '';
  version.style.display = d.version ? '' : 'none';

  images = d.images && d.images.length ? d.images : [d.img];
  if (d.img && !images.includes(d.img)) images = [d.img, ...images];
  imgIndex = 0;
  setImage();
  document.getElementById('detail-media').classList.toggle('is-logo', type === 'apk');
  const multi = images.length > 1;
  document.querySelectorAll('#detail-media .carousel-btn, #carousel-count').forEach(b => b.classList.toggle('hidden', !multi));

  // Créditos del creador original e idioma
  const meta = document.getElementById('detail-meta');
  const safeHttp = (u) => /^https?:\/\//i.test(u || '') ? u : '';
  const parts = [];
  if (d.creator) {
    const link = safeHttp(d.creatorLink);
    parts.push(`<span>${FNF.fi('user', 16)} ${t('Creado por', 'Created by')} ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(d.creator)}</a>` : `<b>${esc(d.creator)}</b>`}</span>`);
  }
  if (FNF.langTag && FNF.langTag(d)) parts.push(`<span>${FNF.fi('globe', 16)} ${esc(FNF.langTag(d))}</span>`);
  if (d.updatedAt) parts.push(`<span>${FNF.fi('calendar', 16)} ${t('Actualizado', 'Updated')} ${FNF.fmtDateTime(d.updatedAt).split(' · ')[0]}</span>`);
  meta.innerHTML = parts.join('');
  meta.hidden = !parts.length;

  // Qué cambió en esta versión
  const cl = document.getElementById('detail-changelog');
  document.getElementById('detail-changelog-text').textContent = d.changelog || '';
  cl.hidden = !d.changelog;
  cl.open = false;

  // ¿Corre en mi celular?
  const compatEl = document.getElementById('detail-compat');
  const compat = type === 'mod' ? FNF.compatOf(d.ram) : null;
  compatEl.className = 'detail-compat' + (compat ? ' compat-' + compat : '');
  compatEl.textContent = compat ? t(COMPAT_TEXT[compat][0], COMPAT_TEXT[compat][1]) : '';
  compatEl.hidden = !compat;

  const safeLink = (u) => /^(https?:\/\/|assets\/)/i.test(u || '') ? u : '#';
  let h = (d.downloads || []).map(dl => {
    const srv = servidorDe(dl.link);
    return `
    <a class="dl-link" href="${esc(safeLink(dl.link))}" target="_blank" rel="noopener"${preview ? '' : ` onclick="trackDownload('${id}')"`}>
      <span class="tile-icon">${icon('download', 'icon icon-sm')}</span><span class="dl-txt">${esc(dl.name)}${srv ? `<small>${esc(srv)}</small>` : ''}</span>
    </a>`;
  }).join('');
  if (!preview) h += `<button class="btn btn-ghost btn-block" style="margin-top:6px;color:var(--danger)" onclick="abrirReporte('${id}')">${icon('alert', 'icon icon-sm')} ${t('Reportar un problema', 'Report a problem')}</button>`;
  document.getElementById('detail-downloads').innerHTML = h;

  current = preview ? null : { id, type };
  window.refreshDetailAdmin();
  if (!preview && window.loadItemRating) window.loadItemRating(id);
  openPopup('detail-popup');
}

// Vista previa desde el editor del panel (se abre encima del editor, sin guardar nada)
window.previewDetalle = (type, d) => showDetail(type, 'preview', d, { preview: true });

// ---- Panel de admin dentro del popup (mods, bases y scripts) ----
let current = null;

window.refreshDetailAdmin = () => {
  const box = document.getElementById('detail-admin');
  if (!box) return;
  if (!window.isSuperUser || !current) { box.hidden = true; return; }
  const { id, type } = current;
  const L = window.live || {};
  const d = FNF.itemOf(id) || {};
  const pinned = !!(L.pinned || {})[id];
  const led = !!(L.leds || {})[id];
  const isNew = (L.newMods || {})['card-' + id] === true;
  const broken = (L.broken || {})[id];
  const top = !!(L.recomendados || {})[id];
  const r = window.ratingOf ? window.ratingOf(id) : { n: 0, avg: 0 };
  const jsTitle = esc(String(d.title || '').replace(/['"\\]/g, ''));

  const fi = FNF.fi;
  const btn = (ic, label, action, on, cls = '') => `<button class="adm-chip${on ? ' on' : ''} ${cls}" onclick="${action}">${fi(ic, 18)}<span>${label}</span></button>`;
  box.innerHTML = `
    <div class="detail-admin-head">
      <span>${fi('shield', 18)} Admin</span>
      <small>${fi('download', 14)} ${FNF.compact((L.downloads || {})[id])} · ${fi('bolt', 14)} ${FNF.compact((L.week || {})[id])} sem. · ${fi('like', 14)} ${FNF.compact((L.likes || {})[id])} · ${fi('star', 14)} ${r.n ? r.avg.toFixed(1) : '—'} (${r.n})</small>
    </div>
    ${broken ? `<p class="detail-admin-alert">${fi('warning', 16)} Descarga bloqueada · reportado por ${esc(broken.reportedBy || '¿?')} ${broken.timestamp ? FNF.timeAgo(broken.timestamp) : ''}</p>` : ''}
    <div class="detail-admin-grid">
      ${btn('pin', pinned ? 'Desfijar' : 'Fijar', `toggleModPin('${id}')`, pinned)}
      ${btn('led', led ? 'Quitar LED' : 'Marcar actualizado', `toggleGreenLed('${id}')`, led)}
      ${btn('star', isNew ? 'Quitar NUEVO' : 'Marcar NUEVO', `toggleNewMod('card-${id}', true)`, isNew)}
      ${broken ? btn('check', 'Reparar link', `fixBrokenLink('${id}', true)`, true, 'ok') : btn('ban', 'Bloquear descarga', `adminMarcarCaido('${id}')`, false)}
      ${type === 'script' ? btn('bolt', top ? 'Quitar TOP' : 'Marcar TOP', `toggleRecomendarScript('${id}')`, top) : ''}
      ${btn('edit', 'Editar', `closeDetail(); abrirEditorMod('${id}', '${type}')`)}
      ${btn('copy', 'Duplicar', `closeDetail(); adminDuplicarItem('${id}')`)}
      ${btn('bell', 'Avisar en campana', `adminNotificarItem('${id}')`)}
      ${btn('chat', 'Comentarios', `closeDetail(); openModComments('${id}', '${jsTitle}')`)}
      ${btn(d.hidden ? 'lock' : 'link', d.hidden ? 'Enlace secreto' : 'Copiar enlace', `adminCopiarEnlace('${id}')`)}
      ${btn('code', 'Ver en el panel', `closeDetail(); adminVerContenido('${id}')`)}
      ${btn('hide', 'Ocultar', `adminOcultarItem('${id}', true)`, false, 'danger')}
    </div>`;
  box.hidden = false;
};

const guard = () => window.exigirRegistro && window.exigirRegistro();

// Si el link está reportado como caído, los usuarios ven "en mantenimiento" (el admin sí puede entrar)
function openItem(type, id) {
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
    document.getElementById('maintenance-mod-name').textContent = d ? d.title : '';
    openPopup('maintenance-popup');
    return;
  }
  showDetail(type, id, d);
}

window.openModInfo = (id) => openItem('mod', id);
window.openApkInfo = (id) => openItem('apk', id);
window.openScriptInfo = (id) => openItem('script', id);

// Tocar la imagen del detalle la abre a pantalla completa
document.getElementById('detail-img').addEventListener('click', () => window.abrirGaleria(images, imgIndex));

window.closeDetail = () => {
  closePopup('detail-popup');
  setTimeout(() => document.getElementById('detail-popup').classList.remove('popup-top'), 400);
  window.currentItemRatingId = null;
  current = null;
};
// Nombres antiguos (por si quedan enlaces en otros archivos)
window.closeModInfo = window.closeApkInfo = window.closeScriptInfo = window.closeDetail;
}).catch(err => console.error(err));
