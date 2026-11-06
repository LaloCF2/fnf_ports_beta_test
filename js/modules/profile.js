// Perfil: portada, estadísticas, insignias, edición y opciones de cuenta.
window.fbReady.then((FB) => {
const { db, ref, get, update } = FB;
const { store, t, esc, fi, openPopup, closePopup, toast, getProfile, timeAgo, fmtDateTime, downloadJSON } = FNF;

const DEFAULT_AVATAR = 'assets/iconos/avatar-default.svg';
const FRAMES = [
  ['var(--accent)', 'Acento del tema', 'Theme accent'],
  ['#ff4fa8', 'Rosa', 'Pink'],
  ['#f7b500', 'Dorado VIP', 'VIP gold'],
  ['#19b56b', 'Verde', 'Green'],
  ['#ef3e6d', 'Fuego', 'Fire'],
  ['#3d8bff', 'Azul', 'Blue']
];

// Insignias: [id, icono, nombre ES, nombre EN, cómo se gana ES, EN, condición]
const BADGES = [
  ['bienvenido', 'medal', 'Bienvenido', 'Welcome', 'Crear tu cuenta', 'Create your account', s => true],
  ['primer-comentario', 'chat', 'Primer comentario', 'First comment', 'Comentar en un mod', 'Comment on a mod', s => s.comments >= 1],
  ['comentarista', 'mail', 'Comentarista', 'Commenter', '10 comentarios', '10 comments', s => s.comments >= 10],
  ['popular', 'bolt', 'Popular', 'Popular', 'Recibir 10 likes en tus comentarios', 'Get 10 likes on your comments', s => s.likesReceived >= 10],
  ['fan', 'like', 'Fan número 1', 'Number 1 fan', 'Dar 10 likes', 'Give 10 likes', s => s.likesGiven >= 10],
  ['critico', 'star', 'Crítico', 'Critic', 'Calificar 5 mods', 'Rate 5 mods', s => s.ratings >= 5],
  ['coleccionista', 'heart', 'Coleccionista', 'Collector', 'Guardar 5 favoritos', 'Save 5 favorites', s => s.favs >= 5],
  ['explorador', 'download', 'Explorador', 'Explorer', 'Descargar 5 cosas', 'Download 5 things', s => s.downloads >= 5],
  ['votante', 'idea', 'Votante', 'Voter', 'Votar 3 pedidos', 'Vote on 3 requests', s => s.votes >= 3],
  ['pedido-cumplido', 'check', 'Pedido cumplido', 'Wish granted', 'Que se complete un mod que pediste', 'Get a mod you requested completed', s => s.requestsDone >= 1],
  ['veterano', 'trophy', 'Veterano', 'Veteran', '6 meses en la comunidad', '6 months in the community', s => s.days >= 180],
  ['verificado', 'verified', 'Verificado', 'Verified', 'Que el admin te verifique', 'Get verified by the admin', s => s.verified]
];

// Junta toda la actividad del usuario (para estadísticas, insignias y "descargar mis datos")
async function actividad(uid) {
  const [commentsSnap, likesSnap, reqSnap] = await Promise.all([
    get(ref(db, 'mod_comments')).catch(() => null),
    get(ref(db, 'likes_registry')).catch(() => null),
    get(ref(db, 'mod_requests')).catch(() => null)
  ]);
  const comments = [];
  Object.entries((commentsSnap && commentsSnap.val()) || {}).forEach(([modId, cs]) =>
    Object.entries(cs || {}).forEach(([id, c]) => { if (c && c.ownerKey === uid) comments.push({ modId, id, ...c }); }));
  const likes = Object.entries((likesSnap && likesSnap.val()) || {}).filter(([, users]) => users && users[uid]).map(([id]) => id);
  const reqs = Object.entries((reqSnap && reqSnap.val()) || {});
  const ratingsAll = (window.live && window.live.ratings) || {};
  const ratings = Object.entries(ratingsAll).filter(([, r]) => r && r[uid]).map(([id, r]) => ({ id, stars: r[uid] }));
  return {
    comments, likes, ratings,
    requests: reqs.filter(([, r]) => r.ownerKey === uid).map(([id, r]) => ({ id, ...r, voters: undefined })),
    voted: reqs.filter(([, r]) => r.voters && r.voters[uid]).map(([id]) => id)
  };
}

// Resumen de la actividad (solo números) guardado 10 minutos en el celular.
// Así el perfil abre al instante y no descarga toda la base de datos cada vez que lo abres.
const ACT_TTL = 10 * 60000;
const resumir = (act) => ({
  comments: act.comments.length,
  likesReceived: act.comments.reduce((a, c) => a + (Number(c.likes) || 0), 0),
  likesGiven: act.likes.length,
  ratings: act.ratings.length,
  votes: act.voted.length,
  requestsDone: act.requests.filter(r => r.status === 'Completado').length
});
const resumenGuardado = (uid) => {
  const c = store.json('fnf_act_' + uid, null);
  return c && c.r ? { r: c.r, fresco: Date.now() - c.ts < ACT_TTL } : null;
};
async function resumenNuevo(uid) {
  const r = resumir(await actividad(uid));
  store.setJson('fnf_act_' + uid, { ts: Date.now(), r });
  return r;
}

const statBox = (ic, value, label, onclick) =>
  `<div class="pf-stat"${onclick ? ` role="button" onclick="${onclick}"` : ''}>${fi(ic, 22)}<strong>${value}</strong><small>${label}</small></div>`;

// Estadísticas + insignias (se repintan solas cuando llega el resumen nuevo)
function statsHTML(s) {
  const v = (n) => (n == null ? '<span class="pf-wait"></span>' : n);
  return `
    ${statBox('heart', v(s.favs), t('Favoritos', 'Favorites'), 'abrirFavoritos()')}
    ${statBox('chat', v(s.comments), t('Comentarios', 'Comments'))}
    ${statBox('like', v(s.likesGiven), t('Likes dados', 'Likes given'))}
    ${statBox('star', v(s.ratings), t('Calificaciones', 'Ratings'))}
    ${statBox('download', v(s.downloads), t('Descargas', 'Downloads'), "closePopup('profile-popup'); abrirMisDescargas()")}
    ${statBox('calendar', v(s.days), t('Días aquí', 'Days here'))}`;
}
function badgesHTML(s) {
  const listo = s.comments != null;
  const earned = listo ? BADGES.filter(b => b[6](s)).length : '…';
  return `
    <div class="pf-section-head"><h4>${fi('trophy', 20)} ${t('Insignias', 'Badges')}</h4><span class="count-pill">${earned} / ${BADGES.length}</span></div>
    <div class="pf-badges">${BADGES.map(([id, ic, es, en, howEs, howEn, ok]) => {
      const got = listo && ok(s);
      return `<div class="pf-badge${got ? ' got' : ''}" title="${esc(t(howEs, howEn))}">
        <span class="pf-badge-ic">${fi(ic, 26)}</span><b>${t(es, en)}</b><small>${got ? t('¡Conseguida!', 'Earned!') : t(howEs, howEn)}</small></div>`;
    }).join('')}</div>`;
}
const accountRow = (ic, title, sub, onclick, cls = '') =>
  `<button class="pf-row ${cls}" onclick="${onclick}">${fi(ic, 24)}<span class="grow"><b>${title}</b><small>${sub}</small></span><svg class="icon icon-sm"><use href="#i-right"/></svg></button>`;

window.abrirPerfil = async function () {
  const box = document.getElementById('perfil-dinamico-contenido');
  openPopup('profile-popup');

  // ---- Invitado ----
  if (!window.usuarioActualFirebase) {
    const perks = [
      ['chat', t('Comentar y responder en los mods', 'Comment and reply on mods')],
      ['heart', t('Guardar favoritos en la nube y seguir mods', 'Save favorites to the cloud and follow mods')],
      ['star', t('Calificar y dar likes', 'Rate and like')],
      ['idea', t('Pedir los mods que quieres ver', 'Request the mods you want')],
      ['trophy', t('Ganar insignias', 'Earn badges')]
    ];
    box.innerHTML = `
      <div class="pf-cover"></div>
      <img src="${DEFAULT_AVATAR}" class="profile-avatar pf-avatar" style="filter:grayscale(1);border-color:var(--line)" alt="">
      <h3 class="pf-name">${t('Únete a la comunidad', 'Join the community')}</h3>
      <p class="popup-sub">${t('Estás como invitado. Con tu cuenta de Google puedes:', "You're a guest. With your Google account you can:")}</p>
      <ul class="pf-perks">${perks.map(([ic, txt]) => `<li>${fi(ic, 22)}<span>${txt}</span></li>`).join('')}</ul>
      <button onclick="iniciarSesionConGoogle()" class="btn btn-google btn-block">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style="width:20px">
        ${t('Conectar con Google', 'Connect with Google')}
      </button>
      <div class="pf-list" style="margin-top:14px">
        ${accountRow('download', t('Mis descargas', 'My downloads'), t('Lo que bajaste desde este celular', 'What you downloaded on this phone'), "closePopup('profile-popup'); abrirMisDescargas()")}
      </div>`;
    return;
  }

  box.innerHTML = `<div class="pf-cover"></div><p class="empty">${t('Cargando perfil...', 'Loading profile...')}</p>`;
  const u = window.usuarioActualFirebase;

  try {
    const snap = await get(ref(db, 'usuarios/' + u.uid));
    const datos = snap.val() || {};
    const guardado = resumenGuardado(u.uid);

    const nombre = datos.nombre || u.displayName || 'Usuario FNF';
    const foto = FNF.safeAvatar(datos.foto) || u.photoURL || DEFAULT_AVATAR;
    const correo = datos.correo || u.email || '';
    const [user, dom] = correo.split('@');
    const correoOculto = user && dom ? user.slice(0, 3) + '***@' + dom : correo;
    const fechaObj = new Date(datos.fechaRegistro || Date.now());
    const marco = FNF.marcoValido(datos.marcoAvatar) ? datos.marcoAvatar : 'var(--accent)';
    const dias = Math.max(0, Math.floor((Date.now() - fechaObj.getTime()) / 86400000));
    const rango = dias > 180 ? t('Leyenda FNF', 'FNF Legend') : dias > 30 ? "Funkin' Gamer" : t('Port-Boy (Nuevo)', 'Port-Boy (New)');
    const verified = !!((window.live || {}).verified || {})[u.uid];
    const esAdmin = u.uid === window.MI_UID_ADMIN;

    const ultima = datos.ultimaFechaCambio || 0;
    const diasPasados = Math.floor((Date.now() - ultima) / 86400000);
    const bloqueado = ultima !== 0 && diasPasados < 15;

    // Lo que vive en el celular se muestra ya; lo de Firebase llega después (o del resumen guardado)
    const base = {
      favs: Object.keys(store.json('fnf_favorites', {})).length,
      downloads: store.json('fnf_dl_history', []).length,
      days: dias,
      verified
    };
    const s = { ...base, ...(guardado ? guardado.r : {}) };

    box.innerHTML = `
      <div class="pf-cover" style="--frame:${esc(marco)}"></div>
      <img src="${esc(foto)}" class="profile-avatar pf-avatar" style="border-color:${esc(marco)}" alt="">
      <h3 class="pf-name">${esc(nombre)}${verified ? ` ${fi('verified', 20)}` : ''}${esAdmin ? ' <span class="admin-tag">ADMIN</span>' : ''}</h3>
      <p class="rank">${fi('medal', 16)} ${rango}</p>
      <p class="pf-meta">${esc(correoOculto)} · ${t('Miembro desde', 'Member since')} ${fmtDateTime(fechaObj.getTime()).split(' · ')[0]}</p>

      <div class="pf-stats" id="pf-stats-box">${statsHTML(s)}</div>

      <div class="pf-section" id="pf-badges-box">${badgesHTML(s)}</div>

      <details class="pf-section pf-edit">
        <summary>${fi('edit', 20)} <span>${t('Editar perfil', 'Edit profile')}</span></summary>
        <div class="stack" style="margin-top:12px;text-align:left">
          <label class="label" for="input-nuevo-apodo">${t('Tu apodo', 'Nickname')}${bloqueado ? ` · ${t('bloqueado', 'locked')} ${15 - diasPasados} d` : ''}</label>
          <input type="text" id="input-nuevo-apodo" class="field" value="${esc(nombre)}" maxlength="24" ${bloqueado ? 'disabled' : ''}>
          <label class="label">${t('Color de marco', 'Frame color')}</label>
          <div class="pf-frames" id="select-marco" data-value="${esc(marco)}">
            ${FRAMES.map(([v, es, en]) => `<button type="button" class="pf-frame${marco === v ? ' on' : ''}" style="--c:${v}" title="${t(es, en)}" onclick="elegirMarco(this, '${v}')"></button>`).join('')}
          </div>
          <label class="label" for="input-nuevo-avatar">${t('URL de avatar (opcional)', 'Avatar URL (optional)')}</label>
          <input type="url" id="input-nuevo-avatar" class="field" placeholder="https://..." value="${esc(datos.foto || '')}">
          <p class="note"><b>${t('NOTA', 'NOTE')}:</b> ${t('el apodo solo se puede cambiar una vez cada 15 días.', 'your nickname can only be changed once every 15 days.')}</p>
          <button onclick="guardarNuevoApodo()" class="btn btn-block">${t('Guardar perfil', 'Save profile')}</button>
        </div>
      </details>

      <div class="pf-list">
        <h4 class="pf-list-title">${t('Tu cuenta', 'Your account')}</h4>
        ${accountRow('download', t('Mis descargas', 'My downloads'), t('Lo que bajaste desde este celular', 'What you downloaded on this phone'), "closePopup('profile-popup'); abrirMisDescargas()")}
        ${accountRow('heart', t('Mis favoritos', 'My favorites'), t('Mods que guardas y sigues', 'Mods you save and follow'), 'abrirFavoritos()')}
        ${accountRow('database', t('Descargar mis datos', 'Download my data'), t('Un archivo con todo lo que guardamos de ti', 'A file with everything we store about you'), 'descargarMisDatos()')}
        ${accountRow('shield', t('Política de privacidad', 'Privacy Policy'), t('Cómo usamos tus datos', 'How we use your data'), "location.href='privacidad.html'")}
        ${accountRow('rules', t('Términos de uso', 'Terms of Use'), t('Normas de la comunidad', 'Community rules'), "location.href='terminos.html'")}
        ${accountRow('trash', t('Pedir que borren mi cuenta', 'Request account deletion'), t('Borra tu perfil, comentarios y votos', 'Deletes your profile, comments and votes'), 'solicitarBorrarCuenta()', 'danger')}
        ${accountRow('logout', t('Cerrar sesión', 'Sign out'), 'Google · ' + esc(correoOculto), 'cerrarSesion()', 'danger')}
      </div>`;

    // Estadísticas de Firebase: solo se vuelven a calcular si el resumen tiene más de 10 minutos
    if (!guardado || !guardado.fresco) {
      resumenNuevo(u.uid).then(r => {
        const statsBox = document.getElementById('pf-stats-box');
        if (!statsBox || window.usuarioActualFirebase !== u) return;
        const nuevo = { ...base, ...r };
        statsBox.innerHTML = statsHTML(nuevo);
        document.getElementById('pf-badges-box').innerHTML = badgesHTML(nuevo);
      }).catch(err => console.warn('Actividad:', err.message));
    }
  } catch (error) {
    console.error('Error al cargar el perfil:', error);
    box.innerHTML = `
      <div class="pf-cover"></div>
      <p class="popup-sub" style="color:var(--danger);margin-top:16px">${t('Hubo un retraso al conectar con el servidor. Cierra y vuelve a abrir.', 'There was a delay connecting. Close and try again.')}</p>
      <button onclick="cerrarSesion()" class="btn btn-danger btn-block">${t('Cerrar sesión', 'Sign out')}</button>`;
  }
};

window.elegirMarco = (btn, value) => {
  const wrap = document.getElementById('select-marco');
  wrap.dataset.value = value;
  wrap.querySelectorAll('.pf-frame').forEach(b => b.classList.toggle('on', b === btn));
  document.querySelector('#perfil-dinamico-contenido .pf-avatar').style.borderColor = value;
};

window.guardarNuevoApodo = async function () {
  const nombreInput = document.getElementById('input-nuevo-apodo');
  if (!nombreInput || !window.usuarioActualFirebase) return;

  const nuevoNombre = nombreInput.value.trim();
  const nuevoAvatar = document.getElementById('input-nuevo-avatar').value.trim();
  const marcoElegido = document.getElementById('select-marco').dataset.value;
  const nuevoMarco = FNF.marcoValido(marcoElegido) ? marcoElegido : 'var(--accent)';

  if (nuevoNombre.length < 3) return toast(t('El apodo debe tener mínimo 3 letras.', 'Nickname must be at least 3 letters.'), 'alert');
  if (nuevoAvatar && !/^https?:\/\//i.test(nuevoAvatar)) return toast(t('La foto debe ser un enlace https://', 'The photo must be an https:// link'), 'alert');

  const actual = (getProfile() || {}).nombre;
  const cambiaNombre = !nombreInput.disabled && nuevoNombre !== actual;
  if (cambiaNombre && window.usuarioActualFirebase.uid !== window.MI_UID_ADMIN && FNF.nombreReservado(nuevoNombre)) {
    return toast(t('Ese apodo está reservado para el administrador.', 'That nickname is reserved for the admin.'), 'alert');
  }
  if (cambiaNombre && !confirm(t('¿Seguro que quieres este apodo? Se bloqueará por 15 días.', 'Keep this nickname? It will be locked for 15 days.'))) return;

  const data = { marcoAvatar: nuevoMarco };
  if (nuevoAvatar) data.foto = nuevoAvatar;
  // La fecha la pone el servidor: las reglas exigen que el cambio de apodo y su fecha vayan juntos
  if (cambiaNombre) { data.nombre = nuevoNombre; data.ultimaFechaCambio = FB.serverTimestamp(); data.usernameModificado = false; }

  try {
    await update(ref(db, 'usuarios/' + window.usuarioActualFirebase.uid), data);
  } catch (err) {
    console.error(err);
    return toast(t('No se pudo guardar. Revisa el apodo (3 a 30 letras).', "Couldn't save. Check the nickname (3 to 30 letters)."), 'alert');
  }

  const perfil = getProfile() || {};
  if (cambiaNombre) perfil.nombre = nuevoNombre;
  if (nuevoAvatar) perfil.foto = nuevoAvatar;
  perfil.marcoAvatar = nuevoMarco;
  store.setJson('fnf_user_profile', perfil);

  window.updateHeaderUser();
  toast(t('¡Perfil actualizado!', 'Profile updated!'), 'user');
  window.abrirPerfil();
};

// "Descargar mis datos": un archivo .json con todo lo que la página guarda del usuario
window.descargarMisDatos = async () => {
  const u = window.usuarioActualFirebase;
  if (!u) return;
  toast(t('Preparando tu archivo...', 'Preparing your file...'), 'database');
  try {
    const [perfil, act, cooldown, mensaje] = await Promise.all([
      get(ref(db, 'usuarios/' + u.uid)).then(s => s.val()),
      actividad(u.uid),
      get(ref(db, 'request_cooldown/' + u.uid)).then(s => s.val()).catch(() => null),
      get(ref(db, 'user_notifications/' + u.uid)).then(s => s.val()).catch(() => null)
    ]);
    downloadJSON(`mis-datos-fnf-${FNF.dayKey()}.json`, {
      exportado: new Date().toISOString(),
      cuenta: { uid: u.uid, correo: u.email },
      perfil,
      comentarios: act.comments,
      likes_dados: act.likes,
      calificaciones: act.ratings,
      pedidos: act.requests,
      pedidos_votados: act.voted,
      ultimo_pedido: cooldown,
      ultimo_mensaje_del_admin: mensaje,
      en_este_celular: {
        favoritos: store.json('fnf_favorites', {}),
        historial_descargas: store.json('fnf_dl_history', []),
        ram: store.get('fnf_my_ram'), idioma: store.get('fnf_lang'), tema: store.get('fnf_theme')
      }
    });
  } catch (err) {
    console.error(err);
    toast(t('No se pudo crear el archivo. Intenta de nuevo.', "Couldn't create the file. Try again."), 'alert');
  }
};

// Pide al admin que borre la cuenta (llega como ticket a Panel → Reportes)
window.solicitarBorrarCuenta = async () => {
  if (!window.usuarioActualFirebase) return;
  const ok = confirm(t('¿Quieres que borremos tu cuenta y todos tus datos (perfil, comentarios, likes, calificaciones y votos)? El administrador lo hará en un máximo de 30 días.',
    'Do you want us to delete your account and all your data (profile, comments, likes, ratings and votes)? The admin will do it within 30 days.'));
  if (!ok) return;
  try {
    await window.crearTicketSoporte({ type: 'cuenta', text: 'Solicito que borren mi cuenta y todos mis datos.' });
    window.mostrarMensaje(t('Solicitud enviada', 'Request sent'),
      t('Recibimos tu solicitud. Tu cuenta se borrará en un máximo de 30 días y te avisaremos aquí mismo.', "We got your request. Your account will be deleted within 30 days and we'll let you know here."));
  } catch (err) {
    console.error(err);
    toast(t('No se pudo enviar. Espera un minuto e intenta de nuevo.', "Couldn't send. Wait a minute and try again."), 'alert');
  }
};

window.exigirRegistro = function () {
  if (!window.usuarioActualFirebase) {
    toast(t('Inicia sesión con Google para usar esta función.', 'Sign in with Google to use this.'), 'shield');
    document.getElementById('auth-overlay').style.display = 'flex';
    return true;
  }
  return false;
};
}).catch(err => console.error(err));
