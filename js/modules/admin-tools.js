// Panel de admin — Herramientas: respaldo, revisor de links, moderación y registro de actividad.
window.fbReady.then((FB) => {
const { db, ref, get, set, remove } = FB;
const { esc, fi, toast, timeAgo, fmtDateTime, dayKey, downloadJSON, store } = FNF;
const A = window.ADMIN;
const live = A.live;

Object.assign(A.ui, { tool: 'respaldo', logFilter: 'todos', logQuery: '' });
const SUBS = [
  ['respaldo', 'Respaldo', 'database'],
  ['links', 'Revisar links', 'link'],
  ['moderacion', 'Moderación', 'filter'],
  ['actividad', 'Actividad', 'history']
];

// Todo lo que se guarda en Firebase (para el respaldo)
const NODOS = ['usuarios', 'mod_comments', 'mod_requests', 'likes', 'likes_registry', 'downloads', 'downloads_week', 'downloads_day',
  'ratings', 'notificaciones', 'notifications', 'site_config', 'mods_custom', 'apks_custom', 'scripts_custom', 'broken_links',
  'support_tickets', 'verified_users', 'banned_users', 'pinned_mods', 'new_mods_status', 'updates_led', 'scripts_recomendados',
  'last_comment_time', 'user_notifications', 'request_cooldown', 'ticket_cooldown', 'comment_cooldown', 'admin_log', 'comments', 'reports', 'dev_progress',
  'broken_reports', 'dl_last'];

let checker = { running: false, results: null, done: 0, total: 0 };

const PANELS = {
  respaldo() {
    const ultimo = store.get('fnf_last_backup');
    return `<div class="card glass">
      <div class="av-head"><span class="av-icon">${fi('database', 34)}</span>
        <div class="grow"><h3>Respaldo de la base de datos</h3><p>Descarga en un archivo todo lo que hay en Firebase: usuarios, comentarios, mods del panel, estadísticas…</p></div>
        ${ultimo ? A.pill(timeAgo(ultimo), 'var(--ok)') : A.pill('Nunca', 'var(--warn)')}</div>
      <div class="status-list">
        <div class="status-row">${fi('calendar', 20)}<span class="grow">Último respaldo desde este celular</span><small>${ultimo ? fmtDateTime(ultimo) : '—'}</small></div>
        <div class="status-row">${fi('box', 20)}<span class="grow">Secciones que se guardan</span><small>${NODOS.length}</small></div>
      </div>
      <div class="adm-actions" style="margin-top:12px">${A.btn('download', 'Descargar respaldo completo', 'adminRespaldo()', 'btn')}</div>
      <p id="backup-result" class="tg-result" hidden></p>
      ${A.note('guarda el archivo en tu PC o en Drive. Para restaurar algo: consola de Firebase → Realtime Database → ⋮ → "Importar JSON" (ojo: reemplaza lo que haya en esa sección). Recomendado: un respaldo por semana.')}
    </div>`;
  },

  links() {
    const url = ((live().config || {}).telegram || {}).url;
    return `<div class="card glass">
      <div class="av-head"><span class="av-icon">${fi('link', 34)}</span>
        <div class="grow"><h3>Revisor de links de descarga</h3><p>Revisa todos los enlaces de mods, bases y scripts y te dice cuáles parecen caídos.</p></div>
        ${url ? A.pill('Listo', 'var(--ok)') : A.pill('Falta el Worker', 'var(--warn)')}</div>
      ${url ? '' : `<p class="tg-result bad">Necesita el Worker de Cloudflare. Configúralo en Avisos → Telegram (es el mismo).</p>`}
      <div class="adm-actions" style="margin-top:10px">${A.btn('search', checker.running ? 'Revisando…' : 'Revisar todos los enlaces', 'adminRevisarLinks()', 'btn')}</div>
      <div id="lk-progress"></div>
      <div id="lk-results"></div>
      ${A.note('MediaFire y Google Drive a veces bloquean estas revisiones; esos enlaces salen como "no se pudo verificar", revísalos a mano. Los marcados como caídos sí fallaron.')}
    </div>`;
  },

  moderacion() {
    const mod = (live().config || {}).moderation || {};
    const words = mod.badWords || [];
    return `<div class="card glass">
      <div class="av-head"><span class="av-icon">${fi('filter', 34)}</span>
        <div class="grow"><h3>Filtro de groserías y spam</h3><p>Los comentarios con estas palabras no se publican.</p></div>
        ${A.pill(`${words.length} palabras`, 'var(--accent)')}</div>
      <div class="stack">
        <label class="label" for="mod-words">Palabras bloqueadas (una por línea o separadas por coma)</label>
        <textarea id="mod-words" class="field" style="min-height:140px" placeholder="palabra1&#10;palabra2">${esc(words.join('\n'))}</textarea>
        ${A.btn('check', 'Guardar lista', 'adminGuardarModeracion()', 'btn')}
        <label class="label" for="mod-test">Probar un texto</label>
        <div class="adm-row"><input id="mod-test" class="field" placeholder="Escribe un comentario de prueba" oninput="adminProbarModeracion()"></div>
        <p id="mod-test-result" class="tg-result" hidden></p>
        <div class="status-list">
          <div class="status-row">${fi('clock', 20)}<span class="grow">Límite de comentarios</span><small>1 cada 15 segundos por usuario</small></div>
          <div class="status-row">${fi('ban', 20)}<span class="grow">Usuarios baneados</span><small>no pueden comentar, pedir ni reportar</small></div>
        </div>
        ${A.note('no importa si escriben con mayúsculas, acentos, letras repetidas o números en lugar de letras (ej. "p3nd3jo"). El límite de 15 segundos lo aplica Firebase y no se puede saltar.')}
      </div>
    </div>`;
  },

  actividad() {
    return `<div class="card glass">
      <div class="av-head"><span class="av-icon">${fi('history', 34)}</span>
        <div class="grow"><h3>Registro de actividad</h3><p>Todo lo que haces como admin queda anotado con fecha y hora.</p></div>
        ${A.btn('refresh', 'Actualizar', 'adminRecargarRegistro()', 'btn-soft')}</div>
      <div class="adm-toolbar">
        <div class="search glass" style="flex:1 1 200px;margin:0">${fi('search', 18)}<input type="search" placeholder="Buscar en el registro..." value="${esc(A.ui.logQuery)}" oninput="adminBuscarRegistro(this.value)"></div>
      </div>
      <div class="chips" id="log-chips"></div>
      <div id="log-list" class="list"><p class="empty">Cargando…</p></div>
      <div class="adm-actions" style="margin-top:12px">${A.btn('trash', 'Borrar el registro', 'adminBorrarRegistro()', 'btn-danger')}</div>
      ${A.note('se muestran las últimas 150 acciones. Sirve para recordar qué cambiaste, a quién baneaste o qué borraste y cuándo.')}
    </div>`;
  }
};

const LOG_GROUPS = [
  ['todos', 'Todo', 'history', () => true],
  ['usuarios', 'Usuarios', 'users', a => /^(ban|unban|verify|account)/.test(a)],
  ['contenido', 'Contenido', 'box', a => /^(content|link)/.test(a)],
  ['comentarios', 'Comentarios', 'chat', a => /^comment/.test(a)],
  ['avisos', 'Avisos', 'bell', a => /^notice/.test(a)],
  ['reportes', 'Reportes', 'support', a => /^(ticket|request)/.test(a)],
  ['ajustes', 'Ajustes', 'settings', a => /^(config|backup)/.test(a)]
];

A.TAB.herramientas = {
  shell: () => `
    <div class="chips sub-chips">
      ${SUBS.map(([k, label, ic]) => `<button class="chip${A.ui.tool === k ? ' active' : ''}" onclick="adminIrHerramientas('${k}')">${fi(ic, 16)} ${label}</button>`).join('')}
    </div>
    <div id="tool-panel">${PANELS[A.ui.tool]()}</div>`,
  async list() {
    if (A.ui.tool === 'links') pintarLinks();
    if (A.ui.tool !== 'actividad') return;
    const log = await A.loadLog();
    if (!A.visible('herramientas') || A.ui.tool !== 'actividad') return;
    const counts = Object.fromEntries(LOG_GROUPS.map(([k, , , f]) => [k, log.filter(l => f(String(l.action))).length]));
    document.getElementById('log-chips').innerHTML = LOG_GROUPS.map(([k, label, ic]) =>
      `<button class="chip${A.ui.logFilter === k ? ' active' : ''}" onclick="adminFiltrarRegistro('${k}')">${fi(ic, 16)} ${label} <span class="chip-n">${counts[k]}</span></button>`).join('');
    const f = (LOG_GROUPS.find(g => g[0] === A.ui.logFilter) || LOG_GROUPS[0])[3];
    const q = A.ui.logQuery.trim().toLowerCase();
    const shown = log.filter(l => f(String(l.action)) && (!q || String(l.detail).toLowerCase().includes(q)));
    document.getElementById('log-list').innerHTML = shown.map(l => `
      <div class="list-item mini">${fi(A.logIcon(l.action), 24)}
        <div class="grow"><h4>${esc(l.detail || l.action)}</h4><p>${fmtDateTime(l.ts)} · ${timeAgo(l.ts)}</p></div>
        ${l.target && (A.userOf(l.target) || FNF.itemOf(l.target)) ? A.btn('eye', 'Ver', A.userOf(l.target) ? `adminVerUsuario('${esc(l.target)}')` : `openItemById('${esc(l.target)}')`) : ''}
      </div>`).join('') || `<div class="empty-state">${fi('history', 48)}<p>Nada por aquí todavía.</p></div>`;
  }
};

window.adminIrHerramientas = (sub) => {
  A.ui.tool = sub;
  if (window.currentSection && window.currentSection() !== 'admin') window.selectSection('admin');
  window.renderAdminTab('herramientas');
};

// ---- Respaldo ----
window.adminRespaldo = async () => {
  const out = document.getElementById('backup-result');
  out.hidden = false; out.className = 'tg-result ok'; out.textContent = 'Juntando datos…';
  const res = await Promise.allSettled(NODOS.map(n => get(ref(db, n)).then(s => [n, s.val()])));
  const data = {};
  const fallaron = [];
  res.forEach((r, i) => { if (r.status === 'fulfilled') data[r.value[0]] = r.value[1]; else fallaron.push(NODOS[i]); });
  const nombre = `respaldo-fnf-ports-${dayKey()}.json`;
  downloadJSON(nombre, { creado: new Date().toISOString(), version: window.APP_VERSION, secciones: data });
  store.set('fnf_last_backup', String(Date.now()));
  A.log('backup', `Descargó un respaldo (${NODOS.length - fallaron.length} secciones)`);
  out.textContent = `Listo: se descargó "${nombre}".` + (fallaron.length ? ` No se pudieron leer: ${fallaron.join(', ')} (publica las reglas nuevas).` : '');
  out.className = 'tg-result ' + (fallaron.length ? 'bad' : 'ok');
};

// ---- Revisor de links ----
function todosLosLinks() {
  const out = [];
  Object.entries(FNF.KINDS).forEach(([kind, k]) => {
    Object.entries(window[k.data] || {}).forEach(([id, d]) => {
      (d.downloads || []).forEach(dl => { if (/^https?:\/\//i.test(dl.link || '')) out.push({ id, kind, name: dl.name, url: dl.link }); });
    });
  });
  return out;
}

function pintarLinks() {
  const prog = document.getElementById('lk-progress');
  const box = document.getElementById('lk-results');
  if (!prog || !box) return;
  if (checker.running) {
    const pct = checker.total ? Math.round(checker.done / checker.total * 100) : 0;
    prog.innerHTML = `<div class="progress" style="margin:12px 0 4px"><div style="width:${pct}%"></div></div><p class="adm-count">${checker.done} de ${checker.total} enlaces revisados…</p>`;
  } else prog.innerHTML = '';
  const r = checker.results;
  if (!r) { box.innerHTML = ''; return; }
  const caidos = r.filter(x => x.estado === 'caido');
  const dudosos = r.filter(x => x.estado === 'dudoso');
  const ok = r.filter(x => x.estado === 'ok');
  const fila = (x) => `
    <div class="list-item adm-item">
      <img src="${esc(A.itemThumb(x.id))}" alt="" loading="lazy">
      <div class="grow"><h4>${esc(A.allTitle(x.id))}</h4><p>${esc(x.name)} · ${esc(x.motivo || '')}</p></div>
      <div class="adm-actions">
        ${A.btn('link', 'Abrir', `window.open(${esc(JSON.stringify(x.url))}, '_blank')`)}
        ${A.btn('edit', 'Editar', `abrirEditorMod('${esc(x.id)}', '${x.kind}')`, 'btn-soft')}
        ${x.estado === 'caido' && !(live().broken || {})[x.id] ? A.btn('ban', 'Bloquear descarga', `adminMarcarCaido('${esc(x.id)}')`) : ''}
      </div>
    </div>`;
  box.innerHTML = `
    <div class="user-stats" style="margin:12px 0">
      <span>${fi('check', 16)} <b>${ok.length}</b> funcionan</span>
      <span>${fi('alert', 16)} <b>${caidos.length}</b> caídos</span>
      <span>${fi('help', 16)} <b>${dudosos.length}</b> sin verificar</span>
    </div>
    ${caidos.length ? `<h4 class="label">Caídos</h4><div class="list">${caidos.map(fila).join('')}</div>` : `<p class="tg-result ok">Ningún enlace caído. ¡Excelente!</p>`}
    ${dudosos.length ? `<details class="pf-section" style="margin-top:12px"><summary>${fi('help', 18)} <span>No se pudieron verificar (${dudosos.length})</span></summary><div class="list" style="margin-top:10px">${dudosos.map(fila).join('')}</div></details>` : ''}`;
}

window.adminRevisarLinks = async () => {
  const url = ((live().config || {}).telegram || {}).url;
  if (!url) return toast('Primero configura el Worker en Avisos → Telegram.', 'alert');
  if (checker.running) return;
  const links = todosLosLinks();
  checker = { running: true, results: [], done: 0, total: links.length };
  pintarLinks();
  for (let i = 0; i < links.length; i += 15) {
    const lote = links.slice(i, i + 15);
    let data = null;
    try {
      const token = await window.tokenSesion();
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ check: lote.map(l => l.url), token }) });
      data = await res.json();
    } catch (err) { data = null; }
    if (!data || !Array.isArray(data.results)) {
      checker.running = false;
      pintarLinks();
      if (data && data.error) return toast(`El Worker respondió: ${data.error}`, 'alert');
      return toast('Tu Worker no tiene el revisor de links. Pega el nuevo tools/telegram-worker.js en Cloudflare.', 'alert');
    }
    lote.forEach((l, j) => {
      const r = data.results[j] || {};
      checker.results.push({ ...l, estado: r.estado || 'dudoso', motivo: r.motivo || '' });
    });
    checker.done = Math.min(links.length, i + lote.length);
    if (A.visible('herramientas') && A.ui.tool === 'links') pintarLinks();
  }
  checker.running = false;
  const caidos = checker.results.filter(x => x.estado === 'caido').length;
  A.log('link:check', `Revisó ${links.length} enlaces: ${caidos} caídos`);
  toast(`Revisión terminada: ${caidos} enlace(s) caído(s).`, caidos ? 'alert' : 'check');
  if (A.visible('herramientas')) window.renderAdminTab('herramientas');
};

// ---- Moderación ----
window.adminGuardarModeracion = async () => {
  const words = [...new Set(document.getElementById('mod-words').value.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean))].slice(0, 500);
  await set(ref(db, 'site_config/moderation'), { badWords: words, updatedAt: Date.now() });
  A.log('config:moderation', `Guardó la lista de palabras bloqueadas (${words.length})`);
  toast(`Lista guardada (${words.length} palabras).`, 'filter');
  setTimeout(() => window.renderAdminTab('herramientas'), 300);
};
window.adminProbarModeracion = () => {
  const txt = document.getElementById('mod-test').value;
  const out = document.getElementById('mod-test-result');
  if (!txt.trim()) { out.hidden = true; return; }
  // Prueba con la lista que está escrita (aunque no se haya guardado)
  const backup = (live().config || {}).moderation;
  const cfg = live().config || (live().config = {});
  cfg.moderation = { badWords: document.getElementById('mod-words').value.split(/[\n,]+/).map(w => w.trim()).filter(Boolean) };
  const bloqueado = FNF.tieneGroserias ? FNF.tieneGroserias(txt) : false;
  cfg.moderation = backup;
  out.hidden = false;
  out.className = 'tg-result ' + (bloqueado ? 'bad' : 'ok');
  out.textContent = bloqueado ? 'Este comentario SE BLOQUEARÍA.' : 'Este comentario se publicaría.';
};

// ---- Registro ----
window.adminFiltrarRegistro = (f) => { A.ui.logFilter = f; A.TAB.herramientas.list(); };
window.adminBuscarRegistro = (q) => { A.ui.logQuery = q; A.TAB.herramientas.list(); };
window.adminRecargarRegistro = async () => { await A.loadLog(true); A.TAB.herramientas.list(); };
window.adminBorrarRegistro = async () => {
  if (!confirm('¿Borrar todo el registro de actividad? No se puede deshacer.')) return;
  await remove(ref(db, 'admin_log'));
  A.cache.log = [];
  A.log('config:log', 'Borró el registro de actividad anterior');
  A.TAB.herramientas.list();
};
}).catch(err => console.error(err));
