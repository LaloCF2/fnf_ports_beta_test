// Todo lo que NO necesita Firebase: ajustes, partículas, compartir, galerías, RAM del celular, PWA.
(() => {
const { store, t, esc, vibrate, openPopup, closePopup, toast } = FNF;
const APP_VERSION = window.APP_VERSION || 'v7.2.0';
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

// ==========================================
// MIS DESCARGAS (historial guardado solo en este celular)
// ==========================================
window.abrirMisDescargas = () => {
  const list = store.json('fnf_dl_history', []).filter(h => FNF.itemOf(h.id));
  const box = document.getElementById('dl-history-list');
  box.innerHTML = list.length ? list.map((h, i) => {
    const d = FNF.itemOf(h.id);
    const kind = { mod: 'MOD', apk: t('Base', 'Engine'), script: 'Script' }[FNF.kindOf(h.id)];
    return `
      <div class="list-item" role="button" style="animation-delay:${Math.min(i, 10) * 40}ms" onclick="closePopup('dl-history-popup'); openItemById('${esc(h.id)}')">
        <img src="${esc(d.img || (d.images || [])[0] || '')}" alt="" loading="lazy">
        <div class="grow"><h4>${esc(d.title)}</h4><p>${kind} · ${FNF.timeAgo(h.ts)}</p></div>
        ${FNF.fi('download', 20)}
      </div>`;
  }).join('') : `<p class="empty">${t('Aún no descargas nada desde este celular.', "You haven't downloaded anything on this phone yet.")}</p>`;
  document.getElementById('dl-history-count').textContent = list.length;
  openPopup('dl-history-popup');
};
window.borrarMisDescargas = () => {
  if (!confirm(t('¿Borrar tu historial de descargas de este celular?', 'Clear your download history on this phone?'))) return;
  store.remove('fnf_dl_history');
  window.abrirMisDescargas();
};

// ==========================================
// GUÍA PARA PRINCIPIANTES (asistente paso a paso)
// ==========================================
const guia = { paso: 0, device: store.get('fnf_device', '') };
const DEVICES = [
  ['android', 'Android', 'gamepad'], ['ios', 'iPhone / iPad', 'lock'], ['pc', 'PC / Laptop', 'code']
];

function recomendacion() {
  const ram = guia.device === 'pc' ? 8 : (Number(store.get('fnf_my_ram')) || 3);
  const mods = Object.entries(window.MOD_DATA || {}).filter(([, d]) => !d.hidden && !d.draft);
  const cabe = mods.filter(([, d]) => { const need = FNF.minRam(d.ram); return !need || ram >= need; });
  const porMotor = {};
  cabe.forEach(([, d]) => { const e = FNF.engineOf(d.engine) || 'Psych Engine'; porMotor[e] = (porMotor[e] || 0) + 1; });
  const motor = Object.entries(porMotor).sort((a, b) => b[1] - a[1])[0];
  const engine = motor ? motor[0] : 'Psych Engine';
  const base = Object.entries(window.APK_DATA || {}).find(([, d]) => d.title.toLowerCase().includes(engine.split(' ')[0].toLowerCase()));
  const dl = (window.live && window.live.downloads) || {};
  const top = cabe.filter(([, d]) => (FNF.engineOf(d.engine) || 'Psych Engine') === engine)
    .sort((a, b) => (dl[b[0]] || 0) - (dl[a[0]] || 0)).slice(0, 3);
  return { ram, engine, base, top, total: cabe.length };
}

function pintarGuia() {
  const box = document.getElementById('guide-body');
  const dots = document.getElementById('guide-dots');
  const pasos = guia.device === 'pc' ? [0, 2, 3] : [0, 1, 2, 3];
  dots.innerHTML = pasos.map(p => `<span class="${p === guia.paso ? 'on' : ''}"></span>`).join('');
  document.getElementById('guide-back').style.visibility = guia.paso === 0 ? 'hidden' : 'visible';
  const next = document.getElementById('guide-next');
  next.hidden = guia.paso === 3;

  if (guia.paso === 0) {
    box.innerHTML = `
      <h3>${t('¿Qué dispositivo usas?', 'What device do you use?')}</h3>
      <p class="guide-sub">${t('Así te recomendamos la base correcta.', "So we can recommend the right engine.")}</p>
      <div class="guide-options">${DEVICES.map(([k, label, ic]) => `
        <button class="guide-opt${guia.device === k ? ' on' : ''}" onclick="guiaElegir('${k}')">${FNF.fi(ic, 34)}<span>${label}</span></button>`).join('')}
      </div>`;
    next.disabled = !guia.device;
  } else if (guia.paso === 1) {
    const ram = Number(store.get('fnf_my_ram')) || 0;
    box.innerHTML = `
      <h3>${t('¿Cuánta RAM tiene tu celular?', 'How much RAM does your phone have?')}</h3>
      <p class="guide-sub">${t('Lo ves en Ajustes → Acerca del teléfono.', 'Find it in Settings → About phone.')}${navigator.deviceMemory ? ' ' + t(`Tu navegador estima ~${navigator.deviceMemory} GB.`, `Your browser estimates ~${navigator.deviceMemory} GB.`) : ''}</p>
      <div class="ram-grid">${[1, 2, 3, 4, 6, 8].map(n => `
        <button class="ram-option${ram === n ? ' active' : ''}" onclick="guiaRam(${n})">${n === 8 ? '8+' : n}<small>GB</small></button>`).join('')}
      </div>`;
    next.disabled = !ram;
  } else if (guia.paso === 2) {
    const r = recomendacion();
    const nota = {
      android: t('Descarga el archivo <b>.apk</b> e instálalo. Si te lo pide, activa "Instalar apps desconocidas".', 'Download the <b>.apk</b> file and install it. If asked, allow "Install unknown apps".'),
      ios: t('Descarga el archivo <b>.ipa</b> e instálalo con una app como AltStore o Sideloadly.', 'Download the <b>.ipa</b> file and install it with an app like AltStore or Sideloadly.'),
      pc: t('Descarga la versión para Windows, Linux o Mac.', 'Download the Windows, Linux or Mac version.')
    }[guia.device];
    box.innerHTML = `
      <h3>${t('Tu base recomendada', 'Your recommended engine')}</h3>
      <p class="guide-sub">${t(`Con ${r.ram >= 8 ? '8 GB o más' : r.ram + ' GB'} puedes jugar <b>${r.total}</b> mods. La mayoría usan <b>${esc(r.engine)}</b>.`, `With ${r.ram >= 8 ? '8+ GB' : r.ram + ' GB'} you can play <b>${r.total}</b> mods. Most use <b>${esc(r.engine)}</b>.`)}</p>
      ${r.base ? `<button class="guide-card" onclick="closePopup('guide-popup'); openApkInfo('${esc(r.base[0])}')">
        <img src="${esc(r.base[1].img)}" alt="">
        <span class="grow"><strong>${esc(r.base[1].title)}</strong><small>${esc((r.base[1].version || '').split('\n')[0])}</small></span>
        ${FNF.fi('download', 22)}</button>` : ''}
      <p class="note">${nota}</p>`;
  } else {
    const r = recomendacion();
    box.innerHTML = `
      <h3>${t('¡Instala tu primer mod!', 'Install your first mod!')}</h3>
      <p class="guide-sub">${t('Estos son los más populares que corren en tu dispositivo:', 'These are the most popular ones that run on your device:')}</p>
      <div class="list">${r.top.map(([id, d]) => `
        <div class="list-item" role="button" onclick="closePopup('guide-popup'); openModInfo('${esc(id)}')">
          <img src="${esc(d.img)}" alt="" loading="lazy">
          <div class="grow"><h4>${esc(d.title)}</h4><p>${esc(d.ram || '')} · ${esc(d.size || '')}</p></div>
          ${FNF.fi('download', 20)}
        </div>`).join('') || `<p class="empty">${t('Revisa la sección MODs.', 'Check the MODs section.')}</p>`}
      </div>
      <button class="btn btn-soft btn-block" style="margin-top:14px" onclick="closePopup('guide-popup'); selectSection('help')">${FNF.fi('book', 18)} ${t('¿Cómo instalo un mod? Ver tutorial', 'How do I install a mod? See tutorial')}</button>`;
    store.set('fnf_guide_done', '1');
  }
}

window.abrirGuia = () => { guia.paso = 0; pintarGuia(); openPopup('guide-popup'); };
window.guiaElegir = (k) => { guia.device = k; store.set('fnf_device', k); pintarGuia(); vibrate(10); };
window.guiaRam = (n) => {
  store.set('fnf_my_ram', String(n));
  paintRamLabel(); window.renderAll(); if (window.repaintLiveData) window.repaintLiveData(); window.filterContent(true);
  pintarGuia(); vibrate(10);
};
window.guiaPaso = (dir) => {
  let p = guia.paso + dir;
  if (guia.device === 'pc' && p === 1) p += dir;
  guia.paso = Math.max(0, Math.min(3, p));
  pintarGuia();
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
