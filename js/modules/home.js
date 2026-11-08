// Inicio editable: bloques que el admin agrega desde la propia página (anuncios, mod especial, imágenes,
// videos, botones, cuentas regresivas...) y el orden / visibilidad de las partes fijas del Inicio.
// Se pinta al instante con la copia guardada en el celular y se actualiza cuando llega Firebase (site_config/home).
(() => {
const { store, t, esc, icon, toast, vibrate, compact } = FNF;

// Partes fijas del Inicio (están en index.html con data-home="...")
const SYS = {
  sys_hero: ['🏠', 'Portada'],
  sys_explorar: ['🧭', 'Explorar (accesos)'],
  sys_top: ['🔥', 'Top de la semana'],
  sys_about: ['ℹ️', '¿De qué trata esta página?'],
  sys_guia: ['💡', 'Guía para principiantes'],
  sys_sprite: ['🎨', 'Spritesheet Generator']
};
const SYS_ORDER = Object.keys(SYS);

// Lo que el admin puede cambiar de cada parte fija (y dónde está en la página)
//   text / textarea: reemplazan el texto · link: a dónde lleva el botón · href: enlace de un <a> · hide: ocultar
const SYS_CAMPOS = {
  sys_hero: [
    { k: 'title', label: 'Título grande', sel: '#fnf-title', tipo: 'text', ph: "Friday Night Funkin'" },
    { k: 'text', label: 'Descripción', sel: ':scope > p', tipo: 'textarea', ph: 'El mejor lugar para descargar tus mods optimizados para móvil.' },
    { k: 'btn', label: 'Texto del botón', sel: ':scope > .btn > span', tipo: 'text', ph: 'Explorar MODs' },
    { k: 'link', label: 'A dónde lleva el botón', sel: ':scope > .btn', tipo: 'link', ph: '#mods' },
    { k: 'hideBtn', label: 'Ocultar el botón', sel: ':scope > .btn', tipo: 'hide' },
    { k: 'hideStatus', label: 'Ocultar "Servidor activo"', sel: '.status-chip', tipo: 'hide' }
  ],
  sys_explorar: [
    { k: 'title', label: 'Título de la sección', sel: '.section-head h2', tipo: 'text', ph: 'Explorar' },
    { k: 'hideFavs', label: 'Ocultar el acceso a Favoritos', sel: '.tile:nth-child(4)', tipo: 'hide' }
  ],
  sys_top: [
    { k: 'title', label: 'Título (vacío = cambia solo entre "Top de la semana" y "Los más descargados")', sel: '#top-week-title', tipo: 'text', ph: '🔥 Top de la semana' }
  ],
  sys_about: [
    { k: 'title', label: 'Título', sel: ':scope > h3', tipo: 'text', ph: '¿De qué trata esta página?' },
    { k: 'text', label: 'Texto', sel: ':scope > p', tipo: 'textarea', ph: 'Aquí subo la mayoría de MODs, Bases y Scripts para móviles…' },
    { k: 'hideList', label: 'Ocultar la lista de puntos', sel: '.feature-list', tipo: 'hide' }
  ],
  sys_guia: [
    { k: 'title', label: 'Título', sel: 'h3', tipo: 'text', ph: '¿Primera vez aquí?' },
    { k: 'text', label: 'Texto', sel: ':scope > div > p', tipo: 'textarea', ph: 'La guía te dice qué base instalar…' },
    { k: 'btn', label: 'Texto del botón', sel: ':scope > .btn', tipo: 'text', ph: 'Empezar' }
  ],
  sys_sprite: [
    { k: 'title', label: 'Título', sel: 'h3', tipo: 'text', ph: 'Spritesheet Generator FNF' },
    { k: 'text', label: 'Texto', sel: ':scope > div > p', tipo: 'textarea', ph: 'Crea y edita spritesheets directamente en tu móvil.' },
    { k: 'btn', label: 'Texto del botón', sel: ':scope > a.btn', tipo: 'text', ph: 'Abrir' },
    { k: 'href', label: 'Enlace del botón', sel: ':scope > a.btn', tipo: 'href', ph: 'https://...' }
  ]
};

// Pone los textos del admin en las partes fijas (o regresa los originales si se borraron)
function aplicarFijos(override) {
  const todos = override || (homeData().sys || {});
  Object.entries(SYS_CAMPOS).forEach(([key, campos]) => {
    const root = document.querySelector(`[data-home="${key}"]`);
    if (!root) return;
    const o = todos[key] || {};
    campos.forEach(c => {
      const el = c.sel.startsWith('#') ? document.querySelector(c.sel) : root.querySelector(c.sel);
      if (!el) return;
      if (!el._orig) el._orig = { html: el.innerHTML, es: el.getAttribute('data-es'), en: el.getAttribute('data-en'), onclick: el.getAttribute('onclick'), href: el.getAttribute('href'), display: el.style.display };
      const v = o[c.k];
      if (c.tipo === 'text' || c.tipo === 'textarea') {
        if (v) {
          const html = fmt(v).replace(/\n/g, '<br>');
          el.innerHTML = html;
          el.setAttribute('data-es', html); el.setAttribute('data-en', html); // que el cambio de idioma lo respete
          el._ovr = true;
        } else if (el._ovr) {
          el._ovr = false;
          ['es', 'en'].forEach(l => { if (el._orig[l] === null) el.removeAttribute('data-' + l); else el.setAttribute('data-' + l, el._orig[l]); });
          el.innerHTML = el._orig[window.currentLang] || el._orig.html;
        }
      } else if (c.tipo === 'link') {
        const p = v && parseLink(v);
        if (p) {
          el.removeAttribute('onclick');
          el.onclick = (e) => { e.preventDefault(); abrirLink(v); };
        } else if (!el.getAttribute('onclick') && el._orig.onclick) {
          el.onclick = null;
          el.setAttribute('onclick', el._orig.onclick);
        }
      } else if (c.tipo === 'href') {
        el.setAttribute('href', v && /^https?:\/\//i.test(v) ? v : el._orig.href);
      } else if (c.tipo === 'hide') {
        el.style.display = v ? 'none' : el._orig.display;
      }
    });
  });
}
// Abre cualquier enlace del Inicio (web, sección o mod)
function abrirLink(url) {
  const p = parseLink(url);
  if (!p) return;
  if (p.ext) { window.open(p.href, '_blank', 'noopener'); return; }
  const [kind, val] = p.act.split(':');
  if (kind === 'sec') window.selectSection(val);
  else if (kind === 'item' && FNF.itemOf(val)) window.openItemById(val);
}
const textoFijo = (key, k) => ((homeData().sys || {})[key] || {})[k] || '';

// Tipos de bloque: [emoji, nombre, descripción]
const TYPES = {
  aviso: ['📢', 'Anuncio / aviso', 'Mensaje con color, foto y botones'],
  destacado: ['⭐', 'Mod especial', 'Un mod con portada grande'],
  imagen: ['🖼️', 'Imagen / carrusel', 'Una o varias imágenes'],
  texto: ['📝', 'Texto libre', 'Título, subtítulo y descripción'],
  botones: ['🔗', 'Botones / enlaces', 'Lista de botones a donde quieras'],
  video: ['▶️', 'Video de YouTube', 'Se reproduce aquí mismo'],
  cuenta: ['⏳', 'Cuenta regresiva', 'Para un estreno o evento']
};
const TONES = {
  accent: ['Morado', 'var(--accent)'], info: ['Azul', '#3d8bff'], success: ['Verde', 'var(--ok)'],
  warn: ['Amarillo', 'var(--warn)'], danger: ['Rojo', 'var(--danger)'], dark: ['Oscuro', '#2c2347']
};

let data = store.json('fnf_home_cache', null); // { order: [...], hidden: {key: true}, blocks: {id: {...}} }
let editing = false;
const homeData = () => data || {};
const blocks = () => homeData().blocks || {};

// ==========================================
// ENLACES, IMÁGENES Y TEXTO (todo pasa por aquí para que sea seguro)
// ==========================================
const SECCIONES = ['home', 'mods', 'apks', 'scripts', 'help', 'contact'];
const okImg = (u) => /^(https?:\/\/|assets\/)\S+$/i.test(String(u || '').trim());

// Devuelve { href, ext } para enlaces externos o { href, act } para acciones dentro de la página
function parseLink(raw) {
  const u = String(raw || '').trim();
  if (/^(https?:\/\/|assets\/)\S+$/i.test(u) || /^mailto:\S+$/i.test(u)) return { href: u, ext: true };
  const sec = u.match(/^#(\w+)$/);
  if (sec && SECCIONES.includes(sec[1])) return { href: u, act: 'sec:' + sec[1] };
  const item = u.match(/^(?:mod|item):([\w-]{1,60})$/i);
  if (item) return { href: '#', act: 'item:' + item[1] };
  return null;
}
const linkHTML = (l, cls) => {
  const p = parseLink(l.url);
  if (!p) return '';
  return p.ext
    ? `<a class="${cls}" href="${esc(p.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`
    : `<a class="${cls}" href="${esc(p.href)}" data-hl="${esc(p.act)}">${esc(l.label)}</a>`;
};

// **negritas** y saltos de línea (el texto ya va escapado)
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const ytId = (u) => (String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/) || [])[1] || '';

const isLogged = () => (window.authKnown ? !!window.usuarioActualFirebase : !!FNF.getProfile());
const dismissed = () => store.json('fnf_home_dismissed', {});

// ==========================================
// HTML DE CADA BLOQUE
// ==========================================
// ---- Lanzamientos (cuenta regresiva y mod especial) ----
// La fecha es la del bloque; en "Mod especial", si no tiene, se usa la fecha de publicación del mod.
const fechaLanzamiento = (b) => {
  if (Number(b.date)) return Number(b.date);
  if (b.type === 'destacado' && FNF.itemOf) {
    const it = FNF.itemOf(b.itemId);
    if (it && Number(it.publishAt) > 0) return Number(it.publishAt);
  }
  return 0;
};
// opts.fase = 'antes' | 'despues' fuerza el estado (vista previa del editor)
const yaLanzado = (b, opts = {}) => {
  if (opts.fase) return opts.fase === 'despues';
  const f = fechaLanzamiento(b);
  return !f || Date.now() >= f;
};
const tieneDespues = (a) => !!(a && (a.title || a.subtitle || a.text || a.tag || a.emoji || (a.links || []).length));
// Lo que se llenó en "Al terminar" reemplaza a lo de antes; sus botones se agregan (o reemplazan)
function contenidoDespues(b) {
  const a = b.after || {};
  const out = { ...b };
  ['title', 'subtitle', 'text', 'tag', 'emoji'].forEach(k => { if (a[k]) out[k] = a[k]; });
  const nuevos = a.links || [];
  out.links = a.replaceLinks ? nuevos : [...nuevos, ...(b.links || [])];
  return out;
}

// Cuenta regresiva: cajitas (días, horas, min, seg) o una sola línea
const cdHTML = (target, b) => {
  if (b.cdStyle === 'linea') return `<p class="hb-cdline" data-cd="${target}">${icon('clock', 'icon icon-sm')}<span>${t('Faltan', 'Starts in')} <b data-line>--</b></span></p>`;
  const parts = [['d', t('días', 'days')], ['h', t('horas', 'hours')], ['m', 'min']];
  if (!b.noSeconds) parts.push(['s', t('seg', 'sec')]);
  return `<div class="hb-cd${b.noSeconds ? ' no-s' : ''}" data-cd="${target}">${parts.map(([k, label]) => `<span><b data-u="${k}">--</b><small>${label}</small></span>`).join('')}</div>`;
};

// Clases de estilo de un botón: Principal / Suave / Contorno (o automático: el primero resalta)
const BTN = { primary: 'btn', soft: 'btn btn-soft', outline: 'btn btn-ghost hb-outline' };
const claseBoton = (l, i, sm = true) => (BTN[l.style] || (i ? 'btn btn-soft' : 'btn')) + (sm ? ' btn-sm' : '');

function blockHTML(bOriginal, id, opts = {}) {
  const fecha = fechaLanzamiento(bOriginal);
  const lanzado = yaLanzado(bOriginal, opts);
  const b = fecha && lanzado ? contenidoDespues(bOriginal) : bOriginal;
  const type = TYPES[b.type] ? b.type : 'aviso';
  const tone = TONES[b.tone] ? b.tone : 'accent';
  const size = ['grande', 'compacto'].includes(b.size) ? b.size : 'normal';
  const imgs = (b.images || []).filter(okImg);
  const links = (b.links || []).filter(l => l && l.label && parseLink(l.url));
  const sid = esc(id);

  const close = b.dismissible && !opts.preview ? `<button class="hb-close" onclick="homeCerrar('${sid}')" aria-label="${t('Cerrar', 'Close')}">${icon('x', 'icon icon-sm')}</button>` : '';
  const tag = (txt) => txt ? `<span class="hb-tag">${esc(txt)}</span>` : '';
  const head = (title, sub, conTag = true) => (b.emoji || title || sub || (conTag && b.tag)) ? `
    <div class="hb-head">
      ${b.emoji ? `<span class="hb-emoji">${esc(b.emoji)}</span>` : ''}
      <div class="grow">${conTag ? tag(b.tag) : ''}${title ? `<h3 class="hb-title">${esc(title)}</h3>` : ''}${sub ? `<p class="hb-sub">${esc(sub)}</p>` : ''}</div>
    </div>` : '';
  const text = (s) => s ? `<p class="hb-text">${fmt(s)}</p>` : '';
  const btns = (list, sm = true) => list.length ? `<div class="hb-links">${list.map((l, i) => linkHTML(l, claseBoton(l, i, sm))).join('')}</div>` : '';
  const clases = [
    `hb-${type}`, `hb-${size}`,
    b.bg === 'color' ? 'hb-bg-color' : b.bg === 'grad' ? 'hb-bg-grad' : '',
    b.align === 'center' ? 'hb-center' : '',
    b.effect === 'pulse' ? 'hb-fx-pulse' : b.effect === 'shine' ? 'hb-fx-shine' : '',
    fecha ? (lanzado ? 'hb-launched' : 'hb-waiting') : ''
  ].filter(Boolean).join(' ');
  const wrap = (inner, extra = '') => `<div class="card glass hblock ${clases}${extra}" data-tone="${tone}" style="--tone:${TONES[tone][1]}">${close}${inner}</div>`;

  if (type === 'aviso' || type === 'texto') {
    const lado = imgs[0] && b.imgPos === 'lado';
    const img = imgs[0] ? `<img class="${lado ? 'hb-side-img' : 'hb-img'}" src="${esc(imgs[0])}" alt="" loading="lazy">` : '';
    const cuerpo = `${head(b.title, b.subtitle)}${text(b.text)}${btns(links)}`;
    return lado ? wrap(`<div class="hb-side">${img}<div class="grow">${cuerpo}</div></div>`) : wrap(img + cuerpo);
  }

  if (type === 'botones') {
    const layout = ['lista', 'fila'].includes(b.layout) ? b.layout : 'grid';
    return wrap(`${head(b.title, b.subtitle)}${text(b.text)}${links.length ? `<div class="hb-btngrid hb-lay-${layout}">${links.map((l, i) => linkHTML(l, claseBoton(l, i, layout === 'fila'))).join('')}</div>` : ''}`);
  }

  if (type === 'imagen') {
    if (!imgs.length) return wrap(`<p class="empty">${t('Sin imágenes', 'No images')}</p>`);
    const link = links[0] && parseLink(links[0].url);
    const ratio = { '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1', '21:9': '21 / 9', '3:4': '3 / 4' }[b.ratio] || '';
    const slide = (src, i) => {
      const img = `<img src="${esc(src)}" alt="" loading="lazy">`;
      if (link) return link.ext ? `<a class="hb-slide" href="${esc(link.href)}" target="_blank" rel="noopener">${img}</a>` : `<a class="hb-slide" href="${esc(link.href)}" data-hl="${esc(link.act)}">${img}</a>`;
      return `<button class="hb-slide" type="button" onclick="homeGaleria('${sid}', ${i})">${img}</button>`;
    };
    return wrap(`
      <div class="hb-media"${ratio ? ` style="--ratio:${ratio}"` : ''}>
        <div class="hb-car" data-car data-interval="${Math.max(0, Number(b.interval) || 0)}">${imgs.map(slide).join('')}</div>
        ${b.tag ? `<span class="hb-badge">${esc(b.tag)}</span>` : ''}
        ${imgs.length > 1 && !b.noDots ? `<div class="hb-dots">${imgs.map((_, i) => `<span class="${i ? '' : 'on'}"></span>`).join('')}</div>` : ''}
      </div>
      ${(b.title || b.subtitle || b.text || b.emoji || links.length > 1) ? `<div class="hb-body">${head(b.title, b.subtitle, false)}${text(b.text)}${btns(links.slice(1))}</div>` : ''}`, ' hb-flush' + (ratio ? ' hb-ratio' : ''));
  }

  if (type === 'video') {
    const vid = ytId(b.video);
    const start = Math.max(0, Math.floor(Number(b.start) || 0));
    const media = vid
      ? `<button class="hb-yt" type="button" onclick="homeVideo(this, '${vid}', ${start})" aria-label="${t('Reproducir video', 'Play video')}">
           <img src="https://i.ytimg.com/vi/${vid}/hqdefault.jpg" alt="" loading="lazy"><span class="hb-play">${icon('play', 'icon')}</span></button>`
      : `<p class="empty">${t('Video no disponible', 'Video unavailable')}</p>`;
    return wrap(`${head(b.title, b.subtitle)}${media}${text(b.text)}${btns(links)}`);
  }

  if (type === 'cuenta') {
    if (lanzado && fecha) {
      // Ya llegó la hora: el contenido de "Al terminar" (o el mensaje de siempre)
      const extra = tieneDespues(bOriginal.after) ? '' : `<p class="hb-done">${esc(bOriginal.doneText || t('¡Ya llegó la hora! 🎉', "It's time! 🎉"))}</p>`;
      return wrap(`${head(b.title, b.subtitle)}${extra}${text(b.text)}${btns(links, false)}`);
    }
    return wrap(`${head(b.title, b.subtitle)}${fecha ? cdHTML(fecha, b) : ''}${text(b.text)}${btns(links)}`);
  }

  // ---- Mod especial ----
  const item = FNF.itemOf ? FNF.itemOf(b.itemId) : null;
  if (!item) return wrap(`${head(b.title || t('Mod especial', 'Featured mod'), t('Este contenido ya no está disponible.', 'This content is no longer available.'))}`);
  const cover = imgs[0] || item.img || (item.images || [])[0] || '';
  const title = b.title || item.title;
  const sub = b.subtitle || (FNF.kindOf(b.itemId) === 'mod' ? [item.engine, item.ram, item.size].filter(Boolean).join(' · ') : (item.version || '').split('\n')[0]);
  const desc = b.hideDesc ? '' : (b.text || String(item.desc || '').replace(/\/n/g, '\n').slice(0, 260));
  const iid = esc(b.itemId);
  const esperando = fecha && !lanzado;
  const principal = esperando
    ? `<span class="btn btn-disabled">${icon('clock', 'icon icon-sm')} ${esc(b.waitText || t('Muy pronto', 'Coming soon'))}</span>`
    : `<a class="btn" href="#" data-hl="item:${iid}">${icon('download', 'icon icon-sm')} ${esc(b.btnText || t('Ver y descargar', 'View & download'))}</a>`;
  return wrap(`
    <${esperando ? 'div' : 'a href="#" data-hl="item:' + iid + '"'} class="hb-cover">
      ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : ''}
      <span class="hb-badge">${esc(b.tag || (esperando ? t('⏳ Próximamente', '⏳ Coming soon') : t('⭐ Destacado', '⭐ Featured')))}</span>
    </${esperando ? 'div' : 'a'}>
    <div class="hb-body">
      ${head(title, sub, false)}
      ${esperando ? cdHTML(fecha, b) : b.hideStats ? '' : `<div class="hb-stats" data-hs="${iid}"></div>`}
      ${text(desc)}
      <div class="hb-links">
        ${principal}
        ${links.map((l, i) => linkHTML(l, claseBoton({ ...l, style: l.style || 'soft' }, i + 1, false))).join('')}
      </div>
    </div>`, ' hb-flush');
}

// ¿Por qué no lo vería el usuario? ('' = sí lo ve)
function whyHidden(key, b) {
  const d = homeData();
  if ((d.hidden || {})[key]) return 'Oculto';
  if (key === 'sys_top' && store.get('homeHideTop') === 'true') return 'Oculto en tus ajustes';
  if (!b) return '';
  const now = Date.now();
  if (b.startAt && b.startAt > now) return 'Programado: ' + FNF.fmtDateTime(b.startAt);
  if (b.endAt && b.endAt < now) return 'Ya terminó';
  if (b.audience === 'usuarios' && !isLogged()) return 'Solo con sesión';
  if (b.audience === 'invitados' && isLogged()) return 'Solo invitados';
  if (b.type === 'destacado') {
    const it = FNF.itemOf ? FNF.itemOf(b.itemId) : null;
    if (!it) return 'El mod no existe';
    // Borradores y secretos no se anuncian (los programados sí: salen con su cuenta regresiva)
    if (FNF.puedeVer && !FNF.puedeVer(b.itemId, { ignorarFecha: true })) return 'El mod está oculto o es borrador';
  }
  const f = fechaLanzamiento(b);
  if (f && now >= f && b.afterMode === 'ocultar') return 'Terminó su cuenta regresiva';
  if (b.dismissible && dismissed()[key] && dismissed()[key] === (b.updatedAt || 1)) return 'Lo cerraste';
  return '';
}

// Orden final: el guardado + lo que falte (partes fijas nuevas o bloques sin acomodar)
function computeOrder() {
  const known = [...SYS_ORDER, ...Object.keys(blocks())];
  const saved = (homeData().order || []).filter((k, i, a) => known.includes(k) && a.indexOf(k) === i);
  return [...saved, ...known.filter(k => !saved.includes(k))];
}

// ==========================================
// PINTAR
// ==========================================
function toolsHTML(key, why) {
  const b = blocks()[key];
  const name = b ? `${(TYPES[b.type] || TYPES.aviso)[0]} ${esc(b.title || (FNF.itemOf && b.itemId && (FNF.itemOf(b.itemId) || {}).title) || (TYPES[b.type] || TYPES.aviso)[1])}` : `${SYS[key][0]} ${SYS[key][1]} <small>(fijo)</small>`;
  const oculto = !!(homeData().hidden || {})[key];
  const k = esc(key);
  return `
    <span class="hb-name">${name}</span>
    ${why ? `<span class="hb-why">${esc(why)}</span>` : ''}
    <span class="hb-btns">
      <button onclick="homeMover('${k}', -1)" aria-label="Subir">${icon('up', 'icon icon-sm')}</button>
      <button onclick="homeMover('${k}', 1)" aria-label="Bajar">${icon('down', 'icon icon-sm')}</button>
      <button onclick="homeOcultar('${k}')">${oculto ? 'Mostrar' : 'Ocultar'}</button>
      ${b ? `<button onclick="homeEditar('${k}')">Editar</button><button onclick="homeDuplicar('${k}')">Duplicar</button><button class="danger" onclick="homeBorrar('${k}')">Borrar</button>`
        : SYS_CAMPOS[key] ? `<button onclick="homeEditarFijo('${k}')">✏️ Editar textos</button>` : ''}
    </span>`;
}

function mkWrap(key) {
  const w = document.createElement('div');
  w.className = 'hb';
  w.dataset.key = key;
  const tools = document.createElement('div');
  tools.className = 'hb-tools';
  w.appendChild(tools);
  return w;
}

function renderHome() {
  const home = document.getElementById('home');
  if (!home) return;
  const showAll = editing && !!window.isSuperUser;

  // Las partes fijas se meten una sola vez en su contenedor
  SYS_ORDER.forEach(k => {
    const el = home.querySelector(`[data-home="${k}"]`);
    if (el && !(el.parentElement && el.parentElement.classList.contains('hb'))) {
      const w = mkWrap(k);
      el.before(w);
      w.appendChild(el);
    }
  });

  const wraps = {};
  home.querySelectorAll(':scope > .hb').forEach(w => { wraps[w.dataset.key] = w; });
  home.querySelectorAll(':scope > .hb-add').forEach(x => x.remove());

  const order = computeOrder();
  order.forEach((key, i) => {
    const b = blocks()[key];
    let w = wraps[key];
    if (!w) {
      if (!b) return;
      w = mkWrap(key);
      const body = document.createElement('div');
      body.className = 'hb-content';
      w.appendChild(body);
    }
    if (b) {
      const body = w.querySelector(':scope > .hb-content');
      const html = blockHTML(b, key);
      // Solo se repinta si cambió (así no se reinicia un video o un carrusel)
      if (body && body._html !== html) { body.innerHTML = html; body._html = html; }
    }
    const why = whyHidden(key, b);
    w.classList.toggle('hb-off', !!why);
    w.hidden = !!why && !showAll;
    const tools = w.querySelector(':scope > .hb-tools');
    if (showAll) tools.innerHTML = toolsHTML(key, why); else if (tools.innerHTML) tools.innerHTML = '';
    if (showAll) {
      const add = document.createElement('button');
      add.className = 'hb-add';
      add.type = 'button';
      add.innerHTML = '+ Agregar aquí';
      add.onclick = () => window.homeNuevoBloque && window.homeNuevoBloque(i);
      home.appendChild(add);
    }
    home.appendChild(w);
    delete wraps[key];
  });
  // Bloques que ya no existen
  Object.values(wraps).forEach(w => { if (!SYS[w.dataset.key]) w.remove(); });
  if (showAll) {
    const add = document.createElement('button');
    add.className = 'hb-add';
    add.type = 'button';
    add.innerHTML = '+ Agregar al final';
    add.onclick = () => window.homeNuevoBloque && window.homeNuevoBloque(order.length);
    home.appendChild(add);
  }

  home.classList.toggle('home-editing', showAll);
  const toggle = document.getElementById('homeEditToggle');
  if (toggle) toggle.checked = showAll;
  aplicarFijos();
  paintExtras(home);
  const n = Object.keys(dismissed()).length;
  const lbl = document.getElementById('home-closed-count');
  if (lbl) lbl.textContent = n ? t(`${n} cerrado(s)`, `${n} closed`) : t('No has cerrado ninguno', "You haven't closed any");
}

// Estadísticas en vivo del mod especial
function paintHomeStats(root = document) {
  const L = window.live || {};
  root.querySelectorAll('[data-hs]').forEach(el => {
    const id = el.dataset.hs;
    const r = window.ratingOf ? window.ratingOf(id) : { n: 0, avg: 0 };
    const dl = Number((L.downloads || {})[id]) || 0;
    const likes = Number((L.likes || {})[id]) || 0;
    el.innerHTML = `<span>${icon('download', 'icon icon-sm')} ${compact(dl)}</span><span>${icon('heart', 'icon icon-sm')} ${compact(likes)}</span>${r.n ? `<span>★ ${r.avg.toFixed(1)}</span>` : ''}`;
  });
}

// Cuentas regresivas. Al llegar a cero, el Inicio se vuelve a pintar solo
// (así aparece el texto y los botones de "Al terminar" sin recargar la página).
let repintarPendiente = false;
function tickCountdowns(root = document) {
  root.querySelectorAll('[data-cd]').forEach(el => {
    const fin = Number(el.dataset.cd);
    if (!fin) return;
    const left = Math.max(0, fin - Date.now());
    if (left === 0 && root.id === 'home' && !repintarPendiente) {
      repintarPendiente = true;
      setTimeout(() => { repintarPendiente = false; renderHome(); vibrate([30, 40, 30]); }, 400);
    }
    const s = Math.floor(left / 1000);
    const v = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
    // Sin segundos: se cuenta en minutos redondeando hacia arriba (no marca 00:00 antes de tiempo)
    const tm = Math.ceil(left / 60000);
    const vm = { d: Math.floor(tm / 1440), h: Math.floor(tm / 60) % 24, m: tm % 60 };
    const usar = el.classList.contains('no-s') ? vm : v;
    el.querySelectorAll('[data-u]').forEach(b => { b.textContent = String(usar[b.dataset.u]).padStart(2, '0'); });
    const line = el.querySelector('[data-line]');
    if (line) {
      line.textContent = v.d ? `${v.d} d ${v.h} h` : v.h ? `${v.h} h ${v.m} min` : left > 0 ? `${v.m} min ${v.s} s` : '0 s';
    }
  });
}

function paintExtras(root) { paintHomeStats(root); tickCountdowns(root); }

setInterval(() => {
  if (document.hidden) return;
  tickCountdowns(document.getElementById('home') || document);
  const prev = document.getElementById('he-preview');
  if (prev && prev.offsetParent) tickCountdowns(prev);
}, 1000);

// Carruseles: puntitos + avance automático (se puede apagar en Ajustes)
document.addEventListener('scroll', (e) => {
  const car = e.target;
  if (!car.classList || !car.classList.contains('hb-car')) return;
  const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
  const dots = car.parentElement.querySelectorAll('.hb-dots span');
  dots.forEach((d, j) => d.classList.toggle('on', j === i));
}, true);
let touching = false;
document.addEventListener('touchstart', (e) => { if (e.target.closest && e.target.closest('.hb-car')) touching = true; }, { passive: true });
document.addEventListener('touchend', () => { setTimeout(() => { touching = false; }, 4000); }, { passive: true });
// Cada carrusel avanza a su propio ritmo (lo elige el admin; -1 = no pasa solo)
setInterval(() => {
  if (document.hidden || touching || store.get('homeAutoCarousel', 'true') !== 'true') return;
  const enInicio = window.currentSection && window.currentSection() === 'home';
  const prev = document.getElementById('he-preview');
  const cars = [...(enInicio ? document.querySelectorAll('#home .hb-car') : []), ...(prev && prev.offsetParent ? prev.querySelectorAll('.hb-car') : [])];
  const now = Date.now();
  cars.forEach(car => {
    const cada = Number(car.dataset.interval) || 5;
    if (cada < 0 || car.children.length < 2) return;
    if (!car._last) car._last = now;
    if (now - car._last < cada * 1000) return;
    car._last = now;
    const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
    car.scrollTo({ left: ((i + 1) % car.children.length) * car.clientWidth, behavior: 'smooth' });
  });
}, 1000);

// ==========================================
// ACCIONES DE LOS USUARIOS
// ==========================================
// Enlaces internos (#mods, mod:ID) dentro de los bloques
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('[data-hl]');
  if (!a) return;
  e.preventDefault();
  if (a.closest('.he-preview')) return toast('Así funcionará el enlace cuando lo publiques.', 'link');
  const [kind, val] = a.dataset.hl.split(':');
  if (kind === 'sec') window.selectSection(val);
  else if (kind === 'item') {
    if (FNF.itemOf(val)) window.openItemById(val);
    else toast(t('Este contenido ya no está disponible.', 'This content is no longer available.'), 'info');
  }
  vibrate(12);
});

window.homeCerrar = (id) => {
  const b = blocks()[id];
  const map = dismissed();
  map[id] = (b && b.updatedAt) || 1;
  store.setJson('fnf_home_dismissed', map);
  renderHome();
  vibrate(15);
};
window.homeMostrarCerrados = () => {
  store.remove('fnf_home_dismissed');
  renderHome();
  toast(t('Listo: los avisos cerrados vuelven a aparecer en el Inicio.', 'Done: closed notices are back on Home.'), 'bell');
};
window.homeGaleria = (id, i) => {
  const b = id === 'preview' ? (FNF.home.previewBlock || {}) : (blocks()[id] || {});
  const imgs = (b.images || []).filter(okImg);
  if (imgs.length && window.abrirGaleria) window.abrirGaleria(imgs, i);
};
// El video de YouTube solo se carga cuando lo tocan (más ligero para celulares de gama baja)
window.homeVideo = (btn, vid, start = 0) => {
  if (!/^[\w-]{11}$/.test(vid)) return;
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0${Number(start) > 0 ? '&start=' + Math.floor(start) : ''}`;
  f.title = 'YouTube';
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.allowFullscreen = true;
  const box = document.createElement('div');
  box.className = 'hb-yt';
  box.appendChild(f);
  btn.replaceWith(box);
};

// Ajustes del usuario para el Inicio
const bind = (id, key, def) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = store.get(key, def) === 'true';
  el.addEventListener('change', () => { store.set(key, String(el.checked)); renderHome(); vibrate(20); });
};
bind('homeAutoToggle', 'homeAutoCarousel', 'true');
bind('homeHideTopToggle', 'homeHideTop', 'false');

// ==========================================
// PARA EL RESTO DE LA PÁGINA
// ==========================================
window.renderHome = renderHome;
window.paintHomeStats = () => paintHomeStats(document.getElementById('home') || document);
window.setHomeData = (h) => {
  data = h || null;
  store.setJson('fnf_home_cache', data);
  renderHome();
  if (window.renderAdminTab) window.renderAdminTab('inicio', true); // pestaña Inicio del panel
};
window.homeModoEdicion = (on) => {
  editing = !!on && !!window.isSuperUser;
  renderHome();
  if (editing) toast('Modo edición: usa los botones de cada bloque. Lo que ves con borde punteado no lo ven los usuarios.', 'edit');
};
FNF.home = { SYS, SYS_ORDER, SYS_CAMPOS, TYPES, TONES, blockHTML, parseLink, okImg, ytId, computeOrder, whyHidden, fechaLanzamiento, aplicarFijos, textoFijo, data: homeData, paintExtras, previewBlock: null };

renderHome();
})();
