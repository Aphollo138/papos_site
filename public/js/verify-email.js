import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, applyActionCode } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
 apiKey: process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || "",
  firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || "(default)"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Sincronizar tema com preferências salvas
(function applyTheme() {
  try {
    const savedTheme = localStorage.getItem("papos_theme");
    if (savedTheme === "light") {
      document.documentElement.setAttribute("data-bs-theme", "light");
      document.body.classList.add("light-theme");
    } else if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-bs-theme", "dark");
      document.body.classList.remove("light-theme");
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      document.documentElement.setAttribute("data-bs-theme", "light");
      document.body.classList.add("light-theme");
    } else {
      document.documentElement.setAttribute("data-bs-theme", "dark");
    }
  } catch (e) {}
})();

document.addEventListener("DOMContentLoaded", async () => {
  const viewLoading = document.getElementById("view-loading");
  const viewSuccess = document.getElementById("view-success");
  const viewError = document.getElementById("view-error");
  const errorMessageEl = document.getElementById("error-message");

  function showView(view) {
    [viewLoading, viewSuccess, viewError].forEach(v => {
      if (v) v.classList.add("d-none");
    });
    if (view) {
      view.classList.remove("d-none");
      view.classList.add("animated-fade-in");
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const oobCode = urlParams.get("oobCode");

  if (!oobCode) {
    if (errorMessageEl) {
      errorMessageEl.textContent = "Código de verificação não encontrado no link recebido. Por favor, verifique o e-mail enviado pelo Papo.net.";
    }
    showView(viewError);
    return;
  }

  try {
    await applyActionCode(auth, oobCode);
    showView(viewSuccess);
  } catch (error) {
    console.error("Erro na verificação de e-mail:", error);
    let msg = "Este link expirou ou já foi utilizado.";
    if (error.code === "auth/invalid-action-code") {
      msg = "Este link de verificação é inválido ou já foi utilizado anteriormente.";
    } else if (error.code === "auth/expired-action-code") {
      msg = "Este link expirou ou já foi utilizado.";
    }
    if (errorMessageEl) {
      errorMessageEl.textContent = msg;
    }
    showView(viewError);
  }
});
