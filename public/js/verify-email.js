import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, applyActionCode } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc5MaD-riO2VOEeha3OIY9hz0",
  authDomain: "papo-net.firebaseapp.com",
  projectId: "papo-net",
  storageBucket: "papo-net.firebasestorage.app",
  messagingSenderId: "344762176006",
  appId: "1:344762176006:web:ff73eb56d882c4e8d4e987",
  measurementId: "G-GFNMN47DSF"
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

    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.displayName) {
          localStorage.setItem("papos_nickname", auth.currentUser.displayName);
        }
      }
    } catch (e) {}

    const btnEnter = document.getElementById("btn-enter-room");
    if (btnEnter) {
      btnEnter.addEventListener("click", (e) => {
        e.preventDefault();
        const savedNick = localStorage.getItem("papos_nickname");
        if (auth.currentUser && auth.currentUser.emailVerified && savedNick) {
          window.location.href = "/chat?room=room-1";
        } else {
          window.location.href = "/chat?room=room-1&action=login";
        }
      });
    }
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
