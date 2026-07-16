// auth-controller.js - Controls the Auth Modal and UI Session states
import FirebaseService from "/firebase/auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- UI ELEMENTS ---
  const authModalEl = document.getElementById("authModal");
  if (!authModalEl) return;

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginRemember = document.getElementById("login-remember");
  const loginAlert = document.getElementById("login-alert");
  const loginSpinner = document.getElementById("login-spinner");
  const loginBtnText = document.getElementById("login-btn-text");
  const btnSubmitLogin = document.getElementById("btn-submit-login");
  const btnForgotPassword = document.getElementById("btn-forgot-password");

  const registerNickname = document.getElementById("register-nickname");
  const registerEmail = document.getElementById("register-email");
  const registerPassword = document.getElementById("register-password");
  const registerConfirmPassword = document.getElementById("register-confirm-password");
  const registerAlert = document.getElementById("register-alert");
  const registerSpinner = document.getElementById("register-spinner");
  const registerBtnText = document.getElementById("register-btn-text");
  const btnSubmitRegister = document.getElementById("btn-submit-register");
  const registerConfirmError = document.getElementById("register-confirm-error");

  // --- TAB TOGGLING ---
  function showLoginTab() {
    tabLogin.classList.remove("text-secondary", "border-secondary", "border-1");
    tabLogin.classList.add("text-white", "border-success", "border-2");

    tabRegister.classList.remove("text-white", "border-success", "border-2");
    tabRegister.classList.add("text-secondary", "border-secondary", "border-1");

    loginForm.classList.remove("d-none");
    registerForm.classList.add("d-none");
  }

  function showRegisterTab() {
    tabRegister.classList.remove("text-secondary", "border-secondary", "border-1");
    tabRegister.classList.add("text-white", "border-success", "border-2");

    tabLogin.classList.remove("text-white", "border-success", "border-2");
    tabLogin.classList.add("text-secondary", "border-secondary", "border-1");

    registerForm.classList.remove("d-none");
    loginForm.classList.add("d-none");
  }

  tabLogin.addEventListener("click", showLoginTab);
  tabRegister.addEventListener("click", showRegisterTab);

  // --- TRANSLATE FIREBASE ERRORS ---
  function translateAuthError(code) {
    switch (code) {
      case "auth/invalid-email":
        return "O formato do e-mail inserido é inválido.";
      case "auth/user-disabled":
        return "Esta conta de usuário foi desativada.";
      case "auth/user-not-found":
        return "Não há nenhum usuário cadastrado com este e-mail.";
      case "auth/wrong-password":
        return "A senha inserida está incorreta.";
      case "auth/email-already-in-use":
        return "Este endereço de e-mail já está sendo utilizado por outra conta.";
      case "auth/weak-password":
        return "A senha escolhida é muito fraca. Deve ter pelo menos 6 caracteres.";
      case "auth/invalid-credential":
        return "E-mail ou senha incorretos. Por favor, tente novamente.";
      case "auth/too-many-requests":
        return "Acesso temporariamente bloqueado devido a muitas tentativas incorretas. Tente mais tarde.";
      default:
        return "Ocorreu um erro ao processar sua solicitação. Tente novamente.";
    }
  }

  // --- PASSWORD MATCH VALIDATION ---
  function validatePasswordsMatch() {
    if (registerPassword.value !== registerConfirmPassword.value) {
      registerConfirmPassword.classList.add("is-invalid");
      registerConfirmError.classList.remove("d-none");
      return false;
    } else {
      registerConfirmPassword.classList.remove("is-invalid");
      registerConfirmError.classList.add("d-none");
      return true;
    }
  }

  registerConfirmPassword.addEventListener("input", validatePasswordsMatch);
  registerPassword.addEventListener("input", () => {
    if (registerConfirmPassword.value) {
      validatePasswordsMatch();
    }
  });

  // --- NICKNAME SANITIZATION ---
  registerNickname.addEventListener("input", () => {
    // Keep only alphanumeric and underscore, limit to 15 chars
    let val = registerNickname.value;
    val = val.replace(/[^a-zA-Z0-9_]/g, "");
    if (val.length > 15) {
      val = val.substring(0, 15);
    }
    registerNickname.value = val;
  });

  // --- LOGIN SUBMISSION ---
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginAlert.classList.add("d-none");

    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    const rememberMe = loginRemember.checked;

    // Show loading state
    loginSpinner.classList.remove("d-none");
    loginBtnText.textContent = "Entrando...";
    btnSubmitLogin.disabled = true;

    try {
      const user = await FirebaseService.login(email, password, rememberMe);
      
      // Save display name or email prefix to localStorage
      const displayName = user.displayName || email.split("@")[0];
      localStorage.setItem("papos_nickname", displayName);

      // Hide modal
      const modalInstance = bootstrap.Modal.getInstance(authModalEl);
      if (modalInstance) modalInstance.hide();
      
      // Clear fields
      loginForm.reset();

      // Show temporary toast or notice and reload to trigger ChatEngine with correct nickname
      window.location.reload();
    } catch (error) {
      console.error("Erro de login:", error);
      loginAlert.textContent = translateAuthError(error.code);
      loginAlert.classList.remove("d-none");
    } finally {
      loginSpinner.classList.add("d-none");
      loginBtnText.textContent = "Entrar";
      btnSubmitLogin.disabled = false;
    }
  });

  // --- REGISTRATION SUBMISSION ---
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerAlert.classList.add("d-none");

    const nickname = registerNickname.value.trim();
    const email = registerEmail.value.trim();
    const password = registerPassword.value;

    if (!validatePasswordsMatch()) return;

    if (nickname.length < 2) {
      registerAlert.textContent = "O apelido deve ter no mínimo 2 caracteres.";
      registerAlert.classList.remove("d-none");
      return;
    }

    // Show loading state
    registerSpinner.classList.remove("d-none");
    registerBtnText.textContent = "Criando conta...";
    btnSubmitRegister.disabled = true;

    try {
      await FirebaseService.register(email, password, nickname);
      
      // Store nickname
      localStorage.setItem("papos_nickname", nickname);

      // Hide modal
      const modalInstance = bootstrap.Modal.getInstance(authModalEl);
      if (modalInstance) modalInstance.hide();
      
      // Clear fields
      registerForm.reset();

      // Reload to activate session
      window.location.reload();
    } catch (error) {
      console.error("Erro no cadastro:", error);
      registerAlert.textContent = translateAuthError(error.code);
      registerAlert.classList.remove("d-none");
    } finally {
      registerSpinner.classList.add("d-none");
      registerBtnText.textContent = "Criar conta";
      btnSubmitRegister.disabled = false;
    }
  });

  // --- FORGOT PASSWORD ---
  btnForgotPassword.addEventListener("click", async () => {
    const email = loginEmail.value.trim();
    if (!email) {
      loginAlert.textContent = "Por favor, digite seu e-mail no campo acima para recuperar a senha.";
      loginAlert.className = "alert alert-warning py-2 px-3 small border border-warning mb-3";
      loginAlert.classList.remove("d-none");
      return;
    }

    try {
      await FirebaseService.resetPassword(email);
      loginAlert.textContent = "Um link para redefinir a senha foi enviado para o seu e-mail!";
      loginAlert.className = "alert alert-success py-2 px-3 small border border-success mb-3";
      loginAlert.classList.remove("d-none");
    } catch (error) {
      console.error("Erro ao enviar reset:", error);
      loginAlert.textContent = translateAuthError(error.code);
      loginAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
      loginAlert.classList.remove("d-none");
    }
  });

  // --- LOGOUT TRIGGERS ---
  const handleLogout = async () => {
    if (confirm("Deseja realmente sair da sua conta?")) {
      try {
        await FirebaseService.logout();
        // Clear locally stored credentials
        localStorage.removeItem("papos_nickname");
        localStorage.removeItem("papos_photo");
        window.location.reload();
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
      }
    }
  };

  const btnLogout = document.getElementById("btn-logout-trigger");
  if (btnLogout) btnLogout.addEventListener("click", handleLogout);

  const btnLogoutMobile = document.getElementById("btn-logout-trigger-mobile");
  if (btnLogoutMobile) btnLogoutMobile.addEventListener("click", handleLogout);
});
