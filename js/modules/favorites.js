// Favoritos: se guardan en localStorage y, con sesión iniciada, en Firebase.
window.fbReady.then((FB) => {
const { db, auth, googleProvider, ref, get, set, update, remove, push, onValue, runTransaction, signInWithPopup, onAuthStateChanged, signOut, APP_VERSION } = FB;
const { store, t, esc, icon, vibrate, openPopup, closePopup, toast, getProfile, profileName, profilePhoto, stringToColor } = FNF;

const lookup = (id) => (window.MOD_DATA || {})[id] || (window.APK_DATA || {})[id] || (window.SCRIPTS_DATA || {})[id];

const openerFor = (id) => id.startsWith('apk') ? window.openApkInfo : id.startsWith('script') ? window.openScriptInfo : window.openModInfo;

window.refreshFavoritesUI = () => {
  const favs = store.json('fnf_favorites', {});
  document.querySelectorAll('[data-fav]').forEach(b => b.classList.toggle('is-fav', !!favs[b.dataset.fav]));
  const tile = document.getElementById('tile-favs');
  if (tile) tile.textContent = `${Object.keys(favs).length} ${t('guardados', 'saved')}`;
};

window.toggleFavorite = (id) => {
  const favs = store.json('fnf_favorites', {});
  if (favs[id]) {
    delete favs[id];
  } else {
    const d = lookup(id) || {};
    favs[id] = { title: d.title || 'Mod FNF', img: d.img || (d.images || [])[0] || '', modId: id, timestamp: Date.now() };
    // Marca la actualización actual como vista: solo avisará de las siguientes
    const led = (window.liveLeds || {})[id];
    if (typeof led === 'number') store.set('seen_update_' + id, String(led));
    if (window.showToast) window.showToast(t('Guardado. Te avisaremos cuando se actualice.', "Saved. We'll let you know when it updates."), 'bookmark');
  }
  store.setJson('fnf_favorites', favs);
  if (window.usuarioActualFirebase) {
    set(ref(db, 'usuarios/' + window.usuarioActualFirebase.uid + '/favoritos'), favs).catch(e => console.error('Error guardando favoritos:', e));
  }
  window.refreshFavoritesUI();
  vibrate(20);
};

window.abrirFavoritos = () => {
  const container = document.getElementById('favorites-list');
  const favs = store.json('fnf_favorites', {});
  const keys = Object.keys(favs).sort((a, b) => (favs[b].timestamp || 0) - (favs[a].timestamp || 0));

  container.innerHTML = keys.length ? keys.map((id, i) => `
    <div class="list-item" role="button" style="animation-delay:${i * 40}ms" onclick="closePopup('favorites-popup'); openFavorite('${esc(id)}')">
      <img src="${esc(favs[id].img)}" alt="" loading="lazy">
      <div class="grow"><h4>${esc(favs[id].title)}</h4>${(window.liveLeds || {})[id] ? `<p class="upd-tag">🟢 ${t('Actualizado', 'Updated')}</p>` : ''}</div>
      ${icon('right', 'icon icon-sm')}
    </div>`).join('')
    : `<p class="empty">${t('Aún no guardas nada. Toca el marcador en tus mods favoritos.', 'Nothing saved yet. Tap the bookmark on your favorite mods.')}</p>`;

  closePopup('profile-popup');
  openPopup('favorites-popup');
};

window.openFavorite = (id) => { const fn = openerFor(id); if (fn) fn(id); };
}).catch(err => console.error(err));
