// Datos en vivo de Firebase pintados sobre las tarjetas + configuración global del sitio.
window.fbReady.then((FB) => {
const { db, ref, get, set, onValue } = FB;
const { store, t, esc, icon, toast, isAdmin, weekKey, compact } = FNF;

const live = window.live = {
  downloads: {}, week: {}, likes: {}, leds: {}, comments: {}, pinned: {}, newMods: {}, broken: {},
  ratings: {}, verified: {}, recomendados: {}, banned: {}
};
window.brokenLinksData = live.broken;
window.liveLeds = live.leds;

const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// ---- Pintar sobre las tarjetas ----
function paintDownloads() {
  Object.keys(live.downloads).forEach(id => setText('dl-' + id, live.downloads[id]));
  document.querySelectorAll('.mod-card').forEach(c => { c.dataset.dl = live.downloads[c.dataset.id] || 0; });
}

function paintLikes() {
  Object.keys(live.likes).forEach(id => setText('count-' + id, live.likes[id]));
  const mine = store.json('my_liked_items', {});
  document.querySelectorAll('.item-card .stat-btn[id^="like-"]').forEach(b => b.classList.toggle('active', !!mine[b.id.slice(5)]));
}

function paintLeds() {
  document.querySelectorAll('.led-green').forEach(el => { el.style.display = 'none'; });
  document.querySelectorAll('.admin-led-btn').forEach(btn => { btn.textContent = '🟢 Act. LED'; });
  Object.keys(live.leds).forEach(id => {
    const el = document.getElementById('led-green-' + id);
    if (el) el.style.display = 'inline-block';
    const btn = document.getElementById('btn-led-' + id);
    if (btn) btn.textContent = '⭕ Quitar LED';
  });
}

function paintCommentLeds() {
  document.querySelectorAll('.led-yellow').forEach(el => { el.style.display = 'none'; });
  Object.keys(live.comments).forEach(id => {
    if (live.comments[id] > Number(store.get(`seen_comments_${id}`, 0))) {
      const el = document.getElementById('led-yellow-' + id);
      if (el) el.style.display = 'inline-block';
    }
  });
}

function paintPinned() {
  document.querySelectorAll('.mod-card').forEach(card => {
    const pinned = !!live.pinned[card.dataset.id];
    card.classList.toggle('pinned-mod', pinned);
    const btn = card.querySelector('.admin-pin-btn');
    if (btn) btn.textContent = pinned ? '❌ Desfijar' : '📌 Fijar';
  });
}

function paintFlags() {
  document.querySelectorAll('.item-card').forEach(card => {
    card.classList.toggle('is-new-mod', live.newMods[card.id] === true);
    card.classList.toggle('is-broken-mod', !!live.broken[card.dataset.id]);
  });
}

function paintRecomendados() {
  document.querySelectorAll('.script-card').forEach(card => {
    const media = card.querySelector('.media-badges');
    const badge = media.querySelector('.badge-top');
    if (live.recomendados[card.dataset.id]) {
      if (!badge) media.insertAdjacentHTML('afterbegin', '<span class="pill-badge badge-top">🔥 TOP</span>');
    } else if (badge) badge.remove();
  });
}

const ratingOf = (id) => {
  const votes = Object.values(live.ratings[id] || {}).filter(v => typeof v === 'number');
  return { n: votes.length, avg: votes.length ? votes.reduce((a, v) => a + v, 0) / votes.length : 0 };
};

function paintRatings() {
  document.querySelectorAll('.item-card').forEach(card => {
    const { n, avg } = ratingOf(card.dataset.id);
    card.dataset.rating = avg.toFixed(2);
    card.dataset.votes = n;
    const chip = document.getElementById('rate-' + card.dataset.id);
    if (!chip) return;
    chip.hidden = !n;
    chip.querySelector('span').textContent = n ? avg.toFixed(1) : '';
    chip.title = n ? t(`${avg.toFixed(1)} de 5 (${n} votos)`, `${avg.toFixed(1)} of 5 (${n} votes)`) : '';
  });
}

function repaintLiveData() {
  paintDownloads(); paintLikes(); paintLeds(); paintCommentLeds(); paintPinned(); paintFlags(); paintRecomendados(); paintRatings();
  if (live.config) paintConfig();
  if (window.applySort) window.applySort();
}
window.repaintLiveData = repaintLiveData;
window.ratingOf = ratingOf;

// ---- Top de la semana (inicio) ----
function paintTopWeek() {
  const box = document.getElementById('top-week');
  if (!box) return;
  const mods = window.MOD_DATA || {};
  const rank = (src) => Object.entries(src).filter(([id, n]) => mods[id] && !mods[id].hidden && n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  let top = rank(live.week);
  let weekly = true;
  if (top.length < 3) { top = rank(live.downloads); weekly = false; }
  document.getElementById('top-week-wrap').hidden = !top.length;
  setText('top-week-title', weekly ? t('🔥 Top de la semana', '🔥 Top this week') : t('🔥 Los más descargados', '🔥 Most downloaded'));
  box.innerHTML = top.map(([id, n], i) => `
    <button class="top-row" onclick="openModInfo('${id}')">
      <span class="top-rank">${i + 1}</span>
      <img src="${esc(mods[id].img)}" alt="" loading="lazy">
      <span class="grow"><strong>${esc(mods[id].title)}</strong>
        <small>${compact(n)} ${weekly ? t('descargas esta semana', 'downloads this week') : t('descargas', 'downloads')}</small></span>
      ${icon('right', 'icon icon-sm')}
    </button>`).join('');
}

// ---- Seguir mods: aviso cuando un favorito se actualiza ----
function checkFollowedUpdates() {
  const favs = store.json('fnf_favorites', {});
  Object.keys(favs).forEach(id => {
    const ts = live.leds[id];
    if (typeof ts !== 'number') return;
    const seen = Number(store.get('seen_update_' + id, 0));
    if (ts > seen) {
      store.set('seen_update_' + id, String(ts));
      if (seen) toast(t(`🟢 ${favs[id].title} tiene una actualización`, `🟢 ${favs[id].title} was updated`), 'download');
      else if (Date.now() - ts < 7 * 86400000) toast(t(`🟢 ${favs[id].title} se actualizó hace poco`, `🟢 ${favs[id].title} was recently updated`), 'download');
    }
  });
}

// ---- Escuchas ----
onValue(ref(db, 'downloads'), s => { live.downloads = s.val() || {}; paintDownloads(); paintTopWeek(); if (window.applySort) window.applySort(); });
onValue(ref(db, `downloads_week/${weekKey()}`), s => { live.week = s.val() || {}; paintTopWeek(); });
onValue(ref(db, 'likes'), s => { live.likes = s.val() || {}; paintLikes(); });
onValue(ref(db, 'updates_led'), s => { live.leds = s.val() || {}; window.liveLeds = live.leds; paintLeds(); checkFollowedUpdates(); });
onValue(ref(db, 'last_comment_time'), s => { live.comments = s.val() || {}; paintCommentLeds(); });
onValue(ref(db, 'pinned_mods'), s => { live.pinned = s.val() || {}; paintPinned(); if (window.applySort) window.applySort(); });
onValue(ref(db, 'new_mods_status'), s => { live.newMods = s.val() || {}; paintFlags(); });
onValue(ref(db, 'broken_links'), s => {
  live.broken = s.val() || {};
  window.brokenLinksData = live.broken;
  paintFlags();
  if (window.renderAdminTab) window.renderAdminTab('reportes', true);
});
onValue(ref(db, 'verified_users'), s => { live.verified = s.val() || {}; });
onValue(ref(db, 'banned_users'), s => { live.banned = s.val() || {}; });
onValue(ref(db, 'scripts_recomendados'), s => { live.recomendados = s.val() || {}; paintRecomendados(); });
onValue(ref(db, 'ratings'), s => {
  live.ratings = s.val() || {};
  paintRatings();
  if (window.applySort) window.applySort();
  if (window.currentItemRatingId && window.loadItemRating) window.loadItemRating(window.currentItemRatingId);
});

onValue(ref(db, '.info/connected'), (snap) => {
  const on = snap.val() === true;
  document.getElementById('statusDot').classList.toggle('online', on);
  setText('statusText', on ? t('Servidor activo', 'Server online') : t('Desconectado', 'Offline'));
});

// ---- Mods creados/editados desde el panel ----
onValue(ref(db, 'mods_custom'), s => {
  const custom = s.val() || {};
  live.custom = custom;
  const before = JSON.stringify(store.json('fnf_mods_custom_cache', {}));
  store.setJson('fnf_mods_custom_cache', custom);
  if (JSON.stringify(custom) !== before) {
    window.applyCustomMods(custom);
    window.renderAll();
    repaintLiveData();
    window.filterContent(true);
    paintTopWeek();
  }
  if (window.renderAdminTab) window.renderAdminTab('mods', true);
});

// ---- Banner global y modo mantenimiento ----
function paintConfig() {
  const cfg = live.config || {};

  const banner = cfg.banner || {};
  const bannerEl = document.getElementById('site-banner');
  const dismissed = store.get('banner_dismissed') === String(banner.updatedAt);
  bannerEl.className = `site-banner glass banner-${banner.type || 'info'}${banner.active && banner.text && !dismissed ? '' : ' hidden'}`;
  setText('site-banner-text', banner.text || '');
  window.dismissBanner = () => { store.set('banner_dismissed', String(banner.updatedAt)); bannerEl.classList.add('hidden'); };

  const m = cfg.maintenance || {};
  const screen = document.getElementById('maintenance-screen');
  screen.classList.toggle('hidden', !m.active || isAdmin());
  setText('maintenance-text', m.message || t('Estamos mejorando la página. ¡Vuelve en un rato!', "We're improving the site. Come back soon!"));
  document.getElementById('maintenance-admin-note').classList.toggle('hidden', !(m.active && isAdmin()));
}
onValue(ref(db, "site_config"), s => {
  live.config = s.val() || {};
  paintConfig();
  if (window.renderAdminTab) window.renderAdminTab("avisos", true);
});

// ---- Acciones de admin en las tarjetas (las reglas de Firebase las limitan a tu cuenta) ----
const toggleNode = async (path, value = true) => {
  const r = ref(db, path);
  const snap = await get(r);
  await set(r, snap.exists() ? null : value);
};

window.toggleGreenLed = (id, e) => { if (e) e.stopPropagation(); if (isAdmin()) toggleNode(`updates_led/${id}`, Date.now()); };
window.toggleModPin = (id, e) => { if (e) e.stopPropagation(); if (isAdmin()) toggleNode(`pinned_mods/${id}`); };
window.toggleNewMod = async (cardId) => {
  if (!isAdmin()) return;
  const esNuevo = live.newMods[cardId] === true;
  if (confirm(esNuevo ? '¿Quitar la etiqueta de NUEVO a este mod?' : '¿Marcar este mod como NUEVO?')) {
    await set(ref(db, `new_mods_status/${cardId}`), esNuevo ? null : true);
  }
};
window.toggleRecomendarScript = (id) => {
  if (isAdmin()) set(ref(db, 'scripts_recomendados/' + id), live.recomendados[id] ? null : true);
};
window.fixBrokenLink = async (id) => {
  if (isAdmin() && confirm('🛠️ ¿Ya solucionaste el link de este mod?')) {
    await set(ref(db, `broken_links/${id}`), null);
    toast('Link marcado como reparado.', 'zap');
  }
};
}).catch(err => console.error(err));
