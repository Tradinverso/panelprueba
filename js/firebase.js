// Firebase initialization. Single source of truth for app, auth, db.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Dos proyectos de Firebase: el REAL (alumnos) y el de PRUEBAS (vacío, solo
// usuarios de prueba). Se elige por la web desde la que se abre la app: solo
// app.tradinverso.com usa los datos reales; panelprueba y el servidor local
// usan el de pruebas. Así este archivo es idéntico en los dos repos y una
// versión en pruebas nunca puede tocar datos de alumnos.
const PROD_CONFIG = {
  apiKey: "AIzaSyAFEcGvTiz-alfMmZLs0wPXCJwcC2knKwM",
  authDomain: "tradinverso-dashboard.firebaseapp.com",
  projectId: "tradinverso-dashboard",
  storageBucket: "tradinverso-dashboard.firebasestorage.app",
  messagingSenderId: "360073891724",
  appId: "1:360073891724:web:f621100eec7428bba7d0a9",
};

const TEST_CONFIG = {
  apiKey: "AIzaSyBzzd9A3SCtv4lqCboLQlWft50Fp2xkv5g",
  authDomain: "tradinverso-pruebas.firebaseapp.com",
  projectId: "tradinverso-pruebas",
  storageBucket: "tradinverso-pruebas.firebasestorage.app",
  messagingSenderId: "512054398967",
  appId: "1:512054398967:web:c4725a013aeb6fe87928f2",
};

export const IS_TEST_ENV = location.hostname !== 'app.tradinverso.com';
export const firebaseConfig = IS_TEST_ENV ? TEST_CONFIG : PROD_CONFIG;

export const ADMIN_EMAIL = 'tradinverso@gmail.com';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Caché offline (IndexedDB). Solo una pestaña tendrá persistencia activa
// cuando hay varias abiertas; las demás siguen funcionando sin caché.
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore: persistence solo activa en una pestaña a la vez.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore: el navegador no soporta persistencia offline.');
  } else {
    console.error('Firestore persistence error:', err);
  }
});
