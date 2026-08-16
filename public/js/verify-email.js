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

function getVerificationCode() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith("#") ? window.location.hash.substring(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);

    const code = searchParams.get("oobCode") || hashParams.get("oobCode") || searchParams.get("code") || hashParams.get("code");
    return code ? code.trim() : null;
  } catch (e) {
    return null;
  }
}

async function verifyEmail() {
  const viewLoading = document.getElementById("view-loading");
  const viewSuccess = document.getElementById("view-success");
  const viewError = document.getElementById("view-error");
  const errorMessageEl = document.getElementById("error-message");

  let isFinished = false;

  function showView(targetView) {
    isFinished = true;
    if (viewLoading) viewLoading.classList.add("d-none");
    if (viewSuccess) viewSuccess.classList.add("d-none");
    if (viewError) viewError.classList.add("d-none");

    if (targetView) {
      targetView.classList.remove("d-none");
      targetView.classList.add("animated-fade-in");
    }
  }

  // Timeout guard para evitar qualquer loading infinito sob qualquer circunstância
  setTimeout(() => {
    if (!isFinished) {
      console.warn("Timeout de verificação atingido.");
      if (errorMessageEl) {
        errorMessageEl.textContent = "Tempo limite excedido ao processar a validação. Por favor, tente novamente ou solicite um novo link.";
      }
      showView(viewError);
    }
  }, 7000);

  const oobCode = getVerificationCode();

  if (!oobCode) {
    if (errorMessageEl) {
      errorMessageEl.textContent = "Código de verificação ausente ou link incompleto. Por favor, abra o link enviado para o seu e-mail.";
    }
    showView(viewError);
    return;
  }

  try {
    // Executa a validação do código de ação sem requerer usuário logado
    await applyActionCode(auth, oobCode);
    showView(viewSuccess);
  } catch (error) {
    console.error("Erro na verificação de e-mail:", error);
    let msg = "Este link expirou ou já foi utilizado.";
    if (error.code === "auth/invalid-action-code") {
      msg = "Este link de verificação é inválido ou já foi utilizado anteriormente.";
    } else if (error.code === "auth/expired-action-code") {
      msg = "Este link expirou. Solicite um novo link de confirmação para continuar.";
    }
    if (errorMessageEl) {
      errorMessageEl.textContent = msg;
    }
    showView(viewError);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", verifyEmail);
} else {
  verifyEmail();
}
