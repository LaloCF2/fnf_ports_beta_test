// Panel de admin — Comentarios y Usuarios (incluye borrar cuentas completas).
window.fbReady.then((FB) => {
const { db, ref, get, set, update, remove, push } = FB;
const { esc, fi, toast, compact, timeAgo, fmtDateTime, dayKey } = FNF;
const A = window.ADMIN;
const live = A.live;

const PAGE_COMMENTS = 30;
const PAGE_USERS = 50;
Object.assign(A.ui, { cQuery: '', cMod: '', cUser: '', cFilter: 'todos', cLimit: PAGE_COMMENTS, uQuery: '', uFilter: 'todos', uSort: 'recientes', uLimit: PAGE_USERS });

const isBanned = (uid) => { const b = (live().banned || {})[uid]; return !!(b && b.expiresAt > Date.now()); };
const isVerified = (uid) => !!(live().verified || {})[uid];
const tags = (uid) => [
  uid === window.MI_UID_ADMIN ? '<span class="admin-tag">ADMIN</span>' : '',
  isVerified(uid) ? fi('verified', 16) : '',
  isBanned(uid) ? A.pill('Baneado', 'var(--danger)') : ''
].join(' ');

// ==========================================
// COMENTARIOS
// ==========================================
A.TAB.comentarios = {
  shell: () => {
    const conComentarios = [...new Set((A.cache.comments || []).map(c => c.modId))];
    return `
    <div class="adm-toolbar">
      <div class="search glass" style="flex:1 1 200px;margin:0">${fi('search', 18)}<input type="search" placeholder="Buscar texto o usuario..." value="${esc(A.ui.cQuery)}" oninput="adminComentariosBuscar(this.value)"></div>
      <select class="field adm-select" onchange="adminComentariosMod(this.value)">
        <option value="">Todos los mods</option>
        ${conComentarios.map(id => `<option value="${esc(id)}" ${A.ui.cMod === id ? 'selected' : ''}>${esc(A.allTitle(id))}</option>`).join('')}
      </select>
      ${A.btn('refresh', 'Recargar', 'adminRecargarComentarios()', 'btn-soft')}
    </div>
    <div class="chips" id="c-chips"></div>
    <p class="adm-count" id="c-count"></p>
    <div id="adm-comments" class="list"><p class="empty">Cargando…</p></div>
    <div id="c-more"></div>`;
  },
  async list() {
    if (!A.cache.comments) { await A.loadComments(); if (A.visible('comentarios')) return window.renderAdminTab('comentarios'); }
    if (!A.cache.users) A.loadUsers().then(() => { if (A.visible('comentarios')) A.TAB.comentarios.list(); });
    if (!A.visible('comentarios')) return;
    const all = A.cache.comments || [];
    const hoy = dayKey();
    const esHoy = (c) => c.date && (() => { const d = new Date(c.date); return !isNaN(d) && dayKey(d) === hoy; })();
    const q = A.ui.cQuery.trim().toLowerCase();
    let shown = all.filter(c =>
      (!A.ui.cMod || c.modId === A.ui.cMod) &&
      (!A.ui.cUser || c.ownerKey === A.ui.cUser) &&
      (!q || `${c.text || ''} ${c.user || ''}`.toLowerCase().includes(q)) &&
      (A.ui.cFilter === 'todos' || (A.ui.cFilter === 'fijados' && c.isPinned) || (A.ui.cFilter === 'populares' && (c.likes || 0) >= 3) || (A.ui.cFilter === 'baneados' && isBanned(c.ownerKey))));
    if (A.ui.cFilter === 'populares') shown = shown.sort((a, b) => (b.likes || 0) - (a.likes || 0));

    const userChip = A.ui.cUser ? `<button class="chip active" onclick="adminComentariosUsuario('')">${fi('user', 16)} ${esc((A.userOf(A.ui.cUser) || {}).nombre || 'Usuario')} ✕</button>` : '';
    document.getElementById('c-chips').innerHTML = userChip + [
      ['todos', 'Todos', 'chat'], ['fijados', 'Fijados', 'pin'], ['populares', 'Con más likes', 'like'], ['baneados', 'De baneados', 'ban']
    ].map(([k, label, ic]) => `<button class="chip${A.ui.cFilter === k ? ' active' : ''}" onclick="adminComentariosFiltro('${k}')">${fi(ic, 16)} ${label}</button>`).join('');
    document.getElementById('c-count').textContent = `${shown.length} comentario(s) · ${all.filter(esHoy).length} hoy · ${all.length} en total`;

    document.getElementById('adm-comments').innerHTML = shown.slice(0, A.ui.cLimit).map(c => {
      const name = c.user || 'Usuario';
      const jsName = A.jsStr(name);
      const id = esc(c.id), mod = esc(c.modId), uid = esc(c.ownerKey);
      return `
      <article class="rep-card glass" style="--rep:${c.isPinned ? 'var(--warn)' : 'var(--accent)'}">
        <div class="rep-head">
          ${A.avatar(c.ownerKey, name, c.avatar, 40)}
          <div class="grow"><b>${esc(name)} ${tags(c.ownerKey)}</b><small>${esc(c.date || '')} · ${fi('like', 13)} ${Number(c.likes) || 0}${c.isPinned ? ' · ' + fi('pin', 13) + ' Fijado' : ''}</small></div>
        </div>
        <div class="rep-item" role="button" onclick="openModComments('${mod}', '${A.jsStr(A.allTitle(c.modId))}')">
          <img src="${esc(A.itemThumb(c.modId))}" alt="" loading="lazy"><span class="grow"><b>${esc(A.allTitle(c.modId))}</b><small>Toca para ver la conversación</small></span>
        </div>
        <p class="rep-text">${esc(c.text)}</p>
        <div class="adm-actions">
          ${A.btn('send', 'Responder', `adminResponderComentario('${mod}', '${jsName}')`, 'btn-soft')}
          ${A.btn('pin', c.isPinned ? 'Desfijar' : 'Fijar', `adminPinComentario('${mod}', '${id}', ${!!c.isPinned})`)}
          ${A.btn('mail', 'Mensaje privado', `adminResponder('${uid}', '${jsName}')`)}
          ${A.btn('chat', 'Sus comentarios', `adminComentariosUsuario('${uid}')`)}
          ${A.btn('user', 'Ver usuario', `adminVerUsuario('${uid}')`)}
          ${A.btn('verified', isVerified(c.ownerKey) ? 'Quitar verificado' : 'Verificar', `adminVerificar('${uid}')`)}
          ${A.btn('copy', 'Copiar', `adminCopiar(${esc(JSON.stringify(String(c.text || '')))})`)}
          ${c.ownerKey !== window.MI_UID_ADMIN ? A.btn('ban', 'Banear', `openBanPanel('${uid}', '${jsName}')`) : ''}
          ${A.btn('trash', 'Borrar', `adminBorrarComentario('${mod}', '${id}')`, 'btn-danger')}
        </div>
      </article>`;
    }).join('') || `<div class="empty-state">${fi('chat', 48)}<p>No hay comentarios con esos filtros.</p></div>`;

    const quedan = shown.length - A.ui.cLimit;
    document.getElementById('c-more').innerHTML = quedan > 0 ? `<button class="btn btn-ghost btn-block" onclick="adminComentariosMas()">${fi('plus', 18)} Ver ${Math.min(PAGE_COMMENTS, quedan)} más (quedan ${quedan})</button>` : '';
  }
};

window.adminComentariosBuscar = (q) => { A.ui.cQuery = q; A.ui.cLimit = PAGE_COMMENTS; A.TAB.comentarios.list(); };
window.adminComentariosMod = (m) => { A.ui.cMod = m; A.ui.cLimit = PAGE_COMMENTS; A.TAB.comentarios.list(); };
window.adminComentariosFiltro = (f) => { A.ui.cFilter = f; A.ui.cLimit = PAGE_COMMENTS; A.TAB.comentarios.list(); };
window.adminComentariosUsuario = (uid) => {
  A.ui.cUser = uid; A.ui.cLimit = PAGE_COMMENTS;
  if (A.tab !== 'comentarios') window.renderAdminTab('comentarios'); else A.TAB.comentarios.list();
};
window.adminComentariosMas = () => { A.ui.cLimit += PAGE_COMMENTS; A.TAB.comentarios.list(); };
window.adminRecargarComentarios = async () => { await A.loadComments(true); window.renderAdminTab('comentarios'); };

window.adminPinComentario = async (modId, id, state) => {
  await update(ref(db, `mod_comments/${modId}/${id}`), { isPinned: !state });
  const c = (A.cache.comments || []).find(x => x.id === id);
  if (c) c.isPinned = !state;
  A.log('comment:pin', `${state ? 'Desfijó' : 'Fijó'} un comentario de ${c ? c.user : '¿?'} en ${A.allTitle(modId)}`);
  A.TAB.comentarios.list();
};
window.adminBorrarComentario = async (modId, id) => {
  const c = (A.cache.comments || []).find(x => x.id === id);
  if (!confirm(`¿Borrar este comentario${c ? ` de ${c.user}` : ''}?`)) return;
  await remove(ref(db, `mod_comments/${modId}/${id}`));
  A.cache.comments = (A.cache.comments || []).filter(x => x.id !== id);
  A.log('comment:delete', `Borró un comentario de ${c ? c.user : '¿?'} en ${A.allTitle(modId)}: "${c ? String(c.text).slice(0, 60) : ''}"`, c && c.ownerKey);
  toast('Comentario borrado.', 'trash');
  A.TAB.comentarios.list();
};
// Responde en público dentro del hilo del mod (como admin)
window.adminResponderComentario = async (modId, name) => {
  const txt = prompt(`Respuesta pública para ${name} (se publica en los comentarios del mod):`, `@${name} `);
  if (!txt || !txt.trim()) return;
  const p = FNF.getProfile() || {};
  const data = {
    ownerKey: window.usuarioActualFirebase.uid, user: FNF.profileName(p).slice(0, 40), link: '#', avatar: FNF.profilePhoto(p),
    text: txt.trim().slice(0, 300), date: new Date().toLocaleString().slice(0, 40), likes: 0, isPinned: false
  };
  const r = await push(ref(db, `mod_comments/${modId}`), data);
  set(ref(db, `last_comment_time/${modId}`), Date.now()).catch(() => { });
  (A.cache.comments || []).unshift({ modId, id: r.key, ...data });
  A.log('comment:reply', `Respondió a ${name} en ${A.allTitle(modId)}`);
  toast('Respuesta publicada.', 'send');
  A.TAB.comentarios.list();
};

window.adminVerificar = async (uid) => {
  const on = !isVerified(uid);
  await set(ref(db, `verified_users/${uid}`), on ? true : null);
  const name = (A.userOf(uid) || {}).nombre || uid;
  A.log('verify', `${on ? 'Verificó' : 'Quitó el verificado a'} ${name}`, uid);
  toast(on ? 'Usuario verificado.' : 'Verificación quitada.', 'verified');
  setTimeout(() => { if (A.TAB[A.tab]) A.TAB[A.tab].list(); }, 300);
};

// ==========================================
// USUARIOS
// ==========================================
A.TAB.usuarios = {
  shell: () => `
    <div class="adm-toolbar">
      <div class="search glass" style="flex:1 1 220px;margin:0">${fi('search', 18)}<input type="search" placeholder="Nombre, correo o UID..." value="${esc(A.ui.uQuery)}" oninput="adminBuscarUsuarios(this.value)"></div>
      <select class="field adm-select" onchange="adminOrdenarUsuarios(this.value)">
        ${[['recientes', 'Más recientes'], ['antiguos', 'Más antiguos'], ['az', 'A – Z'], ['comentarios', 'Más comentarios']].map(([v, l]) => `<option value="${v}" ${A.ui.uSort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      ${A.btn('refresh', 'Recargar', 'adminRecargarUsuarios()', 'btn-soft')}
    </div>
    <div class="chips" id="u-chips"></div>
    <p class="adm-count" id="u-count"></p>
    <div id="adm-users" class="list"><p class="empty">Cargando…</p></div>
    <div id="u-more"></div>`,
  async list() {
    if (!A.cache.users) await A.loadUsers();
    if (!A.cache.comments) await A.loadComments();
    if (!A.cache.requests) await A.loadRequests();
    if (!A.visible('usuarios')) return;
    const L = live();
    const cCount = {}, likesRec = {};
    (A.cache.comments || []).forEach(c => { cCount[c.ownerKey] = (cCount[c.ownerKey] || 0) + 1; likesRec[c.ownerKey] = (likesRec[c.ownerKey] || 0) + (Number(c.likes) || 0); });
    const rCount = {};
    Object.values(L.ratings || {}).forEach(r => Object.keys(r || {}).forEach(uid => { rCount[uid] = (rCount[uid] || 0) + 1; }));
    const reqCount = {};
    Object.values(A.cache.requests || {}).forEach(r => { if (r.ownerKey) reqCount[r.ownerKey] = (reqCount[r.ownerKey] || 0) + 1; });

    const users = Object.entries(A.cache.users || {});
    const q = A.ui.uQuery.trim().toLowerCase();
    const nuevo = (u) => u.fechaRegistro && Date.now() - new Date(u.fechaRegistro).getTime() < 7 * 86400000;
    const counts = {
      todos: users.length, verificados: users.filter(([uid]) => isVerified(uid)).length, baneados: users.filter(([uid]) => isBanned(uid)).length,
      nuevos: users.filter(([, u]) => nuevo(u)).length, activos: users.filter(([uid]) => cCount[uid]).length
    };
    document.getElementById('u-chips').innerHTML = [
      ['todos', 'Todos', 'users'], ['nuevos', 'Nuevos (7 d)', 'plus'], ['activos', 'Con comentarios', 'chat'], ['verificados', 'Verificados', 'verified'], ['baneados', 'Baneados', 'ban']
    ].map(([k, label, ic]) => `<button class="chip${A.ui.uFilter === k ? ' active' : ''}" onclick="adminVerUsuarios('${k}')">${fi(ic, 16)} ${label} <span class="chip-n">${counts[k]}</span></button>`).join('');

    let found = users.filter(([uid, u]) =>
      (!q || `${u.nombre || ''} ${u.correo || ''} ${uid}`.toLowerCase().includes(q)) &&
      (A.ui.uFilter === 'todos' || (A.ui.uFilter === 'verificados' && isVerified(uid)) || (A.ui.uFilter === 'baneados' && isBanned(uid)) || (A.ui.uFilter === 'nuevos' && nuevo(u)) || (A.ui.uFilter === 'activos' && cCount[uid])));
    const fecha = (u) => String(u.fechaRegistro || '');
    found = found.sort({
      recientes: (a, b) => fecha(b[1]).localeCompare(fecha(a[1])),
      antiguos: (a, b) => fecha(a[1]).localeCompare(fecha(b[1])),
      az: (a, b) => String(a[1].nombre || '').localeCompare(String(b[1].nombre || '')),
      comentarios: (a, b) => (cCount[b[0]] || 0) - (cCount[a[0]] || 0)
    }[A.ui.uSort]);

    const shown = found.slice(0, A.ui.uLimit);
    document.getElementById('u-count').textContent = `Mostrando ${shown.length} de ${found.length} (${users.length} usuarios en total)`;
    document.getElementById('adm-users').innerHTML = shown.map(([uid, u]) => {
      const name = u.nombre || 'Usuario';
      const jsName = A.jsStr(name);
      const ban = (L.banned || {})[uid];
      const dias = u.fechaRegistro ? Math.floor((Date.now() - new Date(u.fechaRegistro).getTime()) / 86400000) : null;
      const favs = u.favoritos ? Object.keys(u.favoritos).length : 0;
      const isMe = uid === window.MI_UID_ADMIN;
      return `
      <article class="rep-card glass user-card" style="--rep:${isBanned(uid) ? 'var(--danger)' : isVerified(uid) ? 'var(--ok)' : 'var(--accent)'}">
        <div class="rep-head">
          ${A.avatar(uid, name, u.foto, 48)}
          <div class="grow"><b>${esc(name)} ${tags(uid)}</b><small>${esc(u.correo || 'sin correo')}</small></div>
        </div>
        <div class="user-stats">
          <span>${fi('chat', 16)} <b>${cCount[uid] || 0}</b> comentarios</span>
          <span>${fi('like', 16)} <b>${likesRec[uid] || 0}</b> likes recibidos</span>
          <span>${fi('star', 16)} <b>${rCount[uid] || 0}</b> calificaciones</span>
          <span>${fi('heart', 16)} <b>${favs}</b> favoritos</span>
          <span>${fi('idea', 16)} <b>${reqCount[uid] || 0}</b> pedidos</span>
        </div>
        <div class="rep-meta">
          <span>${fi('calendar', 15)} Registro: ${fmtDateTime(u.fechaRegistro)}${dias !== null ? ` (${dias} d)` : ''}</span>
          ${u.ultimaFechaCambio ? `<span>${fi('edit', 15)} Cambió su apodo ${timeAgo(u.ultimaFechaCambio)}</span>` : ''}
          <span>${fi('lock', 15)} UID ${esc(uid.slice(0, 10))}…</span>
        </div>
        ${isBanned(uid) ? `<p class="rep-text" style="border-color:var(--danger)">${fi('ban', 16)} Baneado: ${esc(ban.reason || '')} · termina ${fmtDateTime(ban.expiresAt)}</p>` : ''}
        <div class="adm-actions">
          ${A.btn('mail', 'Mensaje', `adminResponder('${esc(uid)}', '${jsName}')`, 'btn-soft')}
          ${A.btn('chat', 'Sus comentarios', `adminComentariosUsuario('${esc(uid)}')`)}
          ${isMe ? '' : A.btn('verified', isVerified(uid) ? 'Quitar verificado' : 'Verificar', `adminVerificar('${esc(uid)}')`)}
          ${A.btn('copy', 'Copiar UID', `adminCopiar('${esc(uid)}')`)}
          ${u.correo ? A.btn('mail', 'Copiar correo', `adminCopiar('${esc(u.correo)}')`) : ''}
          ${isMe ? '' : isBanned(uid) ? A.btn('check', 'Desbanear', `adminDesbanear('${esc(uid)}')`, 'btn') : A.btn('ban', 'Banear', `openBanPanel('${esc(uid)}', '${jsName}')`)}
          ${isMe ? '' : A.btn('trash', 'Borrar cuenta', `adminBorrarCuenta('${esc(uid)}', '${jsName}')`, 'btn-danger')}
        </div>
      </article>`;
    }).join('') || `<div class="empty-state">${fi('users', 48)}<p>Sin resultados.</p></div>`;

    const quedan = found.length - shown.length;
    document.getElementById('u-more').innerHTML = quedan > 0
      ? `<button class="btn btn-ghost btn-block" onclick="adminUsuariosMas()">${fi('users', 18)} Ver otros ${Math.min(PAGE_USERS, quedan)} (quedan ${quedan})</button>
         <button class="btn btn-ghost btn-block" style="margin-top:6px" onclick="adminUsuariosTodos()">Ver todos de una vez</button>` : '';
  }
};

window.adminBuscarUsuarios = (q) => { A.ui.uQuery = q; A.ui.uLimit = PAGE_USERS; A.TAB.usuarios.list(); };
window.adminOrdenarUsuarios = (s) => { A.ui.uSort = s; A.TAB.usuarios.list(); };
window.adminUsuariosMas = () => { A.ui.uLimit += PAGE_USERS; A.TAB.usuarios.list(); };
window.adminUsuariosTodos = () => { A.ui.uLimit = 100000; A.TAB.usuarios.list(); };
window.adminRecargarUsuarios = async () => { await Promise.all([A.loadUsers(true), A.loadComments(true), A.loadRequests(true)]); window.renderAdminTab('usuarios'); };
// Abre Usuarios con un filtro (todos, nuevos, baneados…)
window.adminVerUsuarios = (filtro) => {
  A.ui.uFilter = filtro; A.ui.uQuery = ''; A.ui.uLimit = PAGE_USERS;
  if (A.tab !== 'usuarios') window.renderAdminTab('usuarios'); else A.TAB.usuarios.list();
};
// Abre Usuarios buscando a una persona concreta
window.adminVerUsuario = (uid) => {
  if (window.currentSection && window.currentSection() !== 'admin') window.selectSection('admin');
  A.ui.uFilter = 'todos'; A.ui.uQuery = uid; A.ui.uLimit = PAGE_USERS;
  window.renderAdminTab('usuarios');
};
window.adminDesbanear = async (uid) => {
  await remove(ref(db, `banned_users/${uid}`));
  A.log('unban', `Desbaneó a ${(A.userOf(uid) || {}).nombre || uid}`, uid);
  toast('Usuario desbaneado.', 'check');
  setTimeout(() => { if (A.TAB[A.tab]) A.TAB[A.tab].list(); }, 300);
};

// ==========================================
// BORRAR UNA CUENTA COMPLETA
// ==========================================
window.adminBorrarCuenta = async (uid, name) => {
  if (!uid || uid === window.MI_UID_ADMIN) return;
  const ok = prompt(`Se borrará TODO de "${name}": perfil, comentarios, likes, calificaciones, votos, pedidos y mensajes.\n\nNo se puede deshacer. Para confirmar escribe: BORRAR`);
  if (ok !== 'BORRAR') return toast('Cancelado.', 'info');
  toast('Borrando cuenta…', 'trash');
  try {
    const [comments, likesReg, requests, tickets, brokenReports] = await Promise.all([
      get(ref(db, 'mod_comments')).then(s => s.val() || {}),
      get(ref(db, 'likes_registry')).then(s => s.val() || {}),
      get(ref(db, 'mod_requests')).then(s => s.val() || {}),
      Promise.resolve(A.cache.tickets || {}),
      get(ref(db, 'broken_reports')).then(s => s.val() || {}).catch(() => ({}))
    ]);
    const L = live();
    const upd = {
      [`usuarios/${uid}`]: null, [`user_notifications/${uid}`]: null, [`request_cooldown/${uid}`]: null,
      [`ticket_cooldown/${uid}`]: null, [`comment_cooldown/${uid}`]: null, [`verified_users/${uid}`]: null,
      [`dl_last/${uid}`]: null
    };
    Object.entries(brokenReports).forEach(([item, users]) => { if (users && users[uid]) upd[`broken_reports/${item}/${uid}`] = null; });
    let nC = 0, nL = 0, nR = 0, nV = 0;
    Object.entries(comments).forEach(([modId, cs]) => Object.entries(cs || {}).forEach(([cid, c]) => {
      if (!c) return;
      if (c.ownerKey === uid) { upd[`mod_comments/${modId}/${cid}`] = null; nC++; return; }
      if (c.userLikes && c.userLikes[uid]) {
        upd[`mod_comments/${modId}/${cid}/userLikes/${uid}`] = null;
        upd[`mod_comments/${modId}/${cid}/likes`] = Math.max(0, (Number(c.likes) || 1) - 1);
      }
    }));
    Object.entries(likesReg).forEach(([item, users]) => {
      if (users && users[uid]) {
        upd[`likes_registry/${item}/${uid}`] = null;
        upd[`likes/${item}`] = Math.max(0, (Number((L.likes || {})[item]) || 1) - 1);
        nL++;
      }
    });
    Object.entries(L.ratings || {}).forEach(([item, r]) => { if (r && r[uid]) { upd[`ratings/${item}/${uid}`] = null; nR++; } });
    Object.entries(requests).forEach(([rid, r]) => {
      if (!r) return;
      if (r.ownerKey === uid) { upd[`mod_requests/${rid}`] = null; return; }
      if (r.voters && r.voters[uid]) {
        upd[`mod_requests/${rid}/voters/${uid}`] = null;
        upd[`mod_requests/${rid}/votes`] = Math.max(0, (Number(r.votes) || 1) - 1);
        nV++;
      }
    });
    Object.entries(tickets).forEach(([k, tk]) => { if (tk && tk.uid === uid) upd[`support_tickets/${k}`] = null; });
    await update(ref(db), upd);
    A.log('account:delete', `Borró la cuenta de ${name}: ${nC} comentarios, ${nL} likes, ${nR} calificaciones y ${nV} votos`, uid);
    delete (A.cache.users || {})[uid];
    A.cache.comments = (A.cache.comments || []).filter(c => c.ownerKey !== uid);
    window.mostrarMensaje('Cuenta borrada', `Se borraron los datos de ${name} (${nC} comentarios, ${nL} likes, ${nR} calificaciones y ${nV} votos).\n\nSu inicio de sesión de Google sigue registrado en Firebase → Authentication. Si quieres quitarlo también, búscalo ahí por su UID y elimínalo.`);
    if (A.TAB[A.tab]) window.renderAdminTab(A.tab);
  } catch (err) {
    console.error(err);
    toast('No se pudo borrar. ¿Publicaste las reglas nuevas de Firebase?', 'alert');
  }
};
}).catch(err => console.error(err));
