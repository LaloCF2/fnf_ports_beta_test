// Panel de admin — piezas de formulario que usan los editores (Inicio y mods/bases/scripts):
// listas de filas con su propia caja (descargas, botones, imágenes), con Añadir / Subir / Bajar / Borrar.
(() => {
const { esc, icon } = FNF;

// Nombre bonito del servidor de un enlace (para la etiqueta de cada descarga)
const SERVIDORES = {
  'mediafire.com': 'MediaFire', 'drive.google.com': 'Google Drive', 'drive.usercontent.google.com': 'Google Drive', 'docs.google.com': 'Google Drive',
  'mega.nz': 'MEGA', 'github.com': 'GitHub', 'raw.githubusercontent.com': 'GitHub', 'gamebanana.com': 'GameBanana', 'dropbox.com': 'Dropbox',
  'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'discord.gg': 'Discord', 'discord.com': 'Discord', 't.me': 'Telegram',
  'tiktok.com': 'TikTok', 'gamejolt.com': 'Game Jolt', 'itch.io': 'itch.io', 'pixeldrain.com': 'Pixeldrain', 'apkpure.com': 'APKPure'
};
const servidor = (u) => {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    const k = Object.keys(SERVIDORES).find(s => h === s || h.endsWith('.' + s));
    return k ? SERVIDORES[k] : h;
  } catch (e) { return /^assets\//i.test(u || '') ? 'Archivo de la página' : ''; }
};
FNF.servidor = servidor;

// Secciones de la página para los botones
const SECCIONES = [['#home', 'Inicio'], ['#mods', 'MODs'], ['#apks', 'Bases'], ['#scripts', 'Scripts'], ['#help', 'Ayuda'], ['#contact', 'Redes / contacto']];
const opcionesItems = (sel) => Object.entries(FNF.KINDS).map(([, k]) =>
  `<optgroup label="${k.label}">${Object.entries(window[k.data] || {}).map(([id, d]) =>
    `<option value="${esc(id)}" ${id === sel ? 'selected' : ''}>${esc(d.title)}</option>`).join('')}</optgroup>`).join('');
FNF.opcionesItems = opcionesItems;

const tipoDeUrl = (u) => (/^#/.test(u || '') ? 'sec' : /^(mod|item):/i.test(u || '') ? 'item' : 'web');
const primerItem = () => Object.keys(window.MOD_DATA || {})[0] || '';

// Cómo se dibuja y se edita cada tipo de fila
const TIPOS = {
  descarga: {
    nuevo: () => ({ name: '', link: '' }),
    agregar: 'Añadir descarga',
    html: (r) => `
      <div class="fr-main">
        <input class="field" data-k="name" maxlength="60" placeholder="Nombre del botón (ej: Descarga Android)" value="${esc(r.name)}">
        <div class="fr-line">
          <input class="field" data-k="link" inputmode="url" placeholder="https://... o assets/..." value="${esc(r.link)}">
          <span class="fr-host" data-host>${esc(servidor(r.link))}</span>
        </div>
      </div>`,
    extra: () => `<button type="button" data-a="probar" title="Abrir el enlace para probarlo">${icon('link', 'icon icon-sm')}</button>`,
    valido: (r) => !r.link || /^(https?:\/\/|assets\/)\S+$/i.test(r.link.trim())
  },
  boton: {
    nuevo: () => ({ label: '', url: '', style: '' }),
    agregar: 'Añadir botón',
    html: (r) => {
      const tipo = tipoDeUrl(r.url);
      const valor = tipo === 'web'
        ? `<input class="field" data-k="url" inputmode="url" placeholder="https://..." value="${esc(r.url)}">`
        : tipo === 'sec'
          ? `<select class="field" data-k="url">${SECCIONES.map(([v, l]) => `<option value="${v}" ${r.url === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`
          : `<select class="field" data-k="url">${opcionesItems(String(r.url).replace(/^(mod|item):/i, '')).replace(/value="([^"]+)"/g, 'value="mod:$1"')}</select>`;
      return `
        <div class="fr-main">
          <input class="field" data-k="label" maxlength="40" placeholder="Texto del botón (ej: ¡Descárgalo!)" value="${esc(r.label)}">
          <div class="fr-line">
            <select class="field fr-kind" data-tipo>
              <option value="web" ${tipo === 'web' ? 'selected' : ''}>🌐 Enlace web</option>
              <option value="sec" ${tipo === 'sec' ? 'selected' : ''}>🧭 Sección</option>
              <option value="item" ${tipo === 'item' ? 'selected' : ''}>🎮 Abrir un mod</option>
            </select>
            ${valor}
          </div>
          <div class="fr-styles">
            ${[['', 'Automático'], ['primary', 'Principal'], ['soft', 'Suave'], ['outline', 'Contorno']].map(([v, l]) =>
              `<button type="button" class="fr-style${(r.style || '') === v ? ' on' : ''}" data-style="${v}">${l}</button>`).join('')}
          </div>
        </div>`;
    },
    valido: (r) => !r.url || FNF.home.parseLink(r.url)
  },
  paso: {
    nuevo: () => ({ text: '' }),
    agregar: 'Añadir paso',
    html: (r) => `<div class="fr-main"><input class="field" data-k="text" maxlength="200" placeholder="Ej: Copia la carpeta del mod en mods/" value="${esc(r.text)}"></div>`,
    valido: () => true
  },
  version: {
    nuevo: () => ({ version: '', date: '', text: '' }),
    agregar: 'Añadir versión',
    html: (r) => `
      <div class="fr-main">
        <div class="fr-line">
          <input class="field" data-k="version" maxlength="30" placeholder="v1.0.4" value="${esc(r.version)}">
          <input class="field" data-k="date" maxlength="30" placeholder="Fecha (ej: 05/11/2026)" value="${esc(r.date)}">
        </div>
        <textarea class="field" data-k="text" maxlength="800" placeholder="- Qué cambió en esta versión">${esc(r.text)}</textarea>
      </div>`,
    valido: () => true
  },
  credito: {
    nuevo: () => ({ name: '', role: '', link: '' }),
    agregar: 'Añadir persona',
    html: (r) => `
      <div class="fr-main">
        <div class="fr-line">
          <input class="field" data-k="name" maxlength="40" placeholder="Nombre" value="${esc(r.name)}">
          <input class="field" data-k="role" maxlength="40" placeholder="Qué hizo (ej: Música)" value="${esc(r.role)}">
        </div>
        <input class="field" data-k="link" inputmode="url" placeholder="Enlace (opcional): https://..." value="${esc(r.link)}">
      </div>`,
    valido: (r) => !r.link || /^https?:\/\/\S+$/i.test(r.link.trim())
  },
  imagen: {
    nuevo: () => ({ url: '' }),
    agregar: 'Añadir imagen',
    html: (r, i) => `
      <img class="fr-thumb" src="${esc(r.url)}" alt="" ${r.url ? '' : 'hidden'} onerror="this.hidden=true" onload="this.hidden=false">
      <div class="fr-main">
        ${i === 0 ? '<span class="fr-badge">⭐ Principal</span>' : ''}
        <input class="field" data-k="url" inputmode="url" placeholder="https://... o assets/images/..." value="${esc(r.url)}">
      </div>`,
    extra: (r, i) => (i > 0 ? `<button type="button" data-a="top" title="Hacerla la principal">⭐</button>` : ''),
    valido: (r) => !r.url || /^(https?:\/\/|assets\/)\S+$/i.test(r.url.trim())
  }
};

/**
 * Lista editable de filas.
 *   const lista = FNF.Filas(elemento, 'descarga', [{name, link}], () => { ...algo cambió... });
 *   lista.get()  → filas con datos (sin las vacías)
 *   lista.set(filas)
 */
FNF.Filas = (el, tipo, filas, onChange, opciones = {}) => {
  const T = TIPOS[tipo];
  let rows = (filas || []).map(r => ({ ...T.nuevo(), ...r }));
  const max = opciones.max || 20;
  const avisar = () => { if (onChange) onChange(); };

  function pintar() {
    el.innerHTML = `
      <div class="fr-list">${rows.map((r, i) => `
        <div class="fr-row${T.valido(r) ? '' : ' bad'}" data-i="${i}">
          <span class="fr-num">${i + 1}</span>
          ${T.html(r, i)}
          <div class="fr-tools">
            ${T.extra ? T.extra(r, i) : ''}
            <button type="button" data-a="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icon('up', 'icon icon-sm')}</button>
            <button type="button" data-a="down" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Bajar">${icon('down', 'icon icon-sm')}</button>
            <button type="button" data-a="dup" aria-label="Duplicar">${icon('copy', 'icon icon-sm')}</button>
            <button type="button" data-a="del" class="danger" aria-label="Quitar">${icon('trash', 'icon icon-sm')}</button>
          </div>
        </div>`).join('') || `<p class="fr-empty">${opciones.vacio || 'Nada todavía.'}</p>`}
      </div>
      ${rows.length < max ? `<button type="button" class="fr-add" data-a="add">${icon('plus', 'icon icon-sm')} ${opciones.agregar || T.agregar}</button>` : ''}`;
  }

  el.addEventListener('input', (e) => {
    const row = e.target.closest('.fr-row');
    const k = e.target.dataset.k;
    if (!row || !k) return;
    const r = rows[Number(row.dataset.i)];
    r[k] = e.target.value;
    row.classList.toggle('bad', !T.valido(r));
    const host = row.querySelector('[data-host]');
    if (host && k === 'link') host.textContent = servidor(r.link);
    const thumb = row.querySelector('.fr-thumb');
    if (thumb && k === 'url') { thumb.hidden = !r.url; thumb.src = r.url; }
    avisar();
  });
  el.addEventListener('change', (e) => {
    const row = e.target.closest('.fr-row');
    if (!row) return;
    const r = rows[Number(row.dataset.i)];
    if (e.target.matches('[data-tipo]')) {
      // Cambió el tipo de botón: se pone un valor inicial que tenga sentido
      r.url = { web: '', sec: '#mods', item: 'mod:' + primerItem() }[e.target.value];
      pintar();
      avisar();
    } else if (e.target.dataset.k && e.target.tagName === 'SELECT') {
      r[e.target.dataset.k] = e.target.value;
      avisar();
    }
  });
  el.addEventListener('click', (e) => {
    const st = e.target.closest('[data-style]');
    if (st) {
      const r = rows[Number(st.closest('.fr-row').dataset.i)];
      r.style = st.dataset.style;
      pintar(); avisar();
      return;
    }
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'add') {
      rows.push(T.nuevo());
      pintar(); avisar();
      const inputs = el.querySelectorAll('.fr-row:last-child input');
      if (inputs[0]) inputs[0].focus();
      return;
    }
    const i = Number(b.closest('.fr-row').dataset.i);
    if (a === 'up' && i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
    else if (a === 'down' && i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
    else if (a === 'top') rows.unshift(rows.splice(i, 1)[0]);
    else if (a === 'dup' && rows.length < max) rows.splice(i + 1, 0, { ...rows[i] });
    else if (a === 'del') rows.splice(i, 1);
    else if (a === 'probar') {
      const u = (rows[i].link || '').trim();
      if (!u) return FNF.toast('Primero pega el enlace.', 'link');
      window.open(u, '_blank', 'noopener');
      return;
    }
    pintar(); avisar();
  });

  pintar();
  return {
    // Solo las filas con contenido
    get: () => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])))
      .filter(r => Object.entries(r).some(([k, v]) => k !== 'style' && v)),
    invalidas: () => rows.filter(r => !T.valido(r)),
    set: (nuevas) => { rows = (nuevas || []).map(r => ({ ...T.nuevo(), ...r })); pintar(); },
    // Agrega una fila ya llenada (ej. "+ MediaFire") y pone el cursor en su primer campo vacío
    agregar: (r) => {
      if (rows.length >= max) return;
      rows.push({ ...T.nuevo(), ...r });
      pintar(); avisar();
      const vacio = [...el.querySelectorAll('.fr-row:last-child input')].find(x => !x.value);
      if (vacio) vacio.focus();
    }
  };
};

// ==========================================
// EDITOR DE PESTAÑAS DEL POPUP (mods, bases y scripts)
// ==========================================
const TIPOS_TAB = {
  cambios: ['📝', 'Cambios', 'Qué cambió en esta versión'],
  instalar: ['🛠️', 'Instalar', 'Pasos numerados para instalarlo'],
  versiones: ['🗂️', 'Versiones', 'Historial de versiones'],
  requisitos: ['📋', 'Requisitos', 'Lo que se necesita antes'],
  creditos: ['👥', 'Créditos', 'Quién hizo qué'],
  video: ['▶️', 'Video', 'Un video de YouTube'],
  custom: ['✨', 'Personalizada', 'Tú eliges el título y el texto']
};
// Qué lista usa cada tipo (y con qué tipo de fila)
const LISTA_TAB = { instalar: ['steps', 'paso', 'Sin pasos todavía.'], versiones: ['items', 'version', 'Sin versiones. La primera que pongas es la actual.'], creditos: ['items', 'credito', 'Sin personas todavía.'], custom: ['links', 'boton', 'Sin botones (son opcionales).'] };

const tieneContenido = (p) => (FNF.pestanaConContenido ? FNF.pestanaConContenido(p) : !!(p.text || p.url || (p.steps || []).length || (p.items || []).length || (p.links || []).length));
const estadoTab = (p) => p.on === false ? '⏸ Apagada' : tieneContenido(p) ? '✅ Se ve en el popup' : '✏️ Falta escribirle algo';

/**
 *   const tabs = FNF.EditorPestanas(elemento, [{ type, on, emoji, title, text, steps, items, links, url }], () => {...});
 *   tabs.get() / tabs.set([...])
 */
FNF.EditorPestanas = (el, inicial, onChange) => {
  let rows = JSON.parse(JSON.stringify(inicial || []));
  let abierta = null;
  const listas = {};
  const avisar = () => { if (onChange) onChange(); };

  const cuerpo = (p, i) => {
    const lista = LISTA_TAB[p.type] ? `<label class="label">${{ steps: 'Pasos', items: p.type === 'versiones' ? 'Versiones (la de arriba es la actual)' : 'Personas', links: 'Botones (opcional)' }[LISTA_TAB[p.type][0]]}</label><div data-filas="${i}"></div>` : '';
    const texto = (ph, label = 'Texto') => `<label class="label">${label}</label><textarea class="field ed-tall" data-tk="text" maxlength="2000" placeholder="${ph}">${esc(p.text)}</textarea>
      <p class="note"><b>TIP:</b> empieza una línea con <b>- </b> para hacer una lista, y escribe <b>**así**</b> para negritas.</p>`;
    if (p.type === 'instalar') return lista + texto('Nota final (opcional)', 'Nota al final (opcional)');
    if (p.type === 'versiones' || p.type === 'creditos') return lista;
    if (p.type === 'video') return `<label class="label">Enlace de YouTube</label><input class="field" data-tk="url" inputmode="url" placeholder="https://youtu.be/..." value="${esc(p.url)}">` + texto('Algo sobre el video (opcional)', 'Texto (opcional)');
    if (p.type === 'cambios') return texto('- Se optimizaron las canciones\n- Se arregló el crasheo en la semana 2');
    if (p.type === 'requisitos') return texto('- Android 8 o más nuevo\n- 2 GB de RAM\n- La base Psych Engine 0.7.3');
    return texto('Escribe lo que quieras mostrar en esta pestaña.') + lista;
  };

  function pintar() {
    Object.keys(listas).forEach(k => delete listas[k]);
    el.innerHTML = `
      <div class="tp-fijas"><span>Siempre:</span><b>ℹ️ Info</b><b>⬇️ Descargas</b><b>🖼️ Capturas</b><b>💬 Chat</b></div>
      <div class="tp-list">${rows.map((p, i) => {
        const T = TIPOS_TAB[p.type] || TIPOS_TAB.custom;
        const off = p.on === false;
        return `
        <div class="tp-card${off ? ' off' : ''}${abierta === i ? ' open' : ''}" data-i="${i}">
          <div class="tp-head">
            <input class="field tp-emoji" data-tk="emoji" maxlength="4" value="${esc(p.emoji || T[0])}" aria-label="Emoji">
            <input class="field tp-title" data-tk="title" maxlength="24" placeholder="${T[1]}" value="${esc(p.title || '')}" aria-label="Título de la pestaña">
            <label class="switch" title="Activar o apagar"><input type="checkbox" data-tk="on" ${off ? '' : 'checked'}><span></span></label>
          </div>
          <div class="tp-meta">
            <span class="tp-type">${T[0]} ${T[1]}</span>
            <span class="tp-state" data-estado>${estadoTab(p)}</span>
            <span class="grow"></span>
            <button type="button" data-tp="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icon('up', 'icon icon-sm')}</button>
            <button type="button" data-tp="down" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Bajar">${icon('down', 'icon icon-sm')}</button>
            <button type="button" data-tp="abrir" class="tp-edit">${abierta === i ? 'Listo' : '✏️ Editar'}</button>
            <button type="button" data-tp="del" class="danger" aria-label="Borrar">${icon('trash', 'icon icon-sm')}</button>
          </div>
          ${abierta === i ? `<div class="tp-body">${cuerpo(p, i)}</div>` : ''}
        </div>`;
      }).join('') || '<p class="fr-empty">Sin pestañas extra todavía. Agrega una aquí abajo 👇</p>'}</div>
      <div class="tp-add"><span>➕ Añadir pestaña:</span>
        ${Object.entries(TIPOS_TAB).map(([k, [e, n, desc]]) => `<button type="button" data-tpadd="${k}" title="${desc}">${e} ${n}</button>`).join('')}
      </div>`;
    // Listas (pasos, versiones, créditos, botones) dentro de la pestaña abierta
    if (abierta !== null && rows[abierta] && LISTA_TAB[rows[abierta].type]) {
      const p = rows[abierta];
      const [campo, tipo, vacio] = LISTA_TAB[p.type];
      const box = el.querySelector(`[data-filas="${abierta}"]`);
      const f = FNF.Filas(box, tipo, p[campo] || [], () => {
        p[campo] = f.get();
        const est = el.querySelector(`.tp-card[data-i="${abierta}"] [data-estado]`);
        if (est) est.textContent = estadoTab(p);
        avisar();
      }, { vacio, max: 20 });
      listas[abierta] = f;
    }
  }

  el.addEventListener('input', (e) => {
    const k = e.target.dataset.tk;
    const card = e.target.closest('.tp-card');
    if (!k || !card) return;
    const p = rows[Number(card.dataset.i)];
    p[k] = k === 'on' ? e.target.checked : e.target.value;
    if (k === 'on') card.classList.toggle('off', !e.target.checked);
    const est = card.querySelector('[data-estado]');
    if (est) est.textContent = estadoTab(p);
    avisar();
  });
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-filas]')) return; // los botones de las listas los maneja su propia lista
    const add = e.target.closest('[data-tpadd]');
    if (add) {
      const tipo = add.dataset.tpadd;
      rows.push({ id: 't' + Date.now().toString(36), type: tipo, on: true, emoji: TIPOS_TAB[tipo][0], title: '' });
      abierta = rows.length - 1;
      pintar(); avisar();
      const campo = el.querySelector('.tp-card.open textarea, .tp-card.open [data-filas] input, .tp-card.open input[data-tk="url"]');
      if (campo) { campo.focus(); campo.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }
    const b = e.target.closest('[data-tp]');
    if (!b) return;
    const i = Number(b.closest('.tp-card').dataset.i);
    const a = b.dataset.tp;
    if (a === 'up' && i > 0) { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; if (abierta === i) abierta = i - 1; else if (abierta === i - 1) abierta = i; }
    else if (a === 'down' && i < rows.length - 1) { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; if (abierta === i) abierta = i + 1; else if (abierta === i + 1) abierta = i; }
    else if (a === 'abrir') abierta = abierta === i ? null : i;
    else if (a === 'del') {
      if (tieneContenido(rows[i]) && !confirm(`¿Borrar la pestaña "${rows[i].title || TIPOS_TAB[rows[i].type][1]}" y lo que tiene escrito?`)) return;
      rows.splice(i, 1);
      abierta = null;
    }
    pintar();
    if (a !== 'abrir') avisar(); // abrir una pestaña para verla no cuenta como cambio
  });

  pintar();
  const limpia = (p) => {
    const out = { id: p.id || ('t' + Math.random().toString(36).slice(2, 8)), type: p.type, on: p.on !== false };
    ['emoji', 'title', 'text', 'url'].forEach(k => { const v = String(p[k] || '').trim(); if (v) out[k] = v; });
    if ((p.steps || []).length) out.steps = p.steps;
    if ((p.items || []).length) out.items = p.items;
    if ((p.links || []).length) out.links = p.links;
    return out;
  };
  return {
    get: () => rows.map(limpia),
    set: (nuevas) => { rows = JSON.parse(JSON.stringify(nuevas || [])); abierta = null; pintar(); }
  };
};
})();
