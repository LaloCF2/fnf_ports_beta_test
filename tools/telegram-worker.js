
const DEFAULTS = {
  FIREBASE_PROJECT_ID: 'fnf-mobile-lalocf',
  FIREBASE_DB_URL: 'https://fnf-mobile-lalocf-default-rtdb.firebaseio.com',
  ADMIN_UID: 'Mtsvw6hM8FYu19Sk3yPnbDLtfOf2'
};
const conf = (env, k) => String(env[k] || DEFAULTS[k]).trim().replace(/\/+$/, '');


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

async function leerDB(env, path, token) {
  const res = await fetch(`${conf(env, 'FIREBASE_DB_URL')}/${path}.json?auth=${encodeURIComponent(token)}`);
  if (!res.ok) return undefined;
  return res.json().catch(() => undefined);
}

const usados = new Map();
function yaUsado(clave) {
  const ahora = Date.now();
  for (const [k, t] of usados) if (ahora - t > 10 * 60000) usados.delete(k);
  if (usados.has(clave)) return true;
  usados.set(clave, ahora);
  return false;
}

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

const SITE_DEFAULT = 'https://lalocf2.github.io/fnf_ports/';
const sitio = (env) => String(env.SITE_URL || SITE_DEFAULT).trim().replace(/\/*$/, '/');
const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bloqueDe(js, id) {
  const m = new RegExp(`(^|[\\s,{])["']?${id}["']?\\s*:\\s*\\{`).exec(js);
  if (!m) return '';
  let i = m.index + m[0].length - 1, nivel = 0, comilla = null;
  for (let j = i; j < js.length && j < i + 20000; j++) {
    const c = js[j];
    if (comilla) { if (c === '\\') j++; else if (c === comilla) comilla = null; continue; }
    if (c === '"' || c === "'" || c === '`') comilla = c;
    else if (c === '{') nivel++;
    else if (c === '}' && --nivel === 0) return js.slice(i, j + 1);
  }
  return '';
}
const campo = (bloque, k) => {
  const m = new RegExp(`\\b${k}\\s*:\\s*(["'\`])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1`).exec(bloque);
  return m ? m[2].replace(/\\(.)/g, '$1') : '';
};

async function datosItem(env, id) {
  const tipo = id.startsWith('apk') ? ['apks_custom', 'data-apks.js'] : id.startsWith('script') ? ['scripts_custom', 'data-scripts.js'] : ['mods_custom', 'data-mods.js'];
  const db = conf(env, 'FIREBASE_DB_URL');
  const [js, custom, dl, ratings] = await Promise.all([
    fetch(`${sitio(env)}js/modules/${tipo[1]}`, { cf: { cacheTtl: 600 } }).then(r => r.ok ? r.text() : '').catch(() => ''),
    fetch(`${db}/${tipo[0]}/${id}.json`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${db}/downloads/${id}.json`).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${db}/ratings/${id}.json`).then(r => r.ok ? r.json() : null).catch(() => null)
  ]);
  const b = bloqueDe(js, id);
  let d = b ? { title: campo(b, 'title'), img: campo(b, 'img'), desc: campo(b, 'desc'), hidden: /\bhidden\s*:\s*true/.test(b), draft: /\bdraft\s*:\s*true/.test(b) } : {};
  if (custom) {
    if (custom.removed) return null;
    d = { ...d, ...['title', 'img', 'desc', 'hidden', 'draft'].reduce((o, k) => (custom[k] != null ? { ...o, [k]: custom[k] } : o), {}) };
    if (!d.img && Array.isArray(custom.images)) d.img = custom.images[0];
  }
  if (!d.title || d.hidden || d.draft) return null; // secretos y borradores no se muestran
  const votos = Object.values(ratings || {}).filter(v => typeof v === 'number');
  return {
    ...d,
    descargas: Number(dl) || 0,
    estrellas: votos.length ? (votos.reduce((a, v) => a + v, 0) / votos.length).toFixed(1) : null
  };
}

async function vistaPrevia(env, id, url) {
  const site = sitio(env);
  const destino = `${site}?share=${encodeURIComponent(id)}`;
  const d = /^[\w-]{1,60}$/.test(id) ? await datosItem(env, id).catch(() => null) : null;
  const titulo = d ? d.title : "FNF' Ports Mobile";
  const datos = d ? [d.descargas ? `📥 ${d.descargas.toLocaleString('en-US')} descargas` : '', d.estrellas ? `⭐ ${d.estrellas}` : ''].filter(Boolean).join(' · ') : '';
  const texto = String(d && d.desc ? d.desc : 'Los mejores ports de Friday Night Funkin\' para móvil: bases, mods y scripts optimizados.').replace(/\/n|\s+/g, ' ').trim().slice(0, 180);
  const descripcion = datos ? `${datos} — ${texto}` : texto;
  const img = d && d.img ? (/^https?:\/\//i.test(d.img) ? d.img : site + d.img.replace(/^\.?\//, '')) : `${site}assets/icons/logo512.png`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHTML(titulo)} · FNF' Ports</title>
<meta name="description" content="${escHTML(descripcion)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FNF' Ports Mobile">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="${escHTML(titulo)}">
<meta property="og:description" content="${escHTML(descripcion)}">
<meta property="og:image" content="${escHTML(img)}">
<meta property="og:url" content="${escHTML(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHTML(titulo)}">
<meta name="twitter:description" content="${escHTML(descripcion)}">
<meta name="twitter:image" content="${escHTML(img)}">
<meta name="theme-color" content="#b14fe0">
<link rel="canonical" href="${escHTML(destino)}">
<meta http-equiv="refresh" content="0;url=${escHTML(destino)}">
</head><body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 20px;background:#fbd9f1;color:#2a2140">
<p>Abriendo <b>${escHTML(titulo)}</b>…</p><p><a href="${escHTML(destino)}" style="color:#8a3fd0">Toca aquí si no se abre solo</a></p>
<script>location.replace(${JSON.stringify(destino).replace(/</g, '\\u003c')})</script>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || '')
      .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
    const permitido = !allowed.length || allowed.includes(origin);

    const cors = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: cors });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method === 'GET') {
      const ruta = new URL(request.url).pathname;
      const share = ruta.match(/^\/m\/([^/]+)\/?$/);
      if (share) {
        let id = '';
        try { id = decodeURIComponent(share[1]); } catch (e) { /* enlace mal escrito */ }
        return vistaPrevia(env, id, request.url);
      }
      return reply(200, {
        ok: true, mensaje: 'El Worker está funcionando ✅', version: 5, revisor_links: true, requiere_sesion: true, vista_previa: true,
        token_configurado: !!env.TELEGRAM_TOKEN, chat_configurado: !!env.TELEGRAM_CHAT_ID, origenes_permitidos: allowed
      });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'Solo se acepta POST' });
    if (!permitido) return reply(403, { ok: false, error: `Origen no permitido: ${origin || '(vacío)'}` });

    let body = {};
    try { body = JSON.parse(await request.text()) || {}; } catch (e) { /* cuerpo inválido */ }

    const token = String(body.token || '');
    const uid = await verificarToken(token, conf(env, 'FIREBASE_PROJECT_ID')).catch(() => null);
    if (!uid) return reply(401, { ok: false, error: 'Sesión no válida: inicia sesión con Google en la página' });
    const esAdmin = uid === conf(env, 'ADMIN_UID');

    if (Array.isArray(body.check)) {
      if (!esAdmin) return reply(403, { ok: false, error: 'Solo el admin puede revisar links' });
      const urls = body.check.filter(u => /^https?:\/\//i.test(String(u))).slice(0, 20);
      const results = await Promise.all(urls.map(revisar));
      return reply(200, { ok: true, results });
    }

    if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return reply(500, { ok: false, error: 'Faltan las variables TELEGRAM_TOKEN o TELEGRAM_CHAT_ID en el Worker' });
    let text = String(body.text || '').slice(0, 1000);
    if (!text.trim()) return reply(400, { ok: false, error: 'Falta el texto del mensaje' });

    if (!esAdmin) {
      const ban = await leerDB(env, `banned_users/${uid}`, token);
      if (ban && Number(ban.expiresAt) > Date.now()) return reply(403, { ok: false, error: 'Usuario baneado' });
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
