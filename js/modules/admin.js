// Panel de admin — núcleo: pestañas, contador, registro de actividad, gráficas, Resumen y Reportes.
// Las demás pestañas están en admin-users.js, admin-content.js, admin-avisos.js y admin-tools.js.
// Solo se muestra con la sesión de Google del admin; las reglas de Firebase bloquean a cualquier otra cuenta.
window.fbReady.then((FB) => {
const { db, ref, get, set, update, remove, push, onValue, query, orderByKey, startAt, limitToLast } = FB;
const { t, esc, fi, toast, isAdmin, compact, timeAgo, fmtDateTime, stringToColor, dayKey, copyText } = FNF;
const live = () => window.live || {};

const TABS = [
  ['resumen', 'Resumen', 'code'],
  ['reportes', 'Reportes', 'warning'],
  ['comentarios', 'Comentarios', 'chat'],
  ['usuarios', 'Usuarios', 'users'],
  ['contenido', 'Contenido', 'box'],
  ['avisos', 'Avisos', 'megaphone'],
  ['herramientas', 'Herramientas', 'tools']
];

// Estado y utilidades compartidas por todos los archivos del panel
const A = window.ADMIN = {
  TAB: {},
  tab: 'resumen',
  cache: { tickets: {}, users: null, comments: null, requests: null, days: null, log: null },
  ui: {},
  live,
  kindOf: (id) => FNF.kindOf(id),
  baseOf: (kind) => window[FNF.KINDS[kind].data + '_BASE'] || {},
  customOf: (kind) => ((live().customs || {})[kind]) || {},
  jsStr: (s) => esc(String(s || '').replace(/['"\\\n\r]/g, ' ')),
  panel: () => document.getElementById('admin-panel'),
  visible: (name) => A.tab === name && window.currentSection && window.currentSection() === 'admin',
  // Botón con icono de Flaticon
  btn: (ic, label, onclick, cls = 'btn-ghost') => `<button class="btn btn-sm abtn ${cls}" onclick="${onclick}">${fi(ic, 18)}<span>${label}</span></button>`,
  // Texto pequeño explicativo
  note: (text) => `<p class="note"><b>NOTA:</b> ${text}</p>`,
  pill: (text, color) => `<span class="status-tag" style="background:${color}">${text}</span>`,
  userOf: (uid) => (A.cache.users || {})[uid] || null,
  // Avatar de un usuario (foto de su perfil o su inicial)
  avatar: (uid, name, photo, size = 40) => {
    const u = A.userOf(uid) || {};
    const src = photo || u.foto;
    const nm = name || u.nombre || '?';
    return src
      ? `<img class="adm-avatar" src="${esc(src)}" alt="" width="${size}" height="${size}" loading="lazy" style="border-color:${esc(FNF.marcoValido(u.marcoAvatar) ? u.marcoAvatar : 'transparent')}">`
      : `<span class="adm-avatar adm-avatar-letter" style="width:${size}px;height:${size}px;background:${stringToColor(nm)}">${esc(nm.charAt(0).toUpperCase())}</span>`;
  },
  allTitle: (id) => (FNF.itemOf(id) || A.baseOf(FNF.kindOf(id))[id] || {}).title || id,
  itemThumb: (id) => { const d = FNF.itemOf(id) || A.baseOf(FNF.kindOf(id))[id] || {}; return d.img || (d.images || [])[0] || ''; },
  kindLabel: (id) => ({ mod: 'MOD', apk: 'Base', script: 'Script' })[FNF.kindOf(id)],
  copy: (txt, msg) => copyText(txt, msg)
};
window.adminCopiar = (txt) => A.copy(txt);

// ---- Datos que solo carga el admin ----
A.loadUsers = async (force) => {
  if (A.cache.users && !force) return A.cache.users;
  try { A.cache.users = (await get(ref(db, 'usuarios'))).val() || {}; } catch (err) { console.warn('Usuarios:', err.message); A.cache.users = {}; }
  return A.cache.users;
};
A.loadComments = async (force) => {
  if (A.cache.comments && !force) return A.cache.comments;
  try {
    const data = (await get(ref(db, 'mod_comments'))).val() || {};
    A.cache.comments = Object.entries(data).flatMap(([modId, cs]) => Object.entries(cs || {}).map(([id, c]) => ({ modId, id, ...c })))
      .sort((a, b) => b.id.localeCompare(a.id));
  } catch (err) { console.warn('Comentarios:', err.message); A.cache.comments = []; }
  return A.cache.comments;
};
A.loadRequests = async (force) => {
  if (A.cache.requests && !force) return A.cache.requests;
  try { A.cache.requests = (await get(ref(db, 'mod_requests'))).val() || {}; } catch (err) { A.cache.requests = {}; }
  return A.cache.requests;
};
A.loadDays = async (force) => {
  if (A.cache.days && !force) return A.cache.days;
  const desde = dayKey(new Date(Date.now() - 29 * 86400000));
  try { A.cache.days = (await get(query(ref(db, 'downloads_day'), orderByKey(), startAt(desde)))).val() || {}; } catch (err) { A.cache.days = {}; }
  return A.cache.days;
};
A.loadLog = async (force) => {
  if (A.cache.log && !force) return A.cache.log;
  try {
    const data = (await get(query(ref(db, 'admin_log'), limitToLast(150)))).val() || {};
    A.cache.log = Object.entries(data).map(([id, l]) => ({ id, ...l })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  } catch (err) { A.cache.log = []; }
  return A.cache.log;
};

// ---- Registro de actividad (todo lo que hace el admin queda anotado) ----
A.log = (action, detail = '', target = '') => {
  if (!isAdmin()) return;
  const entry = { action, detail: String(detail).slice(0, 200), target: String(target).slice(0, 60), ts: Date.now() };
  push(ref(db, 'admin_log'), entry).catch(err => console.warn('Registro:', err.message));
  if (A.cache.log) A.cache.log.unshift(entry);
};
FNF.logAdmin = A.log;

// ---- Escuchas solo para el admin + contador de pendientes ----
let listening = false;
window.startAdminListeners = () => {
  if (!isAdmin()) return;
  setTimeout(A.updateBadge, 0);
  if (listening) return;
  listening = true;
  onValue(ref(db, 'support_tickets'), s => {
    A.cache.tickets = s.val() || {};
    A.updateBadge();
    if (A.visible('reportes')) A.TAB.reportes.list();
    if (A.visible('resumen')) A.TAB.resumen.list();
  }, err => console.warn('Tickets:', err.message));
};

A.pendingCount = () => Object.keys(A.cache.tickets).length + Object.keys(live().broken || {}).length;
// Numerito rojo de pendientes (en "Más", en el botón Admin y en la pestaña Reportes). Solo lo ve el admin.
A.updateBadge = () => {
  const n = isAdmin() ? A.pendingCount() : 0;
  document.querySelectorAll('.admin-count').forEach(el => { el.textContent = n > 9 ? '9+' : n; el.hidden = !n; });
};
window.updateAdminBadge = A.updateBadge;

// ==========================================
// GRÁFICAS (una serie, un color, valor al final, tooltip al tocar)
// ==========================================
A.rankedBars = (entries, unit) => {
  if (!entries.length) return `<p class="empty">${t('Aún no hay datos.', 'No data yet.')}</p>`;
  const max = Math.max(...entries.map(e => e[1]));
  const total = entries.reduce((a, e) => a + e[1], 0);
  return `<ol class="bar-chart">${entries.map(([id, n]) => {
    const name = A.allTitle(id);
    const pct = total ? Math.round(n / total * 100) : 0;
    return `<li class="bar-row" tabindex="0" data-tip="${esc(name)} · ${n.toLocaleString('en-US')} ${unit} (${pct}%)" aria-label="${esc(name)}: ${n} ${unit}">
      <span class="bar-label">${esc(name)}</span>
      <span class="bar-line"><span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, n / max * 100)}%"></span></span>
      <span class="bar-value">${compact(n)}</span></span>
    </li>`;
  }).join('')}</ol>`;
};

// Columnas por día (últimos 30 días)
A.dailyChart = (days) => {
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const k = dayKey(d);
    const n = Object.values(days[k] || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    rows.push({ k, n, label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` });
  }
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (!total) return `<p class="empty">Aún no hay datos por día. Se empiezan a juntar desde esta versión.</p>`;
  const max = Math.max(...rows.map(r => r.n));
  const best = rows.reduce((a, r) => r.n > a.n ? r : a, rows[0]);
  return `
    <div class="col-summary">
      <span><b>${compact(total)}</b> en 30 días</span><span><b>${(total / 30).toFixed(1)}</b> por día</span><span>Mejor día: <b>${best.label}</b> (${best.n})</span>
    </div>
    <div class="col-chart" role="img" aria-label="Descargas por día de los últimos 30 días">
      <span class="col-max">${compact(max)}</span>
      <div class="cols">${rows.map(r => `<div class="col" tabindex="0" data-tip="${r.label}: ${r.n} descargas"><span class="col-fill" style="height:${r.n ? Math.max(3, r.n / max * 100) : 0}%"></span></div>`).join('')}</div>
      <div class="col-axis">${rows.map((r, i) => `<span>${i % 6 === 0 || i === 29 ? r.label : ''}</span>`).join('')}</div>
    </div>`;
};

A.statTile = (ic, label, value, sub = '', onclick = '') =>
  `<div class="stat-tile glass"${onclick ? ` role="button" onclick="${onclick}"` : ''}>
    <span class="stat-head">${fi(ic, 20)}<span class="stat-label">${label}</span></span>
    <strong class="stat-value">${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;

const LOG_ICONS = {
  ban: 'ban', unban: 'check', verify: 'verified', comment: 'chat', content: 'box', notice: 'bell', link: 'link',
  account: 'trash', config: 'settings', ticket: 'support', backup: 'database', request: 'idea'
};
A.logIcon = (action) => LOG_ICONS[String(action).split(':')[0]] || 'history';

// ==========================================
// RESUMEN
// ==========================================
A.TAB.resumen = {
  shell: () => `
    <div class="adm-toolbar">
      <p>Vista general de tu página. Toca una tarjeta para ir a su sección.</p>
      ${A.btn('refresh', 'Actualizar', 'adminRecargarTodo()', 'btn-soft')}
    </div>
    <div id="adm-stats" class="stat-grid"></div>
    <div class="adm-two">
      <div class="card glass"><h3>${fi('settings', 20)} Estado del sitio</h3><div id="adm-status" class="status-list"></div></div>
      <div class="card glass"><h3>${fi('bolt', 20)} Accesos rápidos</h3><div id="adm-quick" class="quick-grid"></div></div>
    </div>
    <div class="card glass"><h3>${fi('calendar', 20)} Descargas de los últimos 30 días</h3><div id="adm-days"></div></div>
    <div class="adm-two">
      <div class="card glass"><h3>${fi('trophy', 20)} Top 8 de todos los tiempos</h3><div id="adm-top-all"></div></div>
      <div class="card glass"><h3>${fi('bolt', 20)} Top de esta semana</h3><div id="adm-top-week"></div></div>
    </div>
    <div class="adm-two">
      <div class="card glass"><h3>${fi('users', 20)} Usuarios nuevos</h3><div id="adm-new-users" class="list"></div></div>
      <div class="card glass"><h3>${fi('history', 20)} Actividad reciente</h3><div id="adm-recent-log" class="list"></div></div>
    </div>`,
  list() {
    const L = live();
    const sum = (o) => Object.values(o || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    const ratings = Object.values(L.ratings || {}).flatMap(o => Object.values(o || {})).filter(v => typeof v === 'number');
    const avg = ratings.length ? (ratings.reduce((a, v) => a + v, 0) / ratings.length).toFixed(1) : '—';
    const users = A.cache.users;
    const nUsers = users ? Object.keys(users).length : null;
    const nuevos = users ? Object.values(users).filter(u => u.fechaRegistro && Date.now() - new Date(u.fechaRegistro).getTime() < 7 * 86400000).length : null;
    const comments = A.cache.comments;
    const hoyKey = dayKey();
    const hoy = sum((A.cache.days || {})[hoyKey]);
    const reqs = Object.values(A.cache.requests || {});
    const activos = reqs.filter(r => r.status !== 'Completado' && r.status !== 'No Seleccionado').length;
    const baneados = Object.values(L.banned || {}).filter(b => b && b.expiresAt > Date.now()).length;
    const contenido = Object.keys(window.MOD_DATA || {}).length + Object.keys(window.APK_DATA || {}).length + Object.keys(window.SCRIPTS_DATA || {}).length;
    const dots = '…';

    document.getElementById('adm-stats').innerHTML = [
      A.statTile('download', 'Descargas totales', compact(sum(L.downloads)), 'desde el inicio'),
      A.statTile('calendar', 'Hoy', A.cache.days ? compact(hoy) : dots, 'descargas'),
      A.statTile('bolt', 'Esta semana', compact(sum(L.week)), FNF.weekKey()),
      A.statTile('users', 'Usuarios', nUsers === null ? dots : compact(nUsers), 'registrados', "renderAdminTab('usuarios')"),
      A.statTile('plus', 'Nuevos', nuevos === null ? dots : nuevos, 'últimos 7 días', "adminVerUsuarios('nuevos')"),
      A.statTile('chat', 'Comentarios', comments ? compact(comments.length) : dots, 'en total', "renderAdminTab('comentarios')"),
      A.statTile('like', 'Likes', compact(sum(L.likes)), 'en mods y bases'),
      A.statTile('star', 'Calificación', avg === '—' ? avg : `${avg} ★`, `${ratings.length} votos`),
      A.statTile('idea', 'Pedidos activos', A.cache.requests ? activos : dots, 'de 5 posibles', "abrirPedidos()"),
      A.statTile('warning', 'Pendientes', A.pendingCount(), 'reportes y mensajes', "renderAdminTab('reportes')"),
      A.statTile('ban', 'Baneados', baneados, 'ahora mismo', "adminVerUsuarios('baneados')"),
      A.statTile('box', 'Contenido', contenido, 'mods, bases y scripts', "renderAdminTab('contenido')")
    ].join('');

    // Estado del sitio
    const cfg = L.config || {};
    const on = (v, a = 'Activo', b = 'Apagado') => v ? A.pill(a, 'var(--ok)') : A.pill(b, '#8a7f99');
    const ultimoRespaldo = FNF.store.get('fnf_last_backup');
    document.getElementById('adm-status').innerHTML = [
      ['tools', 'Modo mantenimiento', cfg.maintenance && cfg.maintenance.active ? A.pill('ACTIVO', 'var(--danger)') : A.pill('Apagado', '#8a7f99')],
      ['megaphone', 'Banner', on(cfg.banner && cfg.banner.active)],
      ['telegram', 'Avisos en Telegram', on(cfg.telegram && cfg.telegram.url, 'Configurado', 'Sin configurar')],
      ['filter', 'Palabras bloqueadas', A.pill(String(((cfg.moderation || {}).badWords || []).length), 'var(--accent)')],
      ['database', 'Último respaldo', ultimoRespaldo ? `<small>${timeAgo(ultimoRespaldo)}</small>` : A.pill('Nunca', 'var(--warn)')],
      ['info', 'Versión', `<small>${esc(window.APP_VERSION || '')}</small>`]
    ].map(([ic, label, val]) => `<div class="status-row">${fi(ic, 20)}<span class="grow">${label}</span>${val}</div>`).join('');

    // Accesos rápidos
    const maint = cfg.maintenance && cfg.maintenance.active;
    document.getElementById('adm-quick').innerHTML = [
      A.btn('plus', 'Nuevo mod', "abrirEditorMod(null, 'mod')", 'btn-soft'),
      A.btn('warning', 'Ver reportes', "renderAdminTab('reportes')"),
      A.btn('bell', 'Publicar aviso', "adminIrAvisos('campana')"),
      A.btn('database', 'Respaldo', "adminIrHerramientas('respaldo')"),
      A.btn('link', 'Revisar links', "adminIrHerramientas('links')"),
      A.btn('edit', 'Editar inicio', 'homeIrEditar()'),
      A.btn('tools', maint ? 'Apagar mantenimiento' : 'Mantenimiento', 'adminMantenimientoRapido()', maint ? 'btn-danger' : 'btn-ghost')
    ].join('');

    // Gráficas
    document.getElementById('adm-days').innerHTML = A.cache.days ? A.dailyChart(A.cache.days) : `<p class="empty">Cargando…</p>`;
    const items = { ...(window.MOD_DATA || {}), ...(window.APK_DATA || {}), ...(window.SCRIPTS_DATA || {}) };
    const top = (src, n) => Object.entries(src || {}).filter(([id, v]) => items[id] && v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
    document.getElementById('adm-top-all').innerHTML = A.rankedBars(top(L.downloads, 8), 'descargas');
    document.getElementById('adm-top-week').innerHTML = A.rankedBars(top(L.week, 5), 'descargas');

    // Usuarios nuevos
    document.getElementById('adm-new-users').innerHTML = users ? Object.entries(users)
      .sort((a, b) => String(b[1].fechaRegistro || '').localeCompare(String(a[1].fechaRegistro || ''))).slice(0, 5)
      .map(([uid, u]) => `<div class="list-item mini" role="button" onclick="adminVerUsuario('${esc(uid)}')">
          ${A.avatar(uid, u.nombre, u.foto, 36)}<div class="grow"><h4>${esc(u.nombre || 'Usuario')}</h4><p>${fmtDateTime(u.fechaRegistro)}</p></div></div>`).join('')
      : `<p class="empty">Cargando…</p>`;

    // Actividad reciente
    const log = A.cache.log;
    document.getElementById('adm-recent-log').innerHTML = log ? (log.slice(0, 5).map(l => `
        <div class="list-item mini">${fi(A.logIcon(l.action), 22)}<div class="grow"><h4>${esc(l.detail || l.action)}</h4><p>${timeAgo(l.ts)}</p></div></div>`).join('')
        || `<p class="empty">Todavía no hay actividad registrada.</p>`) + A.btn('history', 'Ver todo', "adminIrHerramientas('actividad')")
      : `<p class="empty">Cargando…</p>`;

    // Carga lo que falte y vuelve a pintar
    const faltan = [];
    if (!A.cache.users) faltan.push(A.loadUsers());
    if (!A.cache.comments) faltan.push(A.loadComments());
    if (!A.cache.requests) faltan.push(A.loadRequests());
    if (!A.cache.days) faltan.push(A.loadDays());
    if (!A.cache.log) faltan.push(A.loadLog());
    if (faltan.length) Promise.all(faltan).then(() => { if (A.visible('resumen')) A.TAB.resumen.list(); });
  }
};

window.adminRecargarTodo = async () => {
  toast('Actualizando datos…', 'refresh');
  await Promise.all([A.loadUsers(true), A.loadComments(true), A.loadRequests(true), A.loadDays(true), A.loadLog(true)]);
  window.renderAdminTab(A.tab);
};
window.adminMantenimientoRapido = async () => {
  const m = ((live().config || {}).maintenance) || {};
  const active = !m.active;
  if (active && !confirm('¿Activar el modo mantenimiento? Nadie más podrá usar la página hasta que lo apagues.')) return;
  await set(ref(db, 'site_config/maintenance'), { active, message: m.message || '' });
  A.log('config:maintenance', active ? 'Activó el modo mantenimiento' : 'Apagó el modo mantenimiento');
  toast(active ? 'Mantenimiento ACTIVADO.' : 'Mantenimiento apagado.', 'tools');
  setTimeout(() => window.renderAdminTab('resumen'), 300);
};

// ==========================================
// REPORTES
// ==========================================
A.ui.repFilter = 'todos';
const TICKET_TYPES = {
  report: ['Reporte', 'var(--danger)', 'warning'],
  support: ['Soporte', 'var(--accent)', 'support'],
  cuenta: ['Borrar cuenta', '#2c2347', 'trash']
};
const REASON_LABEL = {
  broken: 'Link caído', corrupt: 'Archivo dañado', crash: 'Se cierra / no abre', missing: 'Falta contenido', other: 'Otro', admin: 'Bloqueado por ti'
};

A.TAB.reportes = {
  shell: () => `
    <div class="chips" id="rep-chips"></div>
    <div class="adm-toolbar">
      <p id="rep-count"></p>
      ${A.btn('check', 'Resolver todos los visibles', 'adminResolverVisibles()')}
    </div>
    <div id="adm-reports" class="rep-list"></div>`,
  list() {
    const L = live();
    const broken = Object.entries(L.broken || {}).map(([id, b]) => ({ kind: 'broken', key: id, ts: b.timestamp || 0, ...b, modId: id }));
    const tickets = Object.entries(A.cache.tickets).map(([key, tk]) => ({ kind: tk.type === 'report' ? 'report' : tk.type === 'cuenta' ? 'cuenta' : 'support', key, ts: tk.timestamp || 0, ...tk }));
    const all = [...broken, ...tickets].sort((a, b) => b.ts - a.ts);
    const counts = { todos: all.length, broken: broken.length, report: tickets.filter(x => x.kind === 'report').length, support: tickets.filter(x => x.kind === 'support').length, cuenta: tickets.filter(x => x.kind === 'cuenta').length };
    const f = A.ui.repFilter;
    document.getElementById('rep-chips').innerHTML = [
      ['todos', 'Todos', 'filter'], ['broken', 'Links caídos', 'link'], ['report', 'Reportes', 'warning'], ['support', 'Soporte', 'support'], ['cuenta', 'Borrar cuenta', 'trash']
    ].map(([k, label, ic]) => `<button class="chip${f === k ? ' active' : ''}" onclick="adminFiltrarReportes('${k}')">${fi(ic, 16)} ${label} <span class="chip-n">${counts[k]}</span></button>`).join('');

    const shown = f === 'todos' ? all : all.filter(x => x.kind === f);
    document.getElementById('rep-count').textContent = shown.length ? `${shown.length} pendiente(s). Los más recientes primero.` : '';
    document.getElementById('adm-reports').innerHTML = shown.length ? shown.map(card).join('') : `<div class="empty-state">${fi('check', 48)}<p>¡Todo en orden! No hay nada pendiente aquí.</p></div>`;
    A.updateBadge();
    if (!A.cache.users) A.loadUsers().then(() => { if (A.visible('reportes')) A.TAB.reportes.list(); });
  }
};

function card(x) {
  const L = live();
  const uid = x.uid || '';
  const u = A.userOf(uid) || {};
  const name = x.kind === 'broken' ? (x.reportedBy || '¿?') : (x.user || u.nombre || '¿?');
  const type = x.kind === 'broken' ? ['Link caído', 'var(--danger)', 'link'] : TICKET_TYPES[x.kind];
  const reason = x.reason && REASON_LABEL[x.reason] ? A.pill(REASON_LABEL[x.reason], '#8a7f99') : '';
  const jsName = A.jsStr(name);
  const isBroken = !!(L.broken || {})[x.modId];
  const item = x.modId ? `
    <div class="rep-item" role="button" onclick="openItemById('${esc(x.modId)}')">
      <img src="${esc(A.itemThumb(x.modId))}" alt="" loading="lazy">
      <span class="grow"><b>${esc(A.allTitle(x.modId))}</b><small>${A.kindLabel(x.modId)} · ${esc(x.modId)}</small></span>
      ${isBroken ? A.pill('Bloqueado', 'var(--danger)') : ''}
    </div>` : '';

  const actions = [];
  if (uid) actions.push(A.btn('mail', 'Responder', `adminResponder('${esc(uid)}', '${jsName}', '${x.kind === 'broken' ? '' : esc(x.key)}')`, 'btn-soft'));
  if (x.modId) actions.push(A.btn('eye', 'Ver', `openItemById('${esc(x.modId)}')`));
  if (x.modId && isBroken) actions.push(A.btn('check', 'Reparar link', `fixBrokenLink('${esc(x.modId)}', true)`));
  if (x.modId && !isBroken && x.kind === 'report') actions.push(A.btn('ban', 'Bloquear descarga', `adminMarcarCaido('${esc(x.modId)}')`));
  if (uid) actions.push(A.btn('user', 'Ver usuario', `adminVerUsuario('${esc(uid)}')`));
  if (x.text) actions.push(A.btn('copy', 'Copiar', `adminCopiar(${esc(JSON.stringify(String(x.text)))})`));
  if (uid && uid !== window.MI_UID_ADMIN) actions.push(A.btn('ban', 'Banear', `openBanPanel('${esc(uid)}', '${jsName}')`));
  if (x.kind === 'cuenta' && uid) actions.push(A.btn('trash', 'Borrar cuenta', `adminBorrarCuenta('${esc(uid)}', '${jsName}')`, 'btn-danger'));
  if (x.kind !== 'broken') actions.push(A.btn('check', 'Resuelto', `adminResolverTicket('${esc(x.key)}')`, 'btn'));

  return `
  <article class="rep-card glass" style="--rep:${type[1]}">
    <div class="rep-head">
      ${A.avatar(uid, name, u.foto, 42)}
      <div class="grow">
        <b>${esc(name)}</b>
        <small>${uid ? `UID ${esc(uid.slice(0, 8))}…` : 'Reporte anterior (sin cuenta)'}${u.correo ? ' · ' + esc(u.correo) : ''}</small>
      </div>
      <span class="rep-type">${fi(type[2], 16)} ${type[0]}</span>
    </div>
    ${item}
    ${x.text ? `<p class="rep-text">${esc(x.text)}</p>` : ''}
    <div class="rep-meta">
      <span>${fi('calendar', 15)} ${fmtDateTime(x.ts)}</span>
      <span>${fi('clock', 15)} ${timeAgo(x.ts)}</span>
      ${reason}
    </div>
    <div class="adm-actions">${actions.join('')}</div>
  </article>`;
}

window.adminFiltrarReportes = (k) => { A.ui.repFilter = k; A.TAB.reportes.list(); };

// Responde al usuario con un mensaje privado (le aparece dentro de la página)
window.adminResponder = async (uid, name, ticketKey) => {
  const msg = prompt(`Mensaje privado para ${name}:`);
  if (!msg || !msg.trim()) return;
  await set(ref(db, `user_notifications/${uid}`), { message: msg.trim(), timestamp: Date.now(), id: Math.random().toString(36).slice(2, 11) });
  A.log('ticket:reply', `Respondió a ${name}: "${msg.trim().slice(0, 80)}"`, uid);
  toast(`Mensaje enviado a ${name}.`, 'send');
  if (ticketKey && confirm('¿Marcar este ticket como resuelto?')) window.adminResolverTicket(ticketKey, true);
};
window.adminResolverTicket = async (key, silencioso) => {
  const tk = A.cache.tickets[key] || {};
  await remove(ref(db, `support_tickets/${key}`));
  A.log('ticket:resolve', `Resolvió un ticket de ${tk.user || '¿?'} (${TICKET_TYPES[tk.type] ? TICKET_TYPES[tk.type][0] : tk.type})`, tk.uid);
  if (!silencioso) toast('Ticket resuelto.', 'check');
};
window.adminResolverVisibles = async () => {
  const f = A.ui.repFilter;
  const keys = Object.entries(A.cache.tickets).filter(([, tk]) => f === 'todos' || (f === 'report' ? tk.type === 'report' : f === 'cuenta' ? tk.type === 'cuenta' : f === 'support' ? (tk.type !== 'report' && tk.type !== 'cuenta') : false)).map(([k]) => k);
  if (!keys.length) return toast(f === 'broken' ? 'Los links caídos se resuelven con "Reparar link".' : 'No hay tickets para resolver.', 'info');
  if (!confirm(`¿Marcar ${keys.length} ticket(s) como resueltos? (Los links caídos no se tocan.)`)) return;
  await update(ref(db), Object.fromEntries(keys.map(k => [`support_tickets/${k}`, null])));
  A.log('ticket:resolve', `Resolvió ${keys.length} ticket(s) de una vez`);
  toast(`${keys.length} ticket(s) resueltos.`, 'check');
};

// ==========================================
// NAVEGACIÓN DEL PANEL
// ==========================================
window.openAdminPanel = () => {
  if (!isAdmin()) return;
  window.startAdminListeners();
  document.getElementById('admin-tabs').innerHTML = TABS.map(([k, label, ic]) =>
    `<button class="seg-btn${k === A.tab ? ' active' : ''}" data-tab="${k}" onclick="renderAdminTab('${k}')">${fi(ic, 18)}<span>${label}</span>${k === 'reportes' ? '<span class="admin-count" hidden></span>' : ''}</button>`).join('');
  A.updateBadge();
  window.renderAdminTab(A.tab);
};

// fromData = true: llegaron datos nuevos; solo se refrescan las listas (no se borra lo que estás escribiendo)
window.renderAdminTab = (name, fromData) => {
  const T = A.TAB[name];
  if (!T) return;
  if (fromData) {
    if (name === 'reportes') A.updateBadge();
    if (A.visible(name)) T.list();
    if (name !== 'resumen' && A.visible('resumen')) A.TAB.resumen.list();
    return;
  }
  A.tab = name;
  document.querySelectorAll('#admin-tabs .seg-btn').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });
  const p = A.panel();
  p.innerHTML = T.shell();
  p.classList.remove('adm-anim'); void p.offsetWidth; p.classList.add('adm-anim');
  T.list();
};

// Tooltip de barras y columnas (toque o mouse)
document.addEventListener('pointerover', (e) => {
  const row = e.target.closest && e.target.closest('.bar-row, .col');
  document.querySelectorAll('.bar-row.tip, .col.tip').forEach(r => { if (r !== row) r.classList.remove('tip'); });
  if (row) row.classList.add('tip');
});

if (isAdmin()) window.startAdminListeners();
}).catch(err => console.error(err));
