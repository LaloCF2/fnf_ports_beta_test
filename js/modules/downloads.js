// Popup de detalle (mods / bases / scripts) + contador de descargas.
window.fbReady.then((FB) => {
const { db, auth, googleProvider, ref, get, set, update, remove, push, onValue, runTransaction, signInWithPopup, onAuthStateChanged, signOut, APP_VERSION } = FB;
const { store, t, esc, icon, vibrate, openPopup, closePopup, toast, getProfile, profileName, profilePhoto, stringToColor } = FNF;

// Suma la descarga al total y al contador de la semana (para el Top de la semana)
window.trackDownload = (id) => {
  runTransaction(ref(db, `downloads/${id}`), (current) => (current || 0) + 1);
  runTransaction(ref(db, `downloads_week/${FNF.weekKey()}/${id}`), (current) => (current || 0) + 1).catch(() => { });
  runTransaction(ref(db, `downloads_day/${FNF.dayKey()}/${id}`), (current) => (current || 0) + 1).catch(() => { });
  // Historial "Mis descargas" (solo en este celular)
  const hist = store.json('fnf_dl_history', []).filter(h => h.id !== id);
  hist.unshift({ id, ts: Date.now() });
  store.setJson('fnf_dl_history', hist.slice(0, 60));
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

function showDetail(type, id, d) {
  if (!d) return;
  window.currentItemRatingId = id;
  window.currentItemType = type;

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
  let h = (d.downloads || []).map(dl => `
    <a class="dl-link" href="${esc(safeLink(dl.link))}" target="_blank" rel="noopener" onclick="trackDownload('${id}')">
      <span class="tile-icon">${icon('download', 'icon icon-sm')}</span><span>${esc(dl.name)}</span>
    </a>`).join('');
  h += `<button class="btn btn-ghost btn-block" style="margin-top:6px;color:var(--danger)" onclick="abrirReporte('${id}')">${icon('alert', 'icon icon-sm')} ${t('Reportar un problema', 'Report a problem')}</button>`;
  document.getElementById('detail-downloads').innerHTML = h;

  current = { id, type };
  window.refreshDetailAdmin();
  if (window.loadItemRating) window.loadItemRating(id);
  openPopup('detail-popup');
}

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
  window.currentItemRatingId = null;
  current = null;
};
// Nombres antiguos (por si quedan enlaces en otros archivos)
window.closeModInfo = window.closeApkInfo = window.closeScriptInfo = window.closeDetail;
}).catch(err => console.error(err));
