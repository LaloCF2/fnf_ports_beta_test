// Panel de admin — Contenido (mods, bases y scripts) y el editor.
window.fbReady.then((FB) => {
const { db, ref, set, update, remove } = FB;
const { esc, fi, toast, compact, openPopup, closePopup, isAdmin } = FNF;
const A = window.ADMIN;
const live = A.live;

Object.assign(A.ui, { kind: 'mod', modQuery: '', cSort: 'recientes', cFilter: 'todos' });
const NOMBRE = { mod: 'mod', apk: 'base', script: 'script' };
const pathOf = (id) => `${FNF.KINDS[A.kindOf(id)].path}/${id}`;

// Datos combinados (archivo data + cambios del panel) de un elemento
// (si los datos en vivo todavía no llegan, se usa la copia guardada en el celular)
const fullItem = (kind, id) => {
  const custom = A.customOf(kind)[id];
  if (!custom && !A.baseOf(kind)[id] && FNF.itemOf(id)) return { ...FNF.itemOf(id) };
  return { ...(A.baseOf(kind)[id] || {}), ...(custom || {}) };
};

A.TAB.contenido = {
  shell: () => {
    const counts = Object.fromEntries(Object.keys(FNF.KINDS).map(k => [k, new Set([...Object.keys(A.baseOf(k)), ...Object.keys(A.customOf(k))]).size]));
    return `
    <div class="chips">
      ${Object.entries(FNF.KINDS).map(([k, v]) => `<button class="chip${A.ui.kind === k ? ' active' : ''}" onclick="adminElegirTipo('${k}')">${fi({ mod: 'gamepad', apk: 'box', script: 'code' }[k], 16)} ${v.label} <span class="chip-n">${counts[k]}</span></button>`).join('')}
    </div>
    <div class="adm-toolbar">
      <div class="search glass" style="flex:1 1 200px;margin:0">${fi('search', 18)}<input type="search" placeholder="Buscar..." value="${esc(A.ui.modQuery)}" oninput="adminBuscarMods(this.value)"></div>
      <select class="field adm-select" onchange="adminOrdenarContenido(this.value)">
        ${[['recientes', 'Orden original'], ['descargas', 'Más descargados'], ['semana', 'Más esta semana'], ['valorados', 'Mejor valorados'], ['az', 'A – Z']].map(([v, l]) => `<option value="${v}" ${A.ui.cSort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      ${A.btn('plus', `Nuevo ${NOMBRE[A.ui.kind]}`, `abrirEditorMod(null, '${A.ui.kind}')`, 'btn')}
    </div>
    <div class="chips" id="ct-chips"></div>
    ${A.note('lo que crees o edites aquí se guarda en Firebase y aparece al instante para todos, sin tocar código. "Original" regresa a lo que dice el archivo data.')}
    <p class="adm-count" id="ct-count"></p>
    <div id="adm-mods" class="list"></div>`;
  },
  list() {
    const kind = A.ui.kind;
    const base = A.baseOf(kind);
    const custom = A.customOf(kind);
    const L = live();
    const ids = [...new Set([...Object.keys(custom).filter(id => !base[id]), ...Object.keys(base)])];
    const cCount = {};
    (A.cache.comments || []).forEach(c => { cCount[c.modId] = (cCount[c.modId] || 0) + 1; });
    const st = (id) => {
      const d = fullItem(kind, id);
      const r = window.ratingOf ? window.ratingOf(id) : { n: 0, avg: 0 };
      return {
        id, d, c: custom[id], r,
        dl: Number((L.downloads || {})[id]) || 0, wk: Number((L.week || {})[id]) || 0, likes: Number((L.likes || {})[id]) || 0,
        pinned: !!(L.pinned || {})[id], led: !!(L.leds || {})[id], isNew: (L.newMods || {})['card-' + id] === true, broken: (L.broken || {})[id]
      };
    };
    const rows = ids.map(st).filter(x => x.d.title);
    const F = {
      todos: () => true, fijados: x => x.pinned, nuevos: x => x.isNew, led: x => x.led, caidos: x => !!x.broken,
      ocultos: x => x.d.removed, borradores: x => x.d.draft, secretos: x => x.d.hidden, editados: x => !!x.c,
      programados: x => Number(x.d.publishAt) > Date.now()
    };
    const labels = [['todos', 'Todos', 'filter'], ['fijados', 'Fijados', 'pin'], ['nuevos', 'Nuevos', 'star'], ['led', 'Con LED', 'led'], ['caidos', 'Link caído', 'link'],
      ['programados', 'Programados', 'clock'], ['borradores', 'Borradores', 'notes'], ['ocultos', 'Ocultos', 'hide'], ['secretos', 'Secretos', 'lock'], ['editados', 'Editados en panel', 'edit']];
    document.getElementById('ct-chips').innerHTML = labels.map(([k, label, ic]) => {
      const n = rows.filter(F[k]).length;
      return (k === 'todos' || n) ? `<button class="chip${A.ui.cFilter === k ? ' active' : ''}" onclick="adminFiltrarContenido('${k}')">${fi(ic, 16)} ${label} <span class="chip-n">${n}</span></button>` : '';
    }).join('');

    const q = A.ui.modQuery.trim().toLowerCase();
    let shown = rows.filter(F[A.ui.cFilter] || F.todos).filter(x => !q || `${x.d.title} ${x.id} ${x.d.creator || ''}`.toLowerCase().includes(q));
    const sorts = {
      recientes: null, descargas: (a, b) => b.dl - a.dl, semana: (a, b) => b.wk - a.wk,
      valorados: (a, b) => b.r.avg - a.r.avg || b.r.n - a.r.n, az: (a, b) => a.d.title.localeCompare(b.d.title)
    };
    if (sorts[A.ui.cSort]) shown = shown.sort(sorts[A.ui.cSort]);
    document.getElementById('ct-count').textContent = `${shown.length} de ${rows.length} ${FNF.KINDS[kind].label.toLowerCase()}`;

    document.getElementById('adm-mods').innerHTML = shown.map(x => {
      const { id, d, c } = x;
      const sid = esc(id);
      const estado = [
        !base[id] ? A.pill('Creado en el panel', 'var(--accent)') : '',
        base[id] && c && !c.removed ? A.pill('Editado', '#3d8bff') : '',
        d.draft ? A.pill('Borrador', '#8a7f99') : '',
        Number(d.publishAt) > Date.now() ? A.pill(`⏰ Se publica ${FNF.fmtDateTime(d.publishAt)}`, 'var(--warn)') : '',
        d.removed ? A.pill('Oculto', '#777') : '',
        d.hidden ? A.pill('Secreto', '#2c2347') : '',
        x.broken ? A.pill('Link caído', 'var(--danger)') : '',
        x.pinned ? A.pill('Fijado', 'var(--warn)') : '',
        x.isNew ? A.pill('Nuevo', 'var(--accent)') : '',
        x.led ? A.pill('Actualizado', 'var(--ok)') : ''
      ].join(' ');
      return `
      <article class="rep-card glass content-card" style="--rep:${x.broken ? 'var(--danger)' : d.removed || d.draft ? '#8a7f99' : 'var(--accent)'};${d.removed ? 'opacity:.7' : ''}">
        <div class="rep-head">
          <img class="ct-thumb" src="${esc(d.img || (d.images || [])[0] || '')}" alt="" loading="lazy">
          <div class="grow"><b>${esc(d.title)}</b><small>${sid}${d.creator ? ' · por ' + esc(d.creator) : ''}${FNF.langTag(d) ? ' · ' + esc(FNF.langTag(d)) : ''}</small></div>
        </div>
        ${estado.trim() ? `<div class="ct-tags">${estado}</div>` : ''}
        <div class="user-stats">
          <span>${fi('download', 16)} <b>${compact(x.dl)}</b> descargas</span>
          <span>${fi('bolt', 16)} <b>${x.wk}</b> esta semana</span>
          <span>${fi('like', 16)} <b>${x.likes}</b> likes</span>
          <span>${fi('star', 16)} <b>${x.r.n ? x.r.avg.toFixed(1) : '—'}</b> (${x.r.n})</span>
          <span>${fi('chat', 16)} <b>${cCount[id] || 0}</b> comentarios</span>
        </div>
        <div class="adm-actions">
          ${d.removed ? '' : A.btn('eye', 'Ver', `openItemById('${sid}')`)}
          ${A.btn('edit', 'Editar', `abrirEditorMod('${sid}', '${kind}')`, 'btn-soft')}
          ${A.btn('copy', 'Duplicar', `adminDuplicarItem('${sid}')`)}
          ${A.btn('pin', x.pinned ? 'Desfijar' : 'Fijar', `toggleModPin('${sid}')`)}
          ${A.btn('led', x.led ? 'Quitar LED' : 'Marcar actualizado', `toggleGreenLed('${sid}')`)}
          ${A.btn('star', x.isNew ? 'Quitar NUEVO' : 'Marcar NUEVO', `toggleNewMod('card-${sid}', true)`)}
          ${x.broken ? A.btn('check', 'Reparar link', `fixBrokenLink('${sid}', true)`) : A.btn('ban', 'Bloquear descarga', `adminMarcarCaido('${sid}')`)}
          ${A.btn('bell', 'Avisar', `adminNotificarItem('${sid}')`)}
          ${A.btn('link', d.hidden ? 'Enlace secreto' : 'Copiar enlace', `adminCopiarEnlace('${sid}')`)}
          ${A.btn(d.removed ? 'eye' : 'hide', d.removed ? 'Mostrar' : 'Ocultar', `adminOcultarItem('${sid}', ${!d.removed})`)}
          ${base[id] && c && !(Object.keys(c).length === 1 && c.removed) ? A.btn('refresh', 'Original', `adminRestaurarItem('${sid}')`) : ''}
          ${!base[id] ? A.btn('trash', 'Borrar', `adminBorrarItem('${sid}')`, 'btn-danger') : ''}
        </div>
      </article>`;
    }).join('') || `<div class="empty-state">${fi('box', 48)}<p>Sin resultados.</p></div>`;
    if (!A.cache.comments) A.loadComments().then(() => { if (A.visible('contenido')) A.TAB.contenido.list(); });
  }
};

window.adminBuscarMods = (q) => { A.ui.modQuery = q; A.TAB.contenido.list(); };
// Abre Contenido mostrando solo ese elemento
window.adminVerContenido = (id) => {
  if (window.currentSection && window.currentSection() !== 'admin') window.selectSection('admin');
  A.ui.kind = A.kindOf(id); A.ui.modQuery = id; A.ui.cFilter = 'todos';
  window.renderAdminTab('contenido');
};
window.adminElegirTipo = (kind) => { A.ui.kind = kind; A.ui.modQuery = ''; A.ui.cFilter = 'todos'; window.renderAdminTab('contenido'); };
window.adminOrdenarContenido = (s) => { A.ui.cSort = s; A.TAB.contenido.list(); };
window.adminFiltrarContenido = (f) => { A.ui.cFilter = f; A.TAB.contenido.list(); };

window.adminOcultarItem = async (id, hide) => {
  if (!isAdmin()) return;
  const kind = A.kindOf(id);
  if (hide && !confirm(`¿Ocultar "${A.allTitle(id)}"? Los usuarios dejarán de verlo (puedes mostrarlo otra vez desde Panel → Contenido).`)) return;
  const c = A.customOf(kind)[id];
  if (!hide && A.baseOf(kind)[id] && c && Object.keys(c).length === 1) await remove(ref(db, pathOf(id)));
  else await update(ref(db, pathOf(id)), { removed: hide ? true : null });
  if (hide && window.closeDetail) window.closeDetail();
  A.log('content:hide', `${hide ? 'Ocultó' : 'Volvió a mostrar'} "${A.allTitle(id)}"`, id);
  toast(hide ? 'Oculto para los usuarios.' : 'Visible otra vez.', hide ? 'hide' : 'eye');
};
// Cambia con un toque un campo de sí/no del mod (Borrador, Secreto) desde el popup
window.adminCampoItem = async (id, campo) => {
  if (!isAdmin()) return;
  const d = FNF.itemOf(id) || {};
  const nuevo = !d[campo];
  try {
    await update(ref(db, pathOf(id)), { [campo]: nuevo || null, updatedAt: Date.now() });
    const nombres = { draft: ['Ahora es borrador (solo tú lo ves).', 'Publicado: ya lo ven todos.'], hidden: ['Ahora es secreto (solo con el enlace).', 'Ya es visible para todos.'] };
    toast((nombres[campo] || ['Activado.', 'Desactivado.'])[nuevo ? 0 : 1], 'check');
    A.log('content:save', `${nuevo ? 'Activó' : 'Quitó'} "${campo === 'draft' ? 'borrador' : campo === 'hidden' ? 'secreto' : campo}" en "${A.allTitle(id)}"`, id);
    setTimeout(() => { if (window.refreshDetailAdmin) window.refreshDetailAdmin(); }, 300);
  } catch (err) {
    toast('No se pudo guardar. ¿Tienes la sesión de admin abierta?', 'alert');
  }
};

// Abre el editor directo en una parte (Pestañas, Imágenes, Descargas, Publicar...)
window.abrirEditorEn = (id, kind, seccion) => {
  window.abrirEditorMod(id, kind);
  if (!seccion) return;
  setTimeout(() => {
    const el = document.getElementById(seccion);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('ed-flash'); setTimeout(() => el.classList.remove('ed-flash'), 1600); }
  }, 450);
};

window.adminRestaurarItem = async (id) => {
  if (!confirm('¿Volver a la versión original del archivo data? Se pierden los cambios hechos en el panel.')) return;
  await remove(ref(db, pathOf(id)));
  A.log('content:restore', `Restauró "${A.allTitle(id)}" a su versión original`, id);
};
window.adminBorrarItem = async (id) => {
  if (!confirm(`¿Borrar "${A.allTitle(id)}" para siempre?`)) return;
  const title = A.allTitle(id);
  await remove(ref(db, pathOf(id)));
  A.log('content:delete', `Borró "${title}"`, id);
};
// Nombres anteriores
window.adminOcultarMod = window.adminOcultarItem;
window.adminRestaurarMod = window.adminRestaurarItem;
window.adminBorrarMod = window.adminBorrarItem;

// ==========================================
// EDITOR (mods, bases y scripts)
// ==========================================
let editingId = null;
let editingKind = 'mod';
let duplicando = null;
let cambios = false;           // hay algo sin guardar
let listaImgs = null;          // filas de imágenes (admin-forms.js)
let listaDls = null;           // filas de descargas
let pestanas = null;           // editor de pestañas del popup
let tipoNota = 'warn';

// ---- ID personalizado (sale en el enlace para compartir) ----
// Las bases deben empezar con "apk" y los scripts con "script" (así sabe la página qué es cada cosa)
function idFinal(kind, raw) {
  let s = String(raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  if (!s) return '';
  if (kind === 'apk' && !s.startsWith('apk')) s = 'apk-' + s;
  if (kind === 'script' && !s.startsWith('script')) s = 'script-' + s;
  if (kind === 'mod' && (s.startsWith('apk') || s.startsWith('script'))) s = 'mod-' + s;
  return s.slice(0, 40);
}
const idOcupado = (id) => !!(FNF.itemOf(id) || Object.keys(FNF.KINDS).some(k => A.baseOf(k)[id] || A.customOf(k)[id]));
function revisarId() {
  const raw = val('ed-id');
  const id = idFinal(editingKind, raw);
  const msg = $('ed-id-msg');
  if (!raw) { msg.textContent = 'Solo letras, números, - y _. Si lo dejas vacío se crea uno solo.'; msg.className = 'ed-hint'; return true; }
  if (idOcupado(id)) { msg.textContent = `❌ "${id}" ya existe. Prueba con otro.`; msg.className = 'ed-hint bad'; return false; }
  msg.textContent = `✅ Quedará así: ?share=${id}`;
  msg.className = 'ed-hint ok';
  return true;
}
window.edIdDesdeTitulo = () => { $('ed-id').value = idFinal(editingKind, val('ed-title')); revisarId(); avisarCambio(); };
window.edCopiarId = () => FNF.copyText(editingId, 'ID copiado.');
window.edCopiarEnlace = () => {
  const d = FNF.itemOf(editingId) || {};
  FNF.copyText(`${location.origin}${location.pathname}?${d.hidden ? 'unlock' : 'share'}=${editingId}`, 'Enlace copiado.');
};
let previewTimer = null;
const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();
const toInput = (ts) => ts ? new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
const fromInput = (s) => { const n = s ? new Date(s).getTime() : NaN; return isNaN(n) ? null : n; };
const tagsDe = (s) => [...new Set(String(s || '').split(',').map(x => x.trim()).filter(Boolean))].slice(0, 4).map(x => x.slice(0, 24));

// El formulario como un mod (sirve para guardar y para la vista previa)
function leerFormulario() {
  const imgs = listaImgs ? listaImgs.get().map(r => r.url) : [];
  const isMod = editingKind === 'mod';
  const tags = tagsDe(val('ed-tags'));
  return {
    title: val('ed-title'), img: imgs[0] || '', desc: val('ed-desc'), version: val('ed-version'),
    gama: isMod ? $('ed-gama').value : null,
    engine: isMod ? val('ed-engine') : null, ram: isMod ? val('ed-ram') : null, size: isMod ? val('ed-size') : null,
    creator: val('ed-creator') || null, creatorLink: val('ed-creator-link') || null,
    // "Qué cambió" ahora es la pestaña Cambios (el campo viejo se borra al guardar)
    changelog: null, lang: $('ed-lang').value || null,
    tabs: pestanas && pestanas.get().length ? pestanas.get() : null,
    // La galería del popup: portada + capturas
    images: imgs.length > 1 || (editingKind === 'script' && imgs.length) ? imgs : null,
    downloads: listaDls ? listaDls.get().filter(r => r.link).map(r => ({ name: r.name || 'Descarga', link: r.link })) : [],
    tags: tags.length ? tags : null,
    trailer: val('ed-trailer') || null,
    note: val('ed-note') || null, noteType: val('ed-note') ? tipoNota : null,
    publishAt: fromInput(val('ed-publish-at')),
    hidden: $('ed-hidden').checked || null, draft: $('ed-draft').checked || null
  };
}

// Vista previa de la tarjeta + contadores + estado (se actualiza mientras escribes)
function pintarVistaPrevia() {
  const d = leerFormulario();
  $('ed-card-preview').innerHTML = FNF.cardFor(editingKind, 'preview', { ...d, title: d.title || 'Sin título' }, 0);
  $('ed-title-n').textContent = `${val('ed-title').length}/80`;
  $('ed-desc-n').textContent = `${val('ed-desc').length}/1500`;
  $('ed-tags-chips').innerHTML = (d.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join('');
  const estado = [];
  if (d.draft) estado.push('📝 Borrador (solo tú lo ves)');
  else if (d.publishAt && d.publishAt > Date.now()) estado.push(`⏰ Se publica el ${FNF.fmtDateTime(d.publishAt)}`);
  else estado.push(editingId ? '✅ Publicado' : '🆕 Se publicará al guardar');
  if (d.hidden) estado.push('🔒 Secreto');
  if (cambios) estado.push('<b>● Cambios sin guardar</b>');
  $('ed-status').innerHTML = estado.join(' · ');
}
const avisarCambio = () => {
  cambios = true;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(pintarVistaPrevia, 150);
};

// Escuchas del editor (una sola vez)
(() => {
  const pop = $('mod-editor-popup');
  pop.addEventListener('input', (e) => { if (!e.target.closest('#ed-images-list, #ed-downloads-list, #ed-tabs-list')) avisarCambio(); });
  pop.addEventListener('change', (e) => { if (!e.target.closest('#ed-images-list, #ed-downloads-list, #ed-tabs-list')) avisarCambio(); });
  $('ed-id').addEventListener('input', revisarId);
  // Atajos: llevan a cada parte del formulario
  $('ed-jump').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    const destino = b && $(b.dataset.ir);
    if (destino && !destino.hidden) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  // Tipo de nota (Info / Cuidado / Importante / Buena noticia)
  $('ed-note-type').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    tipoNota = b.dataset.v;
    $('ed-note-type').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    avisarCambio();
  });
})();

window.abrirEditorMod = (id, kind, origen) => {
  if (!isAdmin()) return;
  editingId = id || null;
  editingKind = kind || (id ? A.kindOf(id) : 'mod');
  const src = id || origen;
  const d = src ? fullItem(editingKind, src) : {};
  duplicando = origen || null;
  const nombre = { mod: 'mod', apk: 'base', script: 'script' }[editingKind];
  $('editor-title').textContent = id ? `Editar: ${d.title || id}` : origen ? `Duplicar: ${d.title}` : `Nuevo ${nombre}`;
  $('ed-mod-fields').hidden = editingKind !== 'mod';
  document.querySelector('#ed-jump [data-ir="ed-mod-fields"]').hidden = editingKind !== 'mod';

  const setV = (k, v) => { $(k).value = v || ''; };
  setV('ed-title', origen ? `${d.title} (copia)` : d.title);
  setV('ed-desc', d.desc); setV('ed-version', d.version);
  setV('ed-engine', d.engine); setV('ed-ram', d.ram); setV('ed-size', d.size);
  setV('ed-creator', d.creator); setV('ed-creator-link', d.creatorLink);
  // ID: se elige al crear; si ya existe, solo se muestra (cambiarlo rompería sus descargas y comentarios)
  $('ed-id-new').hidden = !!id;
  $('ed-id-old').hidden = !id;
  $('ed-id').value = '';
  $('ed-id-pre').textContent = '?share=';
  if (id) $('ed-id-actual').textContent = id;
  revisarId();
  // Pestañas del popup (los mods de antes con "Qué cambió" lo traen como pestaña Cambios)
  let tabs = Array.isArray(d.tabs) ? d.tabs : [];
  if (!tabs.length && d.changelog) tabs = [{ id: 'cambios', type: 'cambios', on: true, text: d.changelog }];
  if (!pestanas) pestanas = FNF.EditorPestanas($('ed-tabs-list'), tabs, avisarCambio);
  else pestanas.set(tabs);
  setV('ed-tags', (d.tags || []).join(', ')); setV('ed-trailer', d.trailer); setV('ed-note', d.note);
  $('ed-publish-at').value = origen ? '' : toInput(d.publishAt);
  $('ed-lang').value = d.lang || '';
  $('ed-gama').value = d.gama || 'low';
  $('ed-hidden').checked = !!d.hidden;
  $('ed-draft').checked = origen ? true : !!d.draft;
  tipoNota = d.noteType || 'warn';
  $('ed-note-type').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === tipoNota));
  ['ed-opt-led', 'ed-opt-bell', 'ed-opt-pin'].forEach(k => { $(k).checked = false; });
  $('ed-opt-new').checked = !id; // lo nuevo se marca como NUEVO (puedes quitarlo)

  // Imágenes y descargas: cada una en su caja
  const portada = d.img || (d.images || [])[0] || '';
  const imgs = [portada, ...(d.images || []).filter(x => x && x !== portada)].filter(Boolean).map(url => ({ url }));
  const dls = (d.downloads || []).map(x => ({ name: x.name, link: x.link }));
  if (!listaImgs) listaImgs = FNF.Filas($('ed-images-list'), 'imagen', imgs, avisarCambio, { vacio: 'Sin imágenes. Agrega al menos la portada.', max: 12 });
  else listaImgs.set(imgs);
  if (!listaDls) listaDls = FNF.Filas($('ed-downloads-list'), 'descarga', dls, avisarCambio, { vacio: 'Sin descargas todavía.', max: 10 });
  else listaDls.set(dls.length ? dls : []);
  if (!dls.length) listaDls.set([{ name: 'Descarga', link: '' }]);

  cambios = false;
  pintarVistaPrevia();
  $('ed-body').scrollTop = 0;
  openPopup('mod-editor-popup');
  setTimeout(() => { const pc = document.querySelector('#mod-editor-popup .popup-content'); if (pc) pc.scrollTop = 0; }, 50);
};
window.adminDuplicarItem = (id) => window.abrirEditorMod(null, A.kindOf(id), id);

// Cerrar: si hay cambios sin guardar, pregunta antes
window.cerrarEditorMod = () => {
  if (cambios && !confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) return;
  cambios = false;
  closePopup('mod-editor-popup');
};

// Ver el popup completo tal como lo verán los usuarios (sin guardar)
window.edVerPopup = () => {
  const d = leerFormulario();
  window.previewDetalle(editingKind, { ...d, title: d.title || 'Sin título', images: d.images || (d.img ? [d.img] : []) });
};

window.edDescargaRapida = (servidor) => listaDls.agregar({ name: `Descarga (${servidor})`, link: '' });

// Fechas rápidas para publicar
window.edFechaRapida = (cual) => {
  const d = new Date();
  if (cual === 0) { $('ed-publish-at').value = ''; avisarCambio(); return; }
  if (cual === 1) d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0);
  if (cual === 'manana') { d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); }
  if (cual === 'finde') { d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); d.setHours(12, 0, 0, 0); }
  $('ed-publish-at').value = toInput(d.getTime());
  avisarCambio();
};

window.guardarMod = async (comoBorrador) => {
  if (comoBorrador === true) $('ed-draft').checked = true;
  const d = leerFormulario();
  const malDl = listaDls.invalidas()[0];
  const malImg = listaImgs.invalidas()[0];
  if (d.title.length < 2) { $('ed-title').focus(); return toast('Ponle un título.', 'alert'); }
  if (!d.img) { $('ed-s-media').scrollIntoView({ behavior: 'smooth' }); return toast('Falta la imagen de portada.', 'alert'); }
  if (malImg) return toast(`Imagen inválida: ${malImg.url}`, 'alert');
  if (malDl) { $('ed-s-dl').scrollIntoView({ behavior: 'smooth' }); return toast(`Enlace inválido: ${malDl.link}. Debe empezar con https:// o assets/`, 'alert'); }
  if (!d.downloads.length && !d.draft) { $('ed-s-dl').scrollIntoView({ behavior: 'smooth' }); return toast('Agrega al menos un enlace de descarga (o guárdalo como borrador).', 'alert'); }
  if (d.creatorLink && !/^https?:\/\//i.test(d.creatorLink)) return toast('El enlace del creador debe empezar con https://', 'alert');
  if (d.trailer && !(FNF.home && FNF.home.ytId(d.trailer))) return toast('El tráiler debe ser un enlace de YouTube.', 'alert');
  if (d.publishAt && d.publishAt <= Date.now()) d.publishAt = null; // fecha que ya pasó = publicar ya

  const data = { ...d, updatedAt: Date.now() };
  // Revisión de las pestañas: si activaste una pero no le escribiste nada, se avisa (no se ve en el popup)
  const vacias = (d.tabs || []).filter(p => p.on && FNF.pestanaConContenido && !FNF.pestanaConContenido(p));
  if (vacias.length && !confirm(`La pestaña "${vacias[0].title || (FNF.TIPOS_PESTANA[vacias[0].type] || [, 'Extra'])[1]}" está activada pero vacía, así que no se verá. ¿Guardar de todas formas?`)) {
    $('ed-s-tabs').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  // ID: el que elegiste (si está libre) o uno automático
  if (!editingId && val('ed-id') && !revisarId()) { $('ed-id').focus(); return toast('Ese ID ya existe. Elige otro.', 'alert'); }
  const id = editingId || idFinal(editingKind, val('ed-id')) || (editingKind + Date.now().toString(36));
  if (!editingId) data.createdAt = Date.now();

  const btn = $('btn-guardar-mod');
  btn.disabled = true;
  try {
    await update(ref(db, `${FNF.KINDS[editingKind].path}/${id}`), data);
    // Opciones de "Al guardar…"
    const extras = [];
    if ($('ed-opt-new').checked) extras.push(set(ref(db, `new_mods_status/card-${id}`), true));
    if ($('ed-opt-led').checked) extras.push(set(ref(db, `updates_led/${id}`), Date.now()));
    if ($('ed-opt-pin').checked) extras.push(set(ref(db, `pinned_mods/${id}`), true));
    if ($('ed-opt-bell').checked && !d.draft) {
      const nid = 'notif_' + Date.now();
      const cuando = d.publishAt || Date.now();
      const aviso = { id: nid, modId: id, texto: editingId ? `¡${d.title} se actualizó! Toca para verlo.` : `¡${d.title} ya está disponible! Toca para verlo.`,
        fecha: new Date(cuando).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) };
      if (d.publishAt) aviso.publishAt = d.publishAt; // sale en la campana a la misma hora que se publica
      extras.push(set(ref(db, 'notificaciones/' + nid), aviso));
    }
    await Promise.all(extras);
    cambios = false;
    closePopup('mod-editor-popup');
    A.log('content:save', `${editingId ? 'Editó' : duplicando ? 'Duplicó' : 'Creó'} "${d.title}"${d.draft ? ' (borrador)' : d.publishAt ? ` (programado para ${FNF.fmtDateTime(d.publishAt)})` : ''}`, id);
    toast(d.draft ? 'Guardado como borrador (solo tú lo ves).'
      : d.publishAt ? `Programado: se publica el ${FNF.fmtDateTime(d.publishAt)}.`
        : editingId ? 'Cambios guardados.' : '¡Publicado! Ya aparece en la lista.', 'check');
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar. ¿Tienes la sesión de admin abierta?', 'alert');
  } finally {
    btn.disabled = false;
  }
};
}).catch(err => console.error(err));
