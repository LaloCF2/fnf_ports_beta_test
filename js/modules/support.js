// Reportes de problemas y mensajes de soporte.
// Todo se guarda en Firebase (support_tickets) y lo ves en Panel de admin → Reportes.
// El token de Telegram YA NO está en la página: si quieres avisos en Telegram,
// publica tools/telegram-worker.js en Cloudflare y pega aquí su dirección.
window.fbReady.then((FB) => {
const { db, ref, get, update, push, serverTimestamp } = FB;
const { t, esc, openPopup, closePopup, toast, getProfile, profileName } = FNF;

const TELEGRAM_PROXY_URL = 'https://telegram-proxy.ec331325.workers.dev/'; // ej: 'https://fnf-telegram.tu-usuario.workers.dev'

const REASONS = {
  broken: ['🔗 El link está caído', '🔗 The link is down'],
  corrupt: ['📦 No descarga o el archivo está dañado', '📦 Download fails or file is corrupt'],
  crash: ['💥 El juego se cierra o no abre', '💥 The game crashes or won\'t open'],
  missing: ['🧩 Falta contenido (canciones, personajes...)', '🧩 Missing content'],
  other: ['✏️ Otro problema', '✏️ Something else']
};

// La dirección del Worker se guarda desde Panel de admin → Avisos → Telegram (o aquí arriba en el código)
const proxyUrl = () => {
  const cfg = (window.live && window.live.config) || {};
  return (cfg.telegram && cfg.telegram.url) || TELEGRAM_PROXY_URL;
};

// Envía un texto al bot. Devuelve { ok, ayuda } con una explicación clara si falla.
window.enviarAvisoTelegram = async (text, url = proxyUrl()) => {
  if (!url) return { ok: false, ayuda: 'No hay dirección del Worker guardada (Panel → Avisos → Telegram).' };
  let res;
  try {
    // text/plain evita la "consulta previa" del navegador, así funciona con cualquier versión del Worker
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ text }) });
  } catch (err) {
    const aqui = location.origin === 'null' ? 'un archivo abierto con doble clic' : location.origin;
    return {
      ok: false,
      ayuda: `No se pudo hablar con el Worker. Puede ser: 1) la dirección está mal (debe terminar en .workers.dev y tener "Deploy"), ` +
        `o 2) el Worker no acepta ${aqui}: en ALLOWED_ORIGIN pon ${location.origin === 'null' ? 'https://lalocf2.github.io y prueba desde ahí' : location.origin}.`
    };
  }
  const body = await res.text().catch(() => '');
  let data = {};
  try { data = JSON.parse(body); } catch (e) { data = { error: body }; }
  if (res.ok && data.ok !== false) return { ok: true };

  const err = String(data.error || body || res.status);
  const origin = location.origin === 'null' ? 'archivo local (file://)' : location.origin;
  let ayuda = `Error del Worker (${res.status}): ${err}`;
  if (res.status === 403 || /origen/i.test(err)) {
    ayuda = `El Worker no acepta esta página (${origin}). En Cloudflare → tu Worker → Settings → Variables, pon en ALLOWED_ORIGIN exactamente: ${location.origin}` +
      (location.origin.includes('lalocf2.github.io') ? '' : ' (o prueba desde lalocf2.github.io)');
  } else if (/unauthorized|401/i.test(err)) {
    ayuda = 'Telegram rechazó el token del bot. Copia el token NUEVO de BotFather en la variable secreta TELEGRAM_TOKEN del Worker (sin espacios) y vuelve a hacer Deploy.';
  } else if (/chat not found|400/i.test(err)) {
    ayuda = 'Telegram no encuentra el chat. Abre tu bot en Telegram, mándale /start y revisa que TELEGRAM_CHAT_ID sea 5429172831.';
  } else if (err === 'error' && res.status === 502) {
    ayuda = 'Telegram rechazó el mensaje (token o chat incorrectos). Pega el nuevo tools/telegram-worker.js en Cloudflare para ver el error exacto.';
  } else if (/falta el texto/i.test(err)) {
    ayuda = 'Tu Worker es la versión anterior. Pega el nuevo tools/telegram-worker.js en Cloudflare y dale Deploy.';
  }
  return { ok: false, ayuda };
};

const notifyTelegram = (text) => {
  if (!proxyUrl()) return;
  window.enviarAvisoTelegram(text).then(r => { if (!r.ok) console.warn('Telegram:', r.ayuda); });
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
window.crearTicketSoporte = async (ticket) => {
  await crearTicket(ticket);
  notifyTelegram(`🗑️ SOLICITUD DE BORRAR CUENTA de ${profileName(getProfile())}`);
};

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
