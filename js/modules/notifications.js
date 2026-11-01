// Campana de notificaciones, avisos emergentes globales y mensajes personales.
// (La creación y edición de avisos está en el panel de admin → Avisos.)
window.fbReady.then((FB) => {
const { db, ref, set, onValue } = FB;
const { store, t, esc, icon, openPopup, closePopup, toast, isAdmin } = FNF;

let notifs = [];
let leidas = store.json('notifsLeidas', []);

// Los avisos programados solo se ven cuando llega su hora (el admin los ve siempre)
const visibles = () => notifs.filter(n => isAdmin() || !n.publishAt || n.publishAt <= Date.now());

function actualizarCampana() {
  const badge = document.getElementById('badge-contador');
  const n = visibles().filter(x => !leidas.includes(x.id)).length;
  badge.style.display = n ? 'block' : 'none';
  badge.textContent = n > 9 ? '9+' : n;
}

function marcarComoLeidas() {
  visibles().forEach(x => { if (!leidas.includes(x.id)) leidas.push(x.id); });
  store.setJson('notifsLeidas', leidas);
  actualizarCampana();
}

function render() {
  const lista = document.getElementById('lista-notificaciones');
  const items = visibles().sort((a, b) => (b.publishAt || 0) - (a.publishAt || 0) || String(b.id).localeCompare(String(a.id)));
  if (!items.length) {
    lista.innerHTML = `<p class="empty">${t('No hay notificaciones nuevas.', 'No new notifications.')}</p>`;
  } else {
    lista.innerHTML = items.map(n => {
      const mod = n.modId && FNF.itemOf(n.modId);
      const pending = n.publishAt && n.publishAt > Date.now();
      return `
      <div class="notif-item">
        ${pending ? `<span class="status-tag" style="background:var(--warn)">⏰ ${t('Programado', 'Scheduled')}</span>` : ''}
        <p>${esc(n.texto)}</p>
        <small>${esc(n.fecha)}</small>
        ${mod ? `<div class="row"><button class="btn btn-sm btn-soft" onclick="closePopup('panel-notificaciones'); openItemById('${esc(n.modId)}')">${icon('music', 'icon icon-sm')} ${esc(mod.title)}</button></div>` : ''}
      </div>`;
    }).join('');
  }
  actualizarCampana();
}

window.toggleNotificaciones = () => {
  const panel = document.getElementById('panel-notificaciones');
  if (panel.classList.contains('show')) { closePopup('panel-notificaciones'); return; }
  render();
  openPopup('panel-notificaciones');
  marcarComoLeidas();
};

onValue(ref(db, 'notificaciones'), (snap) => {
  notifs = [];
  snap.forEach(c => { notifs.push(c.val()); });
  window.liveNotifs = notifs;
  render();
  if (window.renderAdminTab) window.renderAdminTab('avisos', true);
});
// Revisa cada minuto si un aviso programado ya debe aparecer
setInterval(actualizarCampana, 60000);

// ---- Aviso emergente global ----
onValue(ref(db, 'notifications/latest'), (snap) => {
  const data = snap.val();
  if (!data) return;
  const reciente = (Date.now() - data.timestamp) < 86400000;
  if (store.get('last_notif_id') !== data.id && reciente) {
    toast(data.message);
    store.set('last_notif_id', data.id);
  }
});

// ---- Mensajes personales (estado de tus pedidos, respuestas del admin) ----
let personalListening = false;
window.listenToPersonalNotifications = (uid) => {
  if (personalListening) return;
  personalListening = true;
  onValue(ref(db, `user_notifications/${uid}`), (snap) => {
    const data = snap.val();
    if (!data) return;
    const key = `last_personal_notif_${uid}`;
    if (store.get(key) !== data.id) {
      window.mostrarMensaje(t('🔔 Mensaje del administrador', '🔔 Message from the admin'), data.message);
      store.set(key, data.id);
    }
  });
};
}).catch(err => console.error(err));
