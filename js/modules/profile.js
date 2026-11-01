window.fbReady.then((FB) => {
const { db, auth, googleProvider, ref, get, set, update, remove, push, onValue, runTransaction, signInWithPopup, onAuthStateChanged, signOut, APP_VERSION } = FB;
const { store, t, esc, icon, vibrate, openPopup, closePopup, toast, getProfile, profileName, profilePhoto, stringToColor } = FNF;

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/128/149/149071.png';
const FRAMES = [
  ['var(--accent)', '💜 Acento del tema'],
  ['#ff4fa8', '🌸 Rosa'],
  ['#f7b500', '⭐ Dorado VIP'],
  ['#19b56b', '🟢 Verde'],
  ['#ef3e6d', '🔴 Fuego'],
  ['#3d8bff', '🔵 Azul']
];

window.abrirPerfil = async function () {
  const box = document.getElementById('perfil-dinamico-contenido');
  openPopup('profile-popup');

  if (!window.usuarioActualFirebase) {
    box.innerHTML = `
      <img src="${DEFAULT_AVATAR}" class="profile-avatar" style="filter:grayscale(1);border-color:var(--line)" alt="">
      <p class="popup-sub">${t('Estás en modo invitado. Inicia sesión para guardar likes, comentar y descargar.', 'You are a guest. Sign in to like, comment and download.')}</p>
      <button onclick="iniciarSesionConGoogle()" class="btn btn-google btn-block">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style="width:20px">
        ${t('Conectar con Google', 'Connect with Google')}
      </button>`;
    return;
  }

  box.innerHTML = `<p class="empty">${t('Cargando perfil...', 'Loading profile...')}</p>`;
  const u = window.usuarioActualFirebase;

  try {
    const snap = await get(ref(db, 'usuarios/' + u.uid));
    const datos = snap.val() || {};

    const nombre = datos.nombre || u.displayName || 'Usuario FNF';
    const foto = datos.foto || u.photoURL || DEFAULT_AVATAR;
    const correo = datos.correo || u.email || '';
    const [user, dom] = correo.split('@');
    const correoOculto = user && dom ? user.slice(0, 3) + '***@' + dom : correo;

    const fechaObj = new Date(datos.fechaRegistro || Date.now());
    const fecha = fechaObj.toLocaleDateString(t('es-ES', 'en-US'), { year: 'numeric', month: 'long' });
    const marco = datos.marcoAvatar && !String(datos.marcoAvatar).includes('neon') ? datos.marcoAvatar : 'var(--accent)';
    const totalFavs = Object.keys(datos.favoritos || store.json('fnf_favorites', {})).length;

    const dias = Math.floor((Date.now() - fechaObj.getTime()) / 86400000);
    const rango = dias > 180 ? '🥇 Leyenda FNF' : dias > 30 ? "🥈 Funkin' Gamer" : '🥉 Port-Boy (Nuevo)';

    const ultima = datos.ultimaFechaCambio || 0;
    const diasPasados = Math.floor((Date.now() - ultima) / 86400000);
    const bloqueado = ultima !== 0 && diasPasados < 15;

    box.innerHTML = `
      <img src="${esc(foto)}" class="profile-avatar" style="border-color:${esc(marco)}" alt="">
      <h3 style="font-size:19px">${esc(nombre)}</h3>
      <p class="rank">${rango}</p>

      <div class="profile-stats">
        <div onclick="abrirFavoritos()"><strong>${totalFavs}</strong><small>${t('Favoritos', 'Favorites')}</small></div>
        <div><strong style="font-size:14px">${esc(fecha.charAt(0).toUpperCase() + fecha.slice(1))}</strong><small>${t('Registro', 'Joined')}</small></div>
      </div>

      <div class="setting-group" style="text-align:left;padding:14px 16px">
        <label class="label" for="input-nuevo-apodo">${t('Tu apodo', 'Nickname')}${bloqueado ? ` · 🔒 ${15 - diasPasados} d` : ''}</label>
        <input type="text" id="input-nuevo-apodo" class="field" value="${esc(nombre)}" maxlength="24" ${bloqueado ? 'disabled' : ''} style="margin-bottom:12px">

        <label class="label" for="select-marco">${t('Color de marco', 'Frame color')}</label>
        <select id="select-marco" class="field" style="margin-bottom:12px">
          ${FRAMES.map(([v, n]) => `<option value="${v}" ${marco === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>

        <label class="label" for="input-nuevo-avatar">${t('URL de avatar (opcional)', 'Avatar URL (optional)')}</label>
        <input type="url" id="input-nuevo-avatar" class="field" placeholder="https://..." value="${esc(datos.foto || '')}">

        <button onclick="guardarNuevoApodo()" class="btn btn-block" style="margin-top:14px">${t('Guardar perfil', 'Save profile')}</button>
      </div>

      <div class="list-item">
        <div class="grow"><h4>Google</h4><p>${esc(correoOculto)}</p></div>
        <button onclick="cerrarSesion()" class="btn btn-sm btn-danger">${t('Salir', 'Sign out')}</button>
      </div>`;
  } catch (error) {
    console.error('Error al cargar el perfil:', error);
    box.innerHTML = `
      <p class="popup-sub" style="color:var(--danger)">${t('Hubo un retraso al conectar con el servidor. Cierra y vuelve a abrir.', 'There was a delay connecting. Close and try again.')}</p>
      <button onclick="cerrarSesion()" class="btn btn-danger btn-block">${t('Cerrar sesión', 'Sign out')}</button>`;
  }
};

window.guardarNuevoApodo = async function () {
  const nombreInput = document.getElementById('input-nuevo-apodo');
  if (!nombreInput || !window.usuarioActualFirebase) return;

  const nuevoNombre = nombreInput.value.trim();
  const nuevoAvatar = document.getElementById('input-nuevo-avatar').value.trim();
  const nuevoMarco = document.getElementById('select-marco').value;

  if (nuevoNombre.length < 3) return alert(t('El apodo debe tener mínimo 3 letras.', 'Nickname must be at least 3 letters.'));

  const cambiaNombre = !nombreInput.disabled;
  const msg = cambiaNombre
    ? t('¿Seguro que quieres este apodo? Se bloqueará por 15 días.', 'Keep this nickname? It will be locked for 15 days.')
    : t('¿Guardar cambios en tus preferencias?', 'Save your preferences?');
  if (!confirm(msg)) return;

  const data = { marcoAvatar: nuevoMarco };
  if (nuevoAvatar) data.foto = nuevoAvatar;
  if (cambiaNombre) { data.nombre = nuevoNombre; data.ultimaFechaCambio = Date.now(); data.usernameModificado = false; }

  await update(ref(db, 'usuarios/' + window.usuarioActualFirebase.uid), data);

  const perfil = getProfile() || {};
  if (cambiaNombre) perfil.nombre = nuevoNombre;
  if (nuevoAvatar) perfil.foto = nuevoAvatar;
  perfil.marcoAvatar = nuevoMarco;
  store.setJson('fnf_user_profile', perfil);

  window.updateHeaderUser();
  if (window.showToast) window.showToast(t('¡Perfil actualizado!', 'Profile updated!'), 'user');
  window.abrirPerfil();
};

window.exigirRegistro = function () {
  if (!window.usuarioActualFirebase) {
    if (window.showToast) window.showToast(t('Inicia sesión con Google para usar esta función.', 'Sign in with Google to use this.'), 'shield');
    document.getElementById('auth-overlay').style.display = 'flex';
    return true;
  }
  return false;
};
}).catch(err => console.error(err));
