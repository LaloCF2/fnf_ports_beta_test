// Panel de admin — Editor del Inicio: agregar, editar, mover, ocultar, duplicar y borrar bloques.
// Todo se guarda en site_config/home (las reglas de Firebase solo dejan escribir al admin).
window.fbReady.then((FB) => {
const { db, ref, update } = FB;
const { esc, toast, openPopup, closePopup, isAdmin } = FNF;
const H = FNF.home;
const PATH = 'site_config/home';

const log = (detail, target) => { if (FNF.logAdmin) FNF.logAdmin('content:home', detail, target); };
const guardar = async (upd, okMsg) => {
  try {
    await update(ref(db, PATH), upd);
    if (okMsg) toast(okMsg, 'check');
    return true;
  } catch (err) {
    console.error('Inicio:', err);
    toast('No se pudo guardar. ¿Tienes la sesión de admin abierta?', 'alert');
    return false;
  }
};
const nombreDe = (key) => {
  const b = (H.data().blocks || {})[key];
  if (!b) return (H.SYS[key] || ['', key])[1];
  return b.title || (b.itemId && (FNF.itemOf(b.itemId) || {}).title) || H.TYPES[b.type][1];
};

// ==========================================
// MOVER / OCULTAR / BORRAR
// ==========================================
window.homeMover = async (key, dir) => {
  if (!isAdmin()) return;
  const order = H.computeOrder();
  const i = order.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  await guardar({ order });
};

window.homeOcultar = async (key) => {
  if (!isAdmin()) return;
  const oculto = !!(H.data().hidden || {})[key];
  if (await guardar({ [`hidden/${key}`]: oculto ? null : true }, oculto ? 'Visible otra vez.' : 'Oculto para los usuarios.')) {
    log(`${oculto ? 'Mostró' : 'Ocultó'} en el Inicio: "${nombreDe(key)}"`, key);
  }
};

window.homeBorrar = async (key) => {
  if (!isAdmin() || H.SYS[key]) return;
  const nombre = nombreDe(key);
  if (!confirm(`¿Borrar "${nombre}" del Inicio? No se puede deshacer (si solo quieres quitarlo un rato, usa "Ocultar").`)) return;
  const order = H.computeOrder().filter(k => k !== key);
  if (await guardar({ [`blocks/${key}`]: null, [`hidden/${key}`]: null, order }, 'Bloque borrado.')) log(`Borró del Inicio: "${nombre}"`, key);
};

window.homeRestaurarOrden = async () => {
  if (!isAdmin()) return;
  if (!confirm('¿Volver al orden original del Inicio y mostrar todas las partes fijas? (Tus bloques se quedan, al final.)')) return;
  const hidden = Object.fromEntries(Object.entries(H.data().hidden || {}).filter(([k]) => !H.SYS[k]));
  if (await guardar({ order: null, hidden: Object.keys(hidden).length ? hidden : null }, 'Orden original restaurado.')) log('Restauró el orden original del Inicio');
};

window.homeDuplicar = async (key) => {
  if (!isAdmin()) return;
  const b = (H.data().blocks || {})[key];
  if (!b) return;
  const id = 'hb' + Date.now().toString(36);
  const order = H.computeOrder();
  order.splice(order.indexOf(key) + 1, 0, id);
  const copia = { ...b, title: b.title ? `${b.title} (copia)` : b.title || null, createdAt: Date.now(), updatedAt: Date.now() };
  if (await guardar({ [`blocks/${id}`]: limpiar(copia), [`hidden/${id}`]: true, order }, 'Duplicado (oculto). Edítalo y luego dale "Mostrar".')) {
    log(`Duplicó en el Inicio: "${nombreDe(key)}"`, id);
  }
};

// Atajo desde el panel de admin
window.homeIrEditar = () => {
  window.selectSection('home');
  window.homeModoEdicion(true);
};

// ==========================================
// EDITOR
// ==========================================
let ed = { id: null, pos: null, type: 'aviso', tone: 'accent' };
const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();
const setV = (id, v) => { $(id).value = v == null ? '' : v; };
const toInput = (ts) => ts ? new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
const fromInput = (s) => { const n = s ? new Date(s).getTime() : NaN; return isNaN(n) ? null : n; };

// Quita lo vacío (Firebase no acepta undefined y así no se guarda basura)
function limpiar(o) {
  const out = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    out[k] = v;
  });
  return out;
}

function pintarTipos() {
  $('he-types').innerHTML = Object.entries(H.TYPES).map(([k, [emoji, name, desc]]) =>
    `<button type="button" class="he-type${ed.type === k ? ' on' : ''}" onclick="homeEdTipo('${k}')"><span>${emoji}</span><b>${name}</b><small>${desc}</small></button>`).join('');
  $('he-tones').innerHTML = Object.entries(H.TONES).map(([k, [name, color]]) =>
    `<button type="button" class="he-tone${ed.tone === k ? ' on' : ''}" style="--c:${color}" title="${name}" onclick="homeEdTono('${k}')"><span></span>${name}</button>`).join('');
  document.querySelectorAll('#home-editor-popup [data-for]').forEach(el => {
    el.hidden = !el.dataset.for.split(' ').includes(ed.type);
  });
}

function opcionesItems(sel) {
  $('he-item').innerHTML = `<option value="">— Elige uno —</option>` + Object.entries(FNF.KINDS).map(([, k]) =>
    `<optgroup label="${k.label}">${Object.entries(window[k.data] || {}).map(([id, d]) =>
      `<option value="${esc(id)}" ${id === sel ? 'selected' : ''}>${esc(d.title)}${d.draft ? ' (borrador)' : d.hidden ? ' (secreto)' : ''}</option>`).join('')}</optgroup>`).join('');
}

// Lee el formulario y arma el bloque
function leer() {
  const links = val('he-links').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.lastIndexOf('|');
    return i > 0 ? { label: l.slice(0, i).trim().slice(0, 40), url: l.slice(i + 1).trim().slice(0, 500) } : { label: 'Abrir', url: l.slice(0, 500) };
  });
  const usa = (campo) => {
    const el = document.querySelector(`#home-editor-popup [data-for] #${campo}`);
    const sec = el && el.closest('[data-for]');
    return !sec || sec.dataset.for.split(' ').includes(ed.type);
  };
  return {
    type: ed.type, tone: ed.tone, size: $('he-size').value,
    emoji: usa('he-emoji') ? val('he-emoji').slice(0, 8) : '',
    tag: usa('he-tag') ? val('he-tag').slice(0, 30) : '',
    title: val('he-ttl').slice(0, 90), subtitle: val('he-sub').slice(0, 120), text: val('he-text').slice(0, 1500),
    images: usa('he-images') ? val('he-images').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12) : [],
    links: links.slice(0, 12),
    itemId: ed.type === 'destacado' ? $('he-item').value : '',
    video: ed.type === 'video' ? val('he-video') : '',
    date: ed.type === 'cuenta' ? fromInput(val('he-date')) : null,
    doneText: ed.type === 'cuenta' ? val('he-done').slice(0, 120) : '',
    audience: $('he-aud').value === 'todos' ? '' : $('he-aud').value,
    startAt: fromInput(val('he-from')), endAt: fromInput(val('he-until')),
    dismissible: $('he-dismiss').checked || null
  };
}

window.homeEdPreview = () => {
  const b = leer();
  H.previewBlock = b;
  const box = $('he-preview');
  box.innerHTML = H.blockHTML(b, 'preview', { preview: true });
  H.paintExtras(box);
};
window.homeEdTipo = (type) => { ed.type = type; pintarTipos(); window.homeEdPreview(); };
window.homeEdTono = (tone) => { ed.tone = tone; pintarTipos(); window.homeEdPreview(); };

function abrir(id, pos, b) {
  ed = { id, pos, type: (b && H.TYPES[b.type]) ? b.type : 'aviso', tone: (b && H.TONES[b.tone]) ? b.tone : 'accent' };
  b = b || {};
  $('he-title').textContent = id ? `Editar: ${nombreDe(id)}` : 'Nuevo bloque en el Inicio';
  setV('he-emoji', b.emoji); setV('he-tag', b.tag); setV('he-ttl', b.title); setV('he-sub', b.subtitle); setV('he-text', b.text);
  setV('he-images', (b.images || []).join('\n'));
  setV('he-links', (b.links || []).map(l => `${l.label} | ${l.url}`).join('\n'));
  setV('he-video', b.video); setV('he-date', toInput(b.date)); setV('he-done', b.doneText);
  $('he-aud').value = b.audience || 'todos';
  $('he-size').value = b.size || 'normal';
  setV('he-from', toInput(b.startAt)); setV('he-until', toInput(b.endAt));
  $('he-dismiss').checked = !!b.dismissible;
  $('he-visible').checked = id ? !(H.data().hidden || {})[id] : true;
  opcionesItems(b.itemId);
  pintarTipos();
  window.homeEdPreview();
  openPopup('home-editor-popup');
}

window.homeNuevoBloque = (pos) => {
  if (!isAdmin()) return;
  // Por defecto, justo debajo de la portada
  if (typeof pos !== 'number') {
    const order = H.computeOrder();
    const hero = order.indexOf('sys_hero');
    pos = hero >= 0 ? hero + 1 : 0;
  }
  abrir(null, pos, null);
};
window.homeEditar = (key) => {
  if (!isAdmin()) return;
  const b = (H.data().blocks || {})[key];
  if (b) abrir(key, null, b);
};

window.homeGuardarBloque = async () => {
  if (!isAdmin()) return;
  const b = leer();
  // Revisiones según el tipo
  const malLink = b.links.find(l => !H.parseLink(l.url));
  if (malLink) return toast(`Enlace inválido: "${malLink.url}". Usa https://..., #mods o mod:ID`, 'alert');
  const malImg = b.images.find(u => !H.okImg(u));
  if (malImg) return toast(`Imagen inválida: "${malImg}". Debe empezar con https:// o assets/`, 'alert');
  if (b.type === 'destacado' && !b.itemId) return toast('Elige qué mod quieres destacar.', 'alert');
  if (b.type === 'imagen' && !b.images.length) return toast('Agrega al menos una imagen.', 'alert');
  if (b.type === 'video' && !H.ytId(b.video)) return toast('Pega un enlace de YouTube válido.', 'alert');
  if (b.type === 'cuenta' && !b.date) return toast('Elige la fecha de la cuenta regresiva.', 'alert');
  if (['aviso', 'texto', 'botones', 'cuenta'].includes(b.type) && !b.title && !b.text) return toast('Escribe al menos un título o una descripción.', 'alert');
  if (b.type === 'botones' && !b.links.length) return toast('Agrega al menos un botón.', 'alert');
  if (b.startAt && b.endAt && b.endAt <= b.startAt) return toast('La fecha de "ocultar después" debe ser después de "mostrar desde".', 'alert');

  const id = ed.id || ('hb' + Date.now().toString(36));
  const prev = ed.id ? (H.data().blocks || {})[ed.id] || {} : {};
  const data = limpiar({ ...b, createdAt: prev.createdAt || Date.now(), updatedAt: Date.now() });
  const upd = { [`blocks/${id}`]: data, [`hidden/${id}`]: $('he-visible').checked ? null : true };
  if (!ed.id) {
    const order = H.computeOrder();
    order.splice(Math.max(0, Math.min(ed.pos, order.length)), 0, id);
    upd.order = order;
  }
  const btn = $('btn-guardar-bloque');
  btn.disabled = true;
  const ok = await guardar(upd, ed.id ? 'Cambios guardados.' : '¡Listo! Ya aparece en el Inicio.');
  btn.disabled = false;
  if (!ok) return;
  closePopup('home-editor-popup');
  log(`${ed.id ? 'Editó' : 'Agregó'} en el Inicio: ${H.TYPES[b.type][1]} "${b.title || nombreDe(id)}"`, id);
};
}).catch(err => console.error(err));
