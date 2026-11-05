// Panel de admin — Avisos: banner, mantenimiento, campana, aviso emergente y Telegram.
window.fbReady.then((FB) => {
const { db, ref, set, update, remove } = FB;
const { esc, fi, toast, timeAgo, fmtDateTime } = FNF;
const A = window.ADMIN;
const live = A.live;

A.ui.aviso = 'banner';
const SUBS = [
  ['banner', 'Banner', 'megaphone'],
  ['mantenimiento', 'Mantenimiento', 'tools'],
  ['campana', 'Campana', 'bell'],
  ['emergente', 'Emergente', 'bolt'],
  ['telegram', 'Telegram', 'telegram']
];
const val = (id) => document.getElementById(id).value.trim();
const cfg = () => live().config || {};
const fecha = (d) => d.toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const head = (ic, title, estado, desc) => `
  <div class="av-head">
    <span class="av-icon">${fi(ic, 34)}</span>
    <div class="grow"><h3>${title}</h3><p>${desc}</p></div>
    ${estado}
  </div>`;

const PANELS = {
  banner() {
    const b = cfg().banner || {};
    return `<div class="card glass">
      ${head('megaphone', 'Banner en toda la página', b.active ? A.pill('Activo', 'var(--ok)') : A.pill('Apagado', '#8a7f99'), 'Una franja arriba de la página que ven todos.')}
      <label class="label">Vista previa</label>
      <div id="av-banner-preview" class="site-banner glass banner-${esc(b.type || 'info')}" style="margin-bottom:12px">
        <svg class="icon icon-sm"><use href="#i-bell"/></svg><span>${esc(b.text || 'Escribe tu mensaje…')}</span>
      </div>
      <div class="stack">
        <textarea id="adm-banner-text" class="field" maxlength="200" placeholder="Ej: ¡Nuevo mod este fin de semana!" oninput="adminBannerPreview()">${esc(b.text || '')}</textarea>
        <div class="adm-row">
          <select id="adm-banner-type" class="field" onchange="adminBannerPreview()">
            <option value="info" ${b.type === 'info' ? 'selected' : ''}>Información (morado)</option>
            <option value="success" ${b.type === 'success' ? 'selected' : ''}>Buena noticia (verde)</option>
            <option value="warn" ${b.type === 'warn' ? 'selected' : ''}>Advertencia (amarillo)</option>
          </select>
          <label class="setting-row" style="border:0;padding:0;gap:10px">Activo <span class="switch"><input type="checkbox" id="adm-banner-on" ${b.active ? 'checked' : ''}><span></span></span></label>
        </div>
        <div class="adm-actions">
          ${A.btn('check', 'Guardar banner', 'adminGuardarBanner()', 'btn')}
          ${b.active ? A.btn('hide', 'Apagar ahora', 'adminApagarBanner()') : ''}
        </div>
        ${b.updatedAt ? `<p class="adm-count">Última vez guardado: ${fmtDateTime(b.updatedAt)}</p>` : ''}
        ${A.note('cada vez que guardas, el banner vuelve a aparecer aunque alguien lo haya cerrado antes. Úsalo para avisos cortos y temporales.')}
      </div>
    </div>`;
  },

  mantenimiento() {
    const m = cfg().maintenance || {};
    return `<div class="card glass">
      ${head('tools', 'Modo mantenimiento', m.active ? A.pill('ACTIVO', 'var(--danger)') : A.pill('Apagado', '#8a7f99'), 'Tapa toda la página con un mensaje, menos para ti.')}
      <div class="stack">
        <textarea id="adm-maint-text" class="field" maxlength="200" placeholder="Ej: Estamos subiendo mods nuevos, volvemos en 30 minutos">${esc(m.message || '')}</textarea>
        <label class="setting-row" style="border:0;padding:0">Activar mantenimiento <span class="switch"><input type="checkbox" id="adm-maint-on" ${m.active ? 'checked' : ''}><span></span></span></label>
        <div class="adm-actions">
          ${A.btn('check', 'Guardar', 'adminGuardarMantenimiento()', m.active ? 'btn-danger' : 'btn')}
          ${A.btn('eye', 'Ver cómo se ve', 'adminVistaMantenimiento()')}
        </div>
        ${A.note('úsalo solo mientras haces cambios grandes. Mientras esté activo nadie puede descargar ni comentar; no olvides apagarlo al terminar.')}
      </div>
    </div>`;
  },

  campana() {
    const notifs = [...(window.liveNotifs || [])].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    const programadas = notifs.filter(n => n.publishAt && n.publishAt > Date.now()).length;
    const opts = Object.entries(FNF.KINDS).map(([, k]) =>
      `<optgroup label="${k.label}">${Object.entries(window[k.data] || {}).map(([id, d]) => `<option value="${esc(id)}">${esc(d.title)}</option>`).join('')}</optgroup>`).join('');
    return `<div class="card glass">
      ${head('bell', 'Notificaciones de la campana', A.pill(`${notifs.length} publicadas`, 'var(--accent)'), 'Avisos que quedan guardados en la campana de todos.')}
      <div class="stack">
        <textarea id="adm-notif-text" class="field" maxlength="300" placeholder="Aviso para los usuarios..."></textarea>
        <label class="label" for="adm-notif-mod">Enlazar a un mod, base o script (opcional)</label>
        <select id="adm-notif-mod" class="field"><option value="">— Ninguno —</option>${opts}</select>
        <label class="label" for="adm-notif-when">Programar para más tarde (opcional)</label>
        <input type="datetime-local" id="adm-notif-when" class="field">
        ${A.btn('send', 'Publicar', 'adminPublicarNotificacion()', 'btn')}
        ${A.note('si la enlazas, el usuario puede tocarla para abrir ese mod. Si la programas, aparece sola a la hora elegida.')}
      </div>
    </div>
    <div class="card glass">
      <h3>${fi('history', 20)} Publicadas ${programadas ? A.pill(`${programadas} programadas`, 'var(--warn)') : ''}</h3>
      <div id="adm-notif-list" class="list"></div>
    </div>`;
  },

  emergente() {
    const last = window.lastToastData;
    return `<div class="card glass">
      ${head('bolt', 'Aviso emergente', last && Date.now() - last.timestamp < 86400000 ? A.pill('En curso', 'var(--ok)') : A.pill('Sin aviso', '#8a7f99'), 'Un globito que aparece una sola vez arriba de la pantalla.')}
      ${last ? `<div class="rep-text" style="margin-bottom:12px">${fi('history', 16)} Último: "${esc(last.message)}" · ${fmtDateTime(last.timestamp)} (${timeAgo(last.timestamp)})</div>` : ''}
      <div class="stack">
        <textarea id="globalNotifText" class="field" maxlength="200" placeholder="Ej: ¡Nuevo mod disponible!"></textarea>
        <div class="adm-actions">
          ${A.btn('eye', 'Vista previa', "showToast(document.getElementById('globalNotifText').value || 'Vista previa del aviso')")}
          ${A.btn('send', 'Enviar aviso', 'adminEnviarToast()', 'btn')}
        </div>
        ${A.note('lo ve quien entre a la página en las próximas 24 horas, una sola vez. Para avisos que deben quedarse, usa la Campana.')}
      </div>
    </div>`;
  },

  telegram() {
    const tg = cfg().telegram || {};
    return `<div class="card glass">
      ${head('telegram', 'Avisos en Telegram', tg.url ? A.pill('Configurado', 'var(--ok)') : A.pill('Sin configurar', '#8a7f99'), 'Te llega al bot cada reporte, mensaje de soporte y solicitud de borrar cuenta.')}
      <div class="stack">
        <label class="label" for="adm-tg-url">Dirección del Worker de Cloudflare</label>
        <input type="url" id="adm-tg-url" class="field" placeholder="https://fnf-telegram.tuusuario.workers.dev" value="${esc(tg.url || '')}">
        <div class="adm-actions">
          ${A.btn('check', 'Guardar', 'adminGuardarTelegram()', 'btn')}
          ${A.btn('send', 'Enviar prueba', 'adminProbarTelegram()', 'btn-soft')}
          ${A.btn('search', 'Revisar el Worker', 'adminRevisarWorker()')}
        </div>
        <p id="adm-tg-result" class="tg-result" hidden></p>
        ${A.note('el token del bot vive solo en Cloudflare, nunca en la página. "Revisar el Worker" te dice si tiene el token, el chat y qué páginas acepta.')}
      </div>
    </div>`;
  }
};

A.TAB.avisos = {
  shell: () => `
    <div class="chips sub-chips">
      ${SUBS.map(([k, label, ic]) => `<button class="chip${A.ui.aviso === k ? ' active' : ''}" onclick="adminIrAvisos('${k}')">${fi(ic, 16)} ${label}</button>`).join('')}
    </div>
    <div id="av-panel">${PANELS[A.ui.aviso]()}</div>`,
  list() {
    const el = document.getElementById('adm-notif-list');
    if (!el) return;
    const notifs = [...(window.liveNotifs || [])].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    el.innerHTML = notifs.length ? notifs.map(n => {
      const pend = n.publishAt && n.publishAt > Date.now();
      return `<div class="notif-item">
        ${pend ? A.pill(`Programada: ${fmtDateTime(n.publishAt)}`, 'var(--warn)') : ''}
        <p>${esc(n.texto)}</p>
        <small>${esc(n.fecha)}${n.modId ? ' · ' + esc(A.allTitle(n.modId)) : ''}</small>
        <div class="row">
          ${A.btn('edit', 'Editar', `adminEditarNotificacion('${esc(n.id)}')`, 'btn-soft')}
          ${A.btn('copy', 'Repetir', `adminRepetirNotificacion('${esc(n.id)}')`)}
          ${A.btn('trash', 'Borrar', `adminBorrarNotificacion('${esc(n.id)}')`, 'btn-danger')}
        </div>
      </div>`;
    }).join('') : `<p class="empty">No hay notificaciones.</p>`;
  }
};

window.adminIrAvisos = (sub) => {
  A.ui.aviso = sub;
  if (window.currentSection && window.currentSection() !== 'admin') window.selectSection('admin');
  window.renderAdminTab('avisos');
};

// ---- Banner ----
window.adminBannerPreview = () => {
  const p = document.getElementById('av-banner-preview');
  p.className = `site-banner glass banner-${document.getElementById('adm-banner-type').value}`;
  p.querySelector('span').textContent = val('adm-banner-text') || 'Escribe tu mensaje…';
};
window.adminGuardarBanner = async () => {
  const data = { text: val('adm-banner-text'), type: document.getElementById('adm-banner-type').value, active: document.getElementById('adm-banner-on').checked, updatedAt: Date.now() };
  if (data.active && !data.text) return toast('Escribe el texto del banner.', 'alert');
  await set(ref(db, 'site_config/banner'), data);
  A.log('notice:banner', data.active ? `Publicó el banner: "${data.text.slice(0, 80)}"` : 'Guardó el banner apagado');
  toast('Banner guardado.', 'megaphone');
  setTimeout(() => window.renderAdminTab('avisos'), 300);
};
window.adminApagarBanner = async () => {
  await update(ref(db, 'site_config/banner'), { active: false });
  A.log('notice:banner', 'Apagó el banner');
  toast('Banner apagado.', 'hide');
  setTimeout(() => window.renderAdminTab('avisos'), 300);
};

// ---- Mantenimiento ----
window.adminGuardarMantenimiento = async () => {
  const active = document.getElementById('adm-maint-on').checked;
  if (active && !confirm('¿Activar el modo mantenimiento? Nadie más podrá usar la página hasta que lo apagues.')) return;
  await set(ref(db, 'site_config/maintenance'), { active, message: val('adm-maint-text') });
  A.log('config:maintenance', active ? 'Activó el modo mantenimiento' : 'Apagó el modo mantenimiento');
  toast(active ? 'Mantenimiento ACTIVADO.' : 'Mantenimiento apagado.', 'tools');
  setTimeout(() => window.renderAdminTab('avisos'), 300);
};
// Muestra la pantalla de mantenimiento al admin por unos segundos (toca para cerrarla)
window.adminVistaMantenimiento = () => {
  const screen = document.getElementById('maintenance-screen');
  document.getElementById('maintenance-text').textContent = val('adm-maint-text') || 'Estamos mejorando la página. ¡Vuelve en un rato!';
  screen.classList.remove('hidden');
  const cerrar = () => { screen.classList.add('hidden'); screen.removeEventListener('click', cerrar); };
  setTimeout(() => screen.addEventListener('click', cerrar), 300);
  toast('Vista previa: toca la pantalla para cerrarla.', 'eye');
};

// ---- Campana ----
window.adminPublicarNotificacion = async () => {
  const texto = val('adm-notif-text');
  if (!texto) return toast('Escribe el aviso.', 'bell');
  const when = val('adm-notif-when');
  const publishAt = when ? new Date(when).getTime() : null;
  const id = 'notif_' + Date.now();
  const data = { id, texto, fecha: fecha(publishAt ? new Date(publishAt) : new Date()) };
  const modId = document.getElementById('adm-notif-mod').value;
  if (modId) data.modId = modId;
  if (publishAt && publishAt > Date.now()) data.publishAt = publishAt;
  await set(ref(db, 'notificaciones/' + id), data);
  A.log('notice:bell', `${data.publishAt ? 'Programó' : 'Publicó'} en la campana: "${texto.slice(0, 80)}"`);
  document.getElementById('adm-notif-text').value = '';
  document.getElementById('adm-notif-when').value = '';
  toast(data.publishAt ? 'Notificación programada.' : 'Notificación publicada.', 'bell');
};
window.adminEditarNotificacion = (id) => {
  const actual = (window.liveNotifs || []).find(n => n.id === id);
  const nuevo = prompt('Edita la notificación:', actual ? actual.texto : '');
  if (!nuevo || !nuevo.trim()) return;
  update(ref(db, 'notificaciones/' + id), { texto: nuevo.trim() });
  A.log('notice:bell', `Editó una notificación: "${nuevo.trim().slice(0, 80)}"`);
};
window.adminRepetirNotificacion = async (id) => {
  const n = (window.liveNotifs || []).find(x => x.id === id);
  if (!n || !confirm('¿Publicarla otra vez como nueva? (Les vuelve a aparecer el numerito de la campana.)')) return;
  const nid = 'notif_' + Date.now();
  const data = { id: nid, texto: n.texto, fecha: fecha(new Date()) };
  if (n.modId) data.modId = n.modId;
  await set(ref(db, 'notificaciones/' + nid), data);
  A.log('notice:bell', `Repitió la notificación: "${n.texto.slice(0, 80)}"`);
  toast('Publicada otra vez.', 'bell');
};
window.adminBorrarNotificacion = (id) => {
  const n = (window.liveNotifs || []).find(x => x.id === id);
  if (!confirm('¿Borrar esta notificación?')) return;
  remove(ref(db, 'notificaciones/' + id));
  A.log('notice:bell', `Borró la notificación: "${n ? n.texto.slice(0, 80) : id}"`);
};

// ---- Emergente ----
window.adminEnviarToast = async () => {
  const message = val('globalNotifText');
  if (!message) return toast('Escribe un mensaje primero.', 'bolt');
  await set(ref(db, 'notifications/latest'), { message, timestamp: Date.now(), id: Math.random().toString(36).slice(2, 11) });
  A.log('notice:toast', `Envió el aviso emergente: "${message.slice(0, 80)}"`);
  document.getElementById('globalNotifText').value = '';
  toast('Aviso enviado.', 'bolt');
  setTimeout(() => window.renderAdminTab('avisos'), 500);
};

// ---- Telegram ----
window.adminGuardarTelegram = async () => {
  const url = val('adm-tg-url').replace(/\/+$/, '');
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) return toast('La dirección debe empezar con https://', 'alert');
  await set(ref(db, 'site_config/telegram'), url ? { url } : null);
  A.log('config:telegram', url ? 'Guardó la dirección del Worker de Telegram' : 'Desactivó los avisos de Telegram');
  toast(url ? 'Dirección guardada. Ahora toca "Enviar prueba".' : 'Avisos de Telegram desactivados.', 'telegram');
};
const tgResult = (ok, msg) => { const out = document.getElementById('adm-tg-result'); out.hidden = false; out.className = 'tg-result ' + (ok ? 'ok' : 'bad'); out.textContent = msg; };
window.adminProbarTelegram = async () => {
  const url = val('adm-tg-url').replace(/\/+$/, '');
  if (!url) return tgResult(false, 'Primero pega la dirección del Worker.');
  tgResult(true, 'Enviando mensaje de prueba…');
  const r = await window.enviarAvisoTelegram('✅ Prueba desde el panel de FNF\' Ports. ¡Los avisos funcionan!', url);
  tgResult(r.ok, r.ok ? '¡Listo! Revisa tu bot de Telegram.' : r.ayuda);
};
window.adminRevisarWorker = async () => {
  const url = val('adm-tg-url').replace(/\/+$/, '');
  if (!url) return tgResult(false, 'Primero pega la dirección del Worker.');
  tgResult(true, 'Revisando…');
  try {
    const r = await fetch(url);
    const d = await r.json();
    if (d.token_configurado === undefined) return tgResult(false, 'El Worker responde, pero es la versión anterior. Pega el nuevo tools/telegram-worker.js en Cloudflare para ver más detalles.');
    const origen = location.origin;
    const acepta = !d.origenes_permitidos.length || d.origenes_permitidos.includes(origen);
    tgResult(d.token_configurado && d.chat_configurado && acepta,
      `Worker funcionando. Token: ${d.token_configurado ? 'sí' : 'FALTA'} · Chat: ${d.chat_configurado ? 'sí' : 'FALTA'} · ` +
      `Acepta esta página (${origen}): ${acepta ? 'sí' : 'NO — agrégala en ALLOWED_ORIGIN'} · Revisor de links: ${d.revisor_links ? 'sí' : 'no (actualiza el Worker)'} · ` +
      `Protegido con sesión: ${d.requiere_sesion ? 'sí' : 'NO — pega el nuevo tools/telegram-worker.js (v4) en Cloudflare'}`);
  } catch (err) {
    tgResult(false, 'No se pudo conectar con el Worker. Revisa la dirección y que esté publicado ("Deploy").');
  }
};
}).catch(err => console.error(err));
