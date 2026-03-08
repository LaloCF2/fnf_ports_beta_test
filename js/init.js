document.addEventListener('DOMContentLoaded', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    document.body.classList.add('ios-theme');
    console.log("🍏 iOS Detectado: Activando diseño Apple Premium.");
  } else {
    console.log("🤖 Android/PC Detectado: Manteniendo diseño Neón.");
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('App lista para instalar'))
      .catch(err => console.log('Error al registrar SW', err));
  });
}
