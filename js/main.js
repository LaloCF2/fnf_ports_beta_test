import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, runTransaction, get, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const APP_VERSION = "v2.4.3";

let isSuperUser = localStorage.getItem('superUser') === 'true';
if(isSuperUser) { document.body.classList.add('is-admin'); }

let verifiedUsers = {};
let downloadCounts = {};

onValue(ref(db, 'downloads'), (snap) => {
  downloadCounts = snap.val() || {};
  Object.keys(downloadCounts).forEach(id => {
    const el = document.getElementById('dl-' + id);
    if(el) el.innerText = downloadCounts[id];
  });
});

onValue(ref(db, 'verified_users'), (snap) => {
  verifiedUsers = snap.val() || {};
});

window.trackDownload = (id) => {
  runTransaction(ref(db, `downloads/${id}`), (current) => (current || 0) + 1);
};

// --- SISTEMA DE REPORTES DE LINKS ---
window.reportError = async (id) => {
  const user = JSON.parse(localStorage.getItem('fnf_user_profile'));
  if (!user) {
    document.getElementById('register-popup').classList.add('show');
    return;
  }
  if (confirm('⚠️ ¿Estás seguro de reportar que esta descarga está caída o tiene un error grave?')) {
    await set(ref(db, `reports/${id}/${user.key}`), Date.now());
    alert('Reporte enviado a LaloCF. ¡Gracias por ayudar a la comunidad!');
  }
};

window.clearReports = async (id) => {
  if(confirm("🛠️ ¿Limpiar todos los reportes de este archivo?")) {
    await set(ref(db, `reports/${id}`), null);
    alert("Reportes solucionados y limpiados.");
  }
};

onValue(ref(db, 'reports'), (snap) => {
  const reports = snap.val() || {};
  document.querySelectorAll('.led-red').forEach(el => el.style.display = 'none');
  if(isSuperUser) {
    Object.keys(reports).forEach(id => {
      const el = document.getElementById(`led-red-${id}`);
      if (el) el.style.display = 'inline-block';
    });
  }
});
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
    if(!leds[id]) btn.innerText = '🟢 Act. LED';
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
  currentModCommentsId = id;
  document.getElementById("mc-title").innerText = "Comentarios: " + title;
  
  localStorage.setItem(`seen_comments_${id}`, Date.now());
  const yellowLed = document.getElementById(`led-yellow-${id}`);
  if(yellowLed) yellowLed.style.display = 'none';

  const user = JSON.parse(localStorage.getItem('fnf_user_profile'));
  if(!user) {
    document.getElementById('register-popup').classList.add('show');
    return;
  }
  
  const display = document.getElementById('mc-displayMyName');
  display.innerText = "Comentando como: " + user.name;
  if(user.name.toLowerCase() === 'lalocf') display.classList.add('admin-name');
  
  const avatar = document.getElementById('mc-myAvatar');
  if (user.avatar) {
    avatar.innerHTML = `<img src="${user.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    avatar.style.background = 'transparent';
  } else {
    avatar.innerHTML = user.name.charAt(0).toUpperCase();
    avatar.style.background = stringToColor(user.name);
  }

  document.getElementById("mod-comments-popup").classList.add("show");

  if(modCommentsListener) modCommentsListener(); 

  const commentsRef = ref(db, `mod_comments/${id}`);
  modCommentsListener = onValue(commentsRef, (snapshot) => {
    const list = document.getElementById('mc-commentList');
    list.innerHTML = '';
    const data = snapshot.val();
    const myProfile = JSON.parse(localStorage.getItem('fnf_user_profile'));

    if(data) {
      let commentsArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      
      commentsArray.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.id.localeCompare(a.id);
      });

      commentsArray.forEach(c => {
        const isLalo = c.user.toLowerCase() === 'lalocf';
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
          : c.user.charAt(0).toUpperCase();

        const div = document.createElement('div');
        div.className = `yt-comment-container ${pinClass}`;
        div.innerHTML = `
          <div class="yt-avatar" style="background:${c.avatar ? 'transparent' : stringToColor(c.user)}">${avatarContent}</div>
          <div class="yt-content">
            ${pinBadge}
            <div class="yt-header">
              <span class="yt-name ${isLalo ? 'admin-name' : ''}" onclick="openBanPanel('${c.ownerKey}', '${c.user}')">
                <a href="${c.link || '#'}" target="_blank" class="yt-name-link">${c.user}</a>${verifyBadge}
              </span>
              <span class="yt-date">${c.date}</span>
            </div>
            <div class="yt-text">${c.text}</div>
            <div class="yt-actions">
              <span class="yt-action-btn ${activeClass}" id="btn-mclike-${c.id}" onclick="likeModComment('${c.id}')">👍 <span id="mcl-count-${c.id}">${c.likes || 0}</span></span> 
              <span class="yt-action-btn" onclick="replyModComment('${c.user}')">Responder</span>
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
  if(modCommentsListener) {
    modCommentsListener();
    modCommentsListener = null;
  }
};

window.addModComment = async () => {
  if (await checkBanStatus()) return;
  const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  const text = document.getElementById('mc-commentText').value.trim();
  if(!profile) return checkUserStatus();
  if(!text) return alert("Escribe algo...");
  
  push(ref(db, `mod_comments/${currentModCommentsId}`), { 
    ownerKey: profile.key, 
    user: profile.name, 
    link: profile.link, 
    avatar: profile.avatar || "",
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
  const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  if(!profile) return checkUserStatus();
  const userKey = profile.key;
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

window.deleteModComment = (id) => confirm("¿Borrar comentario?") && remove(ref(db, `mod_comments/${currentModCommentsId}/${id}`));
window.togglePinModComment = (cId, currentState) => update(ref(db, `mod_comments/${currentModCommentsId}/${cId}`), { isPinned: !currentState });
window.replyModComment = (name) => { const txt = document.getElementById('mc-commentText'); txt.value = `@${name} `; txt.focus(); };

document.getElementById('mc-commentText').addEventListener('input', function() { document.getElementById('mc-charCounter').innerText = this.value.length; });

window.toggleVerify = (userKey) => { if(confirm("¿Dar insignia de verificado?")) { update(ref(db, `verified_users`), { [userKey]: true }); } };

onValue(ref(db, ".info/connected"), (snap) => {
  if (snap.val() === true) {
    document.getElementById("statusDot").classList.add("online");
    document.getElementById("statusText").innerText = "Servidor: Online";
    document.getElementById("statusText").style.color = "#00ff41";
  } else {
    document.getElementById("statusDot").classList.remove("online");
    document.getElementById("statusText").innerText = "Desconectado";
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

  if(el) {
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

window.filterContent = () => {
  const search = document.getElementById('globalSearch').value.toLowerCase();
  const items = document.querySelectorAll('.mod-card');
  const apks = document.querySelectorAll('.apk-card');
  
  items.forEach(item => {
    if(item.classList.contains('coming-soon-card')) return;
    const title = item.querySelector('h3').innerText.toLowerCase();
    const itemGama = item.getAttribute('data-gama') || 'mid';
    const matchesSearch = title.includes(search);
    const matchesFilter = currentFilter === 'all' || itemGama === currentFilter;
    item.style.display = (matchesSearch && matchesFilter) ? "block" : "none";
  });

  apks.forEach(apk => {
    const title = apk.querySelector('h3').innerText.toLowerCase();
    apk.style.display = title.includes(search) ? "block" : "none";
  });
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
  if(!user) { document.getElementById('register-popup').classList.add('show'); } 
  else { updateCommentInterface(user); syncLikeButtons(); }
}

function updateCommentInterface(user) {
  const display = document.getElementById('mc-displayMyName');
  if(display) {
    display.innerText = "Comentando como: " + user.name;
    if(user.name.toLowerCase() === 'lalocf') display.classList.add('admin-name');
    
    const avatar = document.getElementById('mc-myAvatar');
    if(user.avatar) {
        avatar.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        avatar.style.background = 'transparent';
    } else {
        avatar.innerText = user.name.charAt(0).toUpperCase();
        avatar.style.background = stringToColor(user.name);
    }
  }
}

window.saveRegistration = () => {
  const name = document.getElementById('regName').value.trim();
  const link = document.getElementById('regLink').value.trim() || "#";
  const avatar = document.getElementById('regAvatar').value.trim() || "";
  if(name.length < 3) return alert("Nombre muy corto.");
  
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
  if(btoa(input) === _0xd1a4) {
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
  const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  if(!profile) return checkUserStatus();
  const userKey = profile.key;
  const myLikedItems = JSON.parse(localStorage.getItem('my_liked_items') || '{}');
  const itemLikeRef = ref(db, `likes_registry/${id}/${userKey}`);
  const snap = await get(itemLikeRef);
  if (snap.exists()) {
    await set(itemLikeRef, null); runTransaction(ref(db, `likes/${id}`), (c) => (c || 1) - 1);
    delete myLikedItems[id]; el.classList.remove('active');
  } else {
    await set(itemLikeRef, true); runTransaction(ref(db, `likes/${id}`), (c) => (c || 0) + 1);
    myLikedItems[id] = true; el.classList.add('active');
  }
  localStorage.setItem('my_liked_items', JSON.stringify(myLikedItems));
};

function syncLikeButtons() {
  const myLikedItems = JSON.parse(localStorage.getItem('my_liked_items') || '{}');
  Object.keys(myLikedItems).forEach(id => {
    const btn = document.getElementById('like-' + id);
    if(btn) btn.classList.add('active');
  });
}

const SCRIPTS_DATA = {
  script1: {
    title: "Script HUD Personalizado",
    desc: "Este script cambia por completo la interfaz del juego, dándole un estilo mucho más moderno. Incluye barras de vida personalizadas, contadores precisos y soporte para móviles.",
    version: "v1.0 (Psych Engine)",
    images: [
      "assets/images/webp/logocode.webp",
      "assets/images/mods/play.webp",
      "assets/images/mods/fate.webp"
    ],
    downloads: [
      { name: "Descargar Script (Drive)", link: "#" }
    ]
  }
};

let scriptImagesArray = [];
let currentScriptImgIndex = 0;

window.openScriptInfo = (id) => {
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
  if(scriptImagesArray.length <= 1) {
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
      { name: "Descarga (GameBanana)", link: "https://gamebanana.com/mods/441630"},
      { name: "Descarga Directa (Drive)", link: "https://drive.usercontent.google.com/u/0/uc?id=1g5liWScsGSSd_FCmDtLEOVPQSQtp6E8B&export=download"}
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
      { name: "Descarga Directa Windows64 (Github)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Windows64.zip" },
      { name: "Descarga Directa Windows32 (Github)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Windows32.zip" },
      { name: "Descarga Directa Linux (Github)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Linux.zip"},
      { name: "Descarga Directa Mac (Github)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-MacOS.zip"},
      { name: "Descarga Directa Android (Github)", link: "https://github.com/LaloCF2/LaloCF/releases/download/Psych-Engine-v1.0.4/Psych.Engine.v1.0.4.Android.apk" },
      { name: "Descarga Android No Optimizado (Drive)", link: "https://drive.google.com/file/d/1OLfDEtB_-ItFS0WqRut9xfsnfXSWlBgq/view" },
      { name: "Descarga Directa iOS (Github)", link: "https://github.com/LaloCF2/LaloCF/releases/download/Psych-Engine-v1.0.4/PsychEngine.v1.0.4.iOS.ipa" }
    ]
  },
  apk2: {
    img: "assets/images/webp/logopsychonline.webp",
    title: "Psych Online",
    desc: "Mod de Psych Engine con funciones en línea.",
    version: "v0.13.2 Bugfix",
    downloads: [
      { name: "Descarga Directa Windows (Github)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.13.2/windowsBuild.zip" },
      { name: "Descarga Directa Linux (Github)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.13.2/linuxBuild.zip" },
      { name: "Descarga Directa Mac (Github)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.13.2/macBuild.zip"},
      { name: "Descarga Directa Android (Github)", link: "https://github.com/Prohack202020/Funkin-Psych-Online/releases/download/0.13.2-bugfix-mobile/PsychOnline-Android.apk" },
      { name: "Descarga Directa iOS (Github)", link: "https://github.com/Prohack202020/Funkin-Psych-Online/releases/download/0.13.2-bugfix-mobile/PsychOnline-iOS.ipa" }
    ]
  },
  apk3: {
    img: "assets/images/webp/logocodename.webp",
    title: "CodeName Engine",
    desc: "Codename Engine es una bifurcación de Friday Night Funkin' con un enfoque en codificación suave y modding.",
    version: "v1.0.1",
    downloads: [
      { name: "Descarga Directa Windows (Github)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Windows.zip" },
      { name: "Descarga Directa Linux (Github)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Linux.zip" },
      { name: "Descarga Directa Mac (Github)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Mac.zip"},
      { name: "Descarga Directa Android (Github)", link: "https://github.com/HomuHomu833-haxe-stuff/CodenameEngine-Mobile/releases/download/v1.0.1/Codename.Engine-Android.apk"},
      { name: "Descarga Directa iOS (Github)", link: "https://github.com/HomuHomu833-haxe-stuff/CodenameEngine-Mobile/releases/download/v1.0.1/Codename.Engine-iOS.ipa" }
    ]
  },  
  apk4: {
    img: "assets/images/webp/logoplusengine.webp",
    title: "Plus Engine",
    desc: "Motor basado en Psych 1.0.4 con modcharts como NotITG y compatible con vídeos hxcodec de los mods Psych 0.6.3 y 0.7.3.",
    version: "v1.2",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases" },
      { name: "Descarga Directa Windows (Github)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2/PlusEngine-Windows.zip" },
      { name: "Descarga Directa Linux (Github)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2/PlusEngine-Linux.zip" },
      { name: "Descarga Directa Mac (Github)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2/PlusEngine-Mac.zip"},
      { name: "Descarga Directa Android (Github)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2/PlusEngine-Android.zip"},
      { name: "Descarga Directa iOS (Github)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2/PlusEngine-iOS.zip" }
    ]
  },
  apk5: {
    img: "assets/images/webp/logop-slice.webp",
    title: "P-Slice Engine",
    desc: "El motor P-Slice es un cruce entre Psych Engine y la versión más reciente de Friday Night Funkin.\n\nSu objetivo es incorporar nuevos elementos visuales y características de las versiones más nuevas de FNF y realizar cambios en las existentes para que se sientan más cercanas a las de V-Slice.",
    version: "v3.4.2",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador", link: "https://github.com/Psych-Slice/P-Slice/releases" },
      { name: "Descargas en GameBanana", link: "https://gamebanana.com/mods/535203" },
      { name: "Descarga Directa Windows (Github)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.windows.zip" },
      { name: "Descarga Directa Linux (Github)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.linux.zip" },
      { name: "Descarga Directa Mac (Github)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.macos.zip"},
      { name: "Descarga Directa Android (Github)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.android.zip"},
      { name: "Descarga Directa iOS (Github)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.ios.zip" }
    ]
  }
};

window.openModInfo = (id) => { 
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

onValue(ref(db, 'likes'), (s) => { const d = s.val() || {}; Object.keys(d).forEach(k => { if(document.getElementById('count-'+k)) document.getElementById('count-'+k).innerText = d[k]; }); });

// --- LÓGICA DE INSTALACIÓN (PWA) ---
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