// Popup de detalle (mods / bases / scripts) + contador de descargas.
window.fbReady.then((FB) => {
const { db, auth, googleProvider, ref, get, set, update, remove, push, onValue, runTransaction, signInWithPopup, onAuthStateChanged, signOut, APP_VERSION } = FB;
const { store, t, esc, icon, vibrate, openPopup, closePopup, toast, getProfile, profileName, profilePhoto, stringToColor } = FNF;

// Suma la descarga al total y al contador de la semana (para el Top de la semana)
window.trackDownload = (id) => {
  runTransaction(ref(db, `downloads/${id}`), (current) => (current || 0) + 1);
  runTransaction(ref(db, `downloads_week/${FNF.weekKey()}/${id}`), (current) => (current || 0) + 1).catch(() => { });
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
  imgIndex = 0;
  setImage();
  document.getElementById('detail-media').classList.toggle('is-logo', type === 'apk');
  const multi = images.length > 1;
  document.querySelectorAll('#detail-media .carousel-btn, #carousel-count').forEach(b => b.classList.toggle('hidden', !multi));

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
  if (window.isSuperUser) h += `<button class="btn btn-ghost btn-block" onclick="fixBrokenLink('${id}')">🛠️ ${t('Limpiar reportes', 'Clear reports')}</button>`;
  document.getElementById('detail-downloads').innerHTML = h;

  if (window.loadItemRating) window.loadItemRating(id);
  openPopup('detail-popup');
}

const guard = () => window.exigirRegistro && window.exigirRegistro();

window.openModInfo = (id) => {
  if (guard()) return;
  if (window.brokenLinksData && window.brokenLinksData[id] && !window.isSuperUser) {
    const d = window.MOD_DATA[id];
    document.getElementById('maintenance-mod-name').textContent = d ? d.title : '';
    openPopup('maintenance-popup');
    return;
  }
  showDetail('mod', id, window.MOD_DATA[id]);
};

window.openApkInfo = (id) => { if (!guard()) showDetail('apk', id, window.APK_DATA[id]); };
window.openScriptInfo = (id) => { if (!guard()) showDetail('script', id, window.SCRIPTS_DATA[id]); };

// Tocar la imagen del detalle la abre a pantalla completa
document.getElementById('detail-img').addEventListener('click', () => window.abrirGaleria(images, imgIndex));

window.closeDetail = () => {
  closePopup('detail-popup');
  window.currentItemRatingId = null;
};
// Nombres antiguos (por si quedan enlaces en otros archivos)
window.closeModInfo = window.closeApkInfo = window.closeScriptInfo = window.closeDetail;
}).catch(err => console.error(err));
