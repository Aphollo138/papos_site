import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

function getResetCode() {
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

async function initResetPassword() {
  const viewLoading = document.getElementById("view-loading");
  const viewForm = document.getElementById("view-form");
  const viewSuccess = document.getElementById("view-success");
  const viewError = document.getElementById("view-error");
  const userEmailDisplay = document.getElementById("user-email-display");
  const errorMessageEl = document.getElementById("error-message");

  const form = document.getElementById("reset-password-form");
  const inputNewPassword = document.getElementById("input-new-password");
  const inputConfirmPassword = document.getElementById("input-confirm-password");
  const btnToggleNew = document.getElementById("btn-toggle-new-password");
  const btnToggleConfirm = document.getElementById("btn-toggle-confirm-password");
  const btnSubmit = document.getElementById("btn-submit-reset");
  const btnSubmitText = document.getElementById("btn-submit-text");
  const btnSubmitSpinner = document.getElementById("btn-submit-spinner");
  const alertContainer = document.getElementById("form-alert");

  const ruleLength = document.getElementById("rule-length");
  const ruleLetter = document.getElementById("rule-letter");
  const ruleNumber = document.getElementById("rule-number");

  const oobCode = getResetCode();

  function showView(view) {
    [viewLoading, viewForm, viewSuccess, viewError].forEach(v => {
      if (v) v.classList.add("d-none");
    });
    if (view) {
      view.classList.remove("d-none");
      view.classList.add("animated-fade-in");
    }
  }

  function showAlert(msg) {
    if (alertContainer) {
      alertContainer.textContent = msg;
      alertContainer.classList.remove("d-none");
    }
  }

  function hideAlert() {
    if (alertContainer) {
      alertContainer.textContent = "";
      alertContainer.classList.add("d-none");
    }
  }

  // Toggle visualização de senhas
  if (btnToggleNew && inputNewPassword) {
    btnToggleNew.addEventListener("click", () => {
      const isPassword = inputNewPassword.type === "password";
      inputNewPassword.type = isPassword ? "text" : "password";
      btnToggleNew.innerHTML = isPassword 
        ? '<i class="bi bi-eye-slash"></i>' 
        : '<i class="bi bi-eye"></i>';
    });
  }

  if (btnToggleConfirm && inputConfirmPassword) {
    btnToggleConfirm.addEventListener("click", () => {
      const isPassword = inputConfirmPassword.type === "password";
      inputConfirmPassword.type = isPassword ? "text" : "password";
      btnToggleConfirm.innerHTML = isPassword 
        ? '<i class="bi bi-eye-slash"></i>' 
        : '<i class="bi bi-eye"></i>';
    });
  }

  // Validação em tempo real dos requisitos
  function validateRules() {
    const val = inputNewPassword.value;
    const hasMinLength = val.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(val);
    const hasNumber = /[0-9]/.test(val);

    if (ruleLength) {
      ruleLength.className = hasMinLength ? "pwd-rule-item valid" : "pwd-rule-item invalid";
      ruleLength.innerHTML = hasMinLength 
        ? '<i class="bi bi-check-circle-fill text-success"></i> Mínimo de 8 caracteres'
        : '<i class="bi bi-circle"></i> Mínimo de 8 caracteres';
    }

    if (ruleLetter) {
      ruleLetter.className = hasLetter ? "pwd-rule-item valid" : "pwd-rule-item invalid";
      ruleLetter.innerHTML = hasLetter 
        ? '<i class="bi bi-check-circle-fill text-success"></i> Pelo menos 1 letra'
        : '<i class="bi bi-circle"></i> Pelo menos 1 letra';
    }

    if (ruleNumber) {
      ruleNumber.className = hasNumber ? "pwd-rule-item valid" : "pwd-rule-item invalid";
      ruleNumber.innerHTML = hasNumber 
        ? '<i class="bi bi-check-circle-fill text-success"></i> Pelo menos 1 número'
        : '<i class="bi bi-circle"></i> Pelo menos 1 número';
    }

    return hasMinLength && hasLetter && hasNumber;
  }

  if (inputNewPassword) {
    inputNewPassword.addEventListener("input", () => {
      validateRules();
      hideAlert();
    });
  }

  if (inputConfirmPassword) {
    inputConfirmPassword.addEventListener("input", hideAlert);
  }

  // 1. Validar código recebido do Firebase
  if (!oobCode) {
    if (errorMessageEl) {
      errorMessageEl.textContent = "Código de redefinição não encontrado. Por favor, utilize o link recebido em seu e-mail.";
    }
    showView(viewError);
    return;
  }

  try {
    const email = await verifyPasswordResetCode(auth, oobCode);
    if (userEmailDisplay && email) {
      userEmailDisplay.textContent = email;
    }
    showView(viewForm);
  } catch (error) {
    console.error("Erro ao validar código de redefinição:", error);
    let msg = "O link de redefinição expirou ou já foi utilizado. Solicite um novo link para continuar.";
    if (error.code === "auth/invalid-action-code") {
      msg = "O código de recuperação é inválido ou expirou. Por favor, solicite um novo link.";
    }
    if (errorMessageEl) {
      errorMessageEl.textContent = msg;
    }
    showView(viewError);
    return;
  }

  // 2. Processar envio da nova senha
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();

      const newPassword = inputNewPassword.value;
      const confirmPassword = inputConfirmPassword.value;

      if (!validateRules()) {
        showAlert("A senha deve ter no mínimo 8 caracteres e conter pelo menos uma letra e um número.");
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert("As senhas digitadas não coincidem. Verifique e tente novamente.");
        inputConfirmPassword.focus();
        return;
      }

      // Ativar spinner
      btnSubmit.disabled = true;
      if (btnSubmitSpinner) btnSubmitSpinner.classList.remove("d-none");
      if (btnSubmitText) btnSubmitText.textContent = "Salvando nova senha...";

      try {
        await confirmPasswordReset(auth, oobCode, newPassword);
        showView(viewSuccess);
      } catch (err) {
        console.error("Erro ao confirmar redefinição:", err);
        let errorMsg = "Ocorreu um erro ao redefinir sua senha. Tente novamente.";
        if (err.code === "auth/expired-action-code") {
          errorMsg = "Este link expirou. Por favor, solicite uma nova redefinição.";
        } else if (err.code === "auth/invalid-action-code") {
          errorMsg = "Código de redefinição inválido ou já utilizado.";
        } else if (err.code === "auth/weak-password") {
          errorMsg = "A senha escolhida é muito fraca. Escolha uma senha mais forte.";
        }
        showAlert(errorMsg);
      } finally {
        btnSubmit.disabled = false;
        if (btnSubmitSpinner) btnSubmitSpinner.classList.add("d-none");
        if (btnSubmitText) btnSubmitText.textContent = "Salvar nova senha";
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initResetPassword);
} else {
  initResetPassword();
}
