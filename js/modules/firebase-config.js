// Carga Firebase desde el CDN y expone todo en window.FB.
// Los demás archivos esperan a window.fbReady antes de usar Firebase.
(() => {
const SDK = 'https://www.gstatic.com/firebasejs/10.7.1/';

const firebaseConfig = {
  apiKey: "AIzaSyCG2_mOYbHLkCB5xcaker4mR7KJZVt0zRM",
  authDomain: "fnf-mobile-lalocf.firebaseapp.com",
  databaseURL: "https://fnf-mobile-lalocf-default-rtdb.firebaseio.com",
  projectId: "fnf-mobile-lalocf",
  storageBucket: "fnf-mobile-lalocf.firebasestorage.app",
  messagingSenderId: "407243542354",
  appId: "1:407243542354:web:0da0f6a80db245f6bb348b"
};

window.APP_VERSION = "v7.2.0";
window.MI_UID_ADMIN = "Mtsvw6hM8FYu19Sk3yPnbDLtfOf2";

window.fbReady = Promise.all([
  import(SDK + 'firebase-app.js'),
  import(SDK + 'firebase-database.js'),
  import(SDK + 'firebase-auth.js')
]).then(([appM, dbM, authM]) => {
  const app = appM.initializeApp(firebaseConfig);
  const db = dbM.getDatabase(app);
  const auth = authM.getAuth(app);
  window.db = db;
  window.auth = auth;
  window.app = app;
  window.FB = {
    app, db, auth,
    googleProvider: new authM.GoogleAuthProvider(),
    ref: dbM.ref, get: dbM.get, set: dbM.set, update: dbM.update, remove: dbM.remove,
    push: dbM.push, onValue: dbM.onValue, runTransaction: dbM.runTransaction, serverTimestamp: dbM.serverTimestamp,
    query: dbM.query, orderByKey: dbM.orderByKey, startAt: dbM.startAt, limitToLast: dbM.limitToLast,
    signInWithPopup: authM.signInWithPopup, onAuthStateChanged: authM.onAuthStateChanged, signOut: authM.signOut,
    APP_VERSION: window.APP_VERSION, MI_UID_ADMIN: window.MI_UID_ADMIN
  };
  return window.FB;
});

// Sin internet la página sigue funcionando; solo se avisa en el indicador de estado.
window.fbReady.catch(err => {
  console.error('No se pudo cargar Firebase:', err);
  const txt = document.getElementById('statusText');
  if (txt) txt.textContent = window.FNF.t('Sin conexión', 'Offline');
});
})();
