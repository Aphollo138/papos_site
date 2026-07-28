
(function () {
  let currentStep = 1;
  let userProfileUnsubscribe = null;
  let currentUserData = null;

  let btnRemoveAdsElement = null;
  let btnRemoveAdsParent = null;
  let btnRemoveAdsNextSibling = null;

  let btnMobileRemoveAdsElement = null;
  let btnMobileRemoveAdsParent = null;
  let btnMobileRemoveAdsNextSibling = null;

  function getAuthUser() {
    if (window.FirebaseService && typeof window.FirebaseService.getCurrentUser === "function") {
      return window.FirebaseService.getCurrentUser();
    }
    return null;
  }

  function checkAdsStatus(userData) {
    currentUserData = userData;
    const btnRemoveAds = document.getElementById("btn-remove-ads");
    const mobileBtnRemoveAds = document.getElementById("mobile-menu-remove-ads");

    if (btnRemoveAds && !btnRemoveAdsElement) {
      btnRemoveAdsElement = btnRemoveAds;
      btnRemoveAdsParent = btnRemoveAds.parentNode;
      btnRemoveAdsNextSibling = btnRemoveAds.nextSibling;
    }
    if (mobileBtnRemoveAds && !btnMobileRemoveAdsElement) {
      btnMobileRemoveAdsElement = mobileBtnRemoveAds;
      btnMobileRemoveAdsParent = mobileBtnRemoveAds.parentNode;
      btnMobileRemoveAdsNextSibling = mobileBtnRemoveAds.nextSibling;
    }

    const isAdsDisabled = Boolean(userData && (userData.adsDisabled === true || userData.admin === true));

    if (isAdsDisabled) {
      if (typeof window.desabilitarMonetag === "function") {
        window.desabilitarMonetag();
      }

      const modalEl = document.getElementById("removeAdsModal");
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        const bsModal = window.bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
      }

      const targetBtn = document.getElementById("btn-remove-ads");
      if (targetBtn) {
        if (!btnRemoveAdsParent) btnRemoveAdsParent = targetBtn.parentNode;
        if (!btnRemoveAdsNextSibling) btnRemoveAdsNextSibling = targetBtn.nextSibling;
        if (!btnRemoveAdsElement) btnRemoveAdsElement = targetBtn;
        targetBtn.remove();
      }

      const targetMobileBtn = document.getElementById("mobile-menu-remove-ads");
      if (targetMobileBtn) {
        if (!btnMobileRemoveAdsParent) btnMobileRemoveAdsParent = targetMobileBtn.parentNode;
        if (!btnMobileRemoveAdsNextSibling) btnMobileRemoveAdsNextSibling = targetMobileBtn.nextSibling;
        if (!btnMobileRemoveAdsElement) btnMobileRemoveAdsElement = targetMobileBtn;
        targetMobileBtn.remove();
      }
    } else {
      
      if (!document.getElementById("btn-remove-ads") && btnRemoveAdsElement && btnRemoveAdsParent) {
        if (btnRemoveAdsNextSibling && btnRemoveAdsParent.contains(btnRemoveAdsNextSibling)) {
          btnRemoveAdsParent.insertBefore(btnRemoveAdsElement, btnRemoveAdsNextSibling);
        } else {
          btnRemoveAdsParent.appendChild(btnRemoveAdsElement);
        }
      }

      if (!document.getElementById("mobile-menu-remove-ads") && btnMobileRemoveAdsElement && btnMobileRemoveAdsParent) {
        if (btnMobileRemoveAdsNextSibling && btnMobileRemoveAdsParent.contains(btnMobileRemoveAdsNextSibling)) {
          btnMobileRemoveAdsParent.insertBefore(btnMobileRemoveAdsElement, btnMobileRemoveAdsNextSibling);
        } else {
          btnMobileRemoveAdsParent.appendChild(btnMobileRemoveAdsElement);
        }
      }

      const currentBtn = document.getElementById("btn-remove-ads");
      if (currentBtn) {
        currentBtn.style.display = "";
        currentBtn.classList.remove("d-none");
      }

      const currentMobileBtn = document.getElementById("mobile-menu-remove-ads");
      if (currentMobileBtn) {
        currentMobileBtn.style.display = "";
        currentMobileBtn.classList.remove("d-none");
      }
    }
  }

  window.checkAdsStatus = checkAdsStatus;

  function initRealtimeAdsListener() {
    if (!window.FirebaseService) {
      setTimeout(initRealtimeAdsListener, 300);
      return;
    }

    if (typeof window.FirebaseService.subscribeToAuth === "function") {
      window.FirebaseService.subscribeToAuth((authUser) => {
        if (userProfileUnsubscribe) {
          userProfileUnsubscribe();
          userProfileUnsubscribe = null;
        }

        if (authUser) {
          if (typeof window.FirebaseService.subscribeToUserProfile === "function") {
            userProfileUnsubscribe = window.FirebaseService.subscribeToUserProfile(authUser.uid, (profile) => {
              checkAdsStatus(profile);
            });
          } else {
            checkAdsStatus(null);
          }
        } else {
          checkAdsStatus(null);
        }
      });
    }
  }

  function getFormattedInternalId() {
    
    if (currentUserData) {
      if (currentUserData.permanentId && currentUserData.permanentId.startsWith("USR-")) {
        return currentUserData.permanentId;
      }
      if (currentUserData.internalId && currentUserData.internalId.startsWith("USR-")) {
        return currentUserData.internalId;
      }
      if (currentUserData.permanentId || currentUserData.internalId) {
        const val = String(currentUserData.permanentId || currentUserData.internalId).replace(/[^0-9A-Z]/gi, "");
        return `USR-${val.padStart(6, "0").toUpperCase()}`;
      }
    }

    const stored = localStorage.getItem("papos_permanent_id");
    if (stored) {
      if (stored.startsWith("USR-")) return stored;
      const clean = stored.replace(/[^0-9A-Z]/gi, "");
      return `USR-${clean.padStart(6, "0").toUpperCase()}`;
    }

    const user = getAuthUser();
    if (user && user.uid) {
      let hash = 0;
      for (let i = 0; i < user.uid.length; i++) {
        hash = (hash << 5) - hash + user.uid.charCodeAt(i);
        hash |= 0;
      }
      const positiveNum = Math.abs(hash) % 900000 + 100000;
      return `USR-${positiveNum}`;
    }

    return "USR-000001";
  }

  function getUserNickname() {
    if (currentUserData && (currentUserData.displayName || currentUserData.nickname)) {
      return currentUserData.displayName || currentUserData.nickname;
    }
    const user = getAuthUser();
    if (user) {
      return user.displayName || (user.email ? user.email.split("@")[0] : "Usuário");
    }
    return "Anônimo";
  }

  function getUserEmail() {
    const user = getAuthUser();
    if (user && user.email) return user.email;
    if (currentUserData && currentUserData.email) return currentUserData.email;
    return "Não informado";
  }

  function injectRemoveAdsModal() {
    if (document.getElementById("removeAdsModal")) return;

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "removeAdsModal";
    modal.tabIndex = -1;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-labelledby", "removeAdsModalTitle");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content text-white border-0">
          
          <!-- Modal Header -->
          <div class="modal-header d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <img src="/assets/icons/ad-blocker.svg" alt="Remover anúncios" title="Remover anúncios" width="22" height="22" style="filter: brightness(0) invert(1);" />
              <h5 class="modal-title fw-bold mb-0" id="removeAdsModalTitle" style="font-size: 1.1rem;">
                Remover anúncios
              </h5>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar" title="Fechar"></button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            
            <!-- Step Indicators -->
            <div class="remove-ads-step-indicator-wrapper">
              <div class="remove-ads-step-text" id="remove-ads-step-title">Etapa 1 de 4</div>
              <div class="remove-ads-steps-dots" aria-label="Progresso do pedido">
                <div class="remove-ads-step-dot active" id="dot-step-1" title="Etapa 1: Apresentação"></div>
                <div class="remove-ads-step-dot" id="dot-step-2" title="Etapa 2: Benefícios"></div>
                <div class="remove-ads-step-dot" id="dot-step-3" title="Etapa 3: Pagamento"></div>
                <div class="remove-ads-step-dot" id="dot-step-4" title="Etapa 4: Confirmação"></div>
              </div>
            </div>

            <!-- ETAPA 1 -->
            <div class="remove-ads-step active" id="remove-ads-step-1">
              <div class="text-center py-2">
                <div class="mb-3">
                  <img src="/assets/icons/ad-blocker.svg" alt="Sem Anúncios" title="Sem Anúncios" width="48" height="48" class="text-primary mb-2" style="filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(200deg) brightness(118%) contrast(119%);" />
                </div>
                
                <p class="text-white-50 mb-3" style="font-size: 0.95rem; line-height: 1.6;">
                  Os anúncios ajudam a manter o <strong class="text-white">Papo.net.br</strong> gratuito.<br />
                  Caso deseje, você pode removê-los permanentemente realizando uma contribuição única de apenas <strong class="text-success fs-6">R$ 5,00</strong>.
                </p>
                <p class="small text-secondary mb-4">
                  Seu benefício ficará salvo permanentemente em sua conta.
                </p>

                <!-- If Logged OUT -->
                <div id="step-1-logged-out" class="p-3 rounded-3 mb-3 text-start" style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.25);">
                  <div class="d-flex align-items-start gap-2 mb-2">
                    <i class="bi bi-exclamation-triangle-fill text-warning mt-0.5"></i>
                    <strong class="text-warning small">Para continuar é necessário possuir uma conta.</strong>
                  </div>
                  <p class="small text-white-50 mb-3" style="line-height: 1.4;">
                    A remoção dos anúncios ficará vinculada ao seu perfil e funcionará em qualquer dispositivo onde você fizer login.
                  </p>
                  <div class="d-flex flex-wrap gap-2 justify-content-end">
                    <button type="button" class="btn btn-outline-light btn-sm px-3 py-1.5 fw-semibold" id="btn-step-1-login" title="Entrar" aria-label="Entrar">
                      Entrar
                    </button>
                    <button type="button" class="btn btn-primary btn-sm px-3 py-1.5 fw-semibold" id="btn-step-1-register" title="Criar conta" aria-label="Criar conta">
                      Criar conta
                    </button>
                    <button type="button" class="btn btn-secondary-custom btn-sm px-3 py-1.5" data-bs-dismiss="modal" title="Fechar" aria-label="Fechar">
                      Fechar
                    </button>
                  </div>
                </div>

                <!-- If Logged IN -->
                <div id="step-1-logged-in" class="d-none">
                  <button type="button" class="btn btn-primary w-100 py-2.5 fw-bold mt-2 d-flex align-items-center justify-content-center gap-2" id="btn-step-1-next" title="Continuar" aria-label="Continuar" style="border-radius: var(--radius-sm);">
                    <span>Continuar</span>
                    <i class="bi bi-arrow-right"></i>
                  </button>
                </div>

              </div>
            </div>

            <!-- ETAPA 2 -->
            <div class="remove-ads-step" id="remove-ads-step-2">
              
              <div class="p-3 mb-3 rounded-3" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25);">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <i class="bi bi-check-circle-fill text-success fs-5"></i>
                  <span class="fw-bold text-success">Conta conectada</span>
                </div>
                <div class="row g-2 text-white-50 small font-monospace">
                  <div class="col-6"><strong>Nick:</strong> <span class="text-white" id="step-2-user-nick">...</span></div>
                  <div class="col-6"><strong>ID:</strong> <span class="text-white" id="step-2-user-id">...</span></div>
                  <div class="col-12"><strong>E-mail:</strong> <span class="text-white" id="step-2-user-email">...</span></div>
                </div>
              </div>

              <h6 class="fw-bold text-white mb-2" style="font-size: 0.95rem;">Benefícios inclusos:</h6>
              
              <div class="d-flex flex-column gap-2 mb-3">
                <div class="benefit-list-item">
                  <i class="bi bi-check-lg"></i>
                  <span>Remoção permanente dos anúncios</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-check-lg"></i>
                  <span>Ajuda a manter o projeto online</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-check-lg"></i>
                  <span>Melhor experiência de navegação</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-check-lg"></i>
                  <span>Benefício salvo na conta</span>
                </div>
              </div>

              <div class="d-flex align-items-center justify-content-between p-3 mb-3 rounded-3" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
                <span class="text-secondary fw-semibold">Contribuição única:</span>
                <span class="text-success fw-bold fs-5">R$ 5,00</span>
              </div>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary-custom py-2 px-3 fw-semibold" id="btn-step-2-back" title="Anterior" aria-label="Anterior" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-arrow-left me-1"></i> Anterior
                </button>
                <button type="button" class="btn btn-primary py-2 w-100 fw-bold d-flex align-items-center justify-content-center gap-2" id="btn-step-2-next" title="Continuar" aria-label="Continuar" style="border-radius: var(--radius-sm);">
                  <span>Continuar</span>
                  <i class="bi bi-arrow-right"></i>
                </button>
              </div>

            </div>

            <!-- ETAPA 3 (PAGAMENTO EXCLUSIVO PIXGG - SEM CAMPO PIX COPIA E COLA) -->
            <div class="remove-ads-step" id="remove-ads-step-3">
              <h6 class="fw-bold text-white mb-3 text-center" style="font-size: 1.05rem;">Pagamento via PixGG</h6>
              
              <div class="pix-details-card mb-4">
                <div class="d-flex align-items-center justify-content-between p-2 mb-2 rounded-2" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
                  <span class="text-secondary small fw-semibold">Valor:</span>
                  <span class="text-success fw-bold fs-6">R$ 5,00</span>
                </div>

                <div class="d-flex align-items-center justify-content-between p-2 mb-2 rounded-2" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
                  <span class="text-secondary small fw-semibold">Email:</span>
                  <span class="text-white small font-monospace" id="pix-email-field">...</span>
                </div>

                <div class="d-flex align-items-center justify-content-between p-2 rounded-2" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
                  <span class="text-secondary small fw-semibold">ID:</span>
                  <span class="text-info small font-monospace fw-bold" id="pix-id-field">...</span>
                </div>
              </div>

              <!-- Botão grande Pagar Agora (PixGG) -->
              <a href="https://pixgg.com/papo_net" target="_blank" rel="noopener noreferrer" class="btn btn-warning w-100 py-3 fw-extrabold text-dark d-flex align-items-center justify-content-center gap-2 mb-4 shadow-sm" title="Pagar agora" aria-label="Pagar agora" style="border-radius: var(--radius-sm); font-size: 1.05rem;">
                <i class="bi bi-box-arrow-up-right fs-5"></i>
                <span>Pagar agora</span>
              </a>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary-custom py-2 px-3 fw-semibold" id="btn-step-3-back" title="Anterior" aria-label="Anterior" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-arrow-left me-1"></i> Anterior
                </button>
                <button type="button" class="btn btn-primary py-2 w-100 fw-bold d-flex align-items-center justify-content-center gap-2" id="btn-step-3-next" title="Próximo" aria-label="Próximo" style="border-radius: var(--radius-sm);">
                  <span>Próximo</span>
                  <i class="bi bi-arrow-right"></i>
                </button>
              </div>

            </div>

            <!-- ETAPA 4 -->
            <div class="remove-ads-step" id="remove-ads-step-4">
              <div class="text-center py-2">
                <div class="mb-3">
                  <i class="bi bi-patch-check-fill text-success" style="font-size: 3.2rem;"></i>
                </div>
                
                <h6 class="fw-bold text-white mb-2" style="font-size: 1.1rem;">Pagamento realizado?</h6>
                
                <p class="text-white-50 small mb-4" style="line-height: 1.6;">
                  Após concluir o pagamento no PixGG clique em <strong class="text-success">"Abrir WhatsApp"</strong>.<br />
                  Nossa equipe irá conferir o comprovante.<br />
                  Assim que confirmado, os anúncios serão removidos permanentemente da sua conta.
                </p>

                <!-- Botão Verde WhatsApp -->
                <a id="btn-send-whatsapp-proof" 
                   href="#" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   class="btn btn-whatsapp-action w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 mb-3" 
                   title="Abrir WhatsApp" 
                   aria-label="Abrir WhatsApp"
                   style="font-size: 1rem;">
                  <img src="/assets/icons/whatsapp.svg" alt="WhatsApp" title="WhatsApp" width="22" height="22" style="filter: brightness(0) invert(1);" />
                  <span>Abrir WhatsApp</span>
                </a>

                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-secondary-custom py-2 px-3 fw-semibold" id="btn-step-4-back" title="Anterior" aria-label="Anterior" style="border-radius: var(--radius-sm);">
                    <i class="bi bi-arrow-left me-1"></i> Anterior
                  </button>
                  <button type="button" class="btn btn-secondary-custom py-2 w-100 fw-semibold" data-bs-dismiss="modal" title="Fechar" aria-label="Fechar" style="border-radius: var(--radius-sm);">
                    Fechar
                  </button>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("show.bs.modal", (e) => {
      if (currentUserData && currentUserData.adsDisabled === true) {
        e.preventDefault();
      }
    });

    attachRemoveAdsEvents(modal);
  }

  function updateStepUI(step) {
    currentStep = step;

    const titleEl = document.getElementById("remove-ads-step-title");
    if (titleEl) titleEl.textContent = `Etapa ${step} de 4`;

    document.querySelectorAll(".remove-ads-step").forEach((el) => {
      el.classList.remove("active");
    });

    const targetStep = document.getElementById(`remove-ads-step-${step}`);
    if (targetStep) targetStep.classList.add("active");

    for (let i = 1; i <= 4; i++) {
      const dot = document.getElementById(`dot-step-${i}`);
      if (!dot) continue;
      dot.classList.remove("active", "completed");
      if (i === step) {
        dot.classList.add("active");
      } else if (i < step) {
        dot.classList.add("completed");
      }
    }

    const user = getAuthUser();
    const isLogged = !!user;

    if (step === 1) {
      const loggedOutBox = document.getElementById("step-1-logged-out");
      const loggedInBox = document.getElementById("step-1-logged-in");

      if (isLogged) {
        if (loggedOutBox) loggedOutBox.classList.add("d-none");
        if (loggedInBox) loggedInBox.classList.remove("d-none");
      } else {
        if (loggedOutBox) loggedOutBox.classList.remove("d-none");
        if (loggedInBox) loggedInBox.classList.add("d-none");
      }
    }

    if (step === 2) {
      const nickEl = document.getElementById("step-2-user-nick");
      const idEl = document.getElementById("step-2-user-id");
      const emailEl = document.getElementById("step-2-user-email");

      if (nickEl) nickEl.textContent = getUserNickname();
      if (idEl) idEl.textContent = getFormattedInternalId();
      if (emailEl) emailEl.textContent = getUserEmail();
    }

    if (step === 3) {
      const pixIdEl = document.getElementById("pix-id-field");
      const pixEmailEl = document.getElementById("pix-email-field");

      if (pixIdEl) pixIdEl.textContent = getFormattedInternalId();
      if (pixEmailEl) pixEmailEl.textContent = getUserEmail();
    }

    if (step === 4) {
      const waBtn = document.getElementById("btn-send-whatsapp-proof");
      if (waBtn) {
        const nick = getUserNickname();
        const email = getUserEmail();
        const internalId = getFormattedInternalId();

        const messageText = `Olá!\n\nAcabei de realizar o pagamento para remover os anúncios do Papo.net.br.\n\nSegue abaixo meus dados.\n\nNick:\n${nick}\n\nEmail:\n${email}\n\nID:\n${internalId}\n\nVou anexar o comprovante logo abaixo.`;
        
        waBtn.href = `https://wa.me/5511913303930?text=${encodeURIComponent(messageText)}`;
      }
    }
  }

  function attachRemoveAdsEvents(modalEl) {
    
    const btnLogin = modalEl.querySelector("#btn-step-1-login");
    const btnRegister = modalEl.querySelector("#btn-step-1-register");
    const btnStep1Next = modalEl.querySelector("#btn-step-1-next");

    if (btnLogin) {
      btnLogin.addEventListener("click", () => {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
        const authModal = document.getElementById("authModal");
        if (authModal) {
          const bAuth = new bootstrap.Modal(authModal);
          bAuth.show();
        }
      });
    }

    if (btnRegister) {
      btnRegister.addEventListener("click", () => {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
        const authModal = document.getElementById("authModal");
        if (authModal) {
          const bAuth = new bootstrap.Modal(authModal);
          bAuth.show();
        }
      });
    }

    if (btnStep1Next) {
      btnStep1Next.addEventListener("click", () => updateStepUI(2));
    }

    const btnStep2Back = modalEl.querySelector("#btn-step-2-back");
    const btnStep2Next = modalEl.querySelector("#btn-step-2-next");

    if (btnStep2Back) btnStep2Back.addEventListener("click", () => updateStepUI(1));
    if (btnStep2Next) btnStep2Next.addEventListener("click", () => updateStepUI(3));

    const btnStep3Back = modalEl.querySelector("#btn-step-3-back");
    const btnStep3Next = modalEl.querySelector("#btn-step-3-next");

    if (btnStep3Back) btnStep3Back.addEventListener("click", () => updateStepUI(2));
    if (btnStep3Next) btnStep3Next.addEventListener("click", () => updateStepUI(4));

    const btnStep4Back = modalEl.querySelector("#btn-step-4-back");
    if (btnStep4Back) btnStep4Back.addEventListener("click", () => updateStepUI(3));
  }

  function initRemoveAds() {
    injectRemoveAdsModal();

    document.addEventListener("click", (e) => {
      const btnHeader = e.target.closest("#btn-remove-ads");
      if (btnHeader) {
        
        if (currentUserData && currentUserData.adsDisabled === true) return;

        const modalEl = document.getElementById("removeAdsModal");
        if (modalEl) {
          updateStepUI(1);
          const bModal = new bootstrap.Modal(modalEl);
          bModal.show();
        }
      }
    });

    initRealtimeAdsListener();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRemoveAds);
  } else {
    initRemoveAds();
  }
})();