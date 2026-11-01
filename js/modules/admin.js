// Panel de admin: estadísticas, reportes, moderación, usuarios, mods y avisos.
// Solo se muestra con la sesión de Google del admin; las reglas de Firebase bloquean a cualquier otra cuenta.
window.fbReady.then((FB) => {
const { db, ref, get, set, update, remove, onValue } = FB;
const { t, esc, icon, toast, openPopup, closePopup, isAdmin, compact, timeAgo, stringToColor } = FNF;
const live = () => window.live || {};

const TABS = [
  ['resumen', 'Resumen', 'sparkle'],
  ['reportes', 'Reportes', 'alert'],
  ['comentarios', 'Comentarios', 'chat'],
  ['usuarios', 'Usuarios', 'users'],
  ['contenido', 'Contenido', 'music'],
  ['avisos', 'Avisos', 'bell']
];
let tab = 'resumen';
const cache = { tickets: {}, users: null, comments: null };
const ui = { userQuery: '', modQuery: '', kind: 'mod' };
const kindOf = (id) => FNF.kindOf(id);
const baseOf = (kind) => window[FNF.KINDS[kind].data + '_BASE'] || {};
const customOf = (kind) => ((live().customs || {})[kind]) || {};
const jsStr = (s) => esc(String(s || '').replace(/['"\\]/g, ''));
const allTitle = (id) => (FNF.itemOf(id) || baseOf(FNF.kindOf(id))[id] || {}).title || id;
const panel = () => document.getElementById('admin-panel');
const visible = (name) => tab === name && window.currentSection && window.currentSection() === 'admin';

// ---- Escuchas solo para el admin + contador de pendientes ----
let listening = false;
window.startAdminListeners = () => {
  if (!isAdmin()) return;
  setTimeout(updateBadge, 0);
  if (listening) return;
  listening = true;
  onValue(ref(db, 'support_tickets'), s => {
    cache.tickets = s.val() || {};
    updateBadge();
    if (visible('reportes')) TAB.reportes.list();
    if (visible('resumen')) TAB.resumen.list();
  }, err => console.warn('Tickets:', err.message));
};
if (isAdmin()) window.startAdminListeners();

function pendingCount() {
  return Object.keys(cache.tickets).length + Object.keys(live().broken || {}).length;
}
// Numerito rojo de pendientes (en "Más", en el botón Admin y en la pestaña Reportes). Solo lo ve el admin.
function updateBadge() {
  const n = isAdmin() ? pendingCount() : 0;
  document.querySelectorAll('.admin-count').forEach(el => { el.textContent = n > 9 ? '9+' : n; el.hidden = !n; });
}
window.updateAdminBadge = updateBadge;

// ==========================================
// GRÁFICA: barras horizontales ordenadas (una serie, un color)
// ==========================================
function rankedBars(entries, unit) {
  if (!entries.length) return `<p class="empty">${t('Aún no hay datos.', 'No data yet.')}</p>`;
  const max = Math.max(...entries.map(e => e[1]));
  const total = entries.reduce((a, e) => a + e[1], 0);
  return `<ol class="bar-chart">${entries.map(([id, n]) => {
    const name = allTitle(id);
    const pct = total ? Math.round(n / total * 100) : 0;
    return `<li class="bar-row" tabindex="0" data-tip="${esc(name)} · ${n.toLocaleString('en-US')} ${unit} (${pct}%)" aria-label="${esc(name)}: ${n} ${unit}">
      <span class="bar-label">${esc(name)}</span>
      <span class="bar-line"><span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, n / max * 100)}%"></span></span>
      <span class="bar-value">${compact(n)}</span></span>
    </li>`;
  }).join('')}</ol>`;
}

const statTile = (label, value, sub = '') =>
  `<div class="stat-tile glass"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;

// ==========================================
// PESTAÑAS
// ==========================================
const TAB = {
  // ---------- RESUMEN ----------
  resumen: {
    shell: () => `<div id="adm-stats" class="stat-grid"></div>
      <div class="card glass"><h3>${t('Top 8 mods por descargas', 'Top 8 mods by downloads')}</h3><div id="adm-top-all"></div></div>
      <div class="card glass"><h3>${t('Más descargados esta semana', 'Most downloaded this week')}</h3><div id="adm-top-week"></div></div>`,
    list() {
      const L = live();
      const sum = (o) => Object.values(o || {}).reduce((a, v) => a + (Number(v) || 0), 0);
      const ratings = Object.values(L.ratings || {}).flatMap(o => Object.values(o || {})).filter(v => typeof v === 'number');
      const avg = ratings.length ? (ratings.reduce((a, v) => a + v, 0) / ratings.length).toFixed(1) : '—';
      const users = cache.users ? Object.keys(cache.users).length : null;
      document.getElementById('adm-stats').innerHTML = [
        statTile('Descargas totales', compact(sum(L.downloads))),
        statTile('Esta semana', compact(sum(L.week)), FNF.weekKey()),
        statTile('Likes', compact(sum(L.likes))),
        statTile('Usuarios', users === null ? '…' : compact(users)),
        statTile('Pendientes', pendingCount(), 'reportes y mensajes'),
        statTile('Calificación', avg === '—' ? avg : `${avg} ★`, `${ratings.length} votos`)
      ].join('');
      const mods = window.MOD_DATA || {};
      const top = (src, n) => Object.entries(src || {}).filter(([id, v]) => mods[id] && v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
      document.getElementById('adm-top-all').innerHTML = rankedBars(top(L.downloads, 8), 'descargas');
      document.getElementById('adm-top-week').innerHTML = rankedBars(top(L.week, 5), 'descargas');
      if (cache.users === null) loadUsers().then(() => { if (visible('resumen')) this.list(); });
    }
  },

  // ---------- REPORTES ----------
  reportes: {
    shell: () => `<div class="card glass"><h3>🔗 ${t('Links caídos', 'Broken links')}</h3><p>Estos mods están bloqueados para los usuarios hasta que los marques como reparados.</p><div id="adm-broken" class="list"></div></div>
      <div class="card glass"><h3>🎫 ${t('Reportes y mensajes', 'Reports & messages')}</h3><div id="adm-tickets" class="list"></div></div>`,
    list() {
      const broken = Object.entries(live().broken || {});
      document.getElementById('adm-broken').innerHTML = broken.length ? broken.map(([id, b]) => `
        <div class="list-item adm-item">
          <div class="grow"><h4>${esc(allTitle(id))}</h4><p>${esc(b.reportedBy || '¿?')} · ${timeAgo(b.timestamp)}</p></div>
          <div class="adm-actions">
            <button class="btn btn-sm btn-ghost" onclick="openModInfo('${esc(id)}')">Ver</button>
            <button class="btn btn-sm" onclick="fixBrokenLink('${esc(id)}')">✅ Reparado</button>
          </div>
        </div>`).join('') : `<p class="empty">Ningún link caído. 🎉</p>`;

      const tickets = Object.entries(cache.tickets).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
      document.getElementById('adm-tickets').innerHTML = tickets.length ? tickets.map(([key, tk]) => `
        <div class="list-item adm-item" style="flex-wrap:wrap">
          <div class="grow">
            <span class="status-tag" style="background:${tk.type === 'report' ? 'var(--danger)' : 'var(--accent)'}">${tk.type === 'report' ? 'Reporte' : 'Soporte'}</span>
            ${tk.modId ? `<b style="font-size:13px"> · ${esc(allTitle(tk.modId))}</b>` : ''}
            <p class="adm-text">${esc(tk.text)}</p>
            <p>👤 ${esc(tk.user || '¿?')} · ${timeAgo(tk.timestamp)}</p>
          </div>
          <div class="adm-actions">
            <button class="btn btn-sm btn-soft" onclick="adminResponder('${esc(tk.uid)}', '${jsStr(tk.user)}')">💬 Responder</button>
            <button class="btn btn-sm btn-ghost" onclick="openBanPanel('${esc(tk.uid)}', '${jsStr(tk.user)}')">⛔</button>
            <button class="btn btn-sm" onclick="adminResolverTicket('${esc(key)}')">✅ Resuelto</button>
          </div>
        </div>`).join('') : `<p class="empty">Bandeja vacía. 🎉</p>`;
      updateBadge();
    }
  },

  // ---------- COMENTARIOS ----------
  comentarios: {
    shell: () => `<div class="adm-toolbar"><p>Los 40 comentarios más recientes de todos los mods.</p>
      <button class="btn btn-sm btn-soft" onclick="adminRecargarComentarios()">↻ Recargar</button></div>
      <div id="adm-comments" class="list"><p class="empty">Cargando…</p></div>`,
    async list() {
      if (cache.comments === null) {
        const data = (await get(ref(db, 'mod_comments'))).val() || {};
        cache.comments = Object.entries(data).flatMap(([modId, cs]) => Object.entries(cs || {}).map(([id, c]) => ({ modId, id, ...c })))
          .sort((a, b) => b.id.localeCompare(a.id)).slice(0, 40);
      }
      if (!visible('comentarios')) return;
      const L = live();
      document.getElementById('adm-comments').innerHTML = cache.comments.length ? cache.comments.map(c => {
        const name = c.user || 'Usuario';
        const banned = L.banned && L.banned[c.ownerKey] && L.banned[c.ownerKey].expiresAt > Date.now();
        return `
        <div class="list-item adm-item" style="align-items:flex-start;flex-wrap:wrap">
          <div class="yt-avatar" style="background:${c.avatar ? 'transparent' : stringToColor(name)}">${c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : esc(name.charAt(0).toUpperCase())}</div>
          <div class="grow">
            <h4>${esc(name)} ${L.verified && L.verified[c.ownerKey] ? '☑️' : ''}${banned ? ' <span class="status-tag" style="background:var(--danger)">Baneado</span>' : ''}</h4>
            <p>en <b>${esc(allTitle(c.modId))}</b> · ${esc(c.date || '')}${c.isPinned ? ' · 📌' : ''}</p>
            <p class="adm-text">${esc(c.text)}</p>
          </div>
          <div class="adm-actions">
            <button class="btn btn-sm btn-ghost" onclick="adminPinComentario('${esc(c.modId)}', '${esc(c.id)}', ${!!c.isPinned})">${c.isPinned ? 'Desfijar' : '📌 Fijar'}</button>
            <button class="btn btn-sm btn-ghost" onclick="adminVerificar('${esc(c.ownerKey)}')">☑️</button>
            <button class="btn btn-sm btn-ghost" onclick="openBanPanel('${esc(c.ownerKey)}', '${jsStr(name)}')">⛔</button>
            <button class="btn btn-sm btn-danger" onclick="adminBorrarComentario('${esc(c.modId)}', '${esc(c.id)}')">🗑️</button>
          </div>
        </div>`;
      }).join('') : `<p class="empty">Aún no hay comentarios.</p>`;
    }
  },

  // ---------- USUARIOS ----------
  usuarios: {
    shell: () => `<div class="search glass" style="margin-bottom:12px">${icon('search')}<input type="search" id="adm-user-q" placeholder="Buscar por nombre o correo..." value="${esc(ui.userQuery)}" oninput="adminBuscarUsuarios(this.value)"></div>
      <p class="adm-count" id="adm-user-count"></p><div id="adm-users" class="list"><p class="empty">Cargando…</p></div>`,
    async list() {
      if (cache.users === null) await loadUsers();
      if (!visible('usuarios')) return;
      const L = live();
      const q = ui.userQuery.trim().toLowerCase();
      const all = Object.entries(cache.users || {}).sort((a, b) => String(b[1].fechaRegistro || '').localeCompare(String(a[1].fechaRegistro || '')));
      const found = all.filter(([, u]) => !q || `${u.nombre || ''} ${u.correo || ''}`.toLowerCase().includes(q));
      document.getElementById('adm-user-count').textContent = `${found.length} de ${all.length} usuarios${found.length > 50 ? ' (mostrando 50)' : ''}`;
      document.getElementById('adm-users').innerHTML = found.slice(0, 50).map(([uid, u]) => {
        const verified = L.verified && L.verified[uid];
        const ban = L.banned && L.banned[uid];
        const banned = ban && ban.expiresAt > Date.now();
        const name = u.nombre || 'Usuario';
        return `
        <div class="list-item adm-item" style="flex-wrap:wrap">
          <img src="${esc(u.foto || '')}" alt="" loading="lazy" style="width:44px;height:44px;border-radius:50%">
          <div class="grow">
            <h4>${esc(name)} ${verified ? '☑️' : ''}${uid === window.MI_UID_ADMIN ? ' <span class="admin-tag">ADMIN</span>' : ''}</h4>
            <p>${esc(u.correo || '')} · ${u.fechaRegistro ? new Date(u.fechaRegistro).toLocaleDateString('es-MX') : ''}</p>
            ${banned ? `<p style="color:var(--danger)">⛔ Baneado: ${esc(ban.reason)} (termina ${new Date(ban.expiresAt).toLocaleString('es-MX')})</p>` : ''}
          </div>
          ${uid === window.MI_UID_ADMIN ? '' : `<div class="adm-actions">
            <button class="btn btn-sm btn-ghost" onclick="adminVerificar('${esc(uid)}')">${verified ? 'Quitar ☑️' : '☑️ Verificar'}</button>
            <button class="btn btn-sm btn-soft" onclick="adminResponder('${esc(uid)}', '${jsStr(name)}')">💬</button>
            ${banned ? `<button class="btn btn-sm" onclick="adminDesbanear('${esc(uid)}')">Desbanear</button>`
              : `<button class="btn btn-sm btn-danger" onclick="openBanPanel('${esc(uid)}', '${jsStr(name)}')">⛔ Banear</button>`}
          </div>`}
        </div>`;
      }).join('') || `<p class="empty">Sin resultados.</p>`;
    }
  },

  // ---------- CONTENIDO (MODs, Bases y Scripts) ----------
  contenido: {
    shell: () => `
      <div class="chips" style="margin-bottom:10px">
        ${Object.entries(FNF.KINDS).map(([k, v]) => `<button class="chip${ui.kind === k ? ' active' : ''}" onclick="adminElegirTipo('${k}')">${v.label}</button>`).join('')}
      </div>
      <div class="adm-toolbar">
        <div class="search glass" style="flex:1;margin:0">${icon('search')}<input type="search" placeholder="Buscar..." value="${esc(ui.modQuery)}" oninput="adminBuscarMods(this.value)"></div>
        <button class="btn" onclick="abrirEditorMod(null, '${ui.kind}')">+ Nuevo</button>
      </div>
      <p class="adm-count">Lo que crees o edites aquí se guarda en Firebase y aparece al instante, sin tocar código.</p>
      <div id="adm-mods" class="list"></div>`,
    list() {
      const kind = ui.kind;
      const base = baseOf(kind);
      const custom = customOf(kind);
      const ids = [...new Set([...Object.keys(custom).filter(id => !base[id]), ...Object.keys(base)])];
      const q = ui.modQuery.trim().toLowerCase();
      const L = live();
      document.getElementById('adm-mods').innerHTML = ids.map(id => {
        const c = custom[id];
        const d = { ...(base[id] || {}), ...(c || {}) };
        if (!d.title || (q && !d.title.toLowerCase().includes(q))) return '';
        const tags = [
          !base[id] ? '<span class="status-tag" style="background:var(--accent)">Creado en el panel</span>' : '',
          base[id] && c && !c.removed ? '<span class="status-tag" style="background:#3d8bff">Editado</span>' : '',
          d.removed ? '<span class="status-tag" style="background:#777">Oculto</span>' : '',
          d.hidden ? '<span class="status-tag" style="background:#2c2347">🔒 Secreto</span>' : '',
          (L.broken || {})[id] ? '<span class="status-tag" style="background:var(--danger)">Link caído</span>' : ''
        ].join(' ');
        return `
        <div class="list-item adm-item" style="${d.removed ? 'opacity:.6' : ''}">
          <img src="${esc(d.img || (d.images || [])[0] || '')}" alt="" loading="lazy">
          <div class="grow"><h4>${esc(d.title)}</h4><p>${esc(id)} · 📥 ${compact((L.downloads || {})[id])} ${tags}</p></div>
          <div class="adm-actions">
            ${d.removed ? '' : `<button class="btn btn-sm btn-ghost" onclick="openItemById('${esc(id)}')">👁️ Ver</button>`}
            <button class="btn btn-sm btn-soft" onclick="abrirEditorMod('${esc(id)}', '${kind}')">✏️ Editar</button>
            <button class="btn btn-sm btn-ghost" onclick="adminOcultarItem('${esc(id)}', ${!d.removed})">${d.removed ? '👁️ Mostrar' : '🙈 Ocultar'}</button>
            ${base[id] && c && !(Object.keys(c).length === 1 && c.removed) ? `<button class="btn btn-sm btn-ghost" onclick="adminRestaurarItem('${esc(id)}')">↺ Original</button>` : ''}
            ${!base[id] ? `<button class="btn btn-sm btn-danger" onclick="adminBorrarItem('${esc(id)}')">🗑️</button>` : ''}
          </div>
        </div>`;
      }).join('') || `<p class="empty">Sin resultados.</p>`;
    }
  },

  // ---------- AVISOS ----------
  avisos: {
    shell() {
      const cfg = live().config || {};
      const b = cfg.banner || {};
      const m = cfg.maintenance || {};
      const tg = cfg.telegram || {};
      const modOptions = Object.entries(FNF.KINDS).map(([, k]) =>
        `<optgroup label="${k.label}">${Object.entries(window[k.data] || {}).map(([id, d]) => `<option value="${esc(id)}">${esc(d.title)}</option>`).join('')}</optgroup>`).join('');
      return `
      <div class="card glass">
        <h3>📢 Banner en toda la página</h3>
        <div class="stack">
          <textarea id="adm-banner-text" class="field" maxlength="200" placeholder="Ej: ¡Nuevo mod este fin de semana!">${esc(b.text || '')}</textarea>
          <div class="adm-row">
            <select id="adm-banner-type" class="field">
              <option value="info" ${b.type === 'info' ? 'selected' : ''}>💜 Información</option>
              <option value="success" ${b.type === 'success' ? 'selected' : ''}>✅ Buena noticia</option>
              <option value="warn" ${b.type === 'warn' ? 'selected' : ''}>⚠️ Advertencia</option>
            </select>
            <label class="setting-row" style="border:0;padding:0;gap:10px">Activo <span class="switch"><input type="checkbox" id="adm-banner-on" ${b.active ? 'checked' : ''}><span></span></span></label>
          </div>
          <button class="btn btn-block" onclick="adminGuardarBanner()">Guardar banner</button>
        </div>
      </div>

      <div class="card glass">
        <h3>🚧 Modo mantenimiento</h3>
        <p>Tapa la página para todos menos para ti. Úsalo mientras haces cambios grandes.</p>
        <div class="stack">
          <textarea id="adm-maint-text" class="field" maxlength="200" placeholder="Mensaje para los usuarios">${esc(m.message || '')}</textarea>
          <label class="setting-row" style="border:0;padding:0">Activar mantenimiento <span class="switch"><input type="checkbox" id="adm-maint-on" ${m.active ? 'checked' : ''}><span></span></span></label>
          <button class="btn btn-block ${m.active ? 'btn-danger' : ''}" onclick="adminGuardarMantenimiento()">Guardar</button>
        </div>
      </div>

      <div class="card glass">
        <h3>🔔 Nueva notificación (campana)</h3>
        <div class="stack">
          <textarea id="adm-notif-text" class="field" maxlength="300" placeholder="Aviso para los usuarios..."></textarea>
          <label class="label" for="adm-notif-mod">Enlazar a un mod, base o script (opcional)</label>
          <select id="adm-notif-mod" class="field"><option value="">— Ninguno —</option>${modOptions}</select>
          <label class="label" for="adm-notif-when">Programar (opcional)</label>
          <input type="datetime-local" id="adm-notif-when" class="field">
          <button class="btn btn-block" onclick="adminPublicarNotificacion()">Publicar</button>
        </div>
        <h4 class="label" style="margin-top:18px">Publicadas</h4>
        <div id="adm-notif-list" class="list"></div>
      </div>

      <div class="card glass">
        <h3>⚡ Aviso emergente</h3>
        <p>Aparece una sola vez como globito arriba, a quien entre en las próximas 24 h.</p>
        <div class="stack">
          <textarea id="globalNotifText" class="field" maxlength="200" placeholder="Ej: ¡Nuevo mod disponible!"></textarea>
          <button class="btn btn-block btn-soft" onclick="adminEnviarToast()">Enviar aviso</button>
        </div>
      </div>

      <div class="card glass">
        <h3>✈️ Avisos en Telegram</h3>
        <p>Pega la dirección de tu Worker de Cloudflare (tools/telegram-worker.js). Cada reporte y mensaje de soporte te llegará al bot.</p>
        <div class="stack">
          <input type="url" id="adm-tg-url" class="field" placeholder="https://fnf-telegram.tuusuario.workers.dev" value="${esc(tg.url || '')}">
          <div class="adm-row">
            <button class="btn" style="flex:1" onclick="adminGuardarTelegram()">Guardar</button>
            <button class="btn btn-soft" style="flex:1" onclick="adminProbarTelegram()">✈️ Probar</button>
          </div>
          <p id="adm-tg-result" class="tg-result" hidden></p>
        </div>
      </div>`;
    },
    list() {
      const el = document.getElementById('adm-notif-list');
      if (!el) return;
      const notifs = [...(window.liveNotifs || [])].sort((a, b) => String(b.id).localeCompare(String(a.id)));
      el.innerHTML = notifs.length ? notifs.map(n => `
        <div class="notif-item">
          ${n.publishAt && n.publishAt > Date.now() ? `<span class="status-tag" style="background:var(--warn)">⏰ ${new Date(n.publishAt).toLocaleString('es-MX')}</span>` : ''}
          <p>${esc(n.texto)}</p>
          <small>${esc(n.fecha)}${n.modId ? ' · 🎵 ' + esc(allTitle(n.modId)) : ''}</small>
          <div class="row">
            <button class="btn btn-sm btn-soft" onclick="adminEditarNotificacion('${esc(n.id)}')">Editar</button>
            <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="adminBorrarNotificacion('${esc(n.id)}')">Borrar</button>
          </div>
        </div>`).join('') : `<p class="empty">No hay notificaciones.</p>`;
    }
  }
};

async function loadUsers() {
  try { cache.users = (await get(ref(db, 'usuarios'))).val() || {}; }
  catch (err) { console.warn('Usuarios:', err.message); cache.users = {}; }
}

// ---- Navegación del panel ----
window.openAdminPanel = () => {
  if (!isAdmin()) return;
  window.startAdminListeners();
  document.getElementById('admin-tabs').innerHTML = TABS.map(([k, label, ic]) =>
    `<button class="seg-btn${k === tab ? ' active' : ''}" onclick="renderAdminTab('${k}')">${icon(ic, 'icon icon-sm')}<span>${label}</span>${k === 'reportes' ? '<span class="admin-count" hidden></span>' : ''}</button>`).join('');
  updateBadge();
  window.renderAdminTab(tab);
};

// fromData = true: llegaron datos nuevos; solo se refrescan las listas (no se borra lo que estás escribiendo)
window.renderAdminTab = (name, fromData) => {
  if (!TAB[name]) return;
  if (fromData) {
    if (name === 'reportes') updateBadge();
    if (visible(name)) TAB[name].list();
    if (name !== 'resumen' && visible('resumen')) TAB.resumen.list();
    return;
  }
  tab = name;
  document.querySelectorAll('#admin-tabs .seg-btn').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(`'${name}'`)));
  panel().innerHTML = TAB[name].shell();
  panel().classList.remove('adm-anim'); void panel().offsetWidth; panel().classList.add('adm-anim');
  TAB[name].list();
};

// ==========================================
// ACCIONES
// ==========================================
window.adminResponder = async (uid, name) => {
  const msg = prompt(`Mensaje para ${name}:`);
  if (!msg || !msg.trim()) return;
  await set(ref(db, `user_notifications/${uid}`), { message: msg.trim(), timestamp: Date.now(), id: Math.random().toString(36).slice(2, 11) });
  toast(`Mensaje enviado a ${name}.`, 'send');
};
window.adminResolverTicket = (key) => remove(ref(db, `support_tickets/${key}`));
window.adminRecargarComentarios = () => { cache.comments = null; TAB.comentarios.list(); };
window.adminPinComentario = async (modId, id, state) => {
  await update(ref(db, `mod_comments/${modId}/${id}`), { isPinned: !state });
  const c = (cache.comments || []).find(x => x.id === id);
  if (c) c.isPinned = !state;
  TAB.comentarios.list();
};
window.adminBorrarComentario = async (modId, id) => {
  if (!confirm('¿Borrar este comentario?')) return;
  await remove(ref(db, `mod_comments/${modId}/${id}`));
  cache.comments = (cache.comments || []).filter(x => x.id !== id);
  TAB.comentarios.list();
};
window.adminVerificar = async (uid) => {
  const on = !(live().verified || {})[uid];
  await set(ref(db, `verified_users/${uid}`), on ? true : null);
  toast(on ? 'Usuario verificado ☑️' : 'Verificación quitada', 'shield');
  if (visible('usuarios')) TAB.usuarios.list();
  if (visible('comentarios')) TAB.comentarios.list();
};
window.adminDesbanear = async (uid) => {
  await remove(ref(db, `banned_users/${uid}`));
  toast('Usuario desbaneado.', 'shield');
  setTimeout(() => { if (visible('usuarios')) TAB.usuarios.list(); }, 300);
};
window.adminBuscarUsuarios = (q) => { ui.userQuery = q; TAB.usuarios.list(); };
window.adminBuscarMods = (q) => { ui.modQuery = q; TAB.contenido.list(); };
window.adminElegirTipo = (kind) => { ui.kind = kind; ui.modQuery = ''; window.renderAdminTab('contenido'); };

// ---- Contenido (mods, bases y scripts) ----
const pathOf = (id) => `${FNF.KINDS[kindOf(id)].path}/${id}`;
const NOMBRE = { mod: 'mod', apk: 'base', script: 'script' };

window.adminOcultarItem = async (id, hide) => {
  if (!isAdmin()) return;
  const kind = kindOf(id);
  if (hide && !confirm(`¿Ocultar "${allTitle(id)}"? Los usuarios dejarán de verlo (puedes mostrarlo otra vez desde Panel → Contenido).`)) return;
  const c = customOf(kind)[id];
  if (!hide && baseOf(kind)[id] && c && Object.keys(c).length === 1) await remove(ref(db, pathOf(id)));
  else await update(ref(db, pathOf(id)), { removed: hide ? true : null });
  if (hide && window.closeDetail) window.closeDetail();
  toast(hide ? 'Oculto para los usuarios.' : 'Visible otra vez.', 'music');
};
window.adminRestaurarItem = async (id) => {
  if (confirm('¿Volver a la versión original del archivo data? Se pierden los cambios hechos en el panel.')) await remove(ref(db, pathOf(id)));
};
window.adminBorrarItem = async (id) => {
  if (confirm(`¿Borrar "${allTitle(id)}" para siempre?`)) await remove(ref(db, pathOf(id)));
};
// Nombres anteriores
window.adminOcultarMod = window.adminOcultarItem;
window.adminRestaurarMod = window.adminRestaurarItem;
window.adminBorrarMod = window.adminBorrarItem;

let editingId = null;
let editingKind = 'mod';
const val = (id) => document.getElementById(id).value.trim();

window.abrirEditorMod = (id, kind) => {
  if (!isAdmin()) return;
  editingId = id || null;
  editingKind = kind || (id ? kindOf(id) : 'mod');
  const d = id ? { ...(baseOf(editingKind)[id] || {}), ...(customOf(editingKind)[id] || {}) } : {};
  const mainImg = d.img || (d.images || [])[0] || '';
  document.getElementById('editor-title').textContent = id ? `Editar: ${d.title || id}` : `Nuevo ${NOMBRE[editingKind]}`;
  document.getElementById('ed-mod-fields').hidden = editingKind !== 'mod';
  const setV = (k, v) => { document.getElementById(k).value = v || ''; };
  setV('ed-title', d.title); setV('ed-img', mainImg); setV('ed-desc', d.desc); setV('ed-version', d.version);
  setV('ed-engine', d.engine); setV('ed-ram', d.ram); setV('ed-size', d.size);
  document.getElementById('ed-gama').value = d.gama || 'low';
  setV('ed-images', (d.images || []).filter(x => x !== mainImg).join('\n'));
  setV('ed-downloads', (d.downloads || []).map(x => `${x.name} | ${x.link}`).join('\n'));
  document.getElementById('ed-hidden').checked = !!d.hidden;
  window.previewEditorImg();
  openPopup('mod-editor-popup');
};

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
  if (title.length < 2) return toast('Ponle un título.', 'alert');
  if (!val('ed-img')) return toast('Falta la imagen.', 'alert');
  if (!downloads.length) return toast('Agrega al menos un enlace de descarga.', 'alert');
  if (bad) return toast(`Enlace inválido: ${bad.link}`, 'alert');

  const extras = val('ed-images').split('\n').map(s => s.trim()).filter(Boolean);
  const isMod = editingKind === 'mod';
  const data = {
    title, img: val('ed-img'), desc: val('ed-desc'), version: val('ed-version'),
    gama: isMod ? document.getElementById('ed-gama').value : null,
    engine: isMod ? val('ed-engine') : null, ram: isMod ? val('ed-ram') : null, size: isMod ? val('ed-size') : null,
    // La galería del popup: imagen principal + capturas extra
    images: (extras.length || editingKind === 'script') ? [val('ed-img'), ...extras] : null,
    downloads, hidden: document.getElementById('ed-hidden').checked || null,
    updatedAt: Date.now()
  };
  const id = editingId || (editingKind + Date.now().toString(36));
  if (!editingId) data.createdAt = Date.now();

  const btn = document.getElementById('btn-guardar-mod');
  btn.disabled = true;
  try {
    await update(ref(db, `${FNF.KINDS[editingKind].path}/${id}`), data);
    closePopup('mod-editor-popup');
    toast(editingId ? 'Cambios guardados.' : '¡Publicado! Ya aparece en la lista.', 'music');
    if (!editingId && confirm('¿Marcarlo también como NUEVO?')) set(ref(db, `new_mods_status/card-${id}`), true);
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar. ¿Tienes la sesión de admin abierta?', 'alert');
  } finally {
    btn.disabled = false;
  }
};

// ---- Avisos ----
window.adminGuardarBanner = async () => {
  await set(ref(db, 'site_config/banner'), {
    text: val('adm-banner-text'), type: document.getElementById('adm-banner-type').value,
    active: document.getElementById('adm-banner-on').checked, updatedAt: Date.now()
  });
  toast('Banner guardado.', 'bell');
};
window.adminGuardarMantenimiento = async () => {
  const active = document.getElementById('adm-maint-on').checked;
  if (active && !confirm('¿Activar el modo mantenimiento? Nadie más podrá usar la página hasta que lo apagues.')) return;
  await set(ref(db, 'site_config/maintenance'), { active, message: val('adm-maint-text') });
  toast(active ? 'Mantenimiento ACTIVADO.' : 'Mantenimiento apagado.', 'alert');
  window.renderAdminTab('avisos');
};
window.adminPublicarNotificacion = async () => {
  const texto = val('adm-notif-text');
  if (!texto) return toast('Escribe el aviso.', 'bell');
  const when = val('adm-notif-when');
  const publishAt = when ? new Date(when).getTime() : null;
  const fechaBase = publishAt ? new Date(publishAt) : new Date();
  const id = 'notif_' + Date.now();
  const data = {
    id, texto,
    fecha: fechaBase.toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  };
  const modId = document.getElementById('adm-notif-mod').value;
  if (modId) data.modId = modId;
  if (publishAt && publishAt > Date.now()) data.publishAt = publishAt;
  await set(ref(db, 'notificaciones/' + id), data);
  document.getElementById('adm-notif-text').value = '';
  document.getElementById('adm-notif-when').value = '';
  toast(data.publishAt ? 'Notificación programada.' : 'Notificación publicada.', 'bell');
};
window.adminEditarNotificacion = (id) => {
  const actual = (window.liveNotifs || []).find(n => n.id === id);
  const nuevo = prompt('Edita la notificación:', actual ? actual.texto : '');
  if (nuevo && nuevo.trim()) update(ref(db, 'notificaciones/' + id), { texto: nuevo.trim() });
};
window.adminBorrarNotificacion = (id) => {
  if (confirm('¿Borrar esta notificación?')) remove(ref(db, 'notificaciones/' + id));
};
window.adminEnviarToast = async () => {
  const message = val('globalNotifText');
  if (!message) return toast('Escribe un mensaje primero.', 'bell');
  await set(ref(db, 'notifications/latest'), { message, timestamp: Date.now(), id: Math.random().toString(36).slice(2, 11) });
  document.getElementById('globalNotifText').value = '';
  toast('Aviso enviado.', 'bell');
};

// ---- Telegram ----
window.adminGuardarTelegram = async () => {
  const url = val('adm-tg-url').replace(/\/+$/, '');
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) return toast('La dirección debe empezar con https://', 'alert');
  await set(ref(db, 'site_config/telegram'), url ? { url } : null);
  toast(url ? 'Dirección guardada. Ahora toca "Probar".' : 'Avisos de Telegram desactivados.', 'send');
};

window.adminProbarTelegram = async () => {
  const out = document.getElementById('adm-tg-result');
  const show = (ok, msg) => { out.hidden = false; out.className = 'tg-result ' + (ok ? 'ok' : 'bad'); out.textContent = msg; };
  const url = val('adm-tg-url').replace(/\/+$/, '');
  if (!url) return show(false, 'Primero pega la dirección del Worker.');
  show(true, 'Enviando mensaje de prueba…');
  const r = await window.enviarAvisoTelegram('✅ Prueba desde el panel de FNF\' Ports. ¡Los avisos funcionan!', url);
  show(r.ok, r.ok ? '¡Listo! Revisa tu bot de Telegram.' : r.ayuda);
};

// Tooltip de las barras (toque o mouse)
document.addEventListener('pointerover', (e) => {
  const row = e.target.closest && e.target.closest('.bar-row');
  document.querySelectorAll('.bar-row.tip').forEach(r => { if (r !== row) r.classList.remove('tip'); });
  if (row) row.classList.add('tip');
});
}).catch(err => console.error(err));
