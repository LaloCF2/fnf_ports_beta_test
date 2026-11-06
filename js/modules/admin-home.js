// Panel de admin — Inicio: editor de bloques (con lanzamientos programados), plantillas,
// mover / ocultar / duplicar / borrar, y la pestaña "Inicio" del panel.
// Todo se guarda en site_config/home (las reglas de Firebase solo dejan escribir al admin).
window.fbReady.then((FB) => {
const { db, ref, update } = FB;
const { esc, toast, openPopup, closePopup, isAdmin, fi } = FNF;
const H = FNF.home;
const A = window.ADMIN;
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
// MOVER / OCULTAR / BORRAR / DUPLICAR
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

// Atajo: ir al Inicio con el modo edición encendido
window.homeIrEditar = () => {
  window.selectSection('home');
  window.homeModoEdicion(true);
};

// ==========================================
// PLANTILLAS (empiezan el bloque ya armado)
// ==========================================
const enDias = (d, h = 18) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.getTime(); };
const primerMod = () => Object.keys(window.MOD_DATA || {})[0] || '';
const PLANTILLAS = {
  lanzamiento: ['🚀', 'Lanzamiento de mod', () => ({
    type: 'cuenta', tone: 'accent', size: 'grande', bg: 'grad', align: 'center', effect: 'shine',
    emoji: '🚀', tag: 'Próximamente', title: 'Mi nuevo port llega muy pronto',
    subtitle: 'Optimizado para todas las gamas', text: 'Activa la **campana** para que no te lo pierdas.',
    date: enDias(3), after: {
      emoji: '🎉', tag: '¡Ya disponible!', title: '¡Ya salió!', text: 'Ya puedes descargarlo. ¡Cuéntame qué te pareció en los comentarios!',
      links: [{ label: '¡Descargar ahora!', url: 'mod:' + primerMod(), style: 'primary' }]
    }
  })],
  destacado: ['⭐', 'Mod especial', () => ({
    type: 'destacado', tone: 'accent', size: 'grande', itemId: primerMod(), tag: '⭐ Mi port', btnText: 'Descargar ahora'
  })],
  aviso: ['⚠️', 'Aviso importante', () => ({
    type: 'aviso', tone: 'warn', effect: 'pulse', emoji: '⚠️', tag: 'Importante',
    title: 'Aviso importante', text: 'Escribe aquí tu aviso.', dismissible: true
  })],
  noticia: ['📢', 'Noticia', () => ({
    type: 'aviso', tone: 'info', emoji: '📢', tag: 'Novedades', title: '¡Hay novedades en la página!',
    text: 'Cuéntales qué cambió.', links: [{ label: 'Ver los mods', url: '#mods' }], dismissible: true
  })],
  redes: ['🔗', 'Mis redes', () => ({
    type: 'botones', tone: 'dark', emoji: '💜', title: 'Sígueme en mis redes', layout: '',
    links: [{ label: 'YouTube', url: 'https://youtube.com/' }, { label: 'TikTok', url: 'https://tiktok.com/' }, { label: 'Discord', url: 'https://discord.gg/' }]
  })],
  galeria: ['🖼️', 'Galería', () => ({ type: 'imagen', tone: 'info', ratio: '16:9', tag: 'Galería', title: 'Capturas de mis ports', images: [] })],
  video: ['▶️', 'Tráiler', () => ({ type: 'video', tone: 'danger', emoji: '▶️', title: 'Mira el tráiler', video: '' })]
};
const plantillasHTML = (accion) => Object.entries(PLANTILLAS).map(([k, [emoji, nombre]]) =>
  `<button type="button" class="he-tpl" onclick="${accion}('${k}')"><span>${emoji}</span>${nombre}</button>`).join('');

// ==========================================
// EDITOR
// ==========================================
let ed = { id: null, pos: null, type: 'aviso', tone: 'accent' };
let fase = '';                 // vista previa: '' (ahora) | 'antes' | 'despues'
let cambios = false;
let listaLinks = null, listaAfter = null, listaImgs = null;
let previewTimer = null;
const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();
const setV = (id, v) => { $(id).value = v == null ? '' : v; };
const check = (id, v) => { $(id).checked = !!v; };
const toInput = (ts) => ts ? new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
const fromInput = (s) => { const n = s ? new Date(s).getTime() : NaN; return isNaN(n) ? null : n; };

// Quita lo vacío (Firebase no acepta undefined y así no se guarda basura)
function limpiar(o) {
  const out = {};
  Object.entries(o).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false || v === 0 || (Array.isArray(v) && !v.length)) return;
    if (v && typeof v === 'object' && !Array.isArray(v)) { const sub = limpiar(v); if (Object.keys(sub).length) out[k] = sub; return; }
    out[k] = v;
  });
  return out;
}

// ¿Este campo aplica al tipo elegido? (según los data-for del formulario)
const aplica = (campo) => {
  const sec = $(campo) && $(campo).closest('[data-for]');
  return !sec || sec.dataset.for.split(' ').includes(ed.type);
};

function pintarTipos() {
  $('he-types').innerHTML = Object.entries(H.TYPES).map(([k, [emoji, name, desc]]) =>
    `<button type="button" class="he-type${ed.type === k ? ' on' : ''}" onclick="homeEdTipo('${k}')"><span>${emoji}</span><b>${name}</b><small>${desc}</small></button>`).join('');
  $('he-tones').innerHTML = Object.entries(H.TONES).map(([k, [name, color]]) =>
    `<button type="button" class="he-tone${ed.tone === k ? ' on' : ''}" style="--c:${color}" title="${name}" onclick="homeEdTono('${k}')"><span></span>${name}</button>`).join('');
  document.querySelectorAll('#home-editor-popup [data-for]').forEach(el => {
    el.hidden = !el.dataset.for.split(' ').includes(ed.type);
  });
}

// Lee el formulario y arma el bloque
function leer() {
  const b = {
    type: ed.type, tone: ed.tone, size: $('he-size').value, bg: $('he-bg').value, align: $('he-align').value, effect: $('he-effect').value,
    emoji: aplica('he-emoji') ? val('he-emoji').slice(0, 8) : '',
    tag: aplica('he-tag') ? val('he-tag').slice(0, 30) : '',
    title: val('he-ttl').slice(0, 90), subtitle: val('he-sub').slice(0, 120), text: val('he-text').slice(0, 1500),
    images: aplica('he-images') ? listaImgs.get().map(r => r.url).slice(0, 12) : [],
    imgPos: aplica('he-img-pos') ? $('he-img-pos').value : '',
    ratio: aplica('he-ratio') ? $('he-ratio').value : '',
    interval: aplica('he-interval') ? Number($('he-interval').value) || 0 : 0,
    noDots: aplica('he-no-dots') && $('he-no-dots').checked,
    links: listaLinks.get().slice(0, 12),
    layout: aplica('he-layout') ? $('he-layout').value : '',
    itemId: ed.type === 'destacado' ? $('he-item').value : '',
    btnText: ed.type === 'destacado' ? val('he-btn-text').slice(0, 30) : '',
    waitText: ed.type === 'destacado' ? val('he-wait-text').slice(0, 30) : '',
    hideStats: ed.type === 'destacado' && $('he-hide-stats').checked,
    hideDesc: ed.type === 'destacado' && $('he-hide-desc').checked,
    video: ed.type === 'video' ? val('he-video') : '',
    start: ed.type === 'video' ? Math.max(0, Math.floor(Number(val('he-start')) || 0)) : 0,
    audience: $('he-aud').value === 'todos' ? '' : $('he-aud').value,
    startAt: fromInput(val('he-from')), endAt: fromInput(val('he-until')),
    dismissible: $('he-dismiss').checked
  };
  if (aplica('he-date')) {
    Object.assign(b, {
      date: fromInput(val('he-date')),
      cdStyle: $('he-cd-style').value, noSeconds: $('he-no-seconds').checked,
      afterMode: $('he-after-mode').value,
      doneText: ed.type === 'cuenta' ? val('he-done').slice(0, 120) : '',
      after: {
        emoji: val('he-a-emoji').slice(0, 8), tag: val('he-a-tag').slice(0, 30),
        title: val('he-a-ttl').slice(0, 90), subtitle: val('he-a-sub').slice(0, 120), text: val('he-a-text').slice(0, 1500),
        links: listaAfter.get().slice(0, 12), replaceLinks: $('he-a-replace').checked
      }
    });
  }
  return b;
}

// Vista previa + contadores + estado
function pintarVista() {
  const b = leer();
  H.previewBlock = b;
  const tieneFecha = !!H.fechaLanzamiento(b);
  $('he-fase').hidden = !tieneFecha;
  if (!tieneFecha) fase = '';
  $('he-fase').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.fase === fase));
  const box = $('he-preview');
  box.innerHTML = H.blockHTML(limpiar(b), 'preview', { preview: true, fase: fase || undefined });
  H.paintExtras(box);
  $('he-ttl-n').textContent = `${val('he-ttl').length}/90`;
  $('he-text-n').textContent = `${val('he-text').length}/1500`;
  // Lo que se ve al terminar solo aplica si se cambia el contenido
  $('he-after-box').hidden = $('he-after-mode').value === 'ocultar';
  const estado = [];
  const f = H.fechaLanzamiento(b);
  if (f) estado.push(f > Date.now() ? `🚀 Lanzamiento: ${FNF.fmtDateTime(f)}` : '🎉 La cuenta ya terminó (se ve lo de "al terminar")');
  if (b.startAt && b.startAt > Date.now()) estado.push(`⏰ Aparece el ${FNF.fmtDateTime(b.startAt)}`);
  if (b.endAt) estado.push(`⌛ Se oculta el ${FNF.fmtDateTime(b.endAt)}`);
  if (!$('he-visible').checked) estado.push('🙈 Oculto');
  if (cambios) estado.push('<b>● Cambios sin guardar</b>');
  $('he-status').innerHTML = estado.join(' · ') || (ed.id ? 'Editando un bloque del Inicio' : 'Bloque nuevo');
}
const avisar = () => {
  cambios = true;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(pintarVista, 120);
};
window.homeEdPreview = () => pintarVista();
window.homeEdTipo = (type) => { ed.type = type; pintarTipos(); avisar(); };
window.homeEdTono = (tone) => { ed.tone = tone; pintarTipos(); avisar(); };
window.homeEdIrVista = () => $('he-s-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
window.homeEdNegrita = () => {
  const tx = $('he-text');
  const [a, z] = [tx.selectionStart, tx.selectionEnd];
  const sel = tx.value.slice(a, z) || 'texto';
  tx.value = tx.value.slice(0, a) + `**${sel}**` + tx.value.slice(z);
  tx.focus();
  tx.setSelectionRange(a + 2, a + 2 + sel.length);
  avisar();
};

// Escuchas del editor (una sola vez)
(() => {
  const pop = $('home-editor-popup');
  const enListas = (el) => el.closest('#he-links, #he-a-links, #he-images');
  pop.addEventListener('input', (e) => { if (!enListas(e.target)) avisar(); });
  pop.addEventListener('change', (e) => { if (!enListas(e.target)) avisar(); });
  pop.addEventListener('click', (e) => {
    const em = e.target.closest('[data-emoji]');
    if (em) { $('he-emoji').value = em.dataset.emoji; avisar(); return; }
    const fb = e.target.closest('[data-fecha]');
    if (fb) {
      const k = fb.dataset.fecha;
      const d = new Date();
      if (k === '1h') d.setHours(d.getHours() + 1);
      if (k === 'manana') { d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); }
      if (k === 'finde') { d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(12, 0, 0, 0); }
      if (k === 'semana') { d.setDate(d.getDate() + 7); d.setHours(18, 0, 0, 0); }
      $('he-date').value = k ? toInput(d.getTime()) : '';
      avisar();
      return;
    }
    const fz = e.target.closest('[data-fase]');
    if (fz) { fase = fz.dataset.fase; pintarVista(); }
  });
  $('he-jump').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    const destino = b && $(b.dataset.ir);
    if (destino && !destino.hidden) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('he-tpls').innerHTML = plantillasHTML('homeEdPlantilla');
})();

function abrir(id, pos, b) {
  b = b || {};
  ed = { id, pos, type: H.TYPES[b.type] ? b.type : 'aviso', tone: H.TONES[b.tone] ? b.tone : 'accent' };
  fase = '';
  $('he-title').textContent = id ? `Editar: ${nombreDe(id)}` : 'Nuevo bloque en el Inicio';
  setV('he-emoji', b.emoji); setV('he-tag', b.tag); setV('he-ttl', b.title); setV('he-sub', b.subtitle); setV('he-text', b.text);
  setV('he-img-pos', b.imgPos); setV('he-ratio', b.ratio); setV('he-interval', b.interval ? String(b.interval) : ''); check('he-no-dots', b.noDots);
  setV('he-layout', b.layout); setV('he-video', b.video); setV('he-start', b.start || '');
  setV('he-btn-text', b.btnText); setV('he-wait-text', b.waitText); check('he-hide-stats', b.hideStats); check('he-hide-desc', b.hideDesc);
  setV('he-date', toInput(b.date)); setV('he-cd-style', b.cdStyle); check('he-no-seconds', b.noSeconds);
  setV('he-after-mode', b.afterMode); setV('he-done', b.doneText);
  const a = b.after || {};
  setV('he-a-emoji', a.emoji); setV('he-a-tag', a.tag); setV('he-a-ttl', a.title); setV('he-a-sub', a.subtitle); setV('he-a-text', a.text);
  check('he-a-replace', a.replaceLinks);
  $('he-aud').value = b.audience || 'todos';
  $('he-size').value = b.size || 'normal';
  setV('he-bg', b.bg); setV('he-align', b.align); setV('he-effect', b.effect);
  setV('he-from', toInput(b.startAt)); setV('he-until', toInput(b.endAt));
  check('he-dismiss', b.dismissible);
  $('he-visible').checked = id ? !(H.data().hidden || {})[id] : true;
  $('he-item').innerHTML = `<option value="">— Elige uno —</option>${FNF.opcionesItems(b.itemId)}`;

  // Listas de botones e imágenes (cada uno en su caja)
  const imgs = (b.images || []).map(url => ({ url }));
  if (!listaLinks) {
    listaLinks = FNF.Filas($('he-links'), 'boton', b.links, avisar, { vacio: 'Sin botones. (Son opcionales)', max: 12 });
    listaAfter = FNF.Filas($('he-a-links'), 'boton', a.links, avisar, { vacio: 'Ninguno: agrega aquí el botón con el link del lanzamiento.', agregar: 'Añadir botón de lanzamiento', max: 12 });
    listaImgs = FNF.Filas($('he-images'), 'imagen', imgs, avisar, { vacio: 'Sin imágenes.', max: 12 });
  } else {
    listaLinks.set(b.links); listaAfter.set(a.links); listaImgs.set(imgs);
  }
  pintarTipos();
  cambios = false;
  pintarVista();
  openPopup('home-editor-popup');
  setTimeout(() => { const pc = document.querySelector('#home-editor-popup .popup-content'); if (pc) pc.scrollTop = 0; }, 50);
}

window.homeEdPlantilla = (k) => {
  const p = PLANTILLAS[k];
  if (!p) return;
  if (cambios && !confirm('¿Reemplazar lo que llevas por la plantilla?')) return;
  const { id, pos } = ed;
  abrir(id, pos, p[2]());
  cambios = true;
  pintarVista();
  toast(`Plantilla "${p[1]}" lista. Cambia los textos y guarda.`, 'sparkle');
};

window.homeNuevoBloque = (pos, plantilla) => {
  if (!isAdmin()) return;
  // Por defecto, justo debajo de la portada
  if (typeof pos !== 'number') {
    const order = H.computeOrder();
    const hero = order.indexOf('sys_hero');
    pos = hero >= 0 ? hero + 1 : 0;
  }
  abrir(null, pos, plantilla && PLANTILLAS[plantilla] ? PLANTILLAS[plantilla][2]() : null);
  if (plantilla) cambios = true;
};
window.homeEditar = (key) => {
  if (!isAdmin()) return;
  const b = (H.data().blocks || {})[key];
  if (b) abrir(key, null, b);
};
window.homeCerrarEditor = () => {
  if (cambios && !confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) return;
  cambios = false;
  closePopup('home-editor-popup');
};

window.homeGuardarBloque = async (oculto) => {
  if (!isAdmin()) return;
  if (oculto === true) $('he-visible').checked = false;
  const b = leer();
  // Revisiones según el tipo
  const malos = [...listaLinks.invalidas(), ...(aplica('he-date') ? listaAfter.invalidas() : [])];
  if (malos.length) return toast(`Revisa el botón "${malos[0].label || 'sin texto'}": su enlace no es válido.`, 'alert');
  const sinTexto = [...b.links, ...((b.after || {}).links || [])].find(l => !l.label);
  if (sinTexto) return toast('Hay un botón sin texto. Escríbele qué dice.', 'alert');
  const malImg = listaImgs.invalidas()[0];
  if (aplica('he-images') && malImg) return toast(`Imagen inválida: "${malImg.url}". Debe empezar con https:// o assets/`, 'alert');
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
  const ok = await guardar(upd, !$('he-visible').checked ? 'Guardado oculto: solo tú lo ves en el modo edición.' : ed.id ? 'Cambios guardados.' : '¡Listo! Ya aparece en el Inicio.');
  btn.disabled = false;
  if (!ok) return;
  cambios = false;
  closePopup('home-editor-popup');
  log(`${ed.id ? 'Editó' : 'Agregó'} en el Inicio: ${H.TYPES[b.type][1]} "${b.title || nombreDe(id)}"`, id);
};

// ==========================================
// PESTAÑA "INICIO" DEL PANEL
// ==========================================
function estadoDe(key) {
  const b = (H.data().blocks || {})[key];
  const why = H.whyHidden(key, b);
  if (why === 'Oculto') return A.pill('Oculto', '#8a7f99');
  if (why) return A.pill(why, 'var(--warn)');
  const f = b && H.fechaLanzamiento(b);
  if (f && f > Date.now()) return A.pill(`🚀 ${FNF.fmtDateTime(f)}`, 'var(--accent)');
  if (f) return A.pill('🎉 Lanzado', 'var(--ok)');
  return A.pill('Visible', 'var(--ok)');
}

A.TAB.inicio = {
  shell: () => `
    <div class="adm-toolbar">
      <p>Todo lo que se ve en el Inicio, en el mismo orden. Muévelo, ocúltalo o edítalo desde aquí.</p>
      ${A.btn('eye', 'Ver en la página', 'homeIrEditar()', 'btn-soft')}
      ${A.btn('plus', 'Nuevo bloque', 'homeNuevoBloque()', 'btn')}
    </div>
    <div class="card glass">
      <h3>${fi('sparkle', 20)} Empezar con una plantilla</h3>
      <div class="he-tpls">${plantillasHTML('adminInicioPlantilla')}</div>
    </div>
    <p class="adm-count" id="ai-count"></p>
    <div id="ai-list" class="list"></div>
    <div class="adm-actions" style="margin-top:12px">${A.btn('refresh', 'Volver al orden original', 'homeRestaurarOrden()')}</div>`,
  list() {
    const el = $('ai-list');
    if (!el) return;
    const order = H.computeOrder();
    const blocks = H.data().blocks || {};
    $('ai-count').textContent = `${order.length} partes · ${Object.keys(blocks).length} bloques tuyos`;
    el.innerHTML = order.map((key, i) => {
      const b = blocks[key];
      const k = esc(key);
      const tipo = b ? H.TYPES[b.type] || H.TYPES.aviso : null;
      const emoji = b ? (b.emoji || tipo[0]) : H.SYS[key][0];
      const oculto = !!(H.data().hidden || {})[key];
      return `
      <article class="rep-card glass ai-row${oculto ? ' is-off' : ''}">
        <div class="rep-head">
          <span class="ai-num">${i + 1}</span>
          <span class="ai-emoji">${esc(emoji)}</span>
          <div class="grow"><b>${esc(nombreDe(key))}</b><small>${b ? esc(tipo[1]) : 'Parte fija de la página'}${b && b.updatedAt ? ' · editado ' + FNF.timeAgo(b.updatedAt) : ''}</small></div>
          ${estadoDe(key)}
        </div>
        <div class="adm-actions">
          ${A.btn('up', '', `homeMover('${k}', -1)`)}
          ${A.btn('down', '', `homeMover('${k}', 1)`)}
          ${A.btn(oculto ? 'eye' : 'hide', oculto ? 'Mostrar' : 'Ocultar', `homeOcultar('${k}')`)}
          ${b ? A.btn('edit', 'Editar', `homeEditar('${k}')`, 'btn-soft') + A.btn('copy', 'Duplicar', `homeDuplicar('${k}')`) + A.btn('trash', 'Borrar', `homeBorrar('${k}')`, 'btn-danger') : ''}
        </div>
      </article>`;
    }).join('');
  }
};
window.adminInicioPlantilla = (k) => window.homeNuevoBloque(undefined, k);
}).catch(err => console.error(err));
