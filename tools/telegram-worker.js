// =====================================================================
// Puente a Telegram + revisor de links (Cloudflare Worker, gratis) — v4
// ---------------------------------------------------------------------
// Para qué sirve: recibir en Telegram los reportes y mensajes de soporte
// SIN poner el token del bot dentro de la página (donde cualquiera lo ve).
//
// NUEVO en v4 (seguridad):
//  · Solo acepta peticiones de usuarios con sesión de Google iniciada en tu página
//    (el Worker revisa la firma del token de Firebase; un "curl" falso ya no pasa).
//  · Un usuario solo puede mandar un aviso justo después de crear un ticket real
//    (Firebase ya limita los tickets a 1 por minuto) y nunca si está baneado.
//  · El revisor de links solo lo puede usar el admin.
//  · Cada aviso lleva el UID de quien lo mandó, para que puedas banearlo si abusa.
//
// Cómo publicarlo:
//  1. https://dash.cloudflare.com → Workers & Pages → tu Worker → Edit code.
//  2. Borra todo, pega ESTE archivo completo y dale "Deploy".
//  3. En el Worker → Settings → Variables and Secrets:
//       TELEGRAM_TOKEN   (Secret) = el token de tu bot (BotFather). Sin espacios ni comillas.
//       TELEGRAM_CHAT_ID (Text)   = 5429172831
//       ALLOWED_ORIGIN   (Text)   = https://lalocf2.github.io
//          · Puedes poner varias separadas por coma, por ejemplo para probar con Live Server:
//            https://lalocf2.github.io,http://127.0.0.1:5500
//          · Sin "/" al final y sin la ruta (/fnf_ports): solo el dominio.
//     (Opcionales, ya vienen con tus datos: FIREBASE_PROJECT_ID, FIREBASE_DB_URL, ADMIN_UID)
//  4. Abre tu bot en Telegram y mándale /start (si nunca lo hiciste).
//  5. En la página: Panel de admin → Avisos → Telegram → pega la dirección del Worker → Guardar → Probar.
//  6. El mismo Worker sirve para Panel → Herramientas → Revisar links (no necesita nada extra).
// =====================================================================

const DEFAULTS = {
  FIREBASE_PROJECT_ID: 'fnf-mobile-lalocf',
  FIREBASE_DB_URL: 'https://fnf-mobile-lalocf-default-rtdb.firebaseio.com',
  ADMIN_UID: 'Mtsvw6hM8FYu19Sk3yPnbDLtfOf2'
};
const conf = (env, k) => String(env[k] || DEFAULTS[k]).trim().replace(/\/+$/, '');

// ---------------------------------------------------------------------
// Verificación del token de Firebase (firma RS256 con las llaves públicas de Google)
// ---------------------------------------------------------------------
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwkCache = { keys: [], exp: 0 };

async function googleKeys(force) {
  if (!force && jwkCache.keys.length && Date.now() < jwkCache.exp) return jwkCache.keys;
  const res = await fetch(JWK_URL);
  const data = await res.json();
  const maxAge = Number(((res.headers.get('cache-control') || '').match(/max-age=(\d+)/) || [])[1]) || 3600;
  jwkCache = { keys: data.keys || [], exp: Date.now() + maxAge * 1000 };
  return jwkCache.keys;
}

const b64urlBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

// Devuelve el UID si el token es válido; si no, null
async function verificarToken(token, projectId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try { header = b64urlJson(parts[0]); payload = b64urlJson(parts[1]); } catch (e) { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid) return null;
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
  if (!(payload.exp > now) || !(payload.iat <= now + 300)) return null;

  let jwk = (await googleKeys()).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find(k => k.kid === header.kid); // Google rotó sus llaves
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  return ok ? payload.sub : null;
}

// Lee un dato de tu Realtime Database con los permisos del propio usuario
async function leerDB(env, path, token) {
  const res = await fetch(`${conf(env, 'FIREBASE_DB_URL')}/${path}.json?auth=${encodeURIComponent(token)}`);
  if (!res.ok) return undefined;
  return res.json().catch(() => undefined);
}

// Cada ticket da derecho a UN aviso (memoria del Worker: evita que reenvíen la misma petición)
const usados = new Map();
function yaUsado(clave) {
  const ahora = Date.now();
  for (const [k, t] of usados) if (ahora - t > 10 * 60000) usados.delete(k);
  if (usados.has(clave)) return true;
  usados.set(clave, ahora);
  return false;
}

// ---------------------------------------------------------------------
// Revisor de links
// ---------------------------------------------------------------------
async function revisar(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) FNF-Ports-LinkCheck' } });
    clearTimeout(timer);
    const host = new URL(url).hostname;
    const final = res.url || url;
    if (res.status === 404 || res.status === 410) return { estado: 'caido', motivo: `Error ${res.status} (no existe)` };
    if (res.status === 403 || res.status === 429) return { estado: 'dudoso', motivo: 'El sitio bloqueó la revisión' };
    if (res.status >= 500) return { estado: 'dudoso', motivo: `El servidor respondió ${res.status}` };
    if (res.status >= 400) return { estado: 'caido', motivo: `Error ${res.status}` };

    const tipo = res.headers.get('content-type') || '';
    if (!tipo.includes('text/html')) {
      try { if (res.body) await res.body.cancel(); } catch (e) { /* archivo directo: no hace falta descargarlo */ }
      return { estado: 'ok', motivo: 'Archivo directo' };
    }
    const html = (await res.text()).slice(0, 400000).toLowerCase();
    if (host.includes('mediafire')) {
      if (final.includes('/error.php') || html.includes('invalid or deleted file') || html.includes('file removed') || html.includes('has been removed')) return { estado: 'caido', motivo: 'MediaFire: archivo borrado' };
      if (html.includes('downloadbutton') || html.includes('download_link') || html.includes('aria-label="download file"')) return { estado: 'ok', motivo: 'MediaFire' };
      return { estado: 'dudoso', motivo: 'MediaFire no mostró el botón de descarga' };
    }
    if (host.includes('drive.google') || host.includes('docs.google') || host.includes('drive.usercontent')) {
      if (html.includes('requested does not exist') || (html.includes('lo sentimos') && html.includes('no existe'))) return { estado: 'caido', motivo: 'Drive: el archivo no existe' };
      if (final.includes('accounts.google.com')) return { estado: 'dudoso', motivo: 'Drive pide iniciar sesión (archivo privado)' };
      return { estado: 'ok', motivo: 'Google Drive' };
    }
    if (host.includes('gamebanana') && (html.includes('withheld') || html.includes('has been trashed'))) return { estado: 'caido', motivo: 'GameBanana: retirado' };
    return { estado: 'ok', motivo: `Página (${res.status})` };
  } catch (e) {
    return { estado: 'dudoso', motivo: e.name === 'AbortError' ? 'Tardó demasiado en responder' : 'No se pudo conectar' };
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || '')
      .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const permitido = !allowed.length || allowed.includes(origin);

    // Se responde con el origen de quien pregunta para que la página pueda leer el error y explicarlo
    const cors = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: cors });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method === 'GET') {
      return reply(200, {
        ok: true, mensaje: 'El Worker está funcionando ✅', version: 4, revisor_links: true, requiere_sesion: true,
        token_configurado: !!env.TELEGRAM_TOKEN, chat_configurado: !!env.TELEGRAM_CHAT_ID, origenes_permitidos: allowed
      });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'Solo se acepta POST' });
    if (!permitido) return reply(403, { ok: false, error: `Origen no permitido: ${origin || '(vacío)'}` });

    let body = {};
    try { body = JSON.parse(await request.text()) || {}; } catch (e) { /* cuerpo inválido */ }

    // ---- ¿Quién es? (sesión de Google en tu página) ----
    const token = String(body.token || '');
    const uid = await verificarToken(token, conf(env, 'FIREBASE_PROJECT_ID')).catch(() => null);
    if (!uid) return reply(401, { ok: false, error: 'Sesión no válida: inicia sesión con Google en la página' });
    const esAdmin = uid === conf(env, 'ADMIN_UID');

    // ---- Revisor de links: { check: ["https://...", ...] } (máximo 20 por vez, solo el admin) ----
    if (Array.isArray(body.check)) {
      if (!esAdmin) return reply(403, { ok: false, error: 'Solo el admin puede revisar links' });
      const urls = body.check.filter(u => /^https?:\/\//i.test(String(u))).slice(0, 20);
      const results = await Promise.all(urls.map(revisar));
      return reply(200, { ok: true, results });
    }

    // ---- Aviso a Telegram: { text: "...", token } ----
    if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return reply(500, { ok: false, error: 'Faltan las variables TELEGRAM_TOKEN o TELEGRAM_CHAT_ID en el Worker' });
    let text = String(body.text || '').slice(0, 1000);
    if (!text.trim()) return reply(400, { ok: false, error: 'Falta el texto del mensaje' });

    if (!esAdmin) {
      // Baneado = sin avisos
      const ban = await leerDB(env, `banned_users/${uid}`, token);
      if (ban && Number(ban.expiresAt) > Date.now()) return reply(403, { ok: false, error: 'Usuario baneado' });
      // Debe haber creado un ticket hace menos de 2 minutos (Firebase limita los tickets a 1 por minuto)
      const ultimoTicket = Number(await leerDB(env, `ticket_cooldown/${uid}`, token)) || 0;
      if (Date.now() - ultimoTicket > 120000) return reply(429, { ok: false, error: 'No hay un ticket reciente: el aviso se manda solo al crear un reporte o mensaje' });
      if (yaUsado(`${uid}:${ultimoTicket}`)) return reply(429, { ok: false, error: 'Ese ticket ya envió su aviso' });
      text += `\n🆔 ${uid}`;
    }

    const tg = await fetch(`https://api.telegram.org/bot${String(env.TELEGRAM_TOKEN).trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(env.TELEGRAM_CHAT_ID).trim(), text })
    });
    const data = await tg.json().catch(() => ({}));
    if (!data.ok) return reply(502, { ok: false, error: `Telegram: ${data.description || tg.status}` });
    return reply(200, { ok: true });
  }
};
