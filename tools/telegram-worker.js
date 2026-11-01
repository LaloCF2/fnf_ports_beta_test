// =====================================================================
// Puente opcional a Telegram (Cloudflare Worker, gratis) — v2
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
// =====================================================================

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
        ok: true, mensaje: 'El Worker está funcionando ✅',
        token_configurado: !!env.TELEGRAM_TOKEN, chat_configurado: !!env.TELEGRAM_CHAT_ID, origenes_permitidos: allowed
      });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'Solo se acepta POST' });
    if (!permitido) return reply(403, { ok: false, error: `Origen no permitido: ${origin || '(vacío)'}` });
    if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return reply(500, { ok: false, error: 'Faltan las variables TELEGRAM_TOKEN o TELEGRAM_CHAT_ID en el Worker' });

    let text = '';
    try { text = String((JSON.parse(await request.text()) || {}).text || '').slice(0, 1000); } catch (e) { /* cuerpo inválido */ }
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
