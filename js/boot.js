// Arranque rápido: pinta la página sin esperar a Firebase.
(() => {
const { store, t, esc, vibrate, openPopup, toast, getProfile, profileName, profilePhoto } = FNF;
// (Los módulos de Firebase cargan después y conectan los datos en vivo.)

// ---- Admin ----
// Solo se activa cuando Firebase confirma que la sesión de Google es la del admin (auth.js).
// Aunque alguien lo active a mano en la consola, las reglas de Firebase le niegan cualquier cambio.
window.isSuperUser = false;
window.setAdminMode = (on) => {
  on = !!on;
  const changed = on !== window.isSuperUser;
  window.isSuperUser = on;
  document.body.classList.toggle('is-admin', on);
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !on));
  if (!on) document.querySelectorAll('.admin-count').forEach(el => { el.hidden = true; });
  if (changed) {
    window.renderAll();
    if (window.repaintLiveData) window.repaintLiveData();
    window.filterContent(true);
    if (on && window.startAdminListeners) window.startAdminListeners();
    if (!on && window.currentSection && window.currentSection() === 'admin') window.selectSection('home');
  }
};

// Limpieza de datos de versiones viejas que daban "admin" desde el navegador
store.remove('superUser');

// Contenido guardado desde el panel (copia local para pintarlo al instante, sin esperar a Firebase)
Object.entries(FNF.KINDS).forEach(([kind, k]) => {
  window[k.data + '_BASE'] = window[k.data] || {};
  window.applyCustom(kind, store.json(k.cache, {}));
});

const params = new URLSearchParams(location.search);
if (params.has('set_admin')) history.replaceState({}, document.title, location.pathname + location.hash);

// Mods secretos desbloqueados por enlace (?unlock=modId)
const modToUnlock = params.get('unlock');
if (modToUnlock) {
  const unlocked = store.json('unlocked_mods', []);
  if (!unlocked.includes(modToUnlock)) {
    unlocked.push(modToUnlock);
    store.setJson('unlocked_mods', unlocked);
    setTimeout(() => { openPopup('secret-unlocked-popup'); vibrate([30, 50, 30]); }, 900);
  }
  history.replaceState({}, document.title, location.pathname + location.hash);
}

// ---- Saludo y avatar del encabezado ----
window.updateHeaderUser = () => {
  const h = new Date().getHours();
  document.getElementById('greet-time').textContent =
    h < 12 ? t('¡Buenos días!', 'Good morning!') : h < 19 ? t('¡Buenas tardes!', 'Good afternoon!') : t('¡Buenas noches!', 'Good evening!');
  const p = getProfile();
  const loggedIn = !!window.usuarioActualFirebase;
  document.getElementById('greet-name').textContent = loggedIn && p ? profileName(p) : "FNF' Ports";
  const photo = loggedIn && profilePhoto(p);
  document.getElementById('profileBtn').innerHTML = photo ? `<img src="${esc(photo)}" alt="">` : '<svg class="icon"><use href="#i-user"/></svg>';
};

// ---- Idioma ----
function applyLanguage() {
  document.querySelectorAll('[data-es][data-en]').forEach(el => {
    el.innerHTML = el.getAttribute(`data-${window.currentLang}`);
  });
  const label = window.currentLang === 'es' ? 'English' : 'Español';
  ['langBtn', 'langBtn2'].forEach(id => { const b = document.getElementById(id); if (b) b.textContent = label; });
  document.documentElement.lang = window.currentLang;
  document.getElementById('globalSearch').placeholder = t('Buscar...', 'Search...');
  window.updateHeaderUser();
}

window.toggleLanguage = () => {
  window.currentLang = window.currentLang === 'es' ? 'en' : 'es';
  store.set('fnf_lang', window.currentLang);
  window.renderAll();
  if (window.repaintLiveData) window.repaintLiveData();
  applyLanguage();
  if (window.refreshFavoritesUI) window.refreshFavoritesUI();
  window.filterContent(true);
  vibrate(15);
};

window.entrarComoInvitado = () => {
  store.set('fnf_guest_mode', 'true');
  document.getElementById('auth-overlay').style.display = 'none';
};

// Mientras Firebase termina de cargar, los botones avisan en vez de fallar.
['openModInfo', 'openApkInfo', 'openScriptInfo', 'handleLike', 'toggleFavorite', 'openModComments', 'abrirReporte', 'reportError',
  'voteRequest', 'enviarSolicitudMod', 'abrirEditorMod', 'rateAppItem', 'toggleGreenLed', 'toggleModPin', 'toggleNewMod', 'fixBrokenLink',
  'abrirPerfil', 'toggleNotificaciones', 'abrirFavoritos', 'abrirPedidos', 'cargarNovedadesTXT', 'enviarMensajeAlBot',
  'iniciarSesionConGoogle', 'toggleFaq', 'abrirGaleria', 'resetSettings']
  .forEach(name => { if (!window[name]) window[name] = () => toast(t('Conectando...', 'Connecting...'), 'globe'); });

// ---- Pintar ----
window.renderAll();
window.initNav();
applyLanguage();
document.getElementById('year').textContent = new Date().getFullYear();
requestAnimationFrame(() => document.body.classList.add('loaded'));
})();
