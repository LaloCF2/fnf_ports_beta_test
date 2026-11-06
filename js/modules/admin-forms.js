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
})();
