// Reportes de problemas y mensajes de soporte.
// Todo se guarda en Firebase (support_tickets) y lo ves en Panel de admin → Reportes.
// El token de Telegram YA NO está en la página: si quieres avisos en Telegram,
// publica tools/telegram-worker.js en Cloudflare y pega aquí su dirección.
window.fbReady.then((FB) => {
const { db, ref, get, update, push, serverTimestamp } = FB;
const { t, esc, openPopup, closePopup, toast, getProfile, profileName } = FNF;

const TELEGRAM_PROXY_URL = 'https://telegram-proxy.ec331325.workers.dev'; // ej: 'https://fnf-telegram.tu-usuario.workers.dev'

const REASONS = {
  broken: ['🔗 El link está caído', '🔗 The link is down'],
  corrupt: ['📦 No descarga o el archivo está dañado', '📦 Download fails or file is corrupt'],
  crash: ['💥 El juego se cierra o no abre', '💥 The game crashes or won\'t open'],
  missing: ['🧩 Falta contenido (canciones, personajes...)', '🧩 Missing content'],
  other: ['✏️ Otro problema', '✏️ Something else']
};

const notifyTelegram = (text) => {
  if (!TELEGRAM_PROXY_URL) return;
  fetch(TELEGRAM_PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    .catch(err => console.warn('Telegram:', err));
};

const titleOf = (id) => ((window.MOD_DATA || {})[id] || (window.APK_DATA || {})[id] || (window.SCRIPTS_DATA || {})[id] || {}).title || id;

// Crea un ticket (máximo 1 por minuto por usuario; lo controla Firebase)
async function crearTicket(ticket, extra = {}) {
  const uid = window.usuarioActualFirebase.uid;
  const key = push(ref(db, 'support_tickets')).key;
  await update(ref(db), {
    [`support_tickets/${key}`]: { ...ticket, uid, user: profileName(getProfile()).slice(0, 40), timestamp: Date.now() },
    [`ticket_cooldown/${uid}`]: serverTimestamp(),
    ...extra
  });
}

const errorAmigable = (err) => {
  console.error(err);
  toast(String(err && err.message).includes('PERMISSION')
    ? t('Espera un minuto antes de enviar otro mensaje.', 'Wait a minute before sending another message.')
    : t('No se pudo enviar. Intenta de nuevo.', "Couldn't send. Try again."), 'alert');
};

// ---- Reportar un problema de un mod/base/script ----
let reportId = null;

window.abrirReporte = (id) => {
  if (window.exigirRegistro()) return;
  reportId = id;
  document.getElementById('report-target').textContent = titleOf(id);
  document.getElementById('report-reasons').innerHTML = Object.entries(REASONS).map(([k, [es, en]], i) => `
    <label class="reason">
      <input type="radio" name="reportReason" value="${k}" ${i === 0 ? 'checked' : ''}>
      <span>${t(es, en)}${k === 'broken' ? `<small>${t('Apaga la descarga para todos hasta que se repare.', 'Turns off the download for everyone until fixed.')}</small>` : ''}</span>
    </label>`).join('');
  document.getElementById('report-text').value = '';
  openPopup('report-popup');
};
window.reportError = window.abrirReporte;

window.enviarReporte = async () => {
  if (!reportId || window.exigirRegistro()) return;
  if (await FNF.checkBanStatus()) return;
  const reason = (document.querySelector('input[name="reportReason"]:checked') || {}).value || 'other';
  const details = document.getElementById('report-text').value.trim();
  const btn = document.getElementById('btn-enviar-reporte');
  btn.disabled = true;

  try {
    const extra = {};
    if (reason === 'broken' && !(window.brokenLinksData || {})[reportId]) {
      extra[`broken_links/${reportId}`] = {
        reportedBy: profileName(getProfile()).slice(0, 40), uid: window.usuarioActualFirebase.uid,
        reason: 'broken', timestamp: Date.now()
      };
    }
    const text = `${REASONS[reason][0]}${details ? '\n' + details : ''}`.slice(0, 600);
    await crearTicket({ type: 'report', reason, modId: reportId.slice(0, 40), text }, extra);
    closePopup('report-popup');
    window.closeDetail();
    toast(t('¡Gracias! El administrador ya recibió tu reporte.', 'Thanks! The admin got your report.'), 'alert');
    notifyTelegram(`🚨 REPORTE: ${REASONS[reason][0]}\n📦 ${titleOf(reportId)} (${reportId})\n👤 ${profileName(getProfile())}${details ? '\n💬 ' + details : ''}`);
  } catch (err) {
    errorAmigable(err);
  } finally {
    btn.disabled = false;
  }
};

// ---- Mensaje rápido (sección Redes) ----
window.enviarMensajeAlBot = async () => {
  if (window.exigirRegistro()) return;
  if (await FNF.checkBanStatus()) return;
  const box = document.getElementById('txt-mensaje-telegram');
  const btn = document.getElementById('btn-enviar-telegram');
  const msg = box.value.trim();
  if (!msg) return toast(t('¡Escribe un mensaje primero!', 'Write a message first!'), 'send');

  const label = btn.querySelector('span');
  btn.disabled = true;
  label.textContent = t('Enviando...', 'Sending...');
  try {
    await crearTicket({ type: 'support', text: msg.slice(0, 600) });
    box.value = '';
    toast(t('¡Mensaje enviado! Te responderé por aquí mismo.', "Message sent! I'll reply right here."), 'send');
    notifyTelegram(`💬 SOPORTE de ${profileName(getProfile())}:\n${msg}`);
  } catch (err) {
    errorAmigable(err);
  } finally {
    btn.disabled = false;
    label.textContent = t('Enviar mensaje', 'Send message');
  }
};
}).catch(err => console.error(err));
