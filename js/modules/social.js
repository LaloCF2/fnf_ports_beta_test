// Likes, comentarios, calificaciones y baneos.
window.fbReady.then((FB) => {
const { db, ref, get, set, update, remove, push, onValue } = FB;
const { store, t, esc, vibrate, openPopup, closePopup, toast, getProfile, profileName, profilePhoto, stringToColor, isAdmin } = FNF;
const live = () => window.live || {};
const ADMIN_UID = window.MI_UID_ADMIN;

// Cambia un contador junto con la marca "este usuario ya votó" en una sola escritura.
// Las reglas de Firebase solo aceptan +1 si la marca es nueva y -1 si se quita: 1 voto por persona.
async function coupledToggle(countPath, flagPath) {
  for (let intento = 0; intento < 3; intento++) {
    const [countSnap, flagSnap] = await Promise.all([get(ref(db, countPath)), get(ref(db, flagPath))]);
    const count = Number(countSnap.val()) || 0;
    const had = flagSnap.exists();
    try {
      await update(ref(db), {
        [flagPath]: had ? null : true,
        [countPath]: had ? Math.max(0, count - 1) : count + 1
      });
      return !had;
    } catch (err) {
      // Otro usuario votó al mismo tiempo: se vuelve a leer y se intenta otra vez
      if (intento === 2) throw err;
    }
  }
}
FNF.coupledToggle = coupledToggle;

// ==========================================
// BANEOS
// ==========================================
async function checkBanStatus() {
  const u = window.usuarioActualFirebase;
  if (!u) return false;
  const snap = await get(ref(db, `banned_users/${u.uid}`));
  if (!snap.exists()) return false;
  const ban = snap.val();
  if (Date.now() < ban.expiresAt) {
    window.mostrarMensaje(t('⛔ Acceso restringido', '⛔ Access restricted'),
      t(`Motivo: ${ban.reason}\nTermina en: ${Math.ceil((ban.expiresAt - Date.now()) / 3600000)} h`, `Reason: ${ban.reason}\nEnds in: ${Math.ceil((ban.expiresAt - Date.now()) / 3600000)} h`));
    return true;
  }
  await set(ref(db, `banned_users/${u.uid}`), null).catch(() => { });
  return false;
}
FNF.checkBanStatus = checkBanStatus;

// Versión instantánea (con los baneos que ya llegan en vivo): para likes, votos y calificaciones.
// Las reglas de Firebase también se lo impiden; esto solo muestra el aviso en vez de un error.
function avisoBaneo() {
  const u = window.usuarioActualFirebase;
  const ban = u && (live().banned || {})[u.uid];
  if (!ban || !(Date.now() < ban.expiresAt)) return false;
  window.mostrarMensaje(t('⛔ Acceso restringido', '⛔ Access restricted'),
    t(`Motivo: ${ban.reason}\nTermina en: ${Math.ceil((ban.expiresAt - Date.now()) / 3600000)} h`, `Reason: ${ban.reason}\nEnds in: ${Math.ceil((ban.expiresAt - Date.now()) / 3600000)} h`));
  return true;
}
FNF.avisoBaneo = avisoBaneo;

window.openBanPanel = (userKey, userName) => {
  if (!isAdmin() || !userKey || userKey === ADMIN_UID) return;
  document.getElementById('ban-target-info').textContent = `Gestionando a: ${userName}`;
  openPopup('ban-popup');
  document.getElementById('confirmBanBtn').onclick = async () => {
    const reason = document.getElementById('banReason').value.trim() || 'Normas';
    const hours = parseInt(document.getElementById('banDuration').value) || 24;
    await set(ref(db, `banned_users/${userKey}`), { userName: String(userName).slice(0, 40), reason, expiresAt: Date.now() + hours * 3600000 });
    toast(`${userName} baneado por ${hours} h.`, 'ban');
    if (FNF.logAdmin) FNF.logAdmin('ban', `Baneó a ${userName} por ${hours} h: ${reason}`, userKey);
    closePopup('ban-popup');
    if (window.renderAdminTab) window.renderAdminTab('usuarios', true);
  };
};

// ==========================================
// LIKES DE MODS
// ==========================================
window.handleLike = async (id, el) => {
  if (window.exigirRegistro() || avisoBaneo()) return;
  const uid = window.usuarioActualFirebase.uid;
  if (el) el.disabled = true;
  try {
    const liked = await coupledToggle(`likes/${id}`, `likes_registry/${id}/${uid}`);
    const mine = store.json('my_liked_items', {});
    if (liked) mine[id] = true; else delete mine[id];
    store.setJson('my_liked_items', mine);
    if (el) el.classList.toggle('active', liked);
    vibrate(20);
  } catch (err) {
    console.error('Like:', err);
    toast(t('No se pudo guardar tu like. Intenta de nuevo.', "Couldn't save your like. Try again."), 'alert');
  } finally {
    if (el) el.disabled = false;
  }
};

// ==========================================
// COMENTARIOS
// ==========================================
const MAX_COMENTARIO = 150;
let currentCommentsId = null;
let commentsUnsub = null;
let comentarios = {};            // los del mod abierto
let ordenComentarios = 'recientes';
let nombresHilo = new Set();     // para pintar las @menciones en azul
let primeraVez = true;           // la animación de entrada solo al abrir
let respondiendo = null;         // { hilo, id, name }: a quién le estás respondiendo
let hilosAbiertos = new Set();   // hilos con más de 2 respuestas que el usuario abrió
let recienEnviado = null;        // para resaltar y mostrar tu comentario recién publicado
const HILO_PLEGADO = 2;          // con más de 2 respuestas, el hilo empieza plegado
const $ = (id) => document.getElementById(id);

// La clave que crea Firebase (push) trae escondida la hora exacta en que se escribió
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
const pushTime = (key) => {
  let ts = 0;
  for (let i = 0; i < 8; i++) {
    const v = PUSH_CHARS.indexOf(String(key).charAt(i));
    if (v < 0) return 0;
    ts = ts * 64 + v;
  }
  return ts > 1.4e12 && ts < Date.now() + 864e5 ? ts : 0;
};

// Texto con las @menciones en azul (reconoce nombres con espacios si son de alguien del hilo)
function conMenciones(raw) {
  const s = String(raw || '');
  const nombres = [...nombresHilo].filter(Boolean).sort((a, b) => b.length - a.length);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const at = s.indexOf('@', i);
    if (at < 0) { out += esc(s.slice(i)); break; }
    out += esc(s.slice(i, at));
    const resto = s.slice(at + 1);
    const low = resto.toLowerCase();
    let largo = 0;
    const conocido = nombres.find(n => low.startsWith(n.toLowerCase()) && !/[\p{L}\p{N}_]/u.test(resto.charAt(n.length)));
    if (conocido) largo = conocido.length;
    else { const m = resto.match(/^[\p{L}\p{N}_.\-]{1,30}/u); largo = m ? m[0].length : 0; }
    if (largo) {
      out += `<span class="mc-mention">@${esc(resto.slice(0, largo))}</span>`;
      i = at + 1 + largo;
    } else {
      out += '@';
      i = at + 1;
    }
  }
  return out;
}
FNF.conMenciones = conMenciones;

const avatarHTML = (name, foto, extra = '') => {
  const src = FNF.safeAvatar(foto);
  return `<div class="mc-avatar${extra}" style="background:${stringToColor(name)}"><span>${esc(String(name).charAt(0).toUpperCase())}</span>${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>`;
};

function pintarComentarios() {
  const list = $('mc-commentList');
  if (!list) return;
  const myUid = window.usuarioActualFirebase && window.usuarioActualFirebase.uid;
  const yo = profileName(getProfile()).toLowerCase();
  const all = Object.entries(comentarios || {}).filter(([, c]) => c && c.text != null).map(([id, c]) => ({ id, ...c, ts: pushTime(id) }));
  $('mc-count').textContent = all.length;
  nombresHilo = new Set(all.map(c => c.user).filter(Boolean));
  actualizarEspejo();

  if (!all.length) {
    list.innerHTML = `<div class="mc-empty">${FNF.fi('chat', 44)}<b>${t('Aún no hay comentarios', 'No comments yet')}</b><span>${t('¡Sé el primero en opinar sobre este mod!', 'Be the first to share your thoughts!')}</span></div>`;
    return;
  }
  // Hilos: cada respuesta va debajo de su comentario (si ese comentario se borró, la respuesta queda suelta)
  const porId = Object.fromEntries(all.map(c => [c.id, c]));
  const respuestas = {};
  const principales = [];
  all.forEach(c => {
    if (c.replyTo && porId[c.replyTo] && !porId[c.replyTo].replyTo && c.replyTo !== c.id) (respuestas[c.replyTo] = respuestas[c.replyTo] || []).push(c);
    else principales.push(c);
  });
  Object.values(respuestas).forEach(l => l.sort((a, b) => (a.ts - b.ts) || a.id.localeCompare(b.id))); // en orden de conversación
  const porFecha = (a, b) => (b.ts - a.ts) || b.id.localeCompare(a.id);
  principales.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
    (ordenComentarios === 'populares'
      ? ((Number(b.likes) || 0) + (respuestas[b.id] || []).length) - ((Number(a.likes) || 0) + (respuestas[a.id] || []).length) || porFecha(a, b)
      : porFecha(a, b)));

  const item = (c, i, hilo, esRespuesta) => {
    const name = c.user || 'Usuario';
    const byAdmin = c.ownerKey === ADMIN_UID;
    const verified = !!(live().verified || {})[c.ownerKey];
    const mine = !!myUid && c.ownerKey === myUid;
    const liked = !!(c.userLikes && myUid && c.userLikes[myUid]);
    const likes = Number(c.likes) || 0;
    const padre = esRespuesta ? porId[hilo] : null;
    const meRespondio = !mine && padre && myUid && padre.ownerKey === myUid;
    const paraMi = !mine && !meRespondio && yo.length >= 3 && String(c.text || '').toLowerCase().includes('@' + yo);
    const huerfano = !esRespuesta && c.replyTo && !porId[c.replyTo];
    const cuando = c.ts ? FNF.timeAgo(c.ts) : esc(c.date || '');
    const fecha = c.ts ? FNF.fmtDateTime(c.ts) : esc(c.date || '');
    const cls = ['mc-item', esRespuesta && 'mc-reply', c.isPinned && !esRespuesta && 'is-pinned', mine && 'is-mine', (paraMi || meRespondio) && 'is-for-me', c.id === recienEnviado && 'mc-new'].filter(Boolean).join(' ');

    // Respuestas de este comentario (plegadas si son muchas)
    let hiloHTML = '';
    const rs = esRespuesta ? [] : (respuestas[c.id] || []);
    if (rs.length) {
      const abierto = rs.length <= HILO_PLEGADO || hilosAbiertos.has(c.id);
      const minis = [...new Map(rs.map(r => [r.ownerKey, r])).values()].slice(0, 3)
        .map(r => avatarHTML(r.user || '?', r.avatar)).join('');
      hiloHTML = `
        <div class="mc-thread">
          ${rs.length > HILO_PLEGADO ? `<button class="mc-thread-toggle" data-act="thread">
            ${abierto ? FNF.icon('up', 'icon icon-sm') + t('Ocultar respuestas', 'Hide replies')
              : `<span class="mc-mini-avs">${minis}</span>${FNF.icon('down', 'icon icon-sm')}${t(`Ver ${rs.length} respuestas`, `View ${rs.length} replies`)}`}
          </button>` : ''}
          ${abierto ? `<div class="mc-replies">${rs.map(r => item(r, 0, c.id, true)).join('')}</div>` : ''}
        </div>`;
    }

    return `
      <article class="${cls}" data-id="${esc(c.id)}" data-thread="${esc(esRespuesta ? hilo : c.id)}" style="--d:${Math.min(i, 8) * 35}ms">
        ${avatarHTML(name, c.avatar, byAdmin ? ' ring-admin' : verified ? ' ring-verified' : '')}
        <div class="mc-body">
          <div class="mc-bubble">
            ${c.isPinned && !esRespuesta ? `<span class="mc-pin">${FNF.icon('pin', 'icon icon-sm')} ${t('Fijado por el admin', 'Pinned by admin')}</span>` : ''}
            ${meRespondio ? `<span class="mc-pin mc-pin-me">${FNF.icon('reply', 'icon icon-sm')} ${t('Te respondió', 'Replied to you')}</span>` : ''}
            ${paraMi ? `<span class="mc-pin mc-pin-me">${FNF.icon('bell', 'icon icon-sm')} ${t('Te mencionaron', 'You were mentioned')}</span>` : ''}
            ${huerfano ? `<span class="mc-orphan">${FNF.icon('reply', 'icon icon-sm')} ${t('Respuesta a un comentario que se borró', 'Reply to a deleted comment')}</span>` : ''}
            <div class="mc-meta">
              <button class="mc-name${byAdmin ? ' is-admin' : ''}" data-act="name" data-uid="${esc(c.ownerKey)}" data-name="${esc(name)}">${esc(name)}</button>
              ${byAdmin ? '<span class="admin-tag">ADMIN</span>' : verified ? FNF.fi('verified', 15) : ''}
              <span class="mc-time" title="${fecha}">· ${cuando}</span>
            </div>
            <p class="mc-text">${conMenciones(c.text)}</p>
          </div>
          <div class="mc-actions">
            <button class="mc-act mc-like${liked ? ' on' : ''}" data-act="like" aria-label="Like">${FNF.icon('heart', 'icon icon-sm')}<span>${likes || ''}</span></button>
            <button class="mc-act" data-act="reply" data-name="${esc(name)}">${FNF.icon('reply', 'icon icon-sm')}<span>${t('Responder', 'Reply')}</span></button>
            ${!esRespuesta && rs.length && rs.length <= HILO_PLEGADO ? `<span class="mc-count-replies">${rs.length} ${rs.length === 1 ? t('respuesta', 'reply') : t('respuestas', 'replies')}</span>` : ''}
            <span class="grow"></span>
            ${isAdmin() && !esRespuesta ? `<button class="mc-act" data-act="pin" data-pinned="${c.isPinned ? 1 : 0}" aria-label="${c.isPinned ? 'Desfijar' : 'Fijar'}">${FNF.icon('pin', 'icon icon-sm')}<span>${c.isPinned ? 'Desfijar' : 'Fijar'}</span></button>` : ''}
            ${isAdmin() || mine ? `<button class="mc-act danger" data-act="del" aria-label="${t('Borrar', 'Delete')}">${FNF.icon('trash', 'icon icon-sm')}</button>` : ''}
          </div>
          ${hiloHTML}
        </div>
      </article>`;
  };

  list.classList.toggle('mc-anim', primeraVez);
  primeraVez = false;
  list.innerHTML = principales.map((c, i) => item(c, i, c.id, false)).join('');

  // Tu comentario recién publicado: se muestra y se resalta un momento
  if (recienEnviado) {
    const nuevo = list.querySelector(`.mc-item[data-id="${CSS.escape(recienEnviado)}"]`);
    if (nuevo) {
      nuevo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      recienEnviado = null;
    }
  }
}

// Cuántas respuestas tiene un comentario (para avisar antes de borrarlo)
const respuestasDe = (id) => Object.entries(comentarios || {}).filter(([, c]) => c && c.replyTo === id).map(([k]) => k);

window.mcOrdenar = (modo) => {
  ordenComentarios = modo;
  document.querySelectorAll('.mc-sort button').forEach(b => b.classList.toggle('active', b.dataset.sort === modo));
  primeraVez = true;
  pintarComentarios();
  vibrate(10);
};

window.openModComments = (id, title) => {
  if (window.exigirRegistro()) return;
  currentCommentsId = id;
  comentarios = {};
  primeraVez = true;
  respondiendo = null;
  hilosAbiertos = new Set();
  recienEnviado = null;
  pintarRespondiendo();
  $('mc-title').textContent = title || '';
  $('mc-count').textContent = '…';
  $('mc-commentList').innerHTML = `<div class="mc-skeleton"><span></span><span></span><span></span></div>`;

  store.set(`seen_comments_${id}`, Date.now());
  const led = document.getElementById('led-yellow-' + id);
  if (led) led.style.display = 'none';

  const user = getProfile();
  const nombre = profileName(user);
  $('mc-displayMyName').innerHTML = `${t('Comentando como', 'Commenting as')} <b class="${isAdmin() ? 'admin-name' : ''}">${esc(nombre)}</b>`;
  $('mc-myAvatar').outerHTML = avatarHTML(nombre, profilePhoto(user), isAdmin() ? ' ring-admin' : '').replace('<div class="mc-avatar', '<div id="mc-myAvatar" class="mc-avatar');
  $('mc-commentText').placeholder = t('Escribe un comentario… (usa @ para mencionar)', 'Write a comment… (use @ to mention)');
  actualizarEspejo();

  openPopup('mod-comments-popup');

  if (commentsUnsub) commentsUnsub();
  commentsUnsub = onValue(ref(db, `mod_comments/${id}`), (snapshot) => {
    comentarios = snapshot.val() || {};
    pintarComentarios();
  });
};

window.closeModComments = () => {
  closePopup('mod-comments-popup');
  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
};

// Botones de cada comentario (un solo escuchador para toda la lista)
$('mc-commentList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const item = btn.closest('.mc-item');
  const id = item && item.dataset.id;
  const act = btn.dataset.act;
  if (act === 'like') {
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 400);
    window.likeModComment(id);
  } else if (act === 'reply') window.replyModComment(btn.dataset.name, item.dataset.thread, id);
  else if (act === 'thread') {
    // Abrir / cerrar un hilo con muchas respuestas
    if (hilosAbiertos.has(id)) hilosAbiertos.delete(id); else hilosAbiertos.add(id);
    pintarComentarios();
    vibrate(10);
  } else if (act === 'name') {
    if (isAdmin() && btn.dataset.uid !== ADMIN_UID) window.openBanPanel(btn.dataset.uid, btn.dataset.name);
    else window.replyModComment(btn.dataset.name, item.dataset.thread, id);
  } else if (act === 'pin') window.togglePinModComment(id, btn.dataset.pinned === '1');
  else if (act === 'del') window.deleteModComment(id);
});

window.addModComment = async () => {
  if (window.exigirRegistro()) return;
  if (await checkBanStatus()) return;
  const u = window.usuarioActualFirebase;
  const p = getProfile();
  const box = document.getElementById('mc-commentText');
  const text = box.value.trim().slice(0, MAX_COMENTARIO);
  if (!text) return toast(t('Escribe algo...', 'Write something...'), 'chat');

  // Palabras bloqueadas (se editan en Panel → Herramientas → Moderación)
  if (!isAdmin() && tieneGroserias(text)) {
    return window.mostrarMensaje(t('Comentario no permitido', 'Comment not allowed'),
      t('Tu comentario tiene palabras que no están permitidas en la comunidad. Cámbialo e inténtalo de nuevo.', 'Your comment contains words that are not allowed. Please edit it and try again.'));
  }

  // 1 comentario cada 15 segundos (lo aplica Firebase)
  const espera = 15000 - (Date.now() - Number(store.get('last_comment_sent', 0)));
  if (!isAdmin() && espera > 0) {
    return toast(t(`Espera ${Math.ceil(espera / 1000)} s antes de comentar otra vez.`, `Wait ${Math.ceil(espera / 1000)} s before commenting again.`), 'clock');
  }

  try {
    const key = push(ref(db, `mod_comments/${currentCommentsId}`)).key;
    const nuevo = {
      ownerKey: u.uid, user: profileName(p).slice(0, 40), link: '#', avatar: profilePhoto(p),
      text, date: new Date().toLocaleString().slice(0, 40), likes: 0, isPinned: false
    };
    // Si es una respuesta, se guarda a qué comentario (hilo) pertenece
    const hilo = respondiendo && comentarios[respondiendo.hilo] ? respondiendo.hilo : null;
    if (hilo) nuevo.replyTo = hilo;
    const upd = { [`mod_comments/${currentCommentsId}/${key}`]: nuevo };
    if (!isAdmin()) upd[`comment_cooldown/${u.uid}`] = FB.serverTimestamp();
    // El LED amarillo ("comentarios nuevos") va en la misma escritura: las reglas solo lo aceptan junto a un comentario
    upd[`last_comment_time/${currentCommentsId}`] = FB.serverTimestamp();
    await update(ref(db), upd);
    store.set('last_comment_sent', String(Date.now()));
    store.set(`seen_comments_${currentCommentsId}`, Date.now() + 60000);
    box.value = '';
    respondiendo = null;
    pintarRespondiendo();
    actualizarEspejo();
    recienEnviado = key;
    if (hilo) {
      // Respuesta: se abre su hilo y se lleva la vista hasta ella
      hilosAbiertos.add(hilo);
      pintarComentarios();
    } else {
      // Comentario nuevo: arriba de la lista (en "Recientes")
      if (ordenComentarios !== 'recientes') window.mcOrdenar('recientes');
      $('mc-commentList').scrollTo({ top: 0, behavior: 'smooth' });
    }
    vibrate(20);
  } catch (err) {
    console.error('Comentario:', err);
    toast(String(err && err.message).includes('PERMISSION')
      ? t('Espera unos segundos antes de comentar otra vez.', 'Wait a few seconds before commenting again.')
      : t('No se pudo publicar tu comentario.', "Couldn't post your comment."), 'alert');
  }
};

// Revisa la lista de palabras bloqueadas (sin importar mayúsculas, acentos ni letras repetidas)
const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!]/g, 'i').replace(/0/g, 'o').replace(/(.)\1+/g, '$1');
function tieneGroserias(text) {
  const lista = (((window.live || {}).config || {}).moderation || {}).badWords || [];
  if (!lista.length) return false;
  const limpio = ' ' + normalizar(text).replace(/[^a-zñ0-9]+/g, ' ') + ' ';
  return lista.some(w => { const n = normalizar(w).trim(); return n && limpio.includes(' ' + n + ' '); });
}
FNF.tieneGroserias = tieneGroserias;

window.likeModComment = async (commentId) => {
  if (window.exigirRegistro() || avisoBaneo()) return;
  const base = `mod_comments/${currentCommentsId}/${commentId}`;
  try {
    await coupledToggle(`${base}/likes`, `${base}/userLikes/${window.usuarioActualFirebase.uid}`);
    vibrate(15);
  } catch (err) {
    console.error('Like comentario:', err);
  }
};

// Borrar: el admin borra también las respuestas del hilo; los demás solo su propio comentario
window.deleteModComment = (id) => {
  const hijas = isAdmin() ? respuestasDe(id) : [];
  const msg = hijas.length
    ? `¿Borrar este comentario y sus ${hijas.length} respuesta(s)?`
    : t('¿Borrar comentario?', 'Delete comment?');
  if (!confirm(msg)) return;
  if (!hijas.length) return remove(ref(db, `mod_comments/${currentCommentsId}/${id}`));
  update(ref(db), Object.fromEntries([id, ...hijas].map(k => [`mod_comments/${currentCommentsId}/${k}`, null])));
};
window.togglePinModComment = (id, state) => update(ref(db, `mod_comments/${currentCommentsId}/${id}`), { isPinned: !state });

// Responder: tu mensaje queda debajo de ese comentario (en su hilo) y empieza con @Nombre
window.replyModComment = (name, hilo, id) => {
  const tx = $('mc-commentText');
  const raiz = hilo && comentarios[hilo] && !comentarios[hilo].replyTo ? hilo : (comentarios[hilo] || {}).replyTo || null;
  respondiendo = raiz && comentarios[raiz] ? { hilo: raiz, id: id || raiz, name } : null;
  const yo = profileName(getProfile());
  const tag = `@${name} `;
  // Si ya respondías a otra persona del hilo, se cambia esa mención por la nueva
  const previo = [...nombresHilo].find(n => tx.value.startsWith(`@${n} `));
  const resto = previo ? tx.value.slice(previo.length + 2) : tx.value;
  tx.value = (name === yo ? resto : tag + resto).slice(0, MAX_COMENTARIO); // a ti mismo no te mencionas
  pintarRespondiendo();
  actualizarEspejo();
  tx.focus();
  tx.setSelectionRange(tx.value.length, tx.value.length);
  vibrate(10);
};

// "Respondiendo a @Nombre: «inicio del comentario…»" arriba de la caja de texto
function pintarRespondiendo() {
  const el = $('mc-replying');
  if (!el) return;
  if (!respondiendo) { el.hidden = true; el.innerHTML = ''; return; }
  const c = comentarios[respondiendo.id] || comentarios[respondiendo.hilo] || {};
  el.hidden = false;
  el.innerHTML = `${FNF.icon('reply', 'icon icon-sm')}
    <span><span>${t('Respondiendo a', 'Replying to')} <b>@${esc(respondiendo.name)}</b></span>${c.text ? `<small>«${esc(String(c.text).slice(0, 70))}${String(c.text).length > 70 ? '…' : ''}»</small>` : ''}</span>
    <button type="button" onclick="mcCancelarRespuesta()" aria-label="${t('Cancelar respuesta', 'Cancel reply')}">${FNF.icon('x', 'icon icon-sm')}</button>`;
}
window.mcCancelarRespuesta = () => {
  const tx = $('mc-commentText');
  if (respondiendo && tx.value.startsWith(`@${respondiendo.name} `)) tx.value = tx.value.slice(respondiendo.name.length + 2);
  respondiendo = null;
  pintarRespondiendo();
  actualizarEspejo();
  tx.focus();
};

// La caja de texto: contador, botón de enviar y las @menciones en azul mientras escribes
function actualizarEspejo() {
  const tx = $('mc-commentText');
  if (!tx) return;
  const n = tx.value.length;
  $('mc-mirror').innerHTML = conMenciones(tx.value) + '​';
  $('mc-charCounter').textContent = n;
  $('mc-counter').classList.toggle('warn', n >= MAX_COMENTARIO - 20);
  $('mc-counter').classList.toggle('full', n >= MAX_COMENTARIO);
  $('mc-send').disabled = !tx.value.trim();
}
$('mc-commentText').addEventListener('input', actualizarEspejo);
$('mc-commentText').addEventListener('scroll', function () { $('mc-mirror').scrollTop = this.scrollTop; });
// Ctrl/Cmd + Enter = enviar (en compu)
$('mc-commentText').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); window.addModComment(); }
});

// ==========================================
// CALIFICACIONES
// ==========================================
function paintStars(n) {
  document.querySelectorAll('#detail-rating .stars button').forEach((b, i) => b.classList.toggle('on', i < n));
}

window.loadItemRating = (id) => {
  const { n, avg } = window.ratingOf ? window.ratingOf(id) : { n: 0, avg: 0 };
  const uid = window.usuarioActualFirebase && window.usuarioActualFirebase.uid;
  const mine = (uid && ((live().ratings || {})[id] || {})[uid]) || store.json('my_ratings', {})[id];
  paintStars(mine || 0);
  const base = mine ? t('Tu calificación', 'Your rating') : t('Califica este contenido', 'Rate this content');
  const el = document.getElementById('detail-rating-text');
  el.textContent = n ? `${base} · ${t('Promedio', 'Average')}: ${avg.toFixed(1)} ⭐ (${n})` : base;
};

window.rateAppItem = async (a, b) => {
  const stars = typeof a === 'number' ? a : b;
  const id = window.currentItemRatingId;
  if (!id || window.exigirRegistro() || avisoBaneo()) return;
  const uid = window.usuarioActualFirebase.uid;
  try {
    await set(ref(db, `ratings/${id}/${uid}`), stars);
    const mine = store.json('my_ratings', {});
    mine[id] = stars;
    store.setJson('my_ratings', mine);
    paintStars(stars);
    vibrate(20);
    toast(t('¡Gracias por calificar!', 'Thanks for rating!'), 'sparkle');
  } catch (err) {
    console.error('Calificación:', err);
  }
};
}).catch(err => console.error(err));
