// Utilidades compartidas (window.FNF).
(() => {

const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem(k); return v === null ? fallback : v; } catch (e) { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { } },
  json(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (e) { return fallback; } },
  setJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

const getProfile = () => store.json('fnf_user_profile', null);
const profileName = (p) => (p && (p.nombre || p.name)) || 'Usuario';
const profilePhoto = (p) => (p && (p.foto || p.avatar)) || '';

// Idioma
window.currentLang = store.get('fnf_lang', 'es');
const t = (es, en) => (window.currentLang === 'en' ? en : es);

// Escapa texto de usuarios antes de meterlo en innerHTML
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const icon = (name, cls = 'icon') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

const vibrate = (ms = 15) => {
  if (store.get('hapticMode') === 'true' && navigator.vibrate) navigator.vibrate(ms);
};
window.triggerVibrate = vibrate;

// Popups
const openPopup = (id) => { const el = document.getElementById(id); if (el) el.classList.add('show'); };
const closePopup = (id) => { const el = document.getElementById(id); if (el) el.classList.remove('show'); };
window.openPopup = openPopup;
window.closePopup = closePopup;

// Tocar el fondo oscuro cierra el popup (llama a su botón de cerrar si tiene lógica propia)
document.addEventListener('click', (e) => {
  const popup = e.target.classList && e.target.classList.contains('popup') ? e.target : null;
  if (!popup || ['update-popup', 'install-popup'].includes(popup.id)) return;
  const closeBtn = popup.querySelector('.popup-close');
  if (closeBtn) closeBtn.click(); else popup.classList.remove('show');
});

const toast = (msg, iconName = 'bell') => {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast';
  // Icono SVG propio si existe; si no, el de Flaticon
  const ic = document.getElementById('i-' + iconName) ? icon(iconName, 'icon icon-sm') : (window.FNF && FNF.fi ? FNF.fi(iconName, 18) : '');
  el.innerHTML = `<span class="tile-icon">${ic}</span><span>${esc(msg)}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 400); }, 5000);
};
window.showToast = toast;

const stringToColor = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 55%)`;
};

// Imágenes: si un asset local no existe (p. ej. probando en local), se carga desde el repo de GitHub.
const REMOTE_ASSETS = 'https://raw.githubusercontent.com/LaloCF2/fnf_ports/main/';
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  const src = img.getAttribute('src') || '';
  if (src.startsWith('assets/') && !img.dataset.fallback) {
    img.dataset.fallback = '1';
    img.style.visibility = 'hidden';
    img.addEventListener('load', () => { img.style.visibility = ''; }, { once: true });
    img.src = REMOTE_ASSETS + src;
  } else {
    img.classList.add('img-error');
  }
}, true);

// Semana ISO, p. ej. "2026-W44" (para el Top de la semana)
const weekKey = (d = new Date()) => {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - day);
  const y = u.getUTCFullYear();
  const w = Math.ceil(((u - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
};

// 1284 -> "1,284" · 12900 -> "12.9K"
const compact = (n) => {
  n = Number(n) || 0;
  if (n < 10000) return n.toLocaleString('en-US');
  if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
};

const timeAgo = (ts) => {
  const s = Math.max(0, (Date.now() - Number(ts)) / 1000);
  if (s < 60) return t('justo ahora', 'just now');
  if (s < 3600) return t(`hace ${Math.floor(s / 60)} min`, `${Math.floor(s / 60)} min ago`);
  if (s < 86400) return t(`hace ${Math.floor(s / 3600)} h`, `${Math.floor(s / 3600)} h ago`);
  return t(`hace ${Math.floor(s / 86400)} d`, `${Math.floor(s / 86400)} d ago`);
};

// RAM mínima que pide un mod ("3-4GB RAM" -> 3) y compatibilidad con la RAM del usuario
const minRam = (ram) => { const m = String(ram || '').match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };
const compatOf = (ram) => {
  const mine = Number(store.get('fnf_my_ram')) || 0;
  const need = minRam(ram);
  if (!mine || !need) return null;
  if (mine >= need) return 'ok';
  return mine >= need - 1 ? 'warn' : 'bad';
};

// Motor normalizado para el filtro ("Psych Engine Opt" -> "Psych Engine")
const engineOf = (e) => {
  const s = String(e || '').toLowerCase();
  if (s.includes('codename')) return 'CodeName Engine';
  if (s.includes('p-slice') || s.includes('pslice')) return 'P-Slice Engine';
  if (s.includes('psych')) return 'Psych Engine';
  return e || '';
};

const isAdmin = () => !!window.isSuperUser;

// Iconos de Flaticon (flaticon.com) verificados uno por uno
const FI = {
  pin: 12483013, led: 14035769, star: 1828884, update: 5278663, edit: 5996831, trash: 1214428, eye: 709612,
  hide: 2767146, ban: 1828665, verify: 1828640, check: 4436481, chat: 1041916, mail: 3062634, copy: 1621635,
  link: 455691, send: 2099085, bell: 1827370, refresh: 2805355, sync: 1688988, download: 892303, calendar: 747310,
  clock: 2088617, user: 1077114, users: 33308, shield: 1161388, settings: 1040221, tools: 1077147, warning: 595067,
  alert: 564619, info: 471664, database: 2906274, search: 622669, code: 2920277, like: 8028304, heart: 1077035,
  telegram: 2111646, megaphone: 1998087, bolt: 616494, trophy: 3112946, medal: 2583344, filter: 107799,
  notes: 1001371, book: 2195700, box: 2875878, support: 3889581, plus: 1665731, lock: 6195700, handshake: 2618576,
  history: 2961948, logout: 1828490, gamepad: 8176146, idea: 7978351, globe: 3898082, close: 6711656,
  rules: 11532765, upload: 725008, verified: 7641727, help: 471664,
  moon: 6714978, sun: 869869, palette: 2970785, phone: 541070, document: 3601157, font: 3253235
};
const fiUrl = (name) => { const id = FI[name] || FI.info; return `https://cdn-icons-png.flaticon.com/128/${Math.floor(id / 1000)}/${id}.png`; };
const fi = (name, size = 18) => `<img class="fi" src="${fiUrl(name)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;

// En el HTML: <i data-fi="moon" data-size="24"></i> se convierte en el icono de Flaticon
document.querySelectorAll('i[data-fi]').forEach(el => { el.outerHTML = fi(el.dataset.fi, Number(el.dataset.size) || 24); });

// Fechas: "2026-11-04" (para contadores diarios) y "04/11/2026 · 21:35" (para mostrar)
const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtDateTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'string' && !/^\d+$/.test(ts) ? ts : Number(ts));
  if (isNaN(d)) return String(ts);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// Descarga un objeto como archivo .json (respaldos y "descargar mis datos")
const downloadJSON = (name, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};

const copyText = (txt, okMsg) => {
  const done = () => toast(okMsg || t('Copiado.', 'Copied.'), 'copy');
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done).catch(() => prompt(t('Copia esto:', 'Copy this:'), txt));
  else prompt(t('Copia esto:', 'Copy this:'), txt);
};

window.FNF = {
  store, getProfile, profileName, profilePhoto, t, esc, icon, vibrate, openPopup, closePopup, toast, stringToColor,
  weekKey, compact, timeAgo, minRam, compatOf, engineOf, isAdmin, fi, fiUrl, dayKey, fmtDateTime, downloadJSON, copyText
};
})();
