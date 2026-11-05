window.fbReady.then((FB) => {
const { db, auth, googleProvider, ref, get, set, update, remove, push, onValue, runTransaction, signInWithPopup, onAuthStateChanged, signOut, APP_VERSION } = FB;
const { store, t, esc, icon, vibrate, openPopup, closePopup, toast, getProfile, profileName, profilePhoto, stringToColor } = FNF;

let usuarioActualFirebase = null;
window.usuarioActualFirebase = null;

// Nombre de Google adaptado a las reglas (3-30 letras; "LaloCF" reservado para el admin)
const nombreValido = (raw, uid) => {
  let n = String(raw || '').trim().slice(0, 30);
  if (n.length < 3) n = 'Usuario FNF';
  if (uid !== window.MI_UID_ADMIN && FNF.nombreReservado(n)) n = 'Usuario FNF';
  return n;
};

onAuthStateChanged(auth, async (user) => {
  const overlayAuth = document.getElementById('auth-overlay');

  window.authKnown = true; // ya se sabe si hay sesión (el Inicio lo usa para "solo usuarios / solo invitados")

  // El modo admin depende SOLO de la sesión real de Google (las reglas de Firebase lo respaldan)
  window.setAdminMode(!!user && user.uid === window.MI_UID_ADMIN);

  if (user) {
    usuarioActualFirebase = user;
    window.usuarioActualFirebase = user;
    if (overlayAuth) overlayAuth.style.display = 'none';

    const nombreSeguro = nombreValido(user.displayName, user.uid);
    const fotoSegura = user.photoURL || "https://cdn-icons-png.flaticon.com/128/149/149071.png";

    try {
      const userRef = ref(db, 'usuarios/' + user.uid);
      const snap = await get(userRef);
      if (!snap.exists()) {
        await set(userRef, {
          nombre: nombreSeguro,
          foto: fotoSegura,
          correo: user.email || '',
          usernameModificado: false,
          fechaRegistro: new Date().toISOString()
        });
      }

      const datosBD = snap.exists() ? snap.val() : { nombre: nombreSeguro, foto: fotoSegura };
      store.setJson('fnf_user_profile', { nombre: datosBD.nombre, foto: datosBD.foto, key: user.uid });

      // Favoritos: se juntan los del celular con los de la cuenta
      const favRef = ref(db, 'usuarios/' + user.uid + '/favoritos');
      const favSnap = await get(favRef);
      const localFavs = store.json('fnf_favorites', {});
      const merged = { ...localFavs, ...(favSnap.val() || {}) };
      store.setJson('fnf_favorites', merged);
      if (Object.keys(merged).length) await set(favRef, merged);
    } catch (err) {
      console.error('No se pudo sincronizar el perfil:', err);
      store.setJson('fnf_user_profile', { nombre: nombreSeguro, foto: fotoSegura, key: user.uid });
    }

    if (window.refreshFavoritesUI) window.refreshFavoritesUI();
    if (window.listenToPersonalNotifications) window.listenToPersonalNotifications(user.uid);
  } else {
    usuarioActualFirebase = null;
    window.usuarioActualFirebase = null;
    if (overlayAuth) overlayAuth.style.display = store.get('fnf_guest_mode') === 'true' ? 'none' : 'flex';
  }

  if (window.updateHeaderUser) window.updateHeaderUser();
  if (window.renderHome) window.renderHome();
});

window.iniciarSesionConGoogle = async function () {
  const btn = document.getElementById('btn-google-login');

  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const esNavegadorInterno = (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Instagram") > -1) || (ua.indexOf("Telegram") > -1);

  if (esNavegadorInterno) {
    alert("⚠️ Estás usando el navegador interno de una app.\n\nPara iniciar sesión, toca los 3 puntitos de arriba (o abajo) y selecciona 'Abrir en el navegador' (Chrome o Safari).");
    if (btn) btn.innerHTML = "❌ Abre en Chrome/Safari";
    return;
  }

  if (btn) {
    btn.innerHTML = "⏳ Accediendo a Google...";
  }

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    if (btn) {
      btn.innerHTML = "❌ Falló, intenta de nuevo";
    }

    if (error.code === 'auth/popup-closed-by-user') {
      console.log("Inicio de sesión cancelado por el usuario.");
    } else {
      alert("🚨 Error: " + error.message);
    }
  }
};

window.cerrarSesion = function () {
  signOut(auth).then(() => {
    localStorage.removeItem('fnf_guest_mode');
    localStorage.removeItem('fnf_user_profile');
    location.reload();
  });
};
}).catch(err => console.error(err));
