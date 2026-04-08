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
const APP_VERSION = "v5.1.0";
const MI_UID_ADMIN = "user_a655u37rr"; 

let isSuperUser = false;
const userProfile = JSON.parse(localStorage.getItem('fnf_user_profile'));

if(userProfile && userProfile.key === MI_UID_ADMIN) {
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
    if(el) el.innerText = downloadCounts[id];
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
  if(name.length < 3) return alert("El nombre es corto, intenta agregarle mas caracteres.");
  
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
   script2: {
        title: "FPS Counter",
        desc: "Este script agrega un contador de fotogramas por segundo a tu juego.\nTotalmente funcional para Pc, Android y iOS.",
        version: "v1.0",
        images: [
          "assets/images/scripts/sc1.webp"
        ],
        downloads: [
          { name: "Descarga Script Directo (GitHub)", link: "assets/zip/FPS_Counter.zip" }
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
   mod98_8: {
    img: "assets/images/mods/fan.webp",
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
      { name: "Descarga Original (GameBanana)", link: "https://gamebanana.com/mods/463070"},
      { name: "Descarga ZIP (GitHub)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/BtF/V.S.Botfriend.zip" }
    ]
  },
  mod99_0: {
    img: "assets/images/mods/star2026.webp",
    title: "Stargazer (2026) FanChart",
    desc: "Friday Night Funkin' FNF' Stargazer (2026) FanChart Port Psych Engine Optimizado Para (Pc/Android/iOS).\n\nEste solo esta optimizado y para que fuera compatible con iOS.\n\nPeso del archivo: 18.88MB",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga Original (GameBanana)", link: "https://gamebanana.com/mods/657873"},
      { name: "Descarga ZIP (GitHub)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/Stargazer2026/Stargazer.2026.FanChart-PE.1.0.4.zip" }
    ]
  },
  mod99_1: {
    img: "assets/images/mods/wii.webp",
    title: "VS Matt V3",
    desc: "Friday Night Funkin' FNF' Vs Matt V3 Port Psych Engine Optimizado Para (Pc/Android).\n\nEste puede tener errores en la base de Psych Online, todas las demas son compatibles correctamente.",
    version: "Compatible: Psych v1.0.4, PSlice v3.4.2, Psych Online v0.13.2, Plus Engine v1.2.6",
    downloads: [
      { name: "Descarga Directa ZIP (GitHub)", link: "https://github.com/LaloCF2/Mods-Psych-Engine/releases/download/Wii/MattV3.Port.zip"},
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
      { name: "Descarga en el repositorio del desarrollador (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases" },
      { name: "Descarga en GameBanana", link: "https://gamebanana.com/mods/309789" },
      { name: "Descarga Directa Windows64 (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Windows64.zip" },
      { name: "Descarga Directa Windows32 (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Windows32.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-Linux.zip"},
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/ShadowMario/FNF-PsychEngine/releases/download/1.0.4/PsychEngine-MacOS.zip"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/LaloCF2/LaloCF/releases/download/Psych-Engine-v1.0.4/Psych.Engine.v1.0.4.Android.apk" },
      { name: "Descarga Android No Optimizado (GitHub)", link: "https://github.com/LaloCF2/fnf_ports/releases/download/Psych-Engine-v1.0.4/Friday.Night.Funkin.Psych.Engine_0.2.8.apk" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/LaloCF2/LaloCF/releases/download/Psych-Engine-v1.0.4/PsychEngine.v1.0.4.iOS.ipa" }
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
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.14.6/windowsBuild.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.14.6/linuxBuild.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/Snirozu/Funkin-Psych-Online/releases/download/0.14.6/macBuild.zip"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/Prohack202020/Funkin-Psych-Online/releases/download/0.13.2-bugfix-mobile/PsychOnline-Android.apk" },
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/Prohack202020/Funkin-Psych-Online/releases/download/0.13.2-bugfix-mobile/PsychOnline-iOS.ipa" }
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
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Windows.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Linux.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/CodenameCrew/CodenameEngine/releases/download/v1.0.1/Codename.Engine-Mac.zip"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/HomuHomu833-haxe-stuff/CodenameEngine-Mobile/releases/download/v1.0.1/Codename.Engine-Android.apk"},
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/HomuHomu833-haxe-stuff/CodenameEngine-Mobile/releases/download/v1.0.1/Codename.Engine-iOS.ipa" }
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
      { name: "Descarga Directa Windows 32 (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Windows-x32.zip" },
      { name: "Descarga Directa Windows 64 Actualizado (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.7/PlusEngine-Windows-x64.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Linux-x64.zip" },
      { name: "Descarga Directa Mac ARM (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Mac-ARM.zip"},
      { name: "Descarga Directa Mac Intel (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-Mac-Intel.zip"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.7/PlusEngine-Android-x64-v7a.zip"},
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/Psych-Plus-Team/FNF-PlusEngine/releases/download/1.2.6/PlusEngine-iOS.zip" }
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
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.windows.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.linux.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.macos.zip"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.android.zip"},
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/Psych-Slice/P-Slice/releases/download/3.4.2/P-Slice.1.0.ios.zip" }
    ]
  },
  apk6: {
    img: "assets/images/webp/logonova.webp",
    title: "NovaFleare Engine",
    desc: "NovaFlare-Engine es una rama de FNF Psych Engine , dedicada a proporcionar excelentes efectos visuales y funciones intuitivas. Nuestro objetivo es ofrecer una experiencia de desarrollo y juego potente y divertida tanto para creadores como para jugadores.",
    version: "v1.1.7 Versión Estable",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases" },
      { name: "Descargas en GameBanana", link: "https://gamebanana.com/mods/505473" },
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.1.7/windows.zip" },
      { name: "Descarga Directa Mac14 (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.1.7/macOS14.tar" },
      { name: "Descarga Directa Mac15 (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.1.7/macOS15.tar"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.1.7/android.apk"},
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/NovaFlare-Engine-Concentration/FNF-NovaFlare-Engine/releases/download/V1.1.7/iOSBuild.zip" }
    ]
  },
  apk7: {
    img: "assets/images/webp/logoEK.webp",
    title: "PsychEngine ExtraKeys",
    desc: "¡Bienvenido a la organización más genial del mundo!\n\n Alojamiento de Psych Engine con claves adicionales , Psych EK , claves adicionales de Psych Engine , claves adicionales o PE: ¡EK !",
    version: "v0.4.6",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases" },
      { name: "Descarga Directa Windows (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-windowsBuild-56acc57.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-linuxBuild-56acc57.zip" },
      { name: "Descarga Directa Linux (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-macBuild-56acc57.zip"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-android-apk-32d1f1e.zip"},
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/FunkinExtraKeys/FNF-PsychEngine-EK/releases/download/0.4.6/ek-iOS-ipa-32d1f1e.zip" }
    ]
  },
  apk8: {
    img: "assets/images/webp/logose.webp",
    title: "Shadow Engine",
    desc: "Soy Sombra, el Erizo. Y ahora, soy la forma de tenedor definitiva. - Sombra, el Erizo\n\nUn motor Psych Engine 0.7.3 altamente modificado.\n\nListo para ser modificado en origen.",
    version: "v0.7.0",
    downloads: [
      { name: "Descargas en el repositorio del desarrollador (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases" },
      { name: "Descarga Directa Windows ARM64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-BC-windows-arm64.zip" },
      { name: "Descarga Directa Windows i686 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-BC-windows-i686.zip" },
      { name: "Descarga Directa Windows x86_64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-BC-windows-x86_64.zip" },
      { name: "Descarga Directa Mac (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-BC-macOS-Universal.tar" },
      { name: "Descarga Directa Linux ARM64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-ASTC-linux-arm64.tar"},
      { name: "Descarga Directa Linux ARMV7 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-ASTC-linux-armv7.tar"},
      { name: "Descarga Directa Linux i686 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-BC-linux-i686.tar"},
      { name: "Descarga Directa Linux x86_64 (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-BC-linux-x86_64.tar"},
      { name: "Descarga Directa Android (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-ASTC-Android.apk"},
      { name: "Descarga Directa iOS (GitHub)", link: "https://github.com/ShadowEngineTeam/FNF-Shadow-Engine/releases/download/0.7.0/ShadowEngine-ASTC-iOS.ipa" }
    ]
  }
};

window.openModInfo = (id) => { 
  if (window.brokenLinksData && window.brokenLinksData[id] && !isSuperUser) {
    // Sacamos el nombre del mod directo de la tarjeta para ponerlo en el letrero
    const modName = document.querySelector('#card-' + id + ' h3').textContent;
    document.getElementById('maintenance-mod-name').innerText = modName;
    
    // Mostramos el popup de mantenimiento en vez del normal
    document.getElementById('maintenance-popup').classList.add('show');
    return; // Este return corta la función para que NO se abra el popup de descargas
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
  if(document.getElementById('langBtn')) {
    clearInterval(initV4);
    applyLanguage();
    
    const profile = JSON.parse(localStorage.getItem('fnf_user_profile'));
    if (profile) {
      const nameInput = document.getElementById('editProfileName');
      const avatarInput = document.getElementById('editProfileAvatar');
      const preview = document.getElementById('profile-avatar-preview');
      
      if(nameInput && profile.name) nameInput.value = profile.name;
      if(avatarInput && profile.avatar) {
        avatarInput.value = profile.avatar;
        if(preview) preview.src = profile.avatar;
      }
    }

    const avatarInput = document.getElementById('editProfileAvatar');
    if(avatarInput) {
      avatarInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const preview = document.getElementById('profile-avatar-preview');
        if(preview) {
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
  
  if(name.length < 3) return alert(currentLang === 'es' ? "El nombre es corto, intenta agregarle mas caracteres." : "The name is too short, try adding more characters.");
  
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
    if(window.openModInfo) {
        const origOpenModInfo = window.openModInfo;
        window.openModInfo = (id) => {
          window.currentItemRatingId = id;
          window.loadItemRating(id, 'mod');
          origOpenModInfo(id);
        };
    }
    if(window.openApkInfo) {
        const origOpenApkInfo = window.openApkInfo;
        window.openApkInfo = (id) => {
          window.currentItemRatingId = id;
          window.loadItemRating(id, 'apk');
          origOpenApkInfo(id);
        };
    }
    if(window.openScriptInfo) {
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
  if(window.openModInfo) {
      const origModInfo = window.openModInfo;
      window.openModInfo = (id) => { 
        window.currentItemRatingId = id; 
        window.currentItemType = 'mod';
        origModInfo(id); 
        window.loadItemRating(id, 'mod'); 
      };
  }
  if(window.openApkInfo) {
      const origApkInfo = window.openApkInfo;
      window.openApkInfo = (id) => { 
        window.currentItemRatingId = id; 
        window.currentItemType = 'apk';
        origApkInfo(id); 
        window.loadItemRating(id, 'apk'); 
      };
  }
  if(window.openScriptInfo) {
      const origScriptInfo = window.openScriptInfo;
      window.openScriptInfo = (id) => { 
        window.currentItemRatingId = id; 
        window.currentItemType = 'script';
        origScriptInfo(id); 
        window.loadItemRating(id, 'script'); 
      };
  }
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
  if(txt) txt.innerText = currentLang === 'es' ? "¡Gracias por calificar!" : "Thanks for rating!";
};

window.loadItemRating = (id, type) => {
    const container = document.getElementById(`rating-container-${type}`);
    if(!container) return;
    
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
        if(txt) {
          const baseText = currentLang === 'es' ? "Tu calificación" : "Your rating";
          txt.innerText = totalVotos > 0 ? `${baseText} • Promedio: ${promedio} ⭐ (${totalVotos})` : baseText;
        }
    } else {
        spans.forEach(s => { s.style.color = '#555'; s.style.textShadow = 'none'; });
        if(txt) {
          const baseText = currentLang === 'es' ? "Califica este contenido" : "Rate this content";
          txt.innerText = totalVotos > 0 ? `Promedio: ${promedio} ⭐ (${totalVotos}) • ${baseText}` : baseText;
        }
    }
};

window.updateStarsUI = (type, stars) => {
    const container = document.getElementById(`rating-container-${type}`);
    if(!container) return;
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

    if(localStorage.getItem('lowEndMode') === 'true') document.body.classList.add('low-end-mode');

    const applyCustomFont = (base64Font) => {
        const newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode(`@font-face { font-family: 'CustomUserFont'; src: url('${base64Font}') format('truetype'); } body, h1, h2, h3, p, span, div, button, input, textarea, a { font-family: 'CustomUserFont', sans-serif !important; }`));
        document.head.appendChild(newStyle);
    };
    const savedFont = localStorage.getItem('customUserFont');
    if(savedFont) applyCustomFont(savedFont);

    let chromaInterval;
    const toggleChroma = (enable) => {
        if(enable) {
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
        if(!container) return;
        if(enable) {
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
    
    if(savedTheme === 'pro') {
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
          if(e.target.closest('.btn, .nav-item, .settings-btn, .lang-btn, .profile-btn, .filter-btn, .admin-led-btn, .admin-pin-btn')) window.triggerVibrate(15);
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
          if(document.getElementById('editProfileName') && profile.name) document.getElementById('editProfileName').value = profile.name;
          if(document.getElementById('editProfileAvatar') && profile.avatar) {
            document.getElementById('editProfileAvatar').value = profile.avatar;
            document.getElementById('profile-avatar-preview').src = profile.avatar;
          }
        }
      }, 500);

      const avInput = document.getElementById('editProfileAvatar');
      if(avInput) avInput.addEventListener('input', (e) => { document.getElementById('profile-avatar-preview').src = e.target.value.trim() || "https://via.placeholder.com/80/555/fff?text=?"; });

      window.saveProfileChanges = () => {
        let profile = JSON.parse(localStorage.getItem('fnf_user_profile')) || { key: 'user_' + Math.random().toString(36).substr(2, 9), link: '#' };
        const name = document.getElementById('editProfileName').value.trim();
        if(name.length < 3) return alert(window.currentLang === 'es' ? "Nombre muy corto." : "Name too short.");
        profile.name = name; profile.avatar = document.getElementById('editProfileAvatar').value.trim();
        localStorage.setItem('fnf_user_profile', JSON.stringify(profile));
        document.getElementById('profile-popup').classList.remove('show');
        alert(window.currentLang === 'es' ? "¡Perfil actualizado!" : "Profile updated!");
      };
      
      const colorInput = document.getElementById('themeColor');
      if(colorInput) {
          colorInput.value = savedColor;
          colorInput.addEventListener('input', (e) => {
              document.documentElement.style.setProperty('--neon-blue', e.target.value);
              localStorage.setItem('customThemeColor', e.target.value);
              if(document.getElementById('chromaToggle').checked) {
                  document.getElementById('chromaToggle').checked = false;
                  toggleChroma(false);
                  localStorage.setItem('chromaMode', 'false');
              }
          });
      }

      const chromaToggle = document.getElementById('chromaToggle');
      if(chromaToggle) {
          chromaToggle.checked = localStorage.getItem('chromaMode') === 'true';
          if(chromaToggle.checked) toggleChroma(true);
          chromaToggle.addEventListener('change', (e) => {
              localStorage.setItem('chromaMode', e.target.checked);
              toggleChroma(e.target.checked);
          });
      }

      const particlesToggle = document.getElementById('particlesToggle');
      if(particlesToggle) {
          particlesToggle.checked = localStorage.getItem('particlesMode') === 'true';
          if(particlesToggle.checked && localStorage.getItem('lowEndMode') !== 'true') toggleParticles(true);
          particlesToggle.addEventListener('change', (e) => {
              localStorage.setItem('particlesMode', e.target.checked);
              toggleParticles(e.target.checked);
          });
      }

      const blurSlider = document.getElementById('blurSlider');
      if(blurSlider) {
          blurSlider.value = savedBlur;
          blurSlider.addEventListener('input', (e) => {
              document.documentElement.style.setProperty('--glass-blur', e.target.value + 'px');
              localStorage.setItem('glassBlur', e.target.value);
          });
      }

      const lowEndToggle = document.getElementById('lowEndToggle');
      if(lowEndToggle) {
          lowEndToggle.checked = localStorage.getItem('lowEndMode') === 'true';
          lowEndToggle.addEventListener('change', (e) => {
              localStorage.setItem('lowEndMode', e.target.checked);
              if(e.target.checked) {
                  document.body.classList.add('low-end-mode');
                  toggleParticles(false); // Fuerza apagar partículas
              } else {
                  document.body.classList.remove('low-end-mode');
                  if(document.getElementById('particlesToggle').checked) toggleParticles(true);
              }
              window.triggerVibrate(30);
          });
      }

      const hapticToggle = document.getElementById('hapticToggle');
      if(hapticToggle) {
          hapticToggle.checked = localStorage.getItem('hapticMode') === 'true';
          hapticToggle.addEventListener('change', (e) => {
              localStorage.setItem('hapticMode', e.target.checked);
              if(e.target.checked) navigator.vibrate(50); 
          });
      }

      const pillSlider = document.getElementById('pillSizeSlider');
      if(pillSlider) {
          pillSlider.value = savedPillInset;
          pillSlider.addEventListener('input', (e) => {
              document.documentElement.style.setProperty('--pill-inset', e.target.value + 'px');
              localStorage.setItem('pillInset', e.target.value);
          });
      }

      const fontInput = document.getElementById('customFontUpload');
      if(fontInput) {
          fontInput.addEventListener('change', (e) => {
              const file = e.target.files[0];
              if(file && file.name.toLowerCase().endsWith('.ttf')) {
                  const reader = new FileReader();
                  reader.onload = function(evt) {
                      try { localStorage.setItem('customUserFont', evt.target.result); applyCustomFont(evt.target.result); } 
                      catch(err) { applyCustomFont(evt.target.result); alert("Archivo muy pesado para guardarse permanente, pero se aplicará ahora."); }
                  };
                  reader.readAsDataURL(file);
              }
          });
      }

      window.resetSettings = () => {
          if(confirm("¿Restablecer diseño predeterminado?")) {
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
            if(navItems[0]) pill.style.width = `${navItems[0].offsetWidth}px`;
            
            const snapPill = (index) => {
              pill.classList.remove('is-dragging'); 
              const target = navItems[index];
              if(target) {
                  pill.style.width = `${target.offsetWidth}px`;
                  pill.style.transform = `translateX(${target.offsetLeft}px) scale(1)`; 
                  window.triggerVibrate(25);
              }
            };

            const originalSelectSection = window.selectSection;
            window.selectSection = (sec, el) => {
              if(originalSelectSection) originalSelectSection(sec, el);
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
                 window.scrollTo({top:0, behavior:'smooth'});
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
// 🚨 SISTEMA DE CUARENTENA Y TELEGRAM V2 (Con Nombres y Popups)
// ==========================================

// Usamos window. para que la variable se pueda leer desde otras funciones
window.brokenLinksData = {};

// 1. ESCUCHADOR
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

// 2. FUNCIÓN DE REPORTE (A TELEGRAM)
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

    // 🤖 TELEGRAM: Sacamos el nombre exacto del Mod
    let modName = "Nombre Desconocido";
    const modTitleElement = document.querySelector('#card-' + modId + ' h3');
    if (modTitleElement) {
      modName = modTitleElement.textContent.trim(); // Extrae el texto "Naomi FanChart", etc.
    }

    const botToken = "7599981153:AAH6tPHek2C02UeVHc-lACFtfVK_XleB6VI"; 
    const chatId = "5429172831"; 
    
    // Armamos el mensaje VIP con ID y Nombre
    const mensaje = `🚨 *ALERTA DE LINK CAÍDO* 🚨\n\nEl usuario *${user.name}* reportó el problema de un enlace caido:\n\n📦 Mod: *${modName}*\n🆔 ID: \`${modId}\`\n\n🛑El Mod a sido puesto en cuarentena automáticamente.\n\n🛠️ ¡Entra a repararlo!`;
    
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: mensaje, parse_mode: "Markdown" })
    }).catch(error => console.error("Error Telegram:", error));
  }
};

// 3. FUNCIÓN PARA REPARAR
window.fixBrokenLink = async (modId) => {
  if (!isSuperUser) return; 
  if (confirm('🛠️ ¿Ya solucionaste el link de este mod?')) {
    await set(ref(db, `broken_links/${modId}`), null);
  }
};
// ==========================================
// ==========================================
// ⭐ SISTEMA DE CALIFICACIÓN POR ESTRELLAS
// ==========================================

// 1. Escuchar la base de datos para calcular los promedios
onValue(ref(db, 'ratings'), (snap) => {
  const ratingsData = snap.val() || {};
  const userProfile = JSON.parse(localStorage.getItem('fnf_user_profile'));
  const miLlave = userProfile ? userProfile.key : null;

  // Recorremos todas las tarjetas de los mods en la pantalla
  document.querySelectorAll('.mod-card').forEach(card => {
    // Sacamos el ID exacto del mod (ej. mod98_8)
    const exactModId = card.id.replace('card-', ''); 
    const modRatings = ratingsData[exactModId] || {};
    
    // Calculamos el promedio
    const votosArray = Object.values(modRatings);
    const totalVotos = votosArray.length;
    let promedio = 0;
    
    if (totalVotos > 0) {
      const suma = votosArray.reduce((acc, val) => acc + val, 0);
      promedio = (suma / totalVotos).toFixed(1); // Deja solo 1 decimal (ej. 4.5)
    }

    // Escribimos el promedio en la tarjeta
    const textoPromedio = document.getElementById(`rating-text-${exactModId}`);
    if (textoPromedio) {
      textoPromedio.innerText = `${promedio} ⭐ (${totalVotos})`;
    }

    // Pintamos de dorado las estrellas si el usuario actual ya votó
    const starsContainer = document.getElementById(`stars-${exactModId}`);
    if (starsContainer) {
      const miVotoAnterior = miLlave ? modRatings[miLlave] : 0;
      const spans = starsContainer.querySelectorAll('span');
      
      spans.forEach(span => {
        const valorEstrella = parseInt(span.getAttribute('data-val'));
        if (miVotoAnterior >= valorEstrella) {
          span.innerText = '★'; // Estrella llena
          span.style.color = '#ffd700'; // Dorado Neón
          span.style.textShadow = '0 0 8px #ffd700';
        } else {
          span.innerText = '☆'; // Estrella vacía
          span.style.color = '#555';
          span.style.textShadow = 'none';
        }
      });
    }
  });
});

// 2. Función que se activa cuando alguien toca una estrella
window.rateMod = async (modId, calificacion) => {
  const user = JSON.parse(localStorage.getItem('fnf_user_profile'));
  
  // Si no ha iniciado sesión, abrimos el popup de registro
  if (!user) {
    document.getElementById('register-popup').classList.add('show');
    return;
  }
  
  // Guardamos o actualizamos su calificación en Firebase (del 1 al 5)
  await set(ref(db, `ratings/${modId}/${user.key}`), calificacion);
  
  // Pequeña vibración para confirmar (si el celular lo soporta)
  if(window.triggerVibrate) window.triggerVibrate(15);
};
// ==========================================
// ==========================================
// 📚 SISTEMA DE ACORDEÓN PARA AYUDA
// ==========================================
window.toggleFaq = function(button) {
  // Cambiamos el color del botón y giramos la flecha
  button.classList.toggle('active');
  
  // Seleccionamos la caja de información que está justo debajo de ese botón
  const content = button.nextElementSibling;
  
  // Abrimos o cerramos el contenido con un deslizamiento suave
  if (content.classList.contains('open')) {
    content.classList.remove('open');
  } else {
    content.classList.add('open');
  }
  
  // Pequeña vibración de interfaz (opcional)
  if(window.triggerVibrate) window.triggerVibrate(10);
};
// ==========================================

// ==========================================
// 💎 SISTEMA DE ENLACES SECRETOS (UNLOCKS)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // 1. Revisamos si en el enlace viene la palabra "?unlock=algo"
  const urlParams = new URLSearchParams(window.location.search);
  const modToUnlock = urlParams.get('unlock');

  // Si traen una llave en el enlace...
  if (modToUnlock) {
    // Guardamos en la memoria de su celular que ya tienen permiso de ver ese mod
    let misSecretos = JSON.parse(localStorage.getItem('unlocked_mods') || '[]');
    if (!misSecretos.includes(modToUnlock)) {
      misSecretos.push(modToUnlock);
      localStorage.setItem('unlocked_mods', JSON.stringify(misSecretos));
      
      // Mostramos el fiestón de celebración
      setTimeout(() => {
        document.getElementById('secret-unlocked-popup').classList.add('show');
        if(window.triggerVibrate) window.triggerVibrate([30, 50, 30]); // Doble vibración
      }, 1000);
    }
    
    // Limpiamos el enlace de arriba para que se vea normal (tusitio.com) y no puedan copiar el secreto tan fácil
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 2. Revelar los mods secretos que el usuario ya tenga guardados
  const misSecretosGuardados = JSON.parse(localStorage.getItem('unlocked_mods') || '[]');
  
  // Opcional: Si eres Admin, tú siempre puedes ver todos los mods secretos
  const esAdmin = localStorage.getItem('superUser') === 'true';

  document.querySelectorAll('.secret-mod').forEach(card => {
    // Le quitamos el "card-" al id
    const exactId = card.id.replace('card-', ''); 
    
    // Si el usuario tiene la llave, o si eres tú el Admin, lo hacemos visible
    if (misSecretosGuardados.includes(exactId) || esAdmin) {
      card.classList.remove('hidden');
    }
  });
});
// ==========================================

// ==========================================
// 📤 SISTEMA PARA COMPARTIR ENLACES DIRECTOS
// ==========================================

let linkParaCompartir = "";
let textoParaCompartir = "";

// 1. Abre el menú y prepara el enlace
window.abrirMenuCompartir = (id, nombreMod) => {
  // Construye la URL exacta (Ej: lalocf.com/?share=mod98_8)
  const baseUrl = window.location.origin + window.location.pathname;
  linkParaCompartir = `${baseUrl}?share=${id}`;
  textoParaCompartir = `🔥 ¡Mira este increíble Mod para Psych Engine: *${nombreMod}*! Descárgalo aquí:\n`;

  // Muestra el menú
  document.getElementById('share-modal').classList.add('show');
};

// 2. Funciones de Redes Sociales
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

// ==========================================
// 🚀 DETECTOR DE ENLACES MÁGICOS AL INICIAR
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const idCompartido = urlParams.get('share');

  // Si alguien entró usando un link compartido (?share=mod98_8)
  if (idCompartido) {
    
    // Le damos 1 segundo a la página para que termine de cargar todo
    setTimeout(() => {
      
      // Verificamos si es un Mod, un Apk o un Script y lo abrimos automáticamente
      if (idCompartido.includes('mod') && window.openModInfo) {
        window.openModInfo(idCompartido);
      } else if (idCompartido.includes('apk') && window.openApkInfo) {
        window.openApkInfo(idCompartido);
      } else if (idCompartido.includes('script') && window.openScriptInfo) {
        window.openScriptInfo(idCompartido);
      }

      // 🔥 MAGIA PURA: Le agregamos el efecto de brillos al popup que se acaba de abrir
      // Asegúrate de que el ID sea el correcto del contenedor de información de tu popup principal
      const contenidoPopup = document.querySelector('#mod-info-popup .popup-content') || document.querySelector('.popup.show .popup-content');
      
      if (contenidoPopup) {
        contenidoPopup.classList.add('brillo-epico');
        
        // El brillo dura 6 segundos y luego se apaga para no molestar a la vista
        setTimeout(() => {
          contenidoPopup.classList.remove('brillo-epico');
        }, 6000);
      }
      
      // Limpiamos la URL de arriba para que quede limpia
      window.history.replaceState({}, document.title, window.location.pathname);

    }, 1000);
  }
});

