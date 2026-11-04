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
const fullItem = (kind, id) => ({ ...(A.baseOf(kind)[id] || {}), ...(A.customOf(kind)[id] || {}) });

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
      ocultos: x => x.d.removed, borradores: x => x.d.draft, secretos: x => x.d.hidden, editados: x => !!x.c
    };
    const labels = [['todos', 'Todos', 'filter'], ['fijados', 'Fijados', 'pin'], ['nuevos', 'Nuevos', 'star'], ['led', 'Con LED', 'led'], ['caidos', 'Link caído', 'link'],
      ['borradores', 'Borradores', 'notes'], ['ocultos', 'Ocultos', 'hide'], ['secretos', 'Secretos', 'lock'], ['editados', 'Editados en panel', 'edit']];
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
// EDITOR
// ==========================================
let editingId = null;
let editingKind = 'mod';
let duplicando = null;
const val = (id) => document.getElementById(id).value.trim();

window.abrirEditorMod = (id, kind, origen) => {
  if (!isAdmin()) return;
  editingId = id || null;
  editingKind = kind || (id ? A.kindOf(id) : 'mod');
  const src = id || origen;
  const d = src ? fullItem(editingKind, src) : {};
  duplicando = origen || null;
  const mainImg = d.img || (d.images || [])[0] || '';
  document.getElementById('editor-title').textContent = id ? `Editar: ${d.title || id}` : origen ? `Duplicar: ${d.title}` : `Nuevo ${NOMBRE[editingKind]}`;
  document.getElementById('ed-mod-fields').hidden = editingKind !== 'mod';
  const setV = (k, v) => { document.getElementById(k).value = v || ''; };
  setV('ed-title', origen ? `${d.title} (copia)` : d.title);
  setV('ed-img', mainImg); setV('ed-desc', d.desc); setV('ed-version', d.version);
  setV('ed-engine', d.engine); setV('ed-ram', d.ram); setV('ed-size', d.size);
  setV('ed-creator', d.creator); setV('ed-creator-link', d.creatorLink); setV('ed-changelog', d.changelog);
  document.getElementById('ed-lang').value = d.lang || '';
  document.getElementById('ed-gama').value = d.gama || 'low';
  setV('ed-images', (d.images || []).filter(x => x !== mainImg).join('\n'));
  setV('ed-downloads', (d.downloads || []).map(x => `${x.name} | ${x.link}`).join('\n'));
  document.getElementById('ed-hidden').checked = !!d.hidden;
  document.getElementById('ed-draft').checked = origen ? true : !!d.draft;
  window.previewEditorImg();
  openPopup('mod-editor-popup');
};
window.adminDuplicarItem = (id) => window.abrirEditorMod(null, A.kindOf(id), id);

window.previewEditorImg = () => {
  const img = document.getElementById('ed-preview');
  const src = val('ed-img');
  img.removeAttribute('data-fallback');
  img.hidden = !src;
  if (src) img.src = src;
};

window.guardarMod = async () => {
  const title = val('ed-title');
  const downloads = val('ed-downloads').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.lastIndexOf('|');
    return i > 0 ? { name: l.slice(0, i).trim(), link: l.slice(i + 1).trim() } : { name: 'Descarga', link: l };
  });
  const bad = downloads.find(x => !/^(https?:\/\/|assets\/)/i.test(x.link));
  const creatorLink = val('ed-creator-link');
  if (title.length < 2) return toast('Ponle un título.', 'alert');
  if (!val('ed-img')) return toast('Falta la imagen.', 'alert');
  if (!downloads.length) return toast('Agrega al menos un enlace de descarga.', 'alert');
  if (bad) return toast(`Enlace inválido: ${bad.link}`, 'alert');
  if (creatorLink && !/^https?:\/\//i.test(creatorLink)) return toast('El enlace del creador debe empezar con https://', 'alert');

  const extras = val('ed-images').split('\n').map(s => s.trim()).filter(Boolean);
  const isMod = editingKind === 'mod';
  const draft = document.getElementById('ed-draft').checked;
  const data = {
    title, img: val('ed-img'), desc: val('ed-desc'), version: val('ed-version'),
    gama: isMod ? document.getElementById('ed-gama').value : null,
    engine: isMod ? val('ed-engine') : null, ram: isMod ? val('ed-ram') : null, size: isMod ? val('ed-size') : null,
    creator: val('ed-creator') || null, creatorLink: creatorLink || null,
    changelog: val('ed-changelog') || null, lang: document.getElementById('ed-lang').value || null,
    // La galería del popup: imagen principal + capturas extra
    images: (extras.length || editingKind === 'script') ? [val('ed-img'), ...extras] : null,
    downloads, hidden: document.getElementById('ed-hidden').checked || null, draft: draft || null,
    updatedAt: Date.now()
  };
  const id = editingId || (editingKind + Date.now().toString(36));
  if (!editingId) data.createdAt = Date.now();

  const btn = document.getElementById('btn-guardar-mod');
  btn.disabled = true;
  try {
    await update(ref(db, `${FNF.KINDS[editingKind].path}/${id}`), data);
    closePopup('mod-editor-popup');
    A.log('content:save', `${editingId ? 'Editó' : duplicando ? 'Duplicó' : 'Creó'} "${title}"${draft ? ' (borrador)' : ''}`, id);
    toast(editingId ? 'Cambios guardados.' : draft ? 'Guardado como borrador (solo tú lo ves).' : '¡Publicado! Ya aparece en la lista.', 'check');
    if (!editingId && !draft && confirm('¿Marcarlo también como NUEVO?')) set(ref(db, `new_mods_status/card-${id}`), true);
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar. ¿Publicaste las reglas nuevas y tienes la sesión de admin abierta?', 'alert');
  } finally {
    btn.disabled = false;
  }
};
}).catch(err => console.error(err));
