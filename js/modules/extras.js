// Todo lo que NO necesita Firebase: ajustes, partículas, compartir, galerías, RAM del celular, PWA.
(() => {
const { store, t, esc, vibrate, openPopup, closePopup, toast } = FNF;
const APP_VERSION = window.APP_VERSION || 'v7.1.0';
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

setText('footer-version', APP_VERSION);
setText('update-title', t('Versión ', 'Version ') + APP_VERSION.replace(/^v/, ''));

// ==========================================
// ¿CORRE EN MI CELULAR? (RAM)
// ==========================================
const RAM_OPTIONS = [1, 2, 3, 4, 6, 8];

function paintRamLabel() {
  const ram = Number(store.get('fnf_my_ram')) || 0;
  const label = ram
    ? t(`📱 Tu celular: ${ram >= 8 ? '8+' : ram} GB de RAM`, `📱 Your phone: ${ram >= 8 ? '8+' : ram} GB RAM`)
    : t('📱 ¿Cuánta RAM tiene tu celular? Toca aquí', '📱 How much RAM does your phone have? Tap here');
  setText('device-label', label);
  setText('settings-ram-label', ram ? `${ram >= 8 ? '8+' : ram} GB` : t('Elegir', 'Choose'));
  const chip = document.getElementById('compatChip');
  if (chip) chip.classList.toggle('hidden', !ram);
}

window.abrirSelectorRam = () => {
  const current = Number(store.get('fnf_my_ram')) || 0;
  const guess = navigator.deviceMemory;
  document.getElementById('ram-options').innerHTML = RAM_OPTIONS.map(n =>
    `<button class="ram-option${current === n ? ' active' : ''}" onclick="elegirRam(${n})">${n === 8 ? '8+' : n}<small>GB</small></button>`).join('');
  setText('ram-guess', guess
    ? t(`Tu navegador estima unos ${guess >= 8 ? '8 o más' : guess} GB.`, `Your browser estimates about ${guess >= 8 ? '8 or more' : guess} GB.`)
    : t('Lo encuentras en Ajustes → Acerca del teléfono.', 'Find it in Settings → About phone.'));
  openPopup('ram-popup');
};

window.elegirRam = (n) => {
  store.set('fnf_my_ram', String(n));
  closePopup('ram-popup');
  paintRamLabel();
  window.renderAll();
  if (window.repaintLiveData) window.repaintLiveData();
  window.filterContent(true);
  toast(t('¡Listo! Ahora cada mod te dice si corre en tu celular.', 'Done! Each mod now tells you if it runs on your phone.'), 'phone');
  vibrate(20);
};
paintRamLabel();

// ==========================================
// COMPARTIR
// ==========================================
let shareLink = '';
let shareText = '';

window.abrirMenuCompartir = (id, nombre) => {
  shareLink = `${location.origin}${location.pathname}?share=${id}`;
  shareText = `¡Mira esto: *${nombre}*! Descárgalo aquí:\n`;
  if (navigator.share) {
    navigator.share({ title: nombre, text: shareText.replace(/\*/g, ''), url: shareLink }).catch(() => { });
    return;
  }
  openPopup('share-modal');
};
window.enviarWhatsApp = () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + shareLink)}`, '_blank');
window.enviarTelegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`, '_blank');
window.copiarEnlace = () => {
  navigator.clipboard.writeText(shareText + shareLink).then(() => {
    toast(t('¡Enlace copiado!', 'Link copied!'), 'share');
    closePopup('share-modal');
  });
};

// ==========================================
// NOVEDADES (.txt), FAQ, GALERÍAS Y MENSAJES
// ==========================================
window.cargarNovedadesTXT = (id, tipo) => {
  const box = document.getElementById('texto-novedades-ios');
  box.textContent = t('Cargando información...', 'Loading...');
  openPopup('modal-novedades-ios');
  const path = tipo === 'script' ? `assets/scripts/update/${id}.txt` : `assets/bases/update/${id}.txt`;
  fetch(path)
    .then(r => r.ok ? r : fetch('https://raw.githubusercontent.com/LaloCF2/fnf_ports/main/' + path))
    .then(r => { if (!r.ok) throw new Error('404'); return r.text(); })
    .then(txt => { box.textContent = txt; })
    .catch(() => { box.textContent = t('No hay novedades registradas para esta versión aún.', 'No update notes yet.'); });
};
window.cerrarModalNovedades = () => closePopup('modal-novedades-ios');

window.toggleFaq = (btn) => {
  btn.classList.toggle('active');
  btn.nextElementSibling.classList.toggle('open');
  vibrate(10);
};

// Visor de imágenes a pantalla completa (ayuda y capturas de mods)
const GALERIAS = {
  zarchiver: [1, 2, 3, 4, 5].map(n => `assets/images/help/za/za${n}.webp`),
  gestor: [1, 2, 3, 4].map(n => `assets/images/help/gestor/gestor${n}.webp`),
  files: [1, 2, 3, 4, 5, 6, 7].map(n => `assets/images/help/files/files${n}.webp`)
};
let galeria = [];
let galIdx = 0;
const pintarGaleria = () => {
  const img = document.getElementById('imagen-gigante');
  img.removeAttribute('data-fallback');
  img.src = galeria[galIdx];
  setText('contador-imagenes', `${galIdx + 1} / ${galeria.length}`);
  document.querySelectorAll('#mi-lightbox .carousel-btn').forEach(b => b.classList.toggle('hidden', galeria.length < 2));
};
window.abrirGaleria = (app, start = 0) => {
  galeria = Array.isArray(app) ? app : (GALERIAS[app] || []);
  if (!galeria.length) return;
  galIdx = start;
  pintarGaleria();
  document.getElementById('mi-lightbox').classList.add('show');
};
window.cerrarGaleria = () => document.getElementById('mi-lightbox').classList.remove('show');
window.cambiarImagen = (d) => { galIdx = (galIdx + d + galeria.length) % galeria.length; pintarGaleria(); };

// Abre el detalle de cualquier elemento por su id (mod..., apk..., script...)
window.openItemById = (id) => {
  const fn = { apk: window.openApkInfo, script: window.openScriptInfo, mod: window.openModInfo }[FNF.kindOf(id)];
  if (fn) fn(id);
};

// Mensaje genérico (respuestas del admin, avisos)
window.mostrarMensaje = (titulo, texto) => {
  setText('msg-title', titulo);
  setText('msg-text', texto);
  openPopup('msg-popup');
};

// ==========================================
// AJUSTES
// ==========================================
const root = document.documentElement.style;

const applyCustomFont = (dataUrl) => {
  const st = document.createElement('style');
  st.textContent = `@font-face{font-family:'CustomUserFont';src:url('${dataUrl}') format('truetype');font-display:swap}body,button,input,textarea,select{font-family:'CustomUserFont',sans-serif!important}`;
  document.head.appendChild(st);
};
const savedFont = store.get('customUserFont');
if (savedFont) applyCustomFont(savedFont);

function bindSwitch(id, key, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = store.get(key) === 'true';
  el.addEventListener('change', () => { store.set(key, String(el.checked)); if (onChange) onChange(el.checked); vibrate(20); });
}

const darkToggle = document.getElementById('darkToggle');
darkToggle.checked = document.documentElement.getAttribute('data-theme') === 'dark';
darkToggle.addEventListener('change', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (darkToggle.checked !== isDark) window.toggleTheme();
});

const colorInput = document.getElementById('themeColor');
const savedColor = store.get('customThemeColor');
if (savedColor && savedColor !== '#00eaff') colorInput.value = savedColor;
colorInput.addEventListener('input', (e) => { root.setProperty('--accent', e.target.value); store.set('customThemeColor', e.target.value); });

const blurSlider = document.getElementById('blurSlider');
blurSlider.value = store.get('glassBlur', '16');
blurSlider.addEventListener('input', (e) => { root.setProperty('--glass-blur', e.target.value + 'px'); store.set('glassBlur', e.target.value); });

if (store.get('lowEndMode') === 'true') document.body.classList.add('low-end-mode');
bindSwitch('lowEndToggle', 'lowEndMode', (on) => {
  document.body.classList.toggle('low-end-mode', on);
  toggleParticles(!on && store.get('particlesMode') === 'true');
});

bindSwitch('hapticToggle', 'hapticMode', (on) => { if (on && navigator.vibrate) navigator.vibrate(50); });

// Partículas FNF
let particleTimer;
const ARROWS = ['down', 'left', 'right', 'up'];
function toggleParticles(enable) {
  const box = document.getElementById('particles-container');
  clearInterval(particleTimer);
  if (!enable) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.style.display = 'block';
  const spawnRate = Math.max(250, 2500 - Number(store.get('particlesSpawn', '25')) * 22);
  const baseSpeed = 14 - Number(store.get('particlesSpeed', '50')) * 0.12;
  particleTimer = setInterval(() => {
    if (document.hidden || box.childElementCount > 25) return;
    const img = document.createElement('img');
    img.className = 'fnf-particle';
    img.alt = '';
    img.src = `assets/images/Particles/${ARROWS[Math.random() * 4 | 0]}.webp`;
    img.style.left = Math.random() * 100 + 'vw';
    const dur = Math.random() * (baseSpeed / 2) + baseSpeed;
    img.style.animationDuration = dur + 's';
    box.appendChild(img);
    setTimeout(() => img.remove(), (dur + 1) * 1000);
  }, spawnRate);
}
const particleSettings = document.getElementById('particle-settings-container');
particleSettings.style.display = store.get('particlesMode') === 'true' ? 'block' : 'none';
bindSwitch('particlesToggle', 'particlesMode', (on) => {
  particleSettings.style.display = on ? 'block' : 'none';
  toggleParticles(on && store.get('lowEndMode') !== 'true');
});
if (store.get('particlesMode') === 'true' && store.get('lowEndMode') !== 'true') toggleParticles(true);

const scale = document.getElementById('particleScaleSlider');
scale.value = store.get('particlesScale', '40');
root.setProperty('--escala-particulas', scale.value + 'px');
scale.addEventListener('input', (e) => { root.setProperty('--escala-particulas', e.target.value + 'px'); store.set('particlesScale', e.target.value); });
[['particleSpawnSlider', 'particlesSpawn', '25'], ['particleSpeedSlider', 'particlesSpeed', '50']].forEach(([id, key, def]) => {
  const s = document.getElementById(id);
  s.value = store.get(key, def);
  s.addEventListener('change', (e) => {
    store.set(key, e.target.value);
    if (store.get('particlesMode') === 'true' && store.get('lowEndMode') !== 'true') toggleParticles(true);
  });
});

document.getElementById('customFontUpload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || !file.name.toLowerCase().endsWith('.ttf')) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    applyCustomFont(evt.target.result);
    try { localStorage.setItem('customUserFont', evt.target.result); }
    catch (err) { alert('Archivo muy pesado para guardarse permanente, pero se aplicará ahora.'); }
  };
  reader.readAsDataURL(file);
});

window.resetSettings = () => {
  if (!confirm(t('¿Restablecer el diseño predeterminado?', 'Reset to default design?'))) return;
  ['customThemeColor', 'customUserFont', 'lowEndMode', 'hapticMode', 'glassBlur', 'particlesMode', 'particlesScale', 'particlesSpawn', 'particlesSpeed', 'fnf_theme', 'fnf_sort']
    .forEach(k => store.remove(k));
  location.reload();
};

// ==========================================
// ACTUALIZACIÓN E INSTALACIÓN (PWA)
// ==========================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

window.closeUpdatePopup = () => {
  closePopup('update-popup');
  store.set('lastVersionSeen', APP_VERSION);
  if (deferredPrompt) setTimeout(() => openPopup('install-popup'), 400);
};
window.installApp = async () => {
  closePopup('install-popup');
  if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
};
window.dismissInstall = () => closePopup('install-popup');

if (store.get('lastVersionSeen') !== APP_VERSION) setTimeout(() => openPopup('update-popup'), 600);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('Service Worker no disponible:', err.message));
}

// Enlace compartido (?share=id): se abre cuando Firebase está listo
const sharedId = new URLSearchParams(location.search).get('share');
if (sharedId) {
  history.replaceState({}, document.title, location.pathname + location.hash);
  window.fbReady.then(() => setTimeout(() => {
    if (sharedId.startsWith('apk')) window.openApkInfo(sharedId);
    else if (sharedId.startsWith('script')) window.openScriptInfo(sharedId);
    else window.openModInfo(sharedId);
    const box = document.querySelector('#detail-popup .popup-content');
    if (box) { box.classList.add('brillo-epico'); setTimeout(() => box.classList.remove('brillo-epico'), 5000); }
  }, 1200)).catch(() => { });
}
})();
