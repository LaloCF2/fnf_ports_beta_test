// =====================================================================
// Puente a Telegram + revisor de links (Cloudflare Worker, gratis) — v3
// ---------------------------------------------------------------------
// Para qué sirve: recibir en Telegram los reportes y mensajes de soporte
// SIN poner el token del bot dentro de la página (donde cualquiera lo ve).
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
//  4. Abre tu bot en Telegram y mándale /start (si nunca lo hiciste).
//  5. En la página: Panel de admin → Avisos → Telegram → pega la dirección del Worker → Guardar → Probar.
//  6. El mismo Worker sirve para Panel → Herramientas → Revisar links (no necesita nada extra).
// =====================================================================

// Revisa si un enlace de descarga sigue funcionando
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
        ok: true, mensaje: 'El Worker está funcionando ✅', revisor_links: true,
        token_configurado: !!env.TELEGRAM_TOKEN, chat_configurado: !!env.TELEGRAM_CHAT_ID, origenes_permitidos: allowed
      });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'Solo se acepta POST' });
    if (!permitido) return reply(403, { ok: false, error: `Origen no permitido: ${origin || '(vacío)'}` });

    let body = {};
    try { body = JSON.parse(await request.text()) || {}; } catch (e) { /* cuerpo inválido */ }

    // Revisor de links: { check: ["https://...", ...] } (máximo 20 por vez)
    if (Array.isArray(body.check)) {
      const urls = body.check.filter(u => /^https?:\/\//i.test(String(u))).slice(0, 20);
      const results = await Promise.all(urls.map(revisar));
      return reply(200, { ok: true, results });
    }

    // Aviso a Telegram: { text: "..." }
    if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return reply(500, { ok: false, error: 'Faltan las variables TELEGRAM_TOKEN o TELEGRAM_CHAT_ID en el Worker' });
    const text = String(body.text || '').slice(0, 1000);
    if (!text.trim()) return reply(400, { ok: false, error: 'Falta el texto del mensaje' });

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
