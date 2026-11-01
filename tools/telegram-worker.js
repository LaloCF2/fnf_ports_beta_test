// =====================================================================
// Puente opcional a Telegram (Cloudflare Worker, gratis)
// ---------------------------------------------------------------------
// Para qué sirve: recibir en Telegram los reportes y mensajes de soporte
// SIN poner el token del bot dentro de la página (donde cualquiera lo ve).
//
// Cómo publicarlo (5 minutos):
//  1. Crea una cuenta en https://dash.cloudflare.com → Workers & Pages → Create → Worker.
//  2. Pega TODO este archivo como código del Worker y dale Deploy.
//  3. En el Worker → Settings → Variables and Secrets, agrega:
//       TELEGRAM_TOKEN   (tipo Secret)  = el token NUEVO de tu bot (BotFather → /revoke y /token)
//       TELEGRAM_CHAT_ID (tipo Text)    = 5429172831
//       ALLOWED_ORIGIN   (tipo Text)    = https://lalocf2.github.io
//  4. Copia la dirección del Worker (algo como https://fnf-telegram.tuusuario.workers.dev)
//     y pégala en js/modules/support.js → TELEGRAM_PROXY_URL.
// =====================================================================

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Solo POST', { status: 405, headers: cors });
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return new Response('Origen no permitido', { status: 403, headers: cors });

    let text = '';
    try { text = String((await request.json()).text || '').slice(0, 1000); } catch (e) { /* cuerpo inválido */ }
    if (!text.trim()) return new Response('Falta el texto', { status: 400, headers: cors });

    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text })
    });
    return new Response(res.ok ? 'ok' : 'error', { status: res.ok ? 200 : 502, headers: cors });
  }
};
