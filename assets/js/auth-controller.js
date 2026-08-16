
import FirebaseService from "/firebase/auth.js";

document.addEventListener("DOMContentLoaded", () => {
  
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
      case "auth/too-many-requests":
        return "Acesso temporariamente bloqueado devido a muitas tentativas incorretas. Tente mais tarde.";
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

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerAlert.classList.add("d-none");

    const nickname = registerNickname.value.trim();
    const email = registerEmail.value.trim();
    const password = registerPassword.value;

    if (!validatePasswordsMatch()) return;

    const emailRegex = /^[A-Za-z0-9._%+-]+@(gmail\.com|outlook\.com|hotmail\.com|live\.com|uol\.com\.br|bol\.com\.br)$/i;
    if (!emailRegex.test(email)) {
      registerAlert.textContent = "Utilize um e-mail Gmail, Outlook ou UOL.";
      registerAlert.classList.remove("d-none");
      return;
    }

    if (nickname.length < 2) {
      registerAlert.textContent = "O apelido deve ter no mínimo 2 caracteres.";
      registerAlert.classList.remove("d-none");
      return;
    }

    if (window.isReservedNickname && window.isReservedNickname(nickname)) {
      if (typeof window.showToast === "function") {
        window.showToast("Este nome é reservado pela equipe do Papo.net.br.", "warning");
      }
      registerAlert.textContent = "Este nome é reservado pela equipe do Papo.net.br.";
      registerAlert.classList.remove("d-none");
      return;
    }

    registerSpinner.classList.remove("d-none");
    registerBtnText.textContent = "Criando conta...";
    btnSubmitRegister.disabled = true;

    try {
      await FirebaseService.register(email, password, nickname);
      
      localStorage.setItem("papos_nickname", nickname);

      const modalInstance = bootstrap.Modal.getInstance(authModalEl);
      if (modalInstance) modalInstance.hide();
      
      registerForm.reset();

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
});