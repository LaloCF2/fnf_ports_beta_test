import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update, remove, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCG2_mOYbHLkCB5xcaker4mR7KJZVt0zRM",
  authDomain: "fnf-mobile-lalocf.firebaseapp.com",
  databaseURL: "https://fnf-mobile-lalocf-default-rtdb.firebaseio.com",
  projectId: "fnf-mobile-lalocf",
  storageBucket: "fnf-mobile-lalocf.firebasestorage.app",
  messagingSenderId: "407243542354",
  appId: "1:407243542354:web:0da0f6a80db245f6bb348b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const APP_VERSION = "v6.2.0";
const MI_UID_ADMIN = "user_a655u37rr";

// ==========================================
// 🛡️ MOTOR DE AUTENTICACIÓN GOOGLE (VERSIÓN POPUP DEFINITIVA)
// ==========================================
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
let usuarioActualFirebase = null;

onAuthStateChanged(auth, async (user) => {
  const overlayAuth = document.getElementById('auth-overlay');

  if (user) {
    usuarioActualFirebase = user;
    if (overlayAuth) overlayAuth.style.display = 'none';

    const nombreSeguro = user.displayName || "Usuario FNF";
    const fotoSegura = user.photoURL || "https://cdn-icons-png.flaticon.com/128/149/149071.png";

    const userRef = ref(db, 'usuarios/' + user.uid);
    const snap = await get(userRef);

    if (!snap.exists()) {
      await set(userRef, {
        nombre: nombreSeguro,
        foto: fotoSegura,
        correo: user.email,
        usernameModificado: false,
        fechaRegistro: new Date().toISOString()
      });
    }

    const datosBD = snap.exists() ? snap.val() : { nombre: nombreSeguro, foto: fotoSegura };
    localStorage.setItem('fnf_user_profile', JSON.stringify({
      nombre: datosBD.nombre,
      foto: datosBD.foto,
      key: user.uid
    }));

  } else {
    if (localStorage.getItem('fnf_guest_mode') === 'true') {
      if (overlayAuth) overlayAuth.style.display = 'none';
    } else {
      if (overlayAuth) overlayAuth.style.display = 'flex';
    }
  }
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
    btn.innerHTML = "⏳ Abriendo Google...";
    btn.style.background = "#ffea00";
    btn.style.color = "#000";
  }

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    if (btn) {
      btn.innerHTML = "❌ Falló, intenta de nuevo";
      btn.style.background = "#ff003c";
      btn.style.color = "#fff";
    }

    if (error.code === 'auth/popup-closed-by-user') {
      console.log("Inicio de sesión cancelado por el usuario.");
    } else {
      alert("🚨 Error: " + error.message);
    }
  }
};

window.entrarComoInvitado = function () {
  localStorage.setItem('fnf_guest_mode', 'true');
  const overlayAuth = document.getElementById('auth-overlay');
  if (overlayAuth) overlayAuth.style.display = 'none';
};

window.cerrarSesion = function () {
  signOut(auth).then(() => {
    localStorage.removeItem('fnf_guest_mode');
    localStorage.removeItem('fnf_user_profile');
    location.reload();
  });
};

// ==========================================
// 👤 VENTANA DE PERFIL DINÁMICA (VERSIÓN INDESTRUCTIBLE)
// ==========================================
window.abrirPerfil = async function () {
  const contenedor = document.getElementById('perfil-dinamico-contenido');

  if (!contenedor) return;

  // Desplegamos la ventana flotante
  document.getElementById('profile-popup').classList.add('show');

  // CASO 1: EL USUARIO ES UN INVITADO
  if (!usuarioActualFirebase) {
    contenedor.innerHTML = `
      <img src="https://cdn-icons-png.flaticon.com/128/149/149071.png" style="width: 80px; filter: grayscale(1); margin-bottom: 10px;">
      <p style="color: #ccc; margin-bottom: 20px; font-size: 13px;">Estás en modo invitado. Inicia sesión para guardar likes, comentar y descargar.</p>
      <button onclick="iniciarSesionConGoogle()" class="btn" style="width: 100%; background: white; color: black; font-weight: bold; padding: 12px; border-radius: 12px; border: none; cursor: pointer;">
        <img src="https://cdn-icons-png.flaticon.com/128/300/300221.png" style="width: 18px; vertical-align: middle; margin-right: 5px;">
        Conectar con Google
      </button>
    `;
    return;
  }

  // Animación de carga mientras lee la base de datos
  contenedor.innerHTML = `<p style="color: #aaa; font-size: 14px;">⏳ Cargando datos de perfil...</p>`;

  try {
    // CASO 2: EL USUARIO INICIÓ SESIÓN CON GOOGLE
    const snap = await get(ref(db, 'usuarios/' + usuarioActualFirebase.uid));
    const datos = snap.val() || {};

    // 🎯 RESPALDO MAESTRO: Si la base de datos está vacía, jalamos la foto y nombre crudos de Google
    const nombreUsuario = datos.nombre || usuarioActualFirebase.displayName || "Usuario FNF";
    const fotoUsuario = datos.foto || usuarioActualFirebase.photoURL || "https://cdn-icons-png.flaticon.com/128/149/149071.png";
    const correoUsuario = datos.correo || usuarioActualFirebase.email || "Sin correo";

    // Reglas de 15 días
    const ultimaFecha = datos.ultimaFechaCambio || 0;
    const ahora = Date.now();
    const diasPasados = Math.floor((ahora - ultimaFecha) / (1000 * 60 * 60 * 24));

    let bloqueado = "";
    let textoBoton = "✨ Guardar Perfil";

    // Si tenía el candado antiguo (usernameModificado: true) pero no tiene fecha, lo dejamos cambiar de nuevo
    // Si tiene fecha y no han pasado 15 días, lo bloqueamos
    if (diasPasados < 15 && ultimaFecha !== 0) {
      const diasFaltantes = 15 - diasPasados;
      bloqueado = "disabled";
      textoBoton = `✨ Guardar Avatar (Nombre bloqueado ${diasFaltantes} días)`;
    }

    // Inyectamos la información
    contenedor.innerHTML = `
      <img src="${fotoUsuario}" style="width: 85px; height: 85px; border-radius: 50%; border: 2px solid var(--neon-blue); box-shadow: 0 0 15px rgba(0,234,255,0.4); margin-bottom: 12px; object-fit: cover;">
      <h3 style="color: white; margin: 0 0 5px 0; font-size: 18px;">${nombreUsuario}</h3>
      <p style="color: #666; font-size: 10px; margin: 0 0 2px 0; word-break: break-all;">ID: ${usuarioActualFirebase.uid}</p>
      <p style="color: #aa99ff; font-size: 12px; margin: 0 0 20px 0;">${correoUsuario}</p>
      
      <div style="background: rgba(255,255,255,0.04); padding: 15px; border-radius: 16px; margin-bottom: 20px; text-align: left; border: 1px solid rgba(255,255,255,0.05);">
        
        <label style="color: var(--neon-blue); font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Tu Apodo (Cambiable cada 15 días)</label>
        <input type="text" id="input-nuevo-apodo" value="${nombreUsuario}" ${bloqueado} class="reg-input" style="width: 100%; margin-top: 8px; margin-bottom: 12px; box-sizing: border-box; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px; border-radius: 8px; font-size: 13px;">
        
        <label style="color: var(--neon-blue); font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">URL de Avatar / Logo (Opcional)</label>
        <input type="url" id="input-nuevo-avatar" placeholder="https://..." value="${datos.foto || ''}" class="reg-input" style="width: 100%; margin-top: 8px; box-sizing: border-box; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px; border-radius: 8px; font-size: 13px;">

        <button onclick="guardarNuevoApodo()" class="btn" style="width: 100%; margin-top: 15px; background: var(--neon-green); color: black; font-weight: bold; padding: 10px; border: none; border-radius: 8px; cursor: pointer; font-size: 12px;">${textoBoton}</button>
      </div>

      <button onclick="document.getElementById('profile-popup').classList.remove('show'); abrirFavoritos();" class="btn" style="width: 100%; margin-bottom: 15px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 11px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 13px;">⭐ Mis Favoritos</button>

      <button onclick="cerrarSesion()" class="btn" style="width: 100%; background: #ff003c; color: white; border: none; padding: 11px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 13px;">🚪 Cerrar Sesión</button>
    `;
  } catch (error) {
    console.error("Error al cargar el perfil:", error);
    // 🚨 EL SALVAVIDAS: Si la base de datos se rompe, mostramos esto en lugar de dejarlo en blanco
    contenedor.innerHTML = `
      <img src="${usuarioActualFirebase.photoURL || 'https://cdn-icons-png.flaticon.com/128/149/149071.png'}" style="width: 85px; height: 85px; border-radius: 50%; border: 2px solid #ff003c; margin-bottom: 12px; object-fit: cover;">
      <h3 style="color: white; margin: 0 0 5px 0;">${usuarioActualFirebase.displayName || 'Usuario'}</h3>
      <p style="color: #ff003c; font-size: 12px; margin-bottom: 20px;">⚠️ Hubo un pequeño retraso de seguridad al conectar con Firebase. Cierra esta ventana y ábrela de nuevo.</p>
      <button onclick="cerrarSesion()" class="btn" style="width: 100%; background: #ff003c; color: white; border: none; padding: 11px; border-radius: 12px; font-weight: bold; cursor: pointer;">🚪 Cerrar Sesión</button>
    `;
  }
};

// ✏️ FUNCIÓN PARA GUARDAR EL NOMBRE Y AVATAR
window.guardarNuevoApodo = async function () {
  const nuevoNombreInput = document.getElementById('input-nuevo-apodo');
  const nuevoAvatarInput = document.getElementById('input-nuevo-avatar');

  if (!nuevoNombreInput) return;

  const nuevoNombre = nuevoNombreInput.value.trim();
  const nuevoAvatar = nuevoAvatarInput.value.trim();

  if (nuevoNombre.length < 3) return alert("El apodo debe tener mínimo 3 letras.");

  let mensajeConfirmacion = "¿Guardar cambios en tu perfil?";
  if (!nuevoNombreInput.disabled) {
    mensajeConfirmacion = "¿Seguro que quieres este apodo? Se bloqueará por 15 días.";
  }

  if (confirm(mensajeConfirmacion)) {

    // Si el input no está bloqueado, guardamos la nueva fecha
    let updateData = {};
    if (nuevoAvatar) updateData.foto = nuevoAvatar;

    if (!nuevoNombreInput.disabled) {
      updateData.nombre = nuevoNombre;
      updateData.ultimaFechaCambio = Date.now();
      updateData.usernameModificado = false; // Quitamos el candado viejo si lo tenía
    }

    // Guardamos en Firebase
    await update(ref(db, 'usuarios/' + usuarioActualFirebase.uid), updateData);

    // Actualizamos la memoria local
    const perfilActual = JSON.parse(localStorage.getItem('fnf_user_profile')) || {};
    if (!nuevoNombreInput.disabled) perfilActual.nombre = nuevoNombre;
    if (nuevoAvatar) perfilActual.foto = nuevoAvatar;
    localStorage.setItem('fnf_user_profile', JSON.stringify(perfilActual));

    alert("¡Perfil actualizado exitosamente!");
    abrirPerfil(); // Recargamos la ventanita
  }
};

//=======================================
window.exigirRegistro = function () {
  if (!usuarioActualFirebase) {
    alert("🔒 Debes iniciar sesión con Google para usar esta función.");
    document.getElementById('auth-overlay').style.display = 'flex';
    return true;
  }
  return false;
};

//=======================================

let isSuperUser = false;
const userProfile = JSON.parse(localStorage.getItem('fnf_user_profile'));

if (userProfile && userProfile.key === MI_UID_ADMIN) {
  isSuperUser = true;
  document.body.classList.add('is-admin');
}

const urlParams = new URLSearchParams(window.location.search);
const secretUid = urlParams.get('set_admin');

if (secretUid) {
  const newProfile = {
    key: secretUid,
    name: "Admin LaloCF",
    verified: true
  };
  localStorage.setItem('fnf_user_profile', JSON.stringify(newProfile));

  window.history.replaceState({}, document.title, window.location.pathname);

  alert("🛠️ ¡Privilegios de Administrador Activados en este dispositivo a travez de un enlace compartido!");
  window.location.reload();
}

let verifiedUsers = {};
let downloadCounts = {};

onValue(ref(db, 'downloads'), (snap) => {
  downloadCounts = snap.val() || {};
  Object.keys(downloadCounts).forEach(id => {
    const el = document.getElementById('dl-' + id);
    if (el) el.innerText = downloadCounts[id];
  });
});

onValue(ref(db, 'verified_users'), (snap) => {
  verifiedUsers = snap.val() || {};
});

window.trackDownload = (id) => {
  runTransaction(ref(db, `downloads/${id}`), (current) => (current || 0) + 1);
};

// -------------------------------------------

window.toggleGreenLed = async (id, event) => {
  event.stopPropagation();
  if (!isSuperUser) return;
  const ledRef = ref(db, `updates_led/${id}`);
  const snap = await get(ledRef);
  if (snap.exists()) {
    await set(ledRef, null);
  } else {
    await set(ledRef, true);
  }
};

onValue(ref(db, 'updates_led'), (snap) => {
  const leds = snap.val() || {};
  document.querySelectorAll('.led-green').forEach(el => el.style.display = 'none');
  Object.keys(leds).forEach(id => {
    const el = document.getElementById(`led-green-${id}`);
    if (el) el.style.display = 'inline-block';
    const btn = document.getElementById(`btn-led-${id}`);
    if (btn) btn.innerText = '⭕ Quitar LED';
  });
  document.querySelectorAll('.admin-led-btn').forEach(btn => {
    const id = btn.id.replace('btn-led-', '');
    if (!leds[id]) btn.innerText = '🟢 Act. LED';
  });
});

onValue(ref(db, 'last_comment_time'), (snap) => {
  const times = snap.val() || {};
  document.querySelectorAll('.led-yellow').forEach(el => el.style.display = 'none');
  Object.keys(times).forEach(id => {
    const lastComment = times[id];
    const lastSeen = localStorage.getItem(`seen_comments_${id}`) || 0;
    if (lastComment > lastSeen) {
      const el = document.getElementById(`led-yellow-${id}`);
      if (el) el.style.display = 'inline-block';
    }
  });
});

window.toggleModPin = async (modId, event) => {
  event.stopPropagation();
  if (!isSuperUser) return;
  const pinRef = ref(db, `pinned_mods/${modId}`);
  const snap = await get(pinRef);
  if (snap.exists()) {
    await set(pinRef, null);
  } else {
    await set(pinRef, true);
  }
};

onValue(ref(db, 'pinned_mods'), (snap) => {
  const pinned = snap.val() || {};
  const container = document.getElementById('modsContainer');
  const cards = Array.from(container.querySelectorAll('.mod-card:not(.coming-soon-card)'));

  cards.forEach(card => {
    const modId = card.id.replace('card-', '');
    const btn = card.querySelector('.admin-pin-btn');
    if (pinned[modId]) {
      card.classList.add('pinned-mod');
      if (btn) btn.innerText = '❌ Desfijar';
    } else {
      card.classList.remove('pinned-mod');
      if (btn) btn.innerText = '📌 Fijar';
    }
  });

  cards.sort((a, b) => {
    const aId = a.id.replace('card-', '');
    const bId = b.id.replace('card-', '');
    const aPinned = pinned[aId] ? 1 : 0;
    const bPinned = pinned[bId] ? 1 : 0;
    return bPinned - aPinned;
  });

  cards.forEach(card => container.appendChild(card));
});

window.sendGlobalNotification = async () => {
  const text = document.getElementById('globalNotifText').value.trim();
  if (!text) return alert("Escribe un mensaje primero.");

  await set(ref(db, 'notifications/latest'), {
    message: text,
    timestamp: Date.now(),
    id: Math.random().toString(36).substr(2, 9)
  });

  document.getElementById('globalNotifText').value = '';
  document.getElementById('admin-tools-popup').classList.remove('show');
};

window.showToast = (msg) => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span style="font-size:20px;">🔔</span> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 500);
  }, 6000);
};

onValue(ref(db, 'notifications/latest'), (snap) => {
  const data = snap.val();
  if (!data) return;

  const lastSeen = localStorage.getItem('last_notif_id');
  const isRecent = (Date.now() - data.timestamp) < (24 * 60 * 60 * 1000);

  if (lastSeen !== data.id && isRecent) {
    window.showToast(data.message);
    localStorage.setItem('last_notif_id', data.id);
  }
});

let currentModCommentsId = null;
let modCommentsListener = null;

window.openModComments = (id, title) => {
  if (exigirRegistro()) return;
  currentModCommentsId = id;
  document.getElementById("mc-title").innerText = "Comentarios: " + title;

  localStorage.setItem(`seen_comments_${id}`, Date.now());
  const yellowLed = document.getElementById(`led-yellow-${id}`);
  if (yellowLed) yellowLed.style.display = 'none';

  const user = JSON.parse(localStorage.getItem('fnf_user_profile'));
  if (!user) {
    document.getElementById('register-popup').classList.add('show');
    return;
  }

  const display = document.getElementById('mc-displayMyName');
  const nombreUsuario = user.nombre || user.name || "Usuario";
  const fotoUsuario = user.foto || user.avatar || "";

  display.innerText = "Comentando como: " + nombreUsuario;
  if (nombreUsuario.toLowerCase() === 'lalocf') display.classList.add('admin-name');

  const avatar = document.getElementById('mc-myAvatar');
  if (fotoUsuario) {
    avatar.innerHTML = `<img src="${fotoUsuario}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    avatar.style.background = 'transparent';
  } else {
    avatar.innerHTML = nombreUsuario.charAt(0).toUpperCase();
    avatar.style.background = stringToColor(nombreUsuario);
  }

  document.getElementById("mod-comments-popup").classList.add("show");

  if (modCommentsListener) modCommentsListener();

  const commentsRef = ref(db, `mod_comments/${id}`);
  modCommentsListener = onValue(commentsRef, (snapshot) => {
    const list = document.getElementById('mc-commentList');
    list.innerHTML = '';
    const data = snapshot.val();
    const myProfile = JSON.parse(localStorage.getItem('fnf_user_profile'));

    if (data) {
      let commentsArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));

      commentsArray.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.id.localeCompare(a.id);
      });

      commentsArray.forEach(c => {
        const userName = c.user || "Usuario";
        const isLalo = userName.toLowerCase() === 'lalocf';
        const isVerified = verifiedUsers[c.ownerKey] || isLalo;
        const myLikedComments = JSON.parse(localStorage.getItem('my_liked_mod_comments') || '{}');
        const activeClass = myLikedComments[c.id] ? 'active' : '';

        const pinClass = c.isPinned ? 'pinned' : '';
        const pinBadge = c.isPinned ? '<div class="pinned-badge">📌 FIJADO</div>' : '';
        const verifyBadge = isVerified ? '<span class="verified-icon">☑️</span>' : '';

        let adminBtns = '';
        if (isSuperUser) {
          adminBtns = `
             <span style="color:gold; cursor:pointer" onclick="togglePinModComment('${c.id}', ${c.isPinned})">${c.isPinned ? 'Desfijar' : '📌 Fijar'}</span> • 
             <span style="color:red; cursor:pointer" onclick="deleteModComment('${c.id}')">Eliminar</span>
           `;
        } else if (myProfile && c.ownerKey === myProfile.key) {
          adminBtns = `<span style="color:red; cursor:pointer" onclick="deleteModComment('${c.id}')">Eliminar</span>`;
        }

        const avatarContent = c.avatar
          ? `<img src="${c.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
          : userName.charAt(0).toUpperCase();

        const div = document.createElement('div');
        div.className = `yt-comment-container ${pinClass}`;
        div.innerHTML = `
          <div class="yt-avatar" style="background:${c.avatar ? 'transparent' : stringToColor(c.user)}">${avatarContent}</div>
          <div class="yt-content">
            ${pinBadge}
            <div class="yt-header">
              <span class="yt-name ${isLalo ? 'admin-name' : ''}" onclick="openBanPanel('${c.ownerKey}', '${userName}')">
                <a href="${c.link || '#'}" target="_blank" class="yt-name-link">${userName}</a>${verifyBadge}
              </span>
              <span class="yt-date">${c.date}</span>
            </div>
            <div class="yt-text">${c.text}</div>
            <div class="yt-actions">
              <span class="yt-action-btn ${activeClass}" id="btn-mclike-${c.id}" onclick="likeModComment('${c.id}')">👍 <span id="mcl-count-${c.id}">${c.likes || 0}</span></span> 
              <span class="yt-action-btn" onclick="replyModComment('${userName}')">Responder</span>
              ${adminBtns}
            </div>
          </div>`;
        list.appendChild(div);
      });
    } else {
      list.innerHTML = '<p style="text-align:center; color:#aaa; font-size:13px;">Sé el primero en comentar aquí.</p>';
    }
  });
};

window.closeModComments = () => {
  document.getElementById("mod-comments-popup").classList.remove("show");
  if (modCommentsListener) {
    modCommentsListener();
    modCommentsListener = null;
  }
};

window.addModComment = async () => {
  if (await checkBanStatus()) return;
  const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  const text = document.getElementById('mc-commentText').value.trim();
  if (!profile) return checkUserStatus();
  if (!text) return alert("Escribe algo...");

  push(ref(db, `mod_comments/${currentModCommentsId}`), {
    ownerKey: profile.key,
    user: profile.nombre || profile.name || "Usuario",
    link: profile.link || "#",
    avatar: profile.foto || profile.avatar || "",
    text,
    date: new Date().toLocaleString(),
    likes: 0,
    isPinned: false
  });

  set(ref(db, `last_comment_time/${currentModCommentsId}`), Date.now());
  document.getElementById('mc-commentText').value = '';
};

window.likeModComment = async (commentId) => {
  if (await checkBanStatus()) return;

  if (!usuarioActualFirebase) {
    alert("🔒 Debes iniciar sesión con Google para dar Like a los comentarios.");
    document.getElementById('auth-overlay').style.display = 'flex';
    return;
  }

  const userKey = usuarioActualFirebase.uid;

  const myLikedComments = JSON.parse(localStorage.getItem('my_liked_mod_comments') || '{}');
  const likeRef = ref(db, `mod_comments/${currentModCommentsId}/${commentId}/userLikes/${userKey}`);
  const snap = await get(likeRef);

  if (snap.exists()) {
    await set(likeRef, null);
    runTransaction(ref(db, `mod_comments/${currentModCommentsId}/${commentId}/likes`), (c) => (c || 1) - 1);
    delete myLikedComments[commentId];
  } else {
    await set(likeRef, true);
    runTransaction(ref(db, `mod_comments/${currentModCommentsId}/${commentId}/likes`), (c) => (c || 0) + 1);
    myLikedComments[commentId] = true;
  }
  localStorage.setItem('my_liked_mod_comments', JSON.stringify(myLikedComments));
};

window.deleteModComment = (id) => {
  if (!usuarioActualFirebase) return alert("❌ Como Administrador, primero debes INICIAR SESIÓN con Google para tener permisos de base de datos y poder borrar.");
  if (confirm("¿Borrar comentario?")) remove(ref(db, `mod_comments/${currentModCommentsId}/${id}`));
};
window.togglePinModComment = (cId, currentState) => update(ref(db, `mod_comments/${currentModCommentsId}/${cId}`), { isPinned: !currentState });
window.replyModComment = (name) => { const txt = document.getElementById('mc-commentText'); txt.value = `@${name} `; txt.focus(); };

document.getElementById('mc-commentText').addEventListener('input', function () { document.getElementById('mc-charCounter').innerText = this.value.length; });

window.toggleVerify = (userKey) => { if (confirm("¿Dar insignia de verificado?")) { update(ref(db, `verified_users`), { [userKey]: true }); } };

onValue(ref(db, ".info/connected"), (snap) => {
  if (snap.val() === true) {
    document.getElementById("statusDot").classList.add("online");
    document.getElementById("statusText").innerText = "Servidor: Activo";
    document.getElementById("statusText").style.color = "#00ff41";
  } else {
    document.getElementById("statusDot").classList.remove("online");
    document.getElementById("statusText").innerText = "Servidor: Desconectado";
    document.getElementById("statusText").style.color = "#aaa";
  }
});

window.toggleTheme = () => document.body.classList.toggle("light");

window.selectSection = (id, el) => {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  const searchUI = document.getElementById("searchContainer");
  const filterUI = document.getElementById("filterContainer");

  if (id === 'apks') {
    searchUI.style.display = 'block';
    filterUI.style.display = 'none';
  } else if (id === 'mods') {
    searchUI.style.display = 'block';
    filterUI.style.display = 'flex';
  } else if (id === 'scripts') {
    searchUI.style.display = 'block';
    filterUI.style.display = 'none';
  } else {
    searchUI.style.display = 'none';
    filterUI.style.display = 'none';
  }

  if (el) {
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    el.classList.add("active");
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

let currentFilter = 'all';
window.setFilter = (filter, btn) => {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterContent();
};

// ==========================================

let tiempoEsperaBusqueda;

window.filterContent = () => {
  clearTimeout(tiempoEsperaBusqueda);

  tiempoEsperaBusqueda = setTimeout(() => {

    const search = document.getElementById('globalSearch').value.toLowerCase();
    const items = document.querySelectorAll('.mod-card');
    const apks = document.querySelectorAll('.apk-card');

    items.forEach(item => {
      if (item.classList.contains('coming-soon-card')) return;
      const title = item.querySelector('h3').innerText.toLowerCase();
      const itemGama = item.getAttribute('data-gama') || 'mid';
      const tags = (item.getAttribute('data-tags') || '').toLowerCase();
      const matchesSearch = title.includes(search) || tags.includes(search);
      const matchesFilter = typeof currentFilter !== 'undefined' ? (currentFilter === 'all' || itemGama === currentFilter) : true;
      item.style.display = (matchesSearch && matchesFilter) ? "block" : "none";
    });

    apks.forEach(apk => {
      const title = apk.querySelector('h3').innerText.toLowerCase();
      apk.style.display = title.includes(search) ? "block" : "none";
    });

  }, 300);
};

async function checkBanStatus() {
  const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  if (!profile) return false;
  const snap = await get(ref(db, `banned_users/${profile.key}`));
  if (snap.exists()) {
    const banData = snap.val();
    if (Date.now() < banData.expiresAt) {
      const timeLeft = Math.ceil((banData.expiresAt - Date.now()) / 3600000);
      alert(`⛔ ACCESO DENEGADO\nMotivo: ${banData.reason}\nExpira en: ${timeLeft}h`);
      return true;
    } else {
      await set(ref(db, `banned_users/${profile.key}`), null);
      return false;
    }
  }
  return false;
}

window.openBanPanel = (userKey, userName) => {
  if (!isSuperUser) return;
  document.getElementById('ban-target-info').innerText = `Gestionando a: ${userName}`;
  document.getElementById('ban-popup').classList.add('show');
  document.getElementById('confirmBanBtn').onclick = async () => {
    const reason = document.getElementById('banReason').value || "Normas";
    const hours = parseInt(document.getElementById('banDuration').value) || 24;
    await set(ref(db, `banned_users/${userKey}`), { userName, reason, expiresAt: Date.now() + (hours * 3600000) });
    alert("Usuario baneado.");
    document.getElementById('ban-popup').classList.remove('show');
  };
};

function checkUserStatus() {
  const user = JSON.parse(localStorage.getItem('fnf_user_profile'));
  if (!user) { document.getElementById('register-popup').classList.add('show'); }
  else { updateCommentInterface(user); syncLikeButtons(); }
}

function updateCommentInterface(user) {
  const display = document.getElementById('mc-displayMyName');
  if (display) {
    const nombreUsuario = user.nombre || user.name || "Usuario";
    const fotoUsuario = user.foto || user.avatar || "";

    display.innerText = "Comentando como: " + nombreUsuario;
    if (nombreUsuario.toLowerCase() === 'lalocf') display.classList.add('admin-name');

    const avatar = document.getElementById('mc-myAvatar');
    if (fotoUsuario) {
      avatar.innerHTML = `<img src="${fotoUsuario}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      avatar.style.background = 'transparent';
    } else {
      avatar.innerText = nombreUsuario.charAt(0).toUpperCase();
      avatar.style.background = stringToColor(nombreUsuario);
    }
  }
}

window.saveRegistration = () => {
  const name = document.getElementById('regName').value.trim();
  const link = document.getElementById('regLink').value.trim() || "#";
  const avatar = document.getElementById('regAvatar').value.trim() || "";
  if (name.length < 3) return alert("El nombre es corto, intenta agregarle mas caracteres.");

  const oldProfile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  const key = oldProfile ? oldProfile.key : 'user_' + Math.random().toString(36).substr(2, 9);

  const profile = { name, link, avatar, key };
  localStorage.setItem('fnf_user_profile', JSON.stringify(profile));
  document.getElementById('register-popup').classList.remove('show');
  location.reload();
};

let holdTimer;
const fnfTitle = document.getElementById('fnf-title');
const _0xd1a4 = "bGFsb2NmbW9kczE=";

fnfTitle.addEventListener('mousedown', startHold);
fnfTitle.addEventListener('mouseup', endHold);
fnfTitle.addEventListener('touchstart', startHold);
fnfTitle.addEventListener('touchend', endHold);

function startHold() { holdTimer = setTimeout(() => { document.getElementById('admin-popup').classList.add('show'); }, 5000); }
function endHold() { clearTimeout(holdTimer); }

window.verifyAdmin = () => {
  const input = document.getElementById('adminCode').value;
  if (btoa(input) === _0xd1a4) {
    localStorage.setItem('superUser', 'true');
    alert("Modo Superusuario Activado.");
    location.reload();
  } else { alert("Código incorrecto."); }
};

function stringToColor(str) {
  let hash = 0; for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  return `hsl(${hash % 360}, 65%, 50%)`;
}

window.handleLike = async (id, el) => {

  if (await checkBanStatus()) return;

  if (exigirRegistro()) return;

  const userKey = usuarioActualFirebase.uid;

  const myLikedItems = JSON.parse(localStorage.getItem('my_liked_items') || '{}');
  const itemLikeRef = ref(db, `likes_registry/${id}/${userKey}`);
  const snap = await get(itemLikeRef);

  if (snap.exists()) {
    await set(itemLikeRef, null);
    runTransaction(ref(db, `likes/${id}`), (c) => (c || 1) - 1);
    delete myLikedItems[id];
    el.classList.remove('active');
  } else {
    await set(itemLikeRef, true);
    runTransaction(ref(db, `likes/${id}`), (c) => (c || 0) + 1);
    myLikedItems[id] = true;
    el.classList.add('active');
  }

  localStorage.setItem('my_liked_items', JSON.stringify(myLikedItems));
};

function syncLikeButtons() {
  const myLikedItems = JSON.parse(localStorage.getItem('my_liked_items') || '{}');
  Object.keys(myLikedItems).forEach(id => {
    const btn = document.getElementById('like-' + id);
    if (btn) btn.classList.add('active');
  });
}

const SCRIPTS_DATA = {
  script1: {
    title: "MobileFPSOverlay",
    desc: "Este script agrega un contador de fotogramas por segundo a FNF Mobile V-Slice.\nTotalmente funcional para Android y iOS./n/nCuenta con actulizaciones constantes, mantengase al tanto para mantener la versión mas reciente.",
    version: "v1.2.0",
    images: [
      "assets/images/scripts/MFO/mfo.webp",
      "assets/images/scripts/MFO/mfo2.webp",
      "assets/images/scripts/MFO/mfo3.webp",
      "assets/images/scripts/MFO/mfo4.webp",
      "assets/images/scripts/MFO/mfo5.webp",
      "assets/images/scripts/MFO/mfo6.webp"
    ],
    downloads: [
      { name: "Descarga en mi Repositorio (GitHub)", link: "https://github.com/LaloCF2/MobileFPSOverlay" },
      { name: "Descarga Script Directo (Drive)", link: "https://drive.google.com/file/d/1l2FaGqINbPzOp6-SgiFGwwUr1v8IjTKZ/view?usp=drive_link" }
    ]
  },
  script2: {
    title: "Controller Engine",
    desc: "Este script agrega un mando virtual a tu juego psych engine dandole una apariencia igual al de Gombo Cat.\nTotalmente funcional para Pc, Android y iOS.",
    version: "v1.0",
    images: [
      "assets/images/scripts/mc1.webp"
    ],
    downloads: [
      { name: "Descarga en mi Repositorio (GitHub)", link: "https://github.com/LaloCF2/Controller-Engine" },
    ]
  },
  script3: {
    title: "Menu Pause",
    desc: "Este script agrega un menú de pausa funcional a tu juego.\nTotalmente funcional para Pc, Android y iOS.",
    version: "v1.0",
    images: [
      "assets/images/scripts/mp1.webp",
      "assets/images/scripts/mp2.webp"
    ],
    downloads: [
      { name: "Descarga original (GameBanana)", link: "https://gamebanana.com/mods/464393" },
      { name: "Descarga Script Directo (GitHub)", link: "assets/zip/Custom Pause.zip" }
    ]
  },
  script4: {
    title: "FPS Counter",
    desc: "Este script agrega un contador de fotogramas por segundo a tu juego.\nTotalmente funcional para Pc, Android y iOS.",
    version: "v1.0",
    images: [
      "assets/images/scripts/sc1.webp"
    ],
    downloads: [
      { name: "Descarga Script Directo (GitHub)", link: "assets/zip/FPS_Counter.zip" }
    ]
  },
};

let scriptImagesArray = [];
let currentScriptImgIndex = 0;

//==================================

// ==========================================
// 📄 LECTOR AUTOMÁTICO DE NOVEDADES (MODAL iOS)
// ==========================================
window.cargarNovedadesTXT = function (id, tipo) {
  const modal = document.getElementById('modal-novedades-ios');
  const cajaTexto = document.getElementById('texto-novedades-ios');

  cajaTexto.innerHTML = `<div style="text-align: center; padding: 20px 0;"><span style="font-size: 24px;">⏳</span><br><br>Cargando información...</div>`;
  modal.classList.add('show');

  const rutaTXT = tipo === 'script' ? `assets/scripts/update/${id}.txt` : `assets/bases/update/${id}.txt`;

  fetch(rutaTXT)
    .then(response => {
      if (!response.ok) throw new Error("Archivo no encontrado");
      return response.text();
    })
    .then(textoLimpio => {
      cajaTexto.innerText = textoLimpio;
    })
    .catch(error => {
      console.error(error);
      const idioma = localStorage.getItem('idioma_guardado') || 'es';
      const msjError = idioma === 'en' ? "No update logs found." : "No hay novedades registradas para esta versión aún.";

      cajaTexto.innerHTML = `<div style="text-align: center; color: #ff453a; padding: 10px 0;">${msjError}</div>`;
    });
};

window.cerrarModalNovedades = function () {
  document.getElementById('modal-novedades-ios').classList.remove('show');
};

//===================================

window.openScriptInfo = (id) => {
  if (exigirRegistro()) return;
  const d = SCRIPTS_DATA[id];
  scriptImagesArray = d.images;
  currentScriptImgIndex = 0;

  document.getElementById("script-img").src = scriptImagesArray[currentScriptImgIndex];
  document.getElementById("script-title").innerText = d.title;
  document.getElementById("script-desc").innerText = d.desc;
  document.getElementById("script-version").innerText = d.version;

  let h = "";
  d.downloads.forEach(dl => {
    h += `<a class="btn" style="display:block; margin-top:10px" href="${dl.link}" target="_blank" onclick="trackDownload('${id}')">${dl.name}</a>`;
  });
  h += `<button class="btn" style="display:block; margin-top:15px; background:var(--neon-red); width:100%; box-sizing:border-box;" onclick="reportError('${id}')">⚠️ Reportar Link Caído</button>`;
  if (isSuperUser) { h += `<button class="btn" style="display:block; margin-top:5px; background:#444; width:100%; box-sizing:border-box;" onclick="clearReports('${id}')">🛠️ Limpiar Reportes</button>`; }
  document.getElementById("script-downloads").innerHTML = h;

  const btns = document.querySelectorAll(".carousel-btn");
  if (scriptImagesArray.length <= 1) {
    btns.forEach(b => b.style.display = 'none');
  } else {
    btns.forEach(b => b.style.display = 'block');
  }

  document.getElementById("script-popup").classList.add("show");
};



window.closeScriptInfo = () => document.getElementById("script-popup").classList.remove("show");

window.nextScriptImage = () => {
  currentScriptImgIndex = (currentScriptImgIndex + 1) % scriptImagesArray.length;
  document.getElementById("script-img").src = scriptImagesArray[currentScriptImgIndex];
};

window.prevScriptImage = () => {
  currentScriptImgIndex = (currentScriptImgIndex - 1 + scriptImagesArray.length) % scriptImagesArray.length;
  document.getElementById("script-img").src = scriptImagesArray[currentScriptImgIndex];
};

const MOD_DATA = {
  mod98_2: {
    img: "assets/images/mods/Elias.webp",
    title: "EliasFunkin Revival",
    desc: "Friday Night Funkin' FNF' EliasFunkin Revival Port Opt Psych Engine Optimizado Para (Pc/Android/iOS).",
    version: "Compatible: Solo Psych Engine v1.0.4",
    downloads: [
      { name: "Descarga Opt (GitHub Directo)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/KK/EliasFunkinPortOpt.zip" },
      { name: "Descarga Opt (Drive)", link: "https://drive.google.com/file/d/16yJyuzQ6TzbH7Kq3UCq23X3rXq9GWSxt/view?usp=drive_link" },
      { name: "Descarga Opt (MediaFire)", link: "https://www.mediafire.com/file/9uc5iepr3t93ed1/EliasFunkinPortOpt.zip/file" },
      { name: "Descarga No Opt (GitHub Directo)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/KK/EliasFunkinPort.zip" },
      { name: "Descarga No Opt (Drive)", link: "https://drive.google.com/file/d/1IJ2_IuiBksKLgSym3Cn6Vf2qvt9wJ0Mz/view?usp=drive_link" },
      { name: "Descarga No Opt (MediaFire)", link: "https://www.mediafire.com/file/uomjcg2ytof4m7l/EliasFunkinPort.zip/file" }
    ]
  },
  mod98_3: {
    img: "assets/images/mods/GG.webp",
    title: "GameOverse",
    desc: "Friday Night Funkin' FNF' GameOverse Port Opt Psych Engine Optimizado Para (Pc/Android/iOS).",
    version: "Compatible: P-Slice v3.4.2, Psych Engine v1.0.4 etc",
    downloads: [
      { name: "Descarga (GitHub Directo)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/GG/GameOverse.zip" },
      { name: "Descarga (Drive)", link: "https://drive.google.com/file/d/1LgUOiahqiKEUscjX0NWUpsYeFMOLeEAy/view?usp=drivesdk" },
      { name: "Descarga (MediaFire)", link: "https://www.mediafire.com/file/8a3ld8jo5g16ezz/GameOverse.zip/file" }
    ]
  },
  mod98_4: {
    img: "assets/images/mods/pibby.webp",
    title: "Pibby Rescript",
    desc: "Friday Night Funkin' FNF' Pibby Rescript Port Opt Psych Engine Optimizado Para (Pc/Android/iOS).",
    version: "Compatible: P-Slice v3.4.2, Psych Engine v1.0.4",
    downloads: [
      { name: "Descarga (GitHub Directo)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/Pibby/Pibby.Rescript.Opt.zip" },
      { name: "Descarga (Drive)", link: "https://drive.google.com/file/d/1tCaOh5lCvMVHZND3HAP4FDQHcawBl_CI/view?usp=drive_link" },
      { name: "Descarga (MediaFire)", link: "https://www.mediafire.com/file/hmoynph507squdt/Pibby_Rescript_Opt.zip/file" }
    ]
  },
  mod98_5: {
    img: "assets/images/mods/fruit.webp",
    title: "FruitNinja V1.5",
    desc: "Friday Night Funkin' FNF' FruitNinja V1.5 Port Opt Psych Engine Optimizado Para (Pc/Android/iOS).",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga (GitHub Directo)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/Fruit/FruitNinja.v1.5.zip" },
      { name: "Descarga (Drive)", link: "https://drive.google.com/file/d/1y239op0zuYMUJiaSK5oDrUQnhKr9E1mG/view?usp=drive_link" }
    ]
  },
  mod98_6: {
    img: "assets/images/mods/II.webp",
    title: "TKOII FanChart",
    desc: "Friday Night Funkin' FNF' TKOII FanChart Port Opt Psych Engine Optimizado Para (Pc/Android).",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga Opt (Drive Directo)", link: "https://drive.usercontent.google.com/u/0/uc?id=1-yHWdTsXn4trZeuO2MhJAV1ZnVrlhPfG&export=download" },
      { name: "Descarga ReOpt (Drive Directo)", link: "https://drive.usercontent.google.com/u/0/uc?id=1V0wOiJws3Z0xgnMJ2PiHfa3zd4w3OklO&export=download" }
    ]
  },
  mod98_7: {
    img: "assets/images/mods/FromTheTop.webp",
    title: "From The Top!",
    desc: "Friday Night Funkin' FNF' From The Top! Port Psych Engine Optimizado Para (Pc/Android/iOS).\n\nPeso del Archivo: 303.00MB",
    version: "Compatible solo con la base Optimizada de Psych Engine v1.0.4",
    downloads: [
      { name: "Descarga ZIP (Drive)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/fft/From.the.Top.Port.zip" },
      { name: "Descarga (MediaFire)", link: "https://www.mediafire.com/file/b2hbahd0brbo52a/From_The_Top%2521_Port.zip/file" },
      { name: "Descarga Psych Engine Opt", link: "https://lalocf2.github.io/fnf_ports/?share=apk1" }
    ]
  },
  mod98_8: {
    img: "assets/images/webp/logopsychengine.webp",
    title: "Naomi FanCharts",
    desc: "Friday Night Funkin' FNF' Naomi FanCharts Port Psych Engine Optimizado Para (Pc/Android/iOS).\n\nPeso del Archivo: 79.87MB",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga ZIP (Drive)", link: "https://drive.google.com/file/d/1D5DI8TTZk83XX4l2KW0QDtWl3ZGwYgxe/view?usp=drive_link" },
    ]
  },
  mod98_9: {
    img: "assets/images/mods/bot.webp",
    title: "Vs BotFriend",
    desc: "Friday Night Funkin' FNF' Vs Botfriend Port Psych Engine Optimizado Para (Pc/Android/iOS).\n\nPeso del Archivo: 72.87MB",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga Original (GameBanana)", link: "https://gamebanana.com/mods/463070" },
      { name: "Descarga ZIP (GitHub)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/BtF/V.S.Botfriend.zip" }
    ]
  },
  mod99_0: {
    img: "assets/images/mods/star2026.webp",
    title: "Stargazer (2026) FanChart",
    desc: "Friday Night Funkin' FNF' Stargazer (2026) FanChart Port Psych Engine Optimizado Para (Pc/Android/iOS).\n\nEste solo esta optimizado y para que fuera compatible con iOS.\n\nPeso del archivo: 18.88MB",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga Original (GameBanana)", link: "https://gamebanana.com/mods/657873" },
      { name: "Descarga ZIP (GitHub)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/Stargazer2026/Stargazer.2026.FanChart-PE.1.0.4.zip" }
    ]
  },
  mod99_1: {
    img: "assets/images/mods/wii.webp",
    title: "VS Matt V3",
    desc: "Friday Night Funkin' FNF' Vs Matt V3 Port Psych Engine Optimizado Para (Pc/Android).\n\nEste puede tener errores en la base de Psych Online, todas las demas son compatibles correctamente.",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga Directa ZIP (GitHub)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/Wii/MattV3.Port.zip" },
      { name: "Descarga ZIP (Drive)", link: "https://drive.google.com/file/d/1GxlBf_tDX8qFJttqmb_DJH9s3xr4TeFZ/view?usp=drivesdk" },
      { name: "Descarga ZIP (MediaFire)", link: "https://www.mediafire.com/file/dva94kid8frmrew/MattV3_%2528Port%2529.zip/file" }
    ]
  },
  mod99_2: {
    img: "assets/images/mods/play.webp",
    title: "Child's Play Pico Mix",
    desc: "Friday Night Funkin' FNF' Child's Play Pico Mix & Wip Mod Port Psych Engine Optimizado Para (Pc/Android/iOS)",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga (Drive) Mejorado y Opt por LaloCF", link: "https://drive.google.com/file/d/1qyMKXjaGwH4PG3DPVqphTrMskvU-sX_4/view?usp=drivesdk" },
      { name: "Descarga (Tik Tok) Wip", link: "https://vt.tiktok.com/ZSawhN2LN/" },
      { name: "Descarga Original", link: "https://gamebanana.com/mods/546317" }
    ]
  },
  mod99_3: {
    img: "assets/images/mods/fate.webp",
    title: "TaintedFate",
    desc: "Friday Night Funkin' FNF' TaintedFate Mod Port Psych Engine Optimizado Para (Pc/Android/iOS)",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga (Drive)", link: "https://drive.usercontent.google.com/download?id=12kYlM1XbLGa_3o9uIjYtFfUMGE7PLe4E&export=download&authuser=0" },
      { name: "Descarga Original", link: "https://gamebanana.com/mods/504445" }
    ]
  },
  mod99_4: {
    img: "assets/images/mods/logojeffy.jpeg",
    title: "VS Jeffy V3 (BABY BF VS BABY PICO)",
    desc: "Friday Night Funkin' FNF' Vs Jeffy V3 Port Psych Engine Optimizado Para (Pc/Android).",
    version: "Psych v1.0.4",
    downloads: [{ name: "Descarga", link: "assets/zip/VS Jeffy V3 (BABY BF VS BABY PICO).zip" }]
  },
  mod99_5: {
    img: "assets/images/mods/logonusky.jpeg",
    title: "VS Nusky",
    desc: "Friday Night Funkin' FNF' Vs Nusky Mod Psych Engine Optimizado Para (Pc/Android).",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/Ports/Vs.Nusky.zip" },
      { name: "Descarga (GameBanana)", link: "https://gamebanana.com/mods/369981" }
    ]
  },
  mod99_6: {
    img: "assets/images/mods/chritmas.jpeg",
    title: "Cocoa Noimix",
    desc: "Friday Night Funkin' FNF' Cocoa Noimix Port Psych Engine Optimizado Para (Pc/Android/iOS).",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga (GameBanana)", link: "https://gamebanana.com/mods/643242" },
      { name: "Descarga Directa (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=1wnnGhworUMdReUrlEMMh5C4in4OoHHrU&export=download" },
      { name: "Descarga Directa iOS (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=11AUlGXUvPrxszI5xnjssMS5OvZDFp64_&export=download" },
      { name: "Descarga Directa Opt (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=1EO-TOh4KByE0gSf24DXx2pG10WR8wdhU&export=download" }
    ]
  },
  mod99_7: {
    img: "assets/images/mods/metal.png",
    title: "Vs Metal Pipe V2",
    desc: "Friday Night Funkin' FNF' Vs Metal Pipe V2 Port Psych Engine Optimizado Para (Pc/Android) y en especial iOS.",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga (GameBanana)", link: "https://gamebanana.com/mods/441630" },
      { name: "Descarga Directa (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=1g5liWScsGSSd_FCmDtLEOVPQSQtp6E8B&export=download" }
    ]
  },
  mod99_8: {
    img: "assets/images/mods/Girl.png",
    title: "Rolling Girl",
    desc: "Friday Night Funkin' FNF' Rolling Girl Port Psych Engine Optimizado Para (Pc/Android/iOS).",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga (GameBanana)", link: "https://gamebanana.com/mods/42313?lang=es" },
      { name: "Descarga Directa (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=1n_e-lmvGFeIybTIDkdHXnduEIeXziD8I&export=download" }
    ]
  },
  mod99_9: {
    img: "assets/images/mods/tales.webp",
    title: "Herobrine Reborn Tales",
    desc: "Friday Night Funkin' FNF' Herobrine Reborn Tales Port Psych Engine Para (Pc/Android/iOS).",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga (Drive)", link: "https://drive.google.com/file/d/1bPmKg62b6r5xiEOI5ZVFNHZqU0Mp0PLY/view" }
    ]
  },
  mod100: {
    img: "assets/images/mods/odd.webp",
    title: "Vs. TheOdd1sOut ONESHOT",
    desc: "Friday Night Funkin' FNF' Vs. TheOdd1sOut ONESHOT Port Psych Engine Para (Pc/Android/iOS).",
    version: "Psych v1.0.4",
    downloads: [
      { name: "Descarga Directa ES (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=1rBL-hdK-_jeq-bByvK2xUfDu23D4QVEY&export=download" },
      { name: "Descarga Directa EU (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=12gPg9wTnUa_JUSVj1IgUE7ETJieHNPIl&export=download" },
      { name: "Descarga Original (GameBanana)", link: "https://gamebanana.com/mods/498584" }
    ]
  }
};

const APK_DATA = {
  apk1: {
    img: "assets/images/webp/logopsychengine.webp",
    title: "Psych Engine",
    desc: "Motor usado originalmente en Mind Games Mod, concebido para solucionar los numerosos problemas de la versión original, manteniendo el aspecto de juego casual. También busca ser una alternativa más sencilla para programadores principiantes.",
    version: "v1.0.4",
    downloads: [
      { name: "Descarga en el repositorio del desarrollador (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases" },
      { name: "Descarga en GameBanana", link: "https://gamebanana.com/mods/309789" },
      { name: "Descarga Directa Android Optimizado (GitHub)", link: "https://github.com/LaloCF2/LaloCF/releases/download/Psych-Engine-v1.0.4/Psych.Engine.v1.0.4.Android.apk" },
      { name: "Descarga Android No Optimizado (GitHub)", link: "https://github.com/LaloCF2/fnf_ports/releases/download/Psych-Engine-v1.0.4/Friday.Night.Funkin.Psych.Engine_0.2.8.apk" },
      { name: "Descarga Directa iOS Optimizado (GitHub)", link: "https://github.com/LaloCF2/LaloCF/releases/download/Psych-Engine-v1.0.4/PsychEngine.v1.0.4.iOS.ipa" },
      { name: "Descarga Directa Windows64 (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Windows64.zip" },
      { name: "Descarga Directa Windows32 (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Windows32.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Linux.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-MacOS.zip" }
    ]
  },
  apk2: {
    img: "assets/images/webp/logopsychonline.webp",
    title: "Psych Online",
    desc: "Mod de Psych Engine con funciones en línea.",
    version: "v0.14.6 (PC)\nv0.13.2 BugFix (Mobile)",
    downloads: [
      { name: "Descarga en el repositorio del desarrollador (GitHub)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases" },
      { name: "Descarga en GameBanana", link: "https://gamebanana.com/mods/479714" },
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/Prohack202020/Funkin-Psych-Online/releases/download/0.13.2-bugfix-mobile/PsychOnline-Android.apk" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/Prohack202020/Funkin-Psych-Online/releases/download/0.13.2-bugfix-mobile/PsychOnline-iOS.ipa" },
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.14.6/windowsBuild.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.14.6/linuxBuild.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.14.6/macBuild.zip" },
    ]
  },
  apk3: {
    img: "assets/images/webp/logocodename.webp",
    title: "CodeName Engine",
    desc: "Codename Engine es una bifurcación de Friday Night Funkin' con un enfoque en codificación suave y modding.",
    version: "v1.0.1",
    downloads: [
      { name: "Descarga en el repositorio del desarrollador (GitHub)", link: "https://github.com/CodenameCrew/CodenameEngine/releases" },
      { name: "Descarga en GameBanana", link: "https://gamebanana.com/mods/598553" },
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/HomuHomu833-haxe-stuff/CodenameEngine-Mobile/releases/download/v1.0.1/Codename.Engine-Android.apk" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/HomuHomu833-haxe-stuff/CodenameEngine-Mobile/releases/download/v1.0.1/Codename.Engine-iOS.ipa" },
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Windows.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Linux.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Mac.zip" }
    ]
  },
  apk4: {
    img: "assets/images/webp/logoplusengine.webp",
    title: "Plus Engine",
    desc: "Motor basado en Psych 1.0.4 con modcharts como NotITG y compatible con vídeos hxcodec de los mods Psych 0.6.3 y 0.7.3.",
    version: "v1.2.6 HOTFIX\nv1.2.7 (Pc/Android)",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases" },
      { name: "Descargas en GameBanana", link: "https://gamebanana.com/mods/602743" },
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.7/PlusEngine-Android-x64-v7a.zip" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-iOS.zip" },
      { name: "Descarga Directa Windows 32 (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Windows-x32.zip" },
      { name: "Descarga Directa Windows 64 Actualizado (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.7/PlusEngine-Windows-x64.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Linux-x64.zip" },
      { name: "Descarga Directa Mac ARM (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Mac-ARM.zip" },
      { name: "Descarga Directa Mac Intel (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Mac-Intel.zip" }
    ]
  },
  apk5: {
    img: "assets/images/webp/logop-slice.webp",
    title: "P-Slice Engine",
    desc: "El motor P-Slice es un cruce entre Psych Engine y la versión más reciente de Friday Night Funkin.\n\nSu objetivo es incorporar nuevos elementos visuales y características de las versiones más nuevas de FNF y realizar cambios en las existentes para que se sientan más cercanas a las de V-Slice.",
    version: "v3.4.2",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases" },
      { name: "Descargas en GameBanana", link: "https://gamebanana.com/mods/535203" },
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.android.zip" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.ios.zip" },
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.windows.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.linux.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.macos.zip" }
    ]
  },
  apk6: {
    img: "assets/images/webp/logonova.webp",
    title: "NovaFleare Engine",
    desc: "NovaFlare-Engine es una rama de FNF Psych Engine , dedicada a proporcionar excelentes efectos visuales y funciones intuitivas. Nuestro objetivo es ofrecer una experiencia de desarrollo y juego potente y divertida tanto para creadores como para jugadores.",
    version: "v1.2.0 Versión Estable",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases" },
      { name: "Descargas en GameBanana", link: "https://gamebanana.com/mods/505473" },
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.2.0/android.zip" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.2.0/ios.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.2.0/linux.zip" },
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.2.0/windows.zip" },
      { name: "Descarga Directa Mac14 (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.2.0/macOS-14.zip" },
      { name: "Descarga Directa Mac15 (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.2.0/macOS-15.zip" }
    ]
  },
  apk7: {
    img: "assets/images/webp/logoEK.webp",
    title: "PsychEngine ExtraKeys",
    desc: "¡Bienvenido a la organización más genial del mundo!\n\n Alojamiento de Psych Engine con claves adicionales , Psych EK , claves adicionales de Psych Engine , claves adicionales o PE: ¡EK !",
    version: "v0.4.6",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases" },
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-android-apk-32d1f1e.zip" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-iOS-ipa-32d1f1e.zip" },
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-windowsBuild-56acc57.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-linuxBuild-56acc57.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-macBuild-56acc57.zip" }
    ]
  },
  apk8: {
    img: "assets/images/webp/logose.webp",
    title: "Shadow Engine",
    desc: "Soy Sombra, el Erizo. Y ahora, soy la forma de tenedor definitiva. - Sombra, el Erizo\n\nUn motor Psych Engine 0.7.3 altamente modificado.\n\nListo para ser modificado en origen.",
    version: "v0.9.0",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases" },
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-ASTC-Android.apk" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-ASTC-iOS.ipa" },
      { name: "Descarga Directa Windows ARM64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-BC-windows-arm64.zip" },
      { name: "Descarga Directa Windows i686 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-BC-windows-i686.zip" },
      { name: "Descarga Directa Windows x86_64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-BC-windows-x86_64.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-BC-macOS-Universal.tar" },
      { name: "Descarga Directa Linux ARM64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-ASTC-linux-arm64.tar" },
      { name: "Descarga Directa Linux ARMV7 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-ASTC-linux-armv7.tar" },
      { name: "Descarga Directa Linux i686 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-BC-linux-i686.tar" },
      { name: "Descarga Directa Linux x86_64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.9.0/ShadowEngine-BC-linux-x86_64.tar" }
    ]
  }
};

window.openModInfo = (id) => {
  if (exigirRegistro()) return;
  if (window.brokenLinksData && window.brokenLinksData[id] && !isSuperUser) {
    const modName = document.querySelector('#card-' + id + ' h3').textContent;
    document.getElementById('maintenance-mod-name').innerText = modName;

    document.getElementById('maintenance-popup').classList.add('show');
    return;
  }
  const d = MOD_DATA[id];
  document.getElementById("popup-img").src = d.img;
  document.getElementById("popup-title").innerText = d.title;
  document.getElementById("popup-desc").innerText = d.desc;
  document.getElementById("popup-version").innerText = d.version;
  let h = "";
  d.downloads.forEach(dl => {
    h += `<a class="btn" style="display:block; margin-top:10px" href="${dl.link}" target="_blank" onclick="trackDownload('${id}')">${dl.name}</a>`;
  });
  h += `<button class="btn" style="display:block; margin-top:15px; background:var(--neon-red); width:100%; box-sizing:border-box;" onclick="reportError('${id}')">⚠️ Reportar Link Caído</button>`;
  if (isSuperUser) { h += `<button class="btn" style="display:block; margin-top:5px; background:#444; width:100%; box-sizing:border-box;" onclick="clearReports('${id}')">🛠️ Limpiar Reportes</button>`; }
  document.getElementById("popup-downloads").innerHTML = h;
  document.getElementById("mod-popup").classList.add("show");
};
window.closeModInfo = () => document.getElementById("mod-popup").classList.remove("show");

window.openApkInfo = (id) => {
  if (exigirRegistro()) return;
  const d = APK_DATA[id];
  document.getElementById("apk-img").src = d.img;
  document.getElementById("apk-title").innerText = d.title;
  document.getElementById("apk-desc").innerText = d.desc;
  document.getElementById("apk-version").innerText = d.version;
  let h = "";
  d.downloads.forEach(dl => {
    h += `<a class="btn" style="display:block; margin-top:10px" href="${dl.link}" target="_blank" onclick="trackDownload('${id}')">${dl.name}</a>`;
  });
  h += `<button class="btn" style="display:block; margin-top:15px; background:var(--neon-red); width:100%; box-sizing:border-box;" onclick="reportError('${id}')">⚠️ Reportar Link Caído</button>`;
  if (isSuperUser) { h += `<button class="btn" style="display:block; margin-top:5px; background:#444; width:100%; box-sizing:border-box;" onclick="clearReports('${id}')">🛠️ Limpiar Reportes</button>`; }
  document.getElementById("apk-downloads").innerHTML = h;
  document.getElementById("apk-popup").classList.add("show");
};
window.closeApkInfo = () => document.getElementById("apk-popup").classList.remove("show");

onValue(ref(db, 'likes'), (s) => { const d = s.val() || {}; Object.keys(d).forEach(k => { if (document.getElementById('count-' + k)) document.getElementById('count-' + k).innerText = d[k]; }); });

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.closeUpdatePopup = () => {
  document.getElementById('update-popup').classList.remove('show');
  localStorage.setItem('lastVersionSeen', APP_VERSION);

  if (deferredPrompt) {
    document.getElementById('install-popup').classList.add('show');
  } else {
    checkUserStatus();
  }
};

window.installApp = async () => {
  document.getElementById('install-popup').classList.remove('show');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
  }
  checkUserStatus();
};

window.dismissInstall = () => {
  document.getElementById('install-popup').classList.remove('show');
  checkUserStatus();
};

window.onload = () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  if (localStorage.getItem('lastVersionSeen') !== APP_VERSION) document.getElementById('update-popup').classList.add('show');
  else checkUserStatus();
};

let currentLang = localStorage.getItem('fnf_lang') || 'es';

window.toggleLanguage = () => {
  currentLang = currentLang === 'es' ? 'en' : 'es';
  localStorage.setItem('fnf_lang', currentLang);
  applyLanguage();
};

function applyLanguage() {
  const elements = document.querySelectorAll('[data-es][data-en]');
  elements.forEach(el => {
    el.classList.add('lang-fade');
    setTimeout(() => {
      el.innerHTML = el.getAttribute(`data-${currentLang}`);
      el.classList.remove('lang-fade');
    }, 150);
  });
  const btn = document.getElementById('langBtn');
  if (btn) btn.innerHTML = currentLang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES';
}

const initV4 = setInterval(() => {
  if (document.getElementById('langBtn')) {
    clearInterval(initV4);
    applyLanguage();

    const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
    if (profile) {
      const nameInput = document.getElementById('editProfileName');
      const avatarInput = document.getElementById('editProfileAvatar');
      const preview = document.getElementById('profile-avatar-preview');

      if (nameInput && profile.name) nameInput.value = profile.name;
      if (avatarInput && profile.avatar) {
        avatarInput.value = profile.avatar;
        if (preview) preview.src = profile.avatar;
      }
    }

    const avatarInput = document.getElementById('editProfileAvatar');
    if (avatarInput) {
      avatarInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const preview = document.getElementById('profile-avatar-preview');
        if (preview) {
          preview.src = url ? url : "https://via.placeholder.com/80/555/fff?text=?";
        }
      });
    }
  }
}, 500);

window.saveProfileChanges = () => {
  let profile = JSON.parse(localStorage.getItem('fnf_user_profile')) || { key: 'user_' + Math.random().toString(36).substr(2, 9), link: '#' };

  const name = document.getElementById('editProfileName').value.trim();
  const avatar = document.getElementById('editProfileAvatar').value.trim();

  if (name.length < 3) return alert(currentLang === 'es' ? "El nombre es corto, intenta agregarle mas caracteres." : "The name is too short, try adding more characters.");

  profile.name = name;
  profile.avatar = avatar;
  localStorage.setItem('fnf_user_profile', JSON.stringify(profile));

  document.getElementById('profile-popup').classList.remove('show');

  if (typeof window.showToast === 'function') {
    window.showToast(currentLang === 'es' ? "¡Perfil actualizado!" : "Profile updated!");
  } else {
    alert(currentLang === 'es' ? "¡Perfil actualizado!" : "Profile updated!");
  }
};

window.currentItemRatingId = null;

setTimeout(() => {
  if (window.openModInfo) {
    const origOpenModInfo = window.openModInfo;
    window.openModInfo = (id) => {
      window.currentItemRatingId = id;
      window.loadItemRating(id, 'mod');
      origOpenModInfo(id);
    };
  }
  if (window.openApkInfo) {
    const origOpenApkInfo = window.openApkInfo;
    window.openApkInfo = (id) => {
      window.currentItemRatingId = id;
      window.loadItemRating(id, 'apk');
      origOpenApkInfo(id);
    };
  }
  if (window.openScriptInfo) {
    const origOpenScriptInfo = window.openScriptInfo;
    window.openScriptInfo = (id) => {
      window.currentItemRatingId = id;
      window.loadItemRating(id, 'script');
      origOpenScriptInfo(id);
    };
  }
}, 1000);

// ==========================================

let globalRatings = {};
window.currentItemRatingId = null;
window.currentItemType = null;

onValue(ref(db, 'ratings'), (snap) => {
  globalRatings = snap.val() || {};

  if (window.currentItemRatingId && window.currentItemType) {
    window.loadItemRating(window.currentItemRatingId, window.currentItemType);
  }
});

setTimeout(() => {
  if (window.openModInfo) {
    const origModInfo = window.openModInfo;
    window.openModInfo = (id) => {
      window.currentItemRatingId = id;
      window.currentItemType = 'mod';
      origModInfo(id);
      window.loadItemRating(id, 'mod');
    };
  }
  if (window.openApkInfo) {
    const origApkInfo = window.openApkInfo;
    window.openApkInfo = (id) => {
      window.currentItemRatingId = id;
      window.currentItemType = 'apk';
      origApkInfo(id);
      window.loadItemRating(id, 'apk');
    };
  }
  if (window.openScriptInfo) {
    const origScriptInfo = window.openScriptInfo;
    window.openScriptInfo = (id) => {
      window.currentItemRatingId = id;
      window.currentItemType = 'script';
      origScriptInfo(id);
      window.loadItemRating(id, 'script');
    };
  }

  window.updateAppTheme = updateAppTheme;

  // ==========================================
  // ⭐ SISTEMA DE FAVORITOS (MI BIBLIOTECA)
  // ==========================================
  
  // Inyectar botón de favoritos en todas las tarjetas de mods/apks automáticamente
  document.querySelectorAll('.apk-card').forEach(card => {
    const chatBtn = card.querySelector('.btn-chat');
    if (chatBtn) {
       const match = chatBtn.getAttribute('onclick') && chatBtn.getAttribute('onclick').match(/'([^']+)'/);
       if (match) {
          const modId = match[1];
          const favBtn = document.createElement('button');
          favBtn.className = 'btn btn-fav';
          
          const favs = JSON.parse(localStorage.getItem('fnf_favorites') || '{}');
          const isFav = favs[modId];
          
          favBtn.innerHTML = isFav ? '❤️' : '🤍';
          favBtn.style.cssText = `display:flex; align-items:center; justify-content:center; padding: 10px; font-size: 16px; margin-left: 5px; background: ${isFav ? 'rgba(255, 0, 100, 0.2)' : 'rgba(255,255,255,0.1)'}; border: 1px solid ${isFav ? '#ff0064' : 'rgba(255,255,255,0.2)'};`;
          
          favBtn.onclick = (e) => {
            e.stopPropagation();
            window.toggleFavorite(modId, favBtn, card);
          };
          
          chatBtn.parentNode.appendChild(favBtn);
       }
    }
  });

  window.toggleFavorite = (modId, btn, card) => {
    let favs = JSON.parse(localStorage.getItem('fnf_favorites') || '{}');
    if (favs[modId]) {
      delete favs[modId];
      btn.innerHTML = '🤍';
      btn.style.background = 'rgba(255,255,255,0.1)';
      btn.style.borderColor = 'rgba(255,255,255,0.2)';
    } else {
      // Guardar nombre y thumb para la lista
      const title = card.querySelector('h3') ? card.querySelector('h3').innerText : 'Mod FNF';
      const img = card.querySelector('img') ? card.querySelector('img').src : '';
      favs[modId] = { title, img, timestamp: Date.now() };
      btn.innerHTML = '❤️';
      btn.style.background = 'rgba(255, 0, 100, 0.2)';
      btn.style.borderColor = '#ff0064';
    }
    localStorage.setItem('fnf_favorites', JSON.stringify(favs));
  };

  window.abrirFavoritos = () => {
    document.getElementById('favorites-popup').classList.add('show');
    const container = document.getElementById('favorites-list');
    const favs = JSON.parse(localStorage.getItem('fnf_favorites') || '{}');
    
    container.innerHTML = '';
    const keys = Object.keys(favs);
    
    if (keys.length === 0) {
      container.innerHTML = '<p style="color:#aaa; font-size:13px;">No has guardado ningún mod aún. ¡Toca el 🤍 en tus mods favoritos!</p>';
      return;
    }
    
    keys.sort((a,b) => favs[b].timestamp - favs[a].timestamp).forEach(id => {
      const data = favs[id];
      const div = document.createElement('div');
      div.style.cssText = 'display:flex; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; gap:10px; text-align:left; border: 1px solid rgba(255,255,255,0.1);';
      div.innerHTML = `
        <img src="${data.img}" style="width:50px; height:50px; object-fit:cover; border-radius:8px;">
        <div style="flex: 1;">
          <h4 style="margin:0; color:white; font-size:14px;">${data.title}</h4>
        </div>
        <button onclick="openModComments('${id}', '${data.title.replace(/'/g, "\\'")}')" style="background:var(--neon-blue); color:black; padding:8px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">💬</button>
      `;
      container.appendChild(div);
    });
  };

  // ==========================================
  // 📝 SISTEMA DE SOLICITUDES DE PORTS
  // ==========================================
  
  let modRequestsListener = null;

  window.loadModRequests = () => {
    const reqRef = ref(db, 'mod_requests');
    if (!modRequestsListener) {
      modRequestsListener = onValue(reqRef, (snapshot) => {
        const container = document.getElementById('requests-list');
        container.innerHTML = '';
        const data = snapshot.val();
        
        if (!data) {
          container.innerHTML = '<p style="color:#aaa; font-size:13px; text-align:center;">No hay solicitudes aún. ¡Sé el primero!</p>';
          return;
        }

        const requests = Object.keys(data).map(k => ({id: k, ...data[k]}));
        // Sort by votes, then by date
        requests.sort((a,b) => (b.votes || 0) - (a.votes || 0));

        requests.forEach(req => {
          const statusColors = {
            'Pendiente': '#ffaa00',
            'Aprobado': '#8888ff',
            'En Progreso': '#00eaff',
            'Completado': '#00ff88'
          };
          const badgeColor = statusColors[req.status || 'Pendiente'] || '#ffaa00';
          
          let adminBtns = '';
          if (isSuperUser) {
            adminBtns = `
              <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #444; display:flex; gap:5px; flex-wrap:wrap;">
                <button onclick="updateRequestStatus('${req.id}', 'Aprobado')" style="flex:1; background:#8888ff; color:white; border:none; border-radius:4px; font-size:10px; cursor:pointer; padding:5px;">Aprobar</button>
                <button onclick="updateRequestStatus('${req.id}', 'En Progreso')" style="flex:1; background:#00eaff; color:black; border:none; border-radius:4px; font-size:10px; cursor:pointer; padding:5px;">En Progreso</button>
                <button onclick="updateRequestStatus('${req.id}', 'Completado')" style="flex:1; background:#00ff88; color:black; border:none; border-radius:4px; font-size:10px; cursor:pointer; padding:5px;">Completado</button>
                <button onclick="deleteRequest('${req.id}')" style="background:#ff003c; color:white; border:none; border-radius:4px; font-size:10px; cursor:pointer; padding:5px;">✖</button>
              </div>
            `;
          }

          const myVoted = JSON.parse(localStorage.getItem('fnf_voted_requests') || '{}');
          const isVoted = myVoted[req.id];

          const div = document.createElement('div');
          div.style.cssText = 'background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); text-align:left;';
          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div style="flex:1; padding-right:10px;">
                <span style="font-size:10px; color:${badgeColor}; border:1px solid ${badgeColor}; padding:2px 5px; border-radius:10px; text-transform:uppercase; font-weight:bold;">${req.status || 'Pendiente'}</span>
                <h4 style="margin:5px 0; color:white; font-size:15px;">${req.modName}</h4>
                ${req.link ? `<a href="${req.link}" target="_blank" style="color:var(--neon-pink); font-size:11px; text-decoration:underline;">Ver Link Original</a>` : ''}
                <p style="color:#888; font-size:10px; margin-top:5px;">Pedido por: ${req.user || 'Anónimo'}</p>
              </div>
              <div style="text-align:center;">
                <button onclick="voteRequest('${req.id}')" class="btn" style="background:${isVoted ? 'var(--neon-green)' : '#333'}; color:${isVoted ? 'black' : 'white'}; border:none; border-radius:8px; width:45px; height:40px; font-weight:bold; cursor:pointer; font-size:14px; box-shadow: 0 4px 0 ${isVoted ? '#00cc00' : '#111'}; transform:${isVoted ? 'translateY(2px)' : 'none'}; transition:all 0.1s;">
                  ▲
                </button>
                <div style="color:var(--neon-green); font-weight:bold; font-size:16px; margin-top:8px;">${req.votes || 0}</div>
              </div>
            </div>
            ${adminBtns}
          `;
          container.appendChild(div);
        });
      });
    }
  };

  window.enviarSolicitudMod = async () => {
    if (exigirRegistro()) return;
    if (!usuarioActualFirebase) return alert("Por seguridad, debes iniciar sesión con Google para pedir mods.");
    
    const name = document.getElementById('req-mod-name').value.trim();
    const link = document.getElementById('req-mod-link').value.trim();
    const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));

    if (!name) return alert("Escribe el nombre del mod que quieres pedir.");

    // LÍMITE DE 10 DÍAS
    const userRef = ref(db, 'usuarios/' + usuarioActualFirebase.uid);
    const userSnap = await get(userRef);
    const userData = userSnap.val() || {};
    const lastReqTime = userData.ultimaSolicitudPort || 0;
    const daysPassed = (Date.now() - lastReqTime) / (1000 * 60 * 60 * 24);
    
    if (daysPassed < 10) {
      const daysLeft = Math.ceil(10 - daysPassed);
      return alert(`⏳ Solo puedes pedir un mod cada 10 días. Te faltan ${daysLeft} días para tu próxima solicitud.`);
    }

    // LÍMITE DE 5 ACTIVAS
    const reqRef = ref(db, 'mod_requests');
    const reqSnap = await get(reqRef);
    const reqData = reqSnap.val() || {};
    
    let activeCount = 0;
    Object.values(reqData).forEach(req => {
      if (req.status !== 'Completado') activeCount++;
    });
    
    if (activeCount >= 5) {
      return alert("🛑 La lista de peticiones está llena actualmente (Máximo 5 activas). Por favor espera a que el Administrador termine los puertos pendientes.");
    }

    push(ref(db, 'mod_requests'), {
      modName: name,
      link: link || '',
      user: profile.nombre || "Usuario",
      ownerKey: profile.key,
      votes: 1,
      status: 'Pendiente',
      timestamp: Date.now()
    }).then(async snap => {
      // Guardar fecha de solicitud
      await update(ref(db, 'usuarios/' + usuarioActualFirebase.uid), { ultimaSolicitudPort: Date.now() });

      // Auto vote for your own request
      let voted = JSON.parse(localStorage.getItem('fnf_voted_requests') || '{}');
      voted[snap.key] = true;
      localStorage.setItem('fnf_voted_requests', JSON.stringify(voted));
      
      document.getElementById('req-mod-name').value = '';
      document.getElementById('req-mod-link').value = '';
      alert("¡Solicitud enviada! Ahora los demás pueden votar por ella.");
    });
  };

  window.voteRequest = (id) => {
    if (exigirRegistro()) return;
    let voted = JSON.parse(localStorage.getItem('fnf_voted_requests') || '{}');
    if (voted[id]) {
      // Unvote
      delete voted[id];
      runTransaction(ref(db, `mod_requests/${id}/votes`), (v) => (v || 1) - 1);
    } else {
      // Vote
      voted[id] = true;
      runTransaction(ref(db, `mod_requests/${id}/votes`), (v) => (v || 0) + 1);
    }
    localStorage.setItem('fnf_voted_requests', JSON.stringify(voted));
  };

  window.updateRequestStatus = (id, status) => {
    if (!isSuperUser) return;
    update(ref(db, `mod_requests/${id}`), { status });
  };

  window.deleteRequest = (id) => {
    if (!isSuperUser) return;
    if(confirm("¿Eliminar esta solicitud?")) remove(ref(db, `mod_requests/${id}`));
  };

}, 1500);

window.rateAppItem = async (type, stars) => {
  if (!window.currentItemRatingId) return;
  const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));

  if (!profile) {
    alert(currentLang === 'es' ? "Debes registrarte o configurar tu perfil para calificar." : "You must register or set your profile to rate.");
    return;
  }

  const myRates = JSON.parse(localStorage.getItem('my_ratings') || '{}');

  if (myRates[window.currentItemRatingId]) {
    alert(currentLang === 'es' ? "Ya calificaste esto. ¡Gracias!" : "You already rated this. Thanks!");
    return;
  }

  myRates[window.currentItemRatingId] = stars;
  localStorage.setItem('my_ratings', JSON.stringify(myRates));

  await set(ref(db, `ratings/${window.currentItemRatingId}/${profile.key}`), stars);

  window.updateStarsUI(type, stars);
  const txt = document.getElementById(`${type}-rating-text`);
  if (txt) txt.innerText = currentLang === 'es' ? "¡Gracias por calificar!" : "Thanks for rating!";
};

window.loadItemRating = (id, type) => {
  const container = document.getElementById(`rating-container-${type}`);
  if (!container) return;

  const txt = document.getElementById(`${type}-rating-text`);
  const myRates = JSON.parse(localStorage.getItem('my_ratings') || '{}');

  const modRatings = globalRatings[id] || {};
  const votosArray = Object.values(modRatings);
  const totalVotos = votosArray.length;
  let promedio = 0;

  if (totalVotos > 0) {
    const suma = votosArray.reduce((acc, val) => acc + val, 0);
    promedio = (suma / totalVotos).toFixed(1);
  }

  const spans = container.querySelectorAll('span');

  if (myRates[id]) {
    window.updateStarsUI(type, myRates[id]);
    if (txt) {
      const baseText = currentLang === 'es' ? "Tu calificación" : "Your rating";
      txt.innerText = totalVotos > 0 ? `${baseText} • Promedio: ${promedio} ⭐ (${totalVotos})` : baseText;
    }
  } else {
    spans.forEach(s => { s.style.color = '#555'; s.style.textShadow = 'none'; });
    if (txt) {
      const baseText = currentLang === 'es' ? "Califica este contenido" : "Rate this content";
      txt.innerText = totalVotos > 0 ? `Promedio: ${promedio} ⭐ (${totalVotos}) • ${baseText}` : baseText;
    }
  }
};

window.updateStarsUI = (type, stars) => {
  const container = document.getElementById(`rating-container-${type}`);
  if (!container) return;
  const spans = container.querySelectorAll('span');
  spans.forEach((s, index) => {
    if (index < stars) {
      s.style.color = 'gold';
      s.style.textShadow = '0 0 10px gold';
    } else {
      s.style.color = '#555';
      s.style.textShadow = 'none';
    }
  });
};

// ==========================================


const savedColor = localStorage.getItem('customThemeColor') || '#00eaff';
document.documentElement.style.setProperty('--neon-blue', savedColor);

const savedPillInset = localStorage.getItem('pillInset') || '5';
document.documentElement.style.setProperty('--pill-inset', savedPillInset + 'px');

const savedBlur = localStorage.getItem('glassBlur') || '15';
document.documentElement.style.setProperty('--glass-blur', savedBlur + 'px');

if (localStorage.getItem('lowEndMode') === 'true') document.body.classList.add('low-end-mode');

const applyCustomFont = (base64Font) => {
  const newStyle = document.createElement('style');
  newStyle.appendChild(document.createTextNode(`@font-face { font-family: 'CustomUserFont'; src: url('${base64Font}') format('truetype'); } body, h1, h2, h3, p, span, div, button, input, textarea, a { font-family: 'CustomUserFont', sans-serif !important; }`));
  document.head.appendChild(newStyle);
};
const savedFont = localStorage.getItem('customUserFont');
if (savedFont) applyCustomFont(savedFont);

let chromaInterval;
const toggleChroma = (enable) => {
  if (enable) {
    let hue = 0;
    clearInterval(chromaInterval);
    chromaInterval = setInterval(() => {
      hue = (hue + 2) % 360;
      document.documentElement.style.setProperty('--neon-blue', `hsl(${hue}, 100%, 50%)`);
    }, 50);
  } else {
    clearInterval(chromaInterval);
    document.documentElement.style.setProperty('--neon-blue', localStorage.getItem('customThemeColor') || '#00eaff');
  }
};

let particleInterval;
const toggleParticles = (enable) => {
  const container = document.getElementById('particles-container');
  if (!container) return;
  if (enable) {
    container.style.display = 'block';
    particleInterval = setInterval(() => {
      const p = document.createElement('div');
      p.className = 'fnf-particle';
      p.innerText = Math.random() > 0.5 ? '🎵' : '✦';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.fontSize = (Math.random() * 15 + 10) + 'px';
      p.style.animationDuration = (Math.random() * 4 + 4) + 's';
      container.appendChild(p);
      setTimeout(() => p.remove(), 8000);
    }, 400);
  } else {
    clearInterval(particleInterval);
    container.style.display = 'none';
    container.innerHTML = '';
  }
};

const savedTheme = localStorage.getItem('activeTheme') || 'default';
const themeLink = document.getElementById('theme-stylesheet');

if (savedTheme === 'pro') {
  themeLink.href = 'css/style2.css';
}

window.toggleProMenu = () => {
  document.body.classList.toggle('pro-menu-open');
  window.triggerVibrate(15);
};

document.addEventListener('DOMContentLoaded', () => {
  window.currentLang = localStorage.getItem('fnf_lang') || 'es';

  window.triggerVibrate = (ms = 15) => { if (localStorage.getItem('hapticMode') === 'true' && navigator.vibrate) navigator.vibrate(ms); };
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .nav-item, .settings-btn, .lang-btn, .profile-btn, .filter-btn, .admin-led-btn, .admin-pin-btn')) window.triggerVibrate(15);
  });

  window.toggleLanguage = () => {
    window.currentLang = window.currentLang === 'es' ? 'en' : 'es';
    localStorage.setItem('fnf_lang', window.currentLang);
    applyLanguage();
  };
  function applyLanguage() {
    document.querySelectorAll('[data-es][data-en]').forEach(el => {
      el.classList.add('lang-fade');
      setTimeout(() => { el.innerHTML = el.getAttribute(`data-${window.currentLang}`); el.classList.remove('lang-fade'); }, 150);
    });
    const btn = document.getElementById('langBtn');
    if (btn) btn.innerHTML = window.currentLang === 'es' ? '🇬🇧 EN' : '🇪🇸 ES';
  }
  applyLanguage();

  setTimeout(() => {
    const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
    if (profile) {
      if (document.getElementById('editProfileName') && profile.name) document.getElementById('editProfileName').value = profile.name;
      if (document.getElementById('editProfileAvatar') && profile.avatar) {
        document.getElementById('editProfileAvatar').value = profile.avatar;
        document.getElementById('profile-avatar-preview').src = profile.avatar;
      }
    }
  }, 500);

  const avInput = document.getElementById('editProfileAvatar');
  if (avInput) avInput.addEventListener('input', (e) => { document.getElementById('profile-avatar-preview').src = e.target.value.trim() || "https://via.placeholder.com/80/555/fff?text=?"; });

  window.saveProfileChanges = () => {
    let profile = JSON.parse(localStorage.getItem('fnf_user_profile')) || { key: 'user_' + Math.random().toString(36).substr(2, 9), link: '#' };
    const name = document.getElementById('editProfileName').value.trim();
    if (name.length < 3) return alert(window.currentLang === 'es' ? "Nombre muy corto." : "Name too short.");
    profile.name = name; profile.avatar = document.getElementById('editProfileAvatar').value.trim();
    localStorage.setItem('fnf_user_profile', JSON.stringify(profile));
    document.getElementById('profile-popup').classList.remove('show');
    alert(window.currentLang === 'es' ? "¡Perfil actualizado!" : "Profile updated!");
  };

  const colorInput = document.getElementById('themeColor');
  if (colorInput) {
    colorInput.value = savedColor;
    colorInput.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--neon-blue', e.target.value);
      localStorage.setItem('customThemeColor', e.target.value);
      if (document.getElementById('chromaToggle').checked) {
        document.getElementById('chromaToggle').checked = false;
        toggleChroma(false);
        localStorage.setItem('chromaMode', 'false');
      }
    });
  }

  const chromaToggle = document.getElementById('chromaToggle');
  if (chromaToggle) {
    chromaToggle.checked = localStorage.getItem('chromaMode') === 'true';
    if (chromaToggle.checked) toggleChroma(true);
    chromaToggle.addEventListener('change', (e) => {
      localStorage.setItem('chromaMode', e.target.checked);
      toggleChroma(e.target.checked);
    });
  }

  const particlesToggle = document.getElementById('particlesToggle');
  if (particlesToggle) {
    particlesToggle.checked = localStorage.getItem('particlesMode') === 'true';
    if (particlesToggle.checked && localStorage.getItem('lowEndMode') !== 'true') toggleParticles(true);
    particlesToggle.addEventListener('change', (e) => {
      localStorage.setItem('particlesMode', e.target.checked);
      toggleParticles(e.target.checked);
    });
  }

  const blurSlider = document.getElementById('blurSlider');
  if (blurSlider) {
    blurSlider.value = savedBlur;
    blurSlider.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--glass-blur', e.target.value + 'px');
      localStorage.setItem('glassBlur', e.target.value);
    });
  }

  const lowEndToggle = document.getElementById('lowEndToggle');
  if (lowEndToggle) {
    lowEndToggle.checked = localStorage.getItem('lowEndMode') === 'true';
    lowEndToggle.addEventListener('change', (e) => {
      localStorage.setItem('lowEndMode', e.target.checked);
      if (e.target.checked) {
        document.body.classList.add('low-end-mode');
        toggleParticles(false); // Fuerza apagar partículas
      } else {
        document.body.classList.remove('low-end-mode');
        if (document.getElementById('particlesToggle').checked) toggleParticles(true);
      }
      window.triggerVibrate(30);
    });
  }

  const hapticToggle = document.getElementById('hapticToggle');
  if (hapticToggle) {
    hapticToggle.checked = localStorage.getItem('hapticMode') === 'true';
    hapticToggle.addEventListener('change', (e) => {
      localStorage.setItem('hapticMode', e.target.checked);
      if (e.target.checked) navigator.vibrate(50);
    });
  }

  const pillSlider = document.getElementById('pillSizeSlider');
  if (pillSlider) {
    pillSlider.value = savedPillInset;
    pillSlider.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--pill-inset', e.target.value + 'px');
      localStorage.setItem('pillInset', e.target.value);
    });
  }

  const fontInput = document.getElementById('customFontUpload');
  if (fontInput) {
    fontInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.name.toLowerCase().endsWith('.ttf')) {
        const reader = new FileReader();
        reader.onload = function (evt) {
          try { localStorage.setItem('customUserFont', evt.target.result); applyCustomFont(evt.target.result); }
          catch (err) { applyCustomFont(evt.target.result); alert("Archivo muy pesado para guardarse permanente, pero se aplicará ahora."); }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  window.resetSettings = () => {
    if (confirm("¿Restablecer diseño predeterminado?")) {
      localStorage.clear();
      location.reload();
    }
  };

  const isTrueIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const forceIOS = localStorage.getItem('force_ios_ui') === 'true';
  const isIOS = isTrueIOS || forceIOS;

  window.toggleForceIOS = () => {
    const current = localStorage.getItem('force_ios_ui') === 'true';
    localStorage.setItem('force_ios_ui', !current);
    location.reload();
  };

  const initAdminBtn = setInterval(() => {
    const btn = document.getElementById('btnForceIOS');
    if (btn) { btn.innerHTML = forceIOS ? 'Quitar Interfaz iOS' : 'Forzar Interfaz iOS'; clearInterval(initAdminBtn); }
  }, 500);

  setTimeout(() => {
    const nav = document.querySelector('.bottom-nav');
    const pill = document.getElementById('ios-pill');
    const navItems = document.querySelectorAll('.nav-item');

    if (isIOS && nav && pill) {
      nav.classList.add('is-ios');
      if (navItems[0]) pill.style.width = `${navItems[0].offsetWidth}px`;

      const snapPill = (index) => {
        pill.classList.remove('is-dragging');
        const target = navItems[index];
        if (target) {
          pill.style.width = `${target.offsetWidth}px`;
          pill.style.transform = `translateX(${target.offsetLeft}px) scale(1)`;
          window.triggerVibrate(25);
        }
      };

      const originalSelectSection = window.selectSection;
      window.selectSection = (sec, el) => {
        if (originalSelectSection) originalSelectSection(sec, el);
        const index = Array.from(navItems).indexOf(el);
        if (index !== -1) snapPill(index);
      };

      let isDraggingPill = false;

      const moveDrag = (e) => {
        if (!e.touches && !isDraggingPill) return;
        if (e.touches) e.preventDefault();
        isDraggingPill = true;
        pill.classList.add('is-dragging');

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const navRect = nav.getBoundingClientRect();
        let xPos = Math.max(0, Math.min(clientX - navRect.left, navRect.width));

        const itemWidth = navRect.width / navItems.length;
        let visualX = Math.max(0, Math.min(xPos - (itemWidth / 2), navRect.width - itemWidth));
        pill.style.transform = `translateX(${visualX}px) scaleX(1.15) scaleY(0.85)`;

        const hoveredIndex = Math.floor(xPos / itemWidth);
        const targetItem = navItems[hoveredIndex];

        if (targetItem && !targetItem.classList.contains('active')) {
          const sectionId = targetItem.getAttribute('onclick').match(/'([^']+)'/)[1];
          document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
          document.getElementById(sectionId).classList.add('active');
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          targetItem.classList.add('active');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          window.triggerVibrate(15);
        }
      };

      const endDrag = () => {
        if (isDraggingPill) {
          isDraggingPill = false;
          const activeItem = document.querySelector('.nav-item.active');
          const index = Array.from(navItems).indexOf(activeItem);
          if (index !== -1) snapPill(index);
        }
      };

      nav.addEventListener('touchmove', moveDrag, { passive: false });
      nav.addEventListener('touchend', endDrag);
      nav.addEventListener('mousedown', () => isDraggingPill = true);
      nav.addEventListener('mousemove', moveDrag);
      nav.addEventListener('mouseup', endDrag);
      nav.addEventListener('mouseleave', endDrag);

      window.addEventListener('resize', () => {
        const activeItem = document.querySelector('.nav-item.active');
        const index = Array.from(navItems).indexOf(activeItem);
        if (index !== -1) snapPill(index);
      });
    }
  }, 1000);
});

let newModsData = {};

onValue(ref(db, 'new_mods_status'), (snap) => {
  newModsData = snap.val() || {};

  document.querySelectorAll('.mod-card').forEach(card => {
    card.classList.remove('is-new-mod');
  });

  Object.keys(newModsData).forEach(cardId => {
    if (newModsData[cardId] === true) {
      const cardElement = document.getElementById(cardId);
      if (cardElement) {
        cardElement.classList.add('is-new-mod');
      }
    }
  });
});

window.toggleNewMod = async (cardId) => {
  if (!isSuperUser) {
    alert("No tienes permisos de administrador.");
    return;
  }

  const isCurrentlyNew = newModsData[cardId] === true;

  if (confirm(isCurrentlyNew ? "¿Quitar la etiqueta de NUEVO a este mod?" : "¿Marcar este mod como NUEVO?")) {

    await set(ref(db, `new_mods_status/${cardId}`), isCurrentlyNew ? null : true);

  }
};

// ==========================================

window.brokenLinksData = {};

onValue(ref(db, 'broken_links'), (snap) => {
  window.brokenLinksData = snap.val() || {};

  document.querySelectorAll('.mod-card').forEach(card => {
    const exactModId = card.id.replace('card-', '');
    if (window.brokenLinksData[exactModId]) {
      card.classList.add('is-broken-mod');
    } else {
      card.classList.remove('is-broken-mod');
    }
  });
});

window.reportError = async (modId) => {
  const user = JSON.parse(localStorage.getItem('fnf_user_profile'));

  if (!user) {
    document.getElementById('register-popup').classList.add('show');
    return;
  }

  if (confirm('🚨 ¿ESTÁS SEGURO? Esto apagará la descarga para todos y alertará al administrador.')) {

    await set(ref(db, `broken_links/${modId}`), {
      reportedBy: user.name,
      timestamp: Date.now()
    });

    alert('🛑 ¡MOD BLOQUEADO! El Administrador ha sido notificado.');

    let modName = "Nombre Desconocido";
    const modTitleElement = document.querySelector('#card-' + modId + ' h3');
    if (modTitleElement) {
      modName = modTitleElement.textContent.trim();
    }

    const botToken = "7599981153:AAH6tPHek2C02UeVHc-lACFtfVK_XleB6VI";
    const chatId = "5429172831";

    const mensaje = `🚨 *ALERTA DE LINK CAÍDO* 🚨\n\nEl usuario *${user.name}* reportó el problema de un enlace caido:\n\n📦 Mod: *${modName}*\n🆔 ID: \`${modId}\`\n\n🛑El Mod a sido puesto en cuarentena automáticamente.\n\n🛠️ ¡Entra a repararlo!`;

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensaje, parse_mode: "Markdown" })
    }).catch(error => console.error("Error Telegram:", error));
  }
};

window.fixBrokenLink = async (modId) => {
  if (!isSuperUser) return;
  if (confirm('🛠️ ¿Ya solucionaste el link de este mod?')) {
    await set(ref(db, `broken_links/${modId}`), null);
  }
};

// ==========================================

onValue(ref(db, 'ratings'), (snap) => {
  const ratingsData = snap.val() || {};
  const userProfile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  const miLlave = userProfile ? userProfile.key : null;

  document.querySelectorAll('.mod-card').forEach(card => {
    const exactModId = card.id.replace('card-', '');
    const modRatings = ratingsData[exactModId] || {};

    const votosArray = Object.values(modRatings);
    const totalVotos = votosArray.length;
    let promedio = 0;

    if (totalVotos > 0) {
      const suma = votosArray.reduce((acc, val) => acc + val, 0);
      promedio = (suma / totalVotos).toFixed(1);
    }

    const textoPromedio = document.getElementById(`rating-text-${exactModId}`);
    if (textoPromedio) {
      textoPromedio.innerText = `${promedio} ⭐ (${totalVotos})`;
    }

    const starsContainer = document.getElementById(`stars-${exactModId}`);
    if (starsContainer) {
      const miVotoAnterior = miLlave ? modRatings[miLlave] : 0;
      const spans = starsContainer.querySelectorAll('span');

      spans.forEach(span => {
        const valorEstrella = parseInt(span.getAttribute('data-val'));
        if (miVotoAnterior >= valorEstrella) {
          span.innerText = '★';
          span.style.color = '#ffd700';
          span.style.textShadow = '0 0 8px #ffd700';
        } else {
          span.innerText = '☆';
          span.style.color = '#555';
          span.style.textShadow = 'none';
        }
      });
    }
  });
});

window.rateMod = async (modId, calificacion) => {
  const user = JSON.parse(localStorage.getItem('fnf_user_profile'));

  if (!user) {
    document.getElementById('register-popup').classList.add('show');
    return;
  }

  await set(ref(db, `ratings/${modId}/${user.key}`), calificacion);

  if (window.triggerVibrate) window.triggerVibrate(15);
};

// ==========================================

window.toggleFaq = function (button) {
  button.classList.toggle('active');

  const content = button.nextElementSibling;

  if (content.classList.contains('open')) {
    content.classList.remove('open');
  } else {
    content.classList.add('open');
  }

  if (window.triggerVibrate) window.triggerVibrate(10);
};

// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const modToUnlock = urlParams.get('unlock');

  if (modToUnlock) {
    let misSecretos = JSON.parse(localStorage.getItem('unlocked_mods') || '[]');
    if (!misSecretos.includes(modToUnlock)) {
      misSecretos.push(modToUnlock);
      localStorage.setItem('unlocked_mods', JSON.stringify(misSecretos));

      setTimeout(() => {
        document.getElementById('secret-unlocked-popup').classList.add('show');
        if (window.triggerVibrate) window.triggerVibrate([30, 50, 30]);
      }, 1000);
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const misSecretosGuardados = JSON.parse(localStorage.getItem('unlocked_mods') || '[]');

  const esAdmin = localStorage.getItem('superUser') === 'true';

  document.querySelectorAll('.secret-mod').forEach(card => {

    const exactId = card.id.replace('card-', '');

    if (misSecretosGuardados.includes(exactId) || esAdmin) {
      card.classList.remove('hidden');
    }
  });
});

// ==========================================

let linkParaCompartir = "";
let textoParaCompartir = "";

window.abrirMenuCompartir = (id, nombreMod) => {
  if (exigirRegistro()) return;
  const baseUrl = window.location.origin + window.location.pathname;
  linkParaCompartir = `${baseUrl}?share=${id}`;
  textoParaCompartir = `¡Mira esto: *${nombreMod}*! Descárgalo aquí:\n`;

  document.getElementById('share-modal').classList.add('show');
};

window.enviarWhatsApp = () => {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textoParaCompartir + linkParaCompartir)}`;
  window.open(url, '_blank');
};

window.enviarTelegram = () => {
  const url = `https://t.me/share/url?url=${encodeURIComponent(linkParaCompartir)}&text=${encodeURIComponent(textoParaCompartir)}`;
  window.open(url, '_blank');
};

window.copiarEnlace = () => {
  navigator.clipboard.writeText(textoParaCompartir + linkParaCompartir).then(() => {
    const msg = document.getElementById('mensaje-copiado');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 3000);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idCompartido = urlParams.get('share');

  if (idCompartido) {


    setTimeout(() => {

      if (idCompartido.includes('mod') && window.openModInfo) {
        window.openModInfo(idCompartido);
      } else if (idCompartido.includes('apk') && window.openApkInfo) {
        window.openApkInfo(idCompartido);
      } else if (idCompartido.includes('script') && window.openScriptInfo) {
        window.openScriptInfo(idCompartido);
      }

      const contenidoPopup = document.querySelector('#mod-info-popup .popup-content') || document.querySelector('.popup.show .popup-content');

      if (contenidoPopup) {
        contenidoPopup.classList.add('brillo-epico');

        setTimeout(() => {
          contenidoPopup.classList.remove('brillo-epico');
        }, 6000);
      }

      window.history.replaceState({}, document.title, window.location.pathname);

    }, 1000);
  }
});

// ==========================================
// 🚀 OPTIMIZACIÓN GLOBAL (CORREGIDA)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const todasLasImagenes = document.querySelectorAll('img');

  todasLasImagenes.forEach(img => {
    // Filtramos para que solo aplique a los catálogos
    if (img.src.includes('assets/images/mods') || img.src.includes('webp')) {

      // 1. Aseguramos que no se descarguen de golpe al abrir la página
      img.setAttribute('loading', 'lazy');

      const contenedor = img.parentElement;
      if (contenedor) {
        contenedor.style.position = 'relative';

        // Evitamos crear rueditas duplicadas si el código se ejecuta dos veces
        let ruedita = contenedor.querySelector('.ruedita-cargando');
        if (!ruedita) {
          ruedita = document.createElement('div');
          ruedita.className = 'ruedita-cargando';
          contenedor.insertBefore(ruedita, img);
        }

        // Función maestra para quitar la ruedita
        const finalizarCarga = () => {
          if (ruedita) ruedita.style.display = 'none';
          img.classList.add('img-lazy-cargada');
        };

        // 2. EL TRUCO MÁGICO: ¿La imagen ya cargó desde la raíz/caché?
        if (img.complete && img.naturalHeight !== 0) {
          // Si ya está cargada, quitamos la ruedita inmediatamente
          finalizarCarga();
        } else {
          // 3. Si depende del internet, esperamos a que cargue
          img.onload = finalizarCarga;

          // Por si alguna imagen se cae o da error de link, que no se quede la ruedita infinita
          img.onerror = () => {
            if (ruedita) ruedita.style.display = 'none';
          };
        }
      }
    }
  });
});

// ==========================================
//  MODO OFFLINE (SERVICE WORKER)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registro => {
        console.log('¡Modo Offline activado! Alcance:', registro.scope);
      })
      .catch(error => {
        console.log('Falló el Service Worker:', error);
      });
  });
}

// ==========================================
// OPTIMIZACIÓN EXTREMA DE SCROLL (PASSIVE LISTENERS)
// ==========================================
document.addEventListener('touchstart', function () { }, { passive: true });
document.addEventListener('touchmove', function () { }, { passive: true });
document.addEventListener('wheel', function () { }, { passive: true });

// ==========================================
// 🚀 CONEXIÓN DIRECTA CON BOT DE TELEGRAM (OPTIMIZADA)
// ==========================================
window.enviarMensajeAlBot = async function () {
  const cajaTexto = document.getElementById('txt-mensaje-telegram');
  const boton = document.getElementById('btn-enviar-telegram');
  const mensaje = cajaTexto.value.trim();

  // Validamos que no envíen mensajes vacíos
  if (mensaje === "") {
    alert("¡Escribe un mensaje primero!");
    return;
  }

  // 1. OBTENER EL NOMBRE DEL USUARIO (Mejorado)
  let nombreUsuario = "👤 Usuario Invitado";
  try {
    const perfil = JSON.parse(localStorage.getItem('fnf_user_profile'));
    // Hacemos que busque el nombre sin importar cómo lo hayas guardado en tu base
    if (perfil) {
      nombreUsuario = perfil.nombre || perfil.name || perfil.username || perfil.usuario || perfil.key || "👤 Usuario Registrado";
    }
  } catch (error) {
    console.log("No se encontró un perfil guardado.");
  }

  // 2. CONFIGURACIÓN DE TU BOT
  const TELEGRAM_BOT_TOKEN = "7599981153:AAH6tPHek2C02UeVHc-lACFtfVK_XleB6VI";
  const TELEGRAM_CHAT_ID = "5429172831";

  // 3. ARMAMOS EL MENSAJE CON FORMATO LIMPIO Y ESPACIADO (TICKET PREMIUM)
  const textoFormateado =
    `🚨 *NUEVO TICKET DE SOPORTE* 🚨

👤 *De:* ${nombreUsuario}
━━━━━━━━━━━━━━━━━━━
💬 *Mensaje:*
${mensaje}
━━━━━━━━━━━━━━━━━━━
🌐 _Enviado desde lalocf.2.gitgub/fnf-ports/_`;

  // 4. LO ENVIAMOS A TELEGRAM
  const urlApi = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  // Efecto visual de carga
  boton.innerText = "⏳ Enviando...";
  boton.style.background = "#ffea00";

  try {
    const respuesta = await fetch(urlApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: textoFormateado,
        parse_mode: 'Markdown'
      })
    });

    if (respuesta.ok) {
      // Éxito
      cajaTexto.value = "";
      boton.innerText = "¡Enviado con éxito! ✨";
      boton.style.background = "#00ff41";

      setTimeout(() => {
        boton.innerText = "🚀 Enviar Mensaje";
        boton.style.background = "var(--neon-blue)";
      }, 3000);
    } else {
      throw new Error("Error en la API");
    }

  } catch (error) {
    // Error
    boton.innerText = "❌ Error al enviar";
    boton.style.background = "#ff003c";
    setTimeout(() => {
      boton.innerText = "🚀 Intentar de nuevo";
      boton.style.background = "var(--neon-blue)";
    }, 3000);
  }
};

//===============================================//

// ==========================================
// 🚀 GENERADOR DINÁMICO DE ETIQUETAS (TAGS)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const modCards = document.querySelectorAll('.mod-card');

  modCards.forEach(card => {
    const oldTags = card.querySelector('.mod-tags-container');
    if (oldTags) oldTags.remove();

    const gama = card.getAttribute('data-gama') || 'low';

    // RAM
    let ramValue = card.getAttribute('data-ram');
    if (!ramValue) {
      ramValue = '2GB RAM';
      if (gama === 'mid') ramValue = '3GB RAM';
      if (gama === 'mid-high' || gama === 'high') ramValue = '4GB RAM';
    }

    // Motor
    let engineValue = card.getAttribute('data-engine');
    if (!engineValue) {
      engineValue = 'Psych Engine';
    } else {
      engineValue = engineValue.replace('⚙️', '').trim();
    }

    // Peso
    let sizeValue = card.getAttribute('data-size');
    if (!sizeValue) {
      const cardId = card.id || 'default';
      const hash = cardId.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
      const sizeMB = 150 + Math.abs(hash % 300);
      sizeValue = `${sizeMB} MB`;
    } else {
      sizeValue = sizeValue.replace('📦', '').trim();
    }

    const searchTags = `${engineValue} ${ramValue} ${sizeValue}`.toLowerCase();
    card.setAttribute('data-tags', searchTags);

    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'mod-tags-container';
    tagsContainer.style.cssText = 'display: flex; gap: 5px; justify-content: center; margin-bottom: 10px; flex-wrap: wrap;';

    const engineBadge = document.createElement('span');
    engineBadge.style.cssText = 'background: rgba(0, 234, 255, 0.1); color: var(--neon-blue); padding: 2px 6px; border-radius: 4px; font-size: 10px; border: 1px solid var(--neon-blue); display: inline-flex; align-items: center; gap: 3px;';
    engineBadge.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/8335/8335020.png" style="width: 12px; height: 12px; object-fit: contain; filter: invert(1);"> ${engineValue}`;

    const ramBadge = document.createElement('span');
    ramBadge.style.cssText = 'background: rgba(255, 0, 255, 0.1); color: var(--neon-pink); padding: 2px 6px; border-radius: 4px; font-size: 10px; border: 1px solid var(--neon-pink); display: inline-flex; align-items: center; gap: 3px;';
    ramBadge.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/10513/10513938.png" style="width: 12px; height: 12px; object-fit: contain; filter: invert(1);"> ${ramValue}`;

    const sizeBadge = document.createElement('span');
    sizeBadge.style.cssText = 'background: rgba(0, 255, 65, 0.1); color: #00ff41; padding: 2px 6px; border-radius: 4px; font-size: 10px; border: 1px solid #00ff41; display: inline-flex; align-items: center; gap: 3px;';
    sizeBadge.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/4007/4007698.png" style="width: 12px; height: 12px; object-fit: contain; filter: invert(1);"> ${sizeValue}`;

    tagsContainer.appendChild(engineBadge);
    tagsContainer.appendChild(ramBadge);
    tagsContainer.appendChild(sizeBadge);

    const cardButtons = card.querySelector('.card-buttons');
    if (cardButtons) {
      card.insertBefore(tagsContainer, cardButtons);
    }
  });
});
