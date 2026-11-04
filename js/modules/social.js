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
  if (window.exigirRegistro()) return;
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
let currentCommentsId = null;
let commentsUnsub = null;
const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : '#';

window.openModComments = (id, title) => {
  if (window.exigirRegistro()) return;
  currentCommentsId = id;
  document.getElementById('mc-title').textContent = t('Comentarios: ', 'Comments: ') + title;

  store.set(`seen_comments_${id}`, Date.now());
  const led = document.getElementById('led-yellow-' + id);
  if (led) led.style.display = 'none';

  const user = getProfile();
  const nombre = profileName(user);
  const foto = profilePhoto(user);
  const display = document.getElementById('mc-displayMyName');
  display.textContent = t('Comentando como: ', 'Commenting as: ') + nombre;
  display.classList.toggle('admin-name', isAdmin());

  const avatar = document.getElementById('mc-myAvatar');
  avatar.innerHTML = foto ? `<img src="${esc(foto)}" alt="">` : esc(nombre.charAt(0).toUpperCase());
  avatar.style.background = foto ? 'transparent' : stringToColor(nombre);

  openPopup('mod-comments-popup');

  if (commentsUnsub) commentsUnsub();
  commentsUnsub = onValue(ref(db, `mod_comments/${id}`), (snapshot) => {
    const list = document.getElementById('mc-commentList');
    const data = snapshot.val();
    if (!data) {
      list.innerHTML = `<p class="empty">${t('Sé el primero en comentar aquí.', 'Be the first to comment.')}</p>`;
      return;
    }
    const myUid = window.usuarioActualFirebase && window.usuarioActualFirebase.uid;
    const comments = Object.keys(data).map(k => ({ id: k, ...data[k] }))
      .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || b.id.localeCompare(a.id));

    list.innerHTML = comments.map(c => {
      const name = c.user || 'Usuario';
      const jsName = esc(name.replace(/['"\\]/g, ''));
      const byAdmin = c.ownerKey === ADMIN_UID;
      const verified = live().verified && live().verified[c.ownerKey];
      const liked = !!(c.userLikes && myUid && c.userLikes[myUid]);
      let actions = '';
      if (isAdmin()) {
        actions = `<span class="gold-link" onclick="togglePinModComment('${esc(c.id)}', ${!!c.isPinned})">${c.isPinned ? 'Desfijar' : '📌 Fijar'}</span>
                   <span class="danger-link" onclick="deleteModComment('${esc(c.id)}')">Eliminar</span>`;
      } else if (myUid && c.ownerKey === myUid) {
        actions = `<span class="danger-link" onclick="deleteModComment('${esc(c.id)}')">${t('Eliminar', 'Delete')}</span>`;
      }
      const av = c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : esc(name.charAt(0).toUpperCase());
      return `
        <div class="yt-comment-container ${c.isPinned ? 'pinned' : ''}">
          <div class="yt-avatar" style="background:${c.avatar ? 'transparent' : stringToColor(name)}">${av}</div>
          <div class="yt-content">
            ${c.isPinned ? '<div class="pinned-badge">📌 FIJADO</div>' : ''}
            <div class="yt-header">
              <span class="yt-name ${byAdmin ? 'admin-name' : ''}" onclick="openBanPanel('${esc(c.ownerKey)}', '${jsName}')">
                <a href="${esc(safeUrl(c.link))}" target="_blank" rel="noopener">${esc(name)}</a>${byAdmin ? ' <span class="admin-tag">ADMIN</span>' : verified ? ' ☑️' : ''}
              </span>
              <span class="yt-date">${esc(c.date)}</span>
            </div>
            <div class="yt-text">${esc(c.text)}</div>
            <div class="yt-actions">
              <span class="yt-action-btn ${liked ? 'active' : ''}" onclick="likeModComment('${esc(c.id)}')">👍 ${Number(c.likes) || 0}</span>
              <span class="yt-action-btn" onclick="replyModComment('${jsName}')">${t('Responder', 'Reply')}</span>
              ${actions}
            </div>
          </div>
        </div>`;
    }).join('');
  });
};

window.closeModComments = () => {
  closePopup('mod-comments-popup');
  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
};

window.addModComment = async () => {
  if (window.exigirRegistro()) return;
  if (await checkBanStatus()) return;
  const u = window.usuarioActualFirebase;
  const p = getProfile();
  const box = document.getElementById('mc-commentText');
  const text = box.value.trim();
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
    const upd = {
      [`mod_comments/${currentCommentsId}/${key}`]: {
        ownerKey: u.uid, user: profileName(p).slice(0, 40), link: '#', avatar: profilePhoto(p),
        text: text.slice(0, 300), date: new Date().toLocaleString().slice(0, 40), likes: 0, isPinned: false
      }
    };
    if (!isAdmin()) upd[`comment_cooldown/${u.uid}`] = FB.serverTimestamp();
    await update(ref(db), upd);
    store.set('last_comment_sent', String(Date.now()));
    set(ref(db, `last_comment_time/${currentCommentsId}`), Date.now()).catch(() => { });
    store.set(`seen_comments_${currentCommentsId}`, Date.now() + 1000);
    box.value = '';
    document.getElementById('mc-charCounter').textContent = '0';
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
  if (window.exigirRegistro()) return;
  const base = `mod_comments/${currentCommentsId}/${commentId}`;
  try {
    await coupledToggle(`${base}/likes`, `${base}/userLikes/${window.usuarioActualFirebase.uid}`);
    vibrate(15);
  } catch (err) {
    console.error('Like comentario:', err);
  }
};

window.deleteModComment = (id) => {
  if (confirm(t('¿Borrar comentario?', 'Delete comment?'))) remove(ref(db, `mod_comments/${currentCommentsId}/${id}`));
};
window.togglePinModComment = (id, state) => update(ref(db, `mod_comments/${currentCommentsId}/${id}`), { isPinned: !state });
window.replyModComment = (name) => { const tx = document.getElementById('mc-commentText'); tx.value = `@${name} `; tx.focus(); };

document.getElementById('mc-commentText').addEventListener('input', function () {
  document.getElementById('mc-charCounter').textContent = this.value.length;
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
  if (!id || window.exigirRegistro()) return;
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
