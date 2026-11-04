// Pedidos de ports: crear (1 cada 10 días, lo controla Firebase), votar (1 voto por persona).
window.fbReady.then((FB) => {
const { db, ref, get, set, update, remove, onValue, push, serverTimestamp } = FB;
const { t, esc, vibrate, openPopup, toast, profileName, getProfile, isAdmin } = FNF;

const STATUS_COLORS = { 'Pendiente': '#d9a400', 'Seleccionado': '#3d8bff', 'En Progreso': '#ff8800', 'No Seleccionado': '#ef3e6d', 'Completado': '#19b56b' };
const TEN_DAYS = 10 * 86400000;
let requests = {};
let listening = false;

function render() {
  const container = document.getElementById('requests-list');
  const list = Object.keys(requests).map(k => ({ id: k, ...requests[k] }));
  if (!list.length) {
    container.innerHTML = `<p class="empty">${t('No hay solicitudes aún. ¡Sé el primero!', 'No requests yet. Be the first!')}</p>`;
    return;
  }
  const uid = window.usuarioActualFirebase && window.usuarioActualFirebase.uid;
  container.innerHTML = list
    .sort((a, b) => (b.status !== 'Completado') - (a.status !== 'Completado') || (b.votes || 0) - (a.votes || 0))
    .map(req => {
      const status = req.status || 'Pendiente';
      const prog = Number(req.progress) || 0;
      const rid = esc(req.id);
      const voted = !!(uid && req.voters && req.voters[uid]);
      const admin = isAdmin() ? `
        <div class="req-admin">
          <button style="background:#3d8bff" onclick="updateRequestStatus('${rid}', 'Seleccionado')">Selec.</button>
          <button style="background:#ef3e6d" onclick="updateRequestStatus('${rid}', 'No Seleccionado')">No sel.</button>
          <button style="background:#ff8800" onclick="updateRequestStatus('${rid}', 'En Progreso')">Progreso</button>
          <button style="background:#19b56b" onclick="updateRequestStatus('${rid}', 'Completado')">Listo</button>
          <button style="background:#555;flex:0 0 auto" onclick="deleteRequest('${rid}')">🗑️</button>
          ${status === 'En Progreso' ? `<input type="range" min="0" max="100" value="${prog}" style="width:100%" onchange="updateRequestProgress('${rid}', this.value)">` : ''}
        </div>` : '';
      return `
        <div class="list-item" style="flex-wrap:wrap;align-items:flex-start">
          <div class="grow">
            <span class="status-tag" style="background:${STATUS_COLORS[status] || '#999'}">${esc(status)}</span>
            <h4 style="margin-top:6px">${esc(req.modName)}</h4>
            ${req.link && /^https?:\/\//i.test(req.link) ? `<a href="${esc(req.link)}" target="_blank" rel="noopener" style="font-size:12px">${t('Ver link original', 'Original link')}</a>` : ''}
            <p>${t('Pedido por', 'Requested by')}: <b>${esc(req.user || 'Anónimo')}</b></p>
            ${status === 'En Progreso' ? `<div class="progress"><div style="width:${prog}%"></div></div><p style="text-align:right">${prog}%</p>` : ''}
          </div>
          <button class="vote-btn ${voted ? 'voted' : ''}" onclick="voteRequest('${rid}', this)" aria-label="${t('Votar', 'Vote')}">▲<span>${Number(req.votes) || 0}</span></button>
          ${admin}
        </div>`;
    }).join('');
}
window.renderRequests = render;

window.abrirPedidos = () => {
  openPopup('requests-popup');
  if (listening) { render(); return; }
  listening = true;
  onValue(ref(db, 'mod_requests'), (snapshot) => { requests = snapshot.val() || {}; render(); });
};
window.loadModRequests = window.abrirPedidos;

window.enviarSolicitudMod = async () => {
  if (window.exigirRegistro()) return;
  if (await FNF.checkBanStatus()) return;
  const uid = window.usuarioActualFirebase.uid;
  const name = document.getElementById('req-mod-name').value.trim();
  const link = document.getElementById('req-mod-link').value.trim();
  if (name.length < 2) return toast(t('Escribe el nombre del mod que quieres pedir.', 'Type the name of the mod.'), 'list');
  if (link && !/^https?:\/\//i.test(link)) return toast(t('El enlace debe empezar con https://', 'The link must start with https://'), 'list');

  const btn = document.getElementById('btn-enviar-solicitud');
  btn.disabled = true;
  btn.textContent = t('Enviando...', 'Sending...');
  try {
    // Límite de 10 días (también lo aplica Firebase, esto es solo para avisar bonito)
    const cd = (await get(ref(db, `request_cooldown/${uid}`))).val();
    if (cd && Date.now() - cd < TEN_DAYS) {
      const dias = Math.ceil((TEN_DAYS - (Date.now() - cd)) / 86400000);
      window.mostrarMensaje(t('⏳ Espera un poco', '⏳ Please wait'),
        t(`Solo puedes pedir un mod cada 10 días. Te faltan ${dias} día(s).`, `You can request one mod every 10 days. ${dias} day(s) left.`));
      return;
    }
    const all = (await get(ref(db, 'mod_requests'))).val() || {};
    const active = Object.values(all).filter(r => r.status !== 'Completado' && r.status !== 'No Seleccionado').length;
    if (active >= 5) {
      window.mostrarMensaje(t('🛑 Lista llena', '🛑 List is full'),
        t('Ya hay 5 pedidos activos. Espera a que se terminen los ports pendientes.', 'There are already 5 active requests. Please wait.'));
      return;
    }
    const key = push(ref(db, 'mod_requests')).key;
    await update(ref(db), {
      [`mod_requests/${key}`]: {
        modName: name.slice(0, 80), link: link.slice(0, 300), user: profileName(getProfile()).slice(0, 40),
        ownerKey: uid, votes: 1, voters: { [uid]: true }, status: 'Pendiente', timestamp: Date.now()
      },
      [`request_cooldown/${uid}`]: serverTimestamp()
    });
    document.getElementById('req-mod-name').value = '';
    document.getElementById('req-mod-link').value = '';
    toast(t('¡Solicitud enviada! Ahora otros pueden votar.', 'Request sent! Others can vote now.'), 'list');
  } catch (err) {
    console.error('Error al enviar solicitud:', err);
    toast(t('No se pudo enviar la solicitud. Intenta más tarde.', "Couldn't send the request."), 'alert');
  } finally {
    btn.disabled = false;
    btn.textContent = t('Enviar solicitud', 'Send request');
  }
};

window.voteRequest = async (id, el) => {
  if (window.exigirRegistro()) return;
  if (el) el.disabled = true;
  try {
    await FNF.coupledToggle(`mod_requests/${id}/votes`, `mod_requests/${id}/voters/${window.usuarioActualFirebase.uid}`);
    vibrate(15);
  } catch (err) {
    console.error('Voto:', err);
    toast(t('No se pudo registrar tu voto.', "Couldn't save your vote."), 'alert');
  } finally {
    if (el) el.disabled = false;
  }
};

window.updateRequestStatus = async (id, status) => {
  if (!isAdmin()) return;
  const req = (await get(ref(db, `mod_requests/${id}`))).val();
  if (!req) return;
  await update(ref(db, `mod_requests/${id}`), { status });
  if (FNF.logAdmin) FNF.logAdmin('request:status', `Cambió el pedido "${req.modName}" a ${status}`);
  const msgs = {
    'Seleccionado': `Hola ${req.user}, tu mod "${req.modName}" fue seleccionado con éxito, puedes ver el progreso que lleva este port.`,
    'No Seleccionado': `Hola ${req.user}, lamentablemente tu mod "${req.modName}" no fue seleccionado por pocos votos, puedes intentar pedirlo después.`,
    'Completado': `Hola ${req.user}, tu mod "${req.modName}" fue completado con éxito, ya puedes encontrarlo en el menú de mods.`
  };
  if (req.ownerKey && req.ownerKey !== 'guest' && msgs[status]) {
    await set(ref(db, `user_notifications/${req.ownerKey}`), { message: msgs[status], timestamp: Date.now(), id: Math.random().toString(36).slice(2, 11) });
  }
};
window.updateRequestProgress = (id, v) => { if (isAdmin()) update(ref(db, `mod_requests/${id}`), { progress: parseInt(v) }); };
window.deleteRequest = (id) => {
  if (!isAdmin() || !confirm('¿Eliminar esta solicitud?')) return;
  const r = requests[id] || {};
  remove(ref(db, `mod_requests/${id}`));
  if (FNF.logAdmin) FNF.logAdmin('request:delete', `Eliminó el pedido "${r.modName || id}"`);
};
}).catch(err => console.error(err));
