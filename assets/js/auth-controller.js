
import FirebaseService from "/firebase/auth.js";

document.addEventListener("DOMContentLoaded", () => {
  
  const authModalEl = document.getElementById("authModal");
  if (!authModalEl) return;

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const viewEmailPending = document.getElementById("view-email-pending");
  const modalHeaderNav = authModalEl.querySelector(".modal-header > .w-100");
  const btnResendPendingEmail = document.getElementById("btn-resend-pending-email");
  const btnBackToLogin = document.getElementById("btn-back-to-login");
  const emailPendingMessage = document.getElementById("email-pending-message");

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

  function hideTelaVerificacaoPendente() {
    if (viewEmailPending) viewEmailPending.classList.add("d-none");
    if (modalHeaderNav) modalHeaderNav.classList.remove("d-none");
  }

  function mostrarTelaVerificacaoPendente(email, password) {
    if (modalHeaderNav) modalHeaderNav.classList.add("d-none");
    if (loginForm) loginForm.classList.add("d-none");
    if (registerForm) registerForm.classList.add("d-none");
    if (loginAlert) loginAlert.classList.add("d-none");
    if (registerAlert) registerAlert.classList.add("d-none");

    if (viewEmailPending) {
      viewEmailPending.classList.remove("d-none");
      viewEmailPending.classList.add("animated-fade-in");
    }
    if (emailPendingMessage) {
      emailPendingMessage.innerHTML = `Enviamos um link de confirmação para seu e-mail. Após verificar sua conta, faça login normalmente.`;
    }
    const resendBtn = document.getElementById("btn-resend-pending-email");
    if (resendBtn) {
      setupResendCooldown(resendBtn, email, password);
    }
  }
  window.mostrarTelaVerificacaoPendente = mostrarTelaVerificacaoPendente;
  window.abrirTelaVerificacaoPendente = mostrarTelaVerificacaoPendente;

  function showLoginTab() {
    hideTelaVerificacaoPendente();
    if (tabLogin) {
      tabLogin.classList.remove("text-secondary", "border-secondary", "border-1");
      tabLogin.classList.add("text-white", "border-success", "border-2");
    }
    if (tabRegister) {
      tabRegister.classList.remove("text-white", "border-success", "border-2");
      tabRegister.classList.add("text-secondary", "border-secondary", "border-1");
    }
    if (loginForm) loginForm.classList.remove("d-none");
    if (registerForm) registerForm.classList.add("d-none");
  }

  function showRegisterTab() {
    hideTelaVerificacaoPendente();
    if (tabRegister) {
      tabRegister.classList.remove("text-secondary", "border-secondary", "border-1");
      tabRegister.classList.add("text-white", "border-success", "border-2");
    }
    if (tabLogin) {
      tabLogin.classList.remove("text-white", "border-success", "border-2");
      tabLogin.classList.add("text-secondary", "border-secondary", "border-1");
    }
    if (registerForm) registerForm.classList.remove("d-none");
    if (loginForm) loginForm.classList.add("d-none");
  }

  if (tabLogin) tabLogin.addEventListener("click", showLoginTab);
  if (tabRegister) tabRegister.addEventListener("click", showRegisterTab);

  if (btnBackToLogin) {
    btnBackToLogin.addEventListener("click", () => {
      hideTelaVerificacaoPendente();
      showLoginTab();
      if (loginEmail) loginEmail.focus();
    });
  }

  authModalEl.addEventListener("hidden.bs.modal", () => {
    hideTelaVerificacaoPendente();
    showLoginTab();
    const urlP = new URLSearchParams(window.location.search);
    if (!localStorage.getItem("papos_nickname") && (urlP.get("action") === "login" || urlP.get("auth") === "login")) {
      window.location.href = "/?error=name_required";
    }
  });

  let resendCooldownInterval = null;
  function setupResendCooldown(btn, email, password) {
    if (!btn) return;
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", async () => {
      newBtn.disabled = true;
      newBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Enviando...`;

      try {
        await FirebaseService.resendVerificationEmail(email, password);
        if (typeof window.showToast === "function") {
          window.showToast("E-mail de verificação reenviado com sucesso!", "success");
        }
      } catch (err) {
        console.error("Erro ao reenviar verificação:", err);
        let errorMsg = "Não foi possível reenviar agora. Tente novamente mais tarde.";
        if (err && err.code === "auth/already-verified") {
          errorMsg = "Seu e-mail já foi verificado.";
        } else if (err && (err.code === "auth/too-many-requests" || (err.message && err.message.includes("too-many-requests")))) {
          errorMsg = "Você realizou muitas tentativas. Aguarde alguns minutos antes de solicitar outro e-mail.";
        }
        if (typeof window.showToast === "function") {
          window.showToast(errorMsg, err && err.code === "auth/already-verified" ? "info" : "error");
        }
      }

      let seconds = 60;
      newBtn.disabled = true;
      newBtn.textContent = `Reenviar e-mail (${seconds}s)`;

      if (resendCooldownInterval) clearInterval(resendCooldownInterval);
      resendCooldownInterval = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(resendCooldownInterval);
          resendCooldownInterval = null;
          newBtn.disabled = false;
          newBtn.textContent = "Reenviar e-mail";
        } else {
          newBtn.textContent = `Reenviar e-mail (${seconds}s)`;
        }
      }, 1000);
    });
  }

  function translateAuthError(code) {
    switch (code) {
      case "auth/invalid-email":
        return "O formato do e-mail inserido é inválido.";
      case "auth/invalid-email-domain":
        return "Utilize um e-mail Gmail, Outlook ou UOL.";
      case "auth/reserved-nickname":
        return "Este nome é reservado pela equipe do Papo.net.br.";
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
      case "auth/unverified-email":
        return "📧 Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada antes de entrar no chat.";
      case "auth/network-request-failed":
        return "Falha na conexão de rede. Verifique sua internet e tente novamente.";
      case "auth/too-many-requests":
        return "Você realizou muitas tentativas. Aguarde alguns minutos antes de solicitar outro e-mail.";
      case "auth/internal-error":
        return "Ocorreu um erro interno de autenticação. Tente novamente em instantes.";
      default:
        return "Ocorreu um erro ao processar sua solicitação. Tente novamente.";
    }
  }

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

  registerNickname.addEventListener("input", () => {
    let val = registerNickname.value;
    val = val.replace(/[^a-zA-Z0-9_]/g, "");
    if (val.length > 15) {
      val = val.substring(0, 15);
    }
    registerNickname.value = val;
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginAlert.classList.add("d-none");

    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    const rememberMe = loginRemember.checked;

    loginSpinner.classList.remove("d-none");
    loginBtnText.textContent = "Entrando...";
    btnSubmitLogin.disabled = true;

    try {
      const user = await FirebaseService.login(email, password, rememberMe);
      
      const displayName = user.displayName || email.split("@")[0];
      localStorage.setItem("papos_nickname", displayName);

      const modalInstance = bootstrap.Modal.getInstance(authModalEl);
      if (modalInstance) modalInstance.hide();
      
      loginForm.reset();

      const currentParams = new URLSearchParams(window.location.search);
      const targetRoom = currentParams.get("room") || localStorage.getItem("target_room_id") || "room-1";
      localStorage.removeItem("target_room_id");
      const isHomePage = window.location.pathname === "/" || window.location.pathname === "/index.html" || window.location.pathname === "";
      if (isHomePage || currentParams.get("action") === "login" || currentParams.get("auth") === "login") {
        window.location.href = `/chat?room=${targetRoom}`;
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error("Erro de login:", error);
      if (error.code === "auth/unverified-email") {
        mostrarTelaVerificacaoPendente(email, password);
      } else {
        loginAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        loginAlert.textContent = translateAuthError(error.code);
        loginAlert.classList.remove("d-none");
      }
    } finally {
      loginSpinner.classList.add("d-none");
      loginBtnText.textContent = "Entrar";
      btnSubmitLogin.disabled = false;
    }
  });

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    if (registerAlert) registerAlert.classList.add("d-none");

    const nickname = registerNickname ? registerNickname.value.trim() : "";
    const email = registerEmail ? registerEmail.value.trim() : "";
    const password = registerPassword ? registerPassword.value : "";
    const confirmPassword = registerConfirmPassword ? registerConfirmPassword.value : "";

    if (!nickname || nickname.length < 2) {
      if (registerAlert) {
        registerAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        registerAlert.textContent = "O apelido deve ter no mínimo 2 caracteres.";
        registerAlert.classList.remove("d-none");
      }
      if (registerNickname) registerNickname.focus();
      return;
    }

    if (!email) {
      if (registerAlert) {
        registerAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        registerAlert.textContent = "Informe seu endereço de e-mail.";
        registerAlert.classList.remove("d-none");
      }
      if (registerEmail) registerEmail.focus();
      return;
    }

    const emailRegex = /^[A-Za-z0-9._%+-]+@(gmail\.com|outlook\.com|hotmail\.com|live\.com|uol\.com\.br|bol\.com\.br)$/i;
    if (!emailRegex.test(email)) {
      if (registerAlert) {
        registerAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        registerAlert.textContent = "Utilize um e-mail Gmail, Outlook ou UOL.";
        registerAlert.classList.remove("d-none");
      }
      if (registerEmail) registerEmail.focus();
      return;
    }

    if (!password || password.length < 6) {
      if (registerAlert) {
        registerAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        registerAlert.textContent = "A senha deve ter no mínimo 6 caracteres.";
        registerAlert.classList.remove("d-none");
      }
      if (registerPassword) registerPassword.focus();
      return;
    }

    if (password !== confirmPassword) {
      if (registerConfirmPassword) registerConfirmPassword.classList.add("is-invalid");
      if (registerConfirmError) registerConfirmError.classList.remove("d-none");
      if (registerAlert) {
        registerAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        registerAlert.textContent = "As senhas não coincidem.";
        registerAlert.classList.remove("d-none");
      }
      if (registerConfirmPassword) registerConfirmPassword.focus();
      return;
    }

    if (window.isReservedNickname && window.isReservedNickname(nickname)) {
      if (typeof window.showToast === "function") {
        window.showToast("Este nome é reservado pela equipe do Papo.net.br.", "warning");
      }
      if (registerAlert) {
        registerAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        registerAlert.textContent = "Este nome é reservado pela equipe do Papo.net.br.";
        registerAlert.classList.remove("d-none");
      }
      return;
    }

    if (registerSpinner) registerSpinner.classList.remove("d-none");
    if (registerBtnText) registerBtnText.textContent = "Criando conta...";
    if (btnSubmitRegister) btnSubmitRegister.disabled = true;

    try {
      await FirebaseService.register(email, password, nickname);
      if (registerForm) registerForm.reset();
      mostrarTelaVerificacaoPendente(email, password);
    } catch (error) {
      console.error("Erro no cadastro:", error);
      if (registerAlert) {
        registerAlert.className = "alert alert-danger py-2 px-3 small border border-danger mb-3";
        registerAlert.textContent = (error && error.message) || translateAuthError(error && error.code);
        registerAlert.classList.remove("d-none");
      }
    } finally {
      if (registerSpinner) registerSpinner.classList.add("d-none");
      if (registerBtnText) registerBtnText.textContent = "Criar conta";
      if (btnSubmitRegister) btnSubmitRegister.disabled = false;
    }
  };

  if (registerForm) {
    registerForm.addEventListener("submit", handleRegisterSubmit);
  }

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

  let activeGlobalProfileUnsub = null;

  const fService = window.FirebaseService || FirebaseService;
  if (fService) {
    fService.subscribeToAuth((user) => {
      if (activeGlobalProfileUnsub) {
        activeGlobalProfileUnsub();
        activeGlobalProfileUnsub = null;
      }

      const btnAuthTrigger = document.getElementById("btn-auth-trigger");
      const btnAuthTriggerMobile = document.getElementById("btn-auth-trigger-mobile");
      const btnLogoutAction = document.getElementById("btn-logout-action");
      const btnLogoutActionMobile = document.getElementById("btn-logout-action-mobile");
      
      const userProfileDesktop = document.getElementById("user-profile-dropdown-desktop");
      const userProfileMobile = document.getElementById("user-profile-dropdown-mobile");

      const desktopUserName = document.getElementById("desktop-user-name");
      const desktopDropdownName = document.getElementById("desktop-dropdown-user-name");
      const desktopDropdownEmail = document.getElementById("desktop-dropdown-user-email");
      const desktopAvatarContainer = document.getElementById("desktop-user-avatar-container");

      const mobileDropdownName = document.getElementById("mobile-dropdown-user-name");
      const mobileDropdownEmail = document.getElementById("mobile-dropdown-user-email");
      const mobileAvatarContainer = document.getElementById("mobile-user-avatar-container");

      if (user) {
        if (!user.emailVerified) {
          fService.logout();
          return;
        }
        const initialNickname = user.displayName || user.email.split("@")[0];
        localStorage.setItem("papos_nickname", initialNickname);

        fService.syncUserProfile().then((profileData) => {
          if (profileData) {
            if (profileData.permanentId) {
              localStorage.setItem("papos_permanent_id", profileData.permanentId);
              const localIdEl = document.getElementById("user-local-id");
              if (localIdEl) {
                localIdEl.textContent = profileData.permanentId;
              }
            }
            localStorage.setItem("papos_is_admin", profileData.admin === true ? "true" : "false");
          }
        }).catch((err) => {
          console.error("Error syncing profile on auth:", err);
        });

        if (typeof fService.subscribeToUserProfile === "function") {
          activeGlobalProfileUnsub = fService.subscribeToUserProfile(user.uid, (profile) => {
            if (!profile) return;
            const nick = profile.displayName || profile.nickname || profile.name || user.email.split("@")[0];
            const bio = profile.bio || "";
            const age = profile.age !== undefined && profile.age !== null ? profile.age : "";
            const gender = profile.gender || "";
            const permId = profile.permanentId || profile.internalId || "USR-000000";

            localStorage.setItem("papos_nickname", nick);
            localStorage.setItem("papos_bio", bio);
            localStorage.setItem("papos_age", String(age));
            localStorage.setItem("papos_gender", gender);
            localStorage.setItem("papos_permanent_id", permId);
            localStorage.setItem("papos_is_admin", (profile.admin === true || user.uid === "iMDKTiIEezc2w2VQ2SO27bXsQTd2") ? "true" : "false");

            if (desktopUserName) desktopUserName.textContent = nick;
            if (desktopDropdownName) desktopDropdownName.textContent = nick;
            if (mobileDropdownName) mobileDropdownName.textContent = nick;
            const mobileMenuUserNickEl = document.getElementById("mobile-menu-user-nick");
            if (mobileMenuUserNickEl) mobileMenuUserNickEl.textContent = `Olá, ${nick}`;

            const renderAvatar = (name, size) => {
              const initial = name ? name.trim().charAt(0).toUpperCase() : "A";
              return `<div class="avatar-circle ${size}" title="${name}">${initial}</div>`;
            };

            if (desktopAvatarContainer) {
              desktopAvatarContainer.innerHTML = renderAvatar(nick, "avatar-xs");
            }
            if (mobileAvatarContainer) {
              mobileAvatarContainer.innerHTML = renderAvatar(nick, "avatar-xs");
            }

            const localIdEl = document.getElementById("user-local-id");
            if (localIdEl) {
              localIdEl.textContent = permId;
            }

            const userHeaderContainer = document.getElementById("user-profile-header");
            if (userHeaderContainer) {
              userHeaderContainer.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                  ${renderAvatar(nick, "avatar-sm")}
                  <div class="d-none d-sm-block text-start">
                    <p class="mb-0 fw-semibold lh-1 text-white">${nick}</p>
                    <small class="text-success"><span class="status-indicator status-online position-static d-inline-block me-1" style="width:6px; height:6px;"></span>Conectado</small>
                  </div>
                </div>
              `;
            }
          });
        }

        if (btnAuthTrigger) btnAuthTrigger.classList.add("d-none");
        if (btnAuthTriggerMobile) btnAuthTriggerMobile.classList.add("d-none");

        const sidebarBtnAuth = document.getElementById("sidebar-btn-auth-trigger");
        const sidebarBtnLogout = document.getElementById("sidebar-btn-logout-action");
        if (sidebarBtnAuth) sidebarBtnAuth.classList.add("d-none");
        if (sidebarBtnLogout) {
          sidebarBtnLogout.classList.remove("d-none");
          sidebarBtnLogout.classList.add("d-flex");
        }

        const mobileMenuUserBox = document.getElementById("mobile-menu-user-box");
        const mobileMenuUserNick = document.getElementById("mobile-menu-user-nick");
        const mobileMenuBtnAuth = document.getElementById("mobile-menu-btn-auth");
        if (mobileMenuUserBox) mobileMenuUserBox.classList.remove("d-none");
        if (mobileMenuUserNick) mobileMenuUserNick.textContent = `Olá, ${initialNickname}`;
        if (mobileMenuBtnAuth) mobileMenuBtnAuth.classList.add("d-none");

        if (btnLogoutAction) {
          btnLogoutAction.classList.remove("d-none");
          btnLogoutAction.classList.add("d-flex");
        }
        if (btnLogoutActionMobile) {
          btnLogoutActionMobile.classList.remove("d-none");
          btnLogoutActionMobile.classList.add("d-flex");
        }

        if (userProfileDesktop) userProfileDesktop.classList.remove("d-none");
        if (userProfileMobile) userProfileMobile.classList.remove("d-none");
        const headerThreeDots = document.getElementById("header-three-dots-container");
        if (headerThreeDots) headerThreeDots.classList.remove("d-none");

        if (desktopUserName) desktopUserName.textContent = nickname;
        if (desktopDropdownName) desktopDropdownName.textContent = nickname;
        if (desktopDropdownEmail) desktopDropdownEmail.textContent = user.email;

        if (mobileDropdownName) mobileDropdownName.textContent = nickname;
        if (mobileDropdownEmail) mobileDropdownEmail.textContent = user.email;

        const renderAvatar = (name, size) => {
          const initial = name ? name.trim().charAt(0).toUpperCase() : "A";
          return `<div class="avatar-circle ${size}" title="${name}">${initial}</div>`;
        };

        if (desktopAvatarContainer) {
          desktopAvatarContainer.innerHTML = renderAvatar(nickname, "avatar-xs");
        }
        if (mobileAvatarContainer) {
          mobileAvatarContainer.innerHTML = renderAvatar(nickname, "avatar-xs");
        }

      } else {
        
        if (btnAuthTrigger) btnAuthTrigger.classList.remove("d-none");
        if (btnAuthTriggerMobile) btnAuthTriggerMobile.classList.remove("d-none");

        const sidebarBtnAuthOut = document.getElementById("sidebar-btn-auth-trigger");
        const sidebarBtnLogoutOut = document.getElementById("sidebar-btn-logout-action");
        if (sidebarBtnAuthOut) sidebarBtnAuthOut.classList.remove("d-none");
        if (sidebarBtnLogoutOut) {
          sidebarBtnLogoutOut.classList.add("d-none");
          sidebarBtnLogoutOut.classList.remove("d-flex");
        }

        const mobileMenuUserBoxOut = document.getElementById("mobile-menu-user-box");
        const mobileMenuBtnAuthOut = document.getElementById("mobile-menu-btn-auth");
        if (mobileMenuUserBoxOut) mobileMenuUserBoxOut.classList.add("d-none");
        if (mobileMenuBtnAuthOut) mobileMenuBtnAuthOut.classList.remove("d-none");

        if (btnLogoutAction) {
          btnLogoutAction.classList.add("d-none");
          btnLogoutAction.classList.remove("d-flex");
        }
        if (btnLogoutActionMobile) {
          btnLogoutActionMobile.classList.add("d-none");
          btnLogoutActionMobile.classList.remove("d-flex");
        }

        if (userProfileDesktop) userProfileDesktop.classList.add("d-none");
        if (userProfileMobile) userProfileMobile.classList.add("d-none");
        const headerThreeDotsOut = document.getElementById("header-three-dots-container");
        if (headerThreeDotsOut) headerThreeDotsOut.classList.add("d-none");
      }
    });
  }

  const btnConfirmLogoutAction = document.getElementById("btn-confirm-logout-action");
  if (btnConfirmLogoutAction) {
    btnConfirmLogoutAction.addEventListener("click", async () => {
      try {
        const currentNickname = localStorage.getItem("papos_nickname");
        
        await fService.logout();

        if (currentNickname) {
          localStorage.removeItem(`papos_pms_${currentNickname}`);
        }
        localStorage.removeItem("papos_nickname");
        localStorage.removeItem("papos_photo");
        localStorage.removeItem("papos_permanent_id");

        const logoutModalEl = document.getElementById("logoutConfirmModal");
        if (logoutModalEl) {
          const modalInstance = bootstrap.Modal.getInstance(logoutModalEl);
          if (modalInstance) modalInstance.hide();
        }

        window.location.reload();
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
      }
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("action") === "login" || urlParams.get("auth") === "login") {
    setTimeout(() => {
      try {
        const modal = new bootstrap.Modal(authModalEl);
        showLoginTab();
        modal.show();
      } catch (e) {}
    }, 400);
  }
});