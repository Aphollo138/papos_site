/**
 * remove-ads.js - Remover Anúncios Modal Flow and Management
 */

(function () {
  let currentStep = 1;

  function isUserLoggedIn() {
    if (window.FirebaseService && typeof window.FirebaseService.getCurrentUser === "function") {
      const user = window.FirebaseService.getCurrentUser();
      return !!user;
    }
    return false;
  }

  function checkUserAdsStatus() {
    const btnHeader = document.getElementById("btn-remove-ads");
    if (!btnHeader) return;

    if (window.FirebaseService && typeof window.FirebaseService.getCurrentUserData === "function") {
      const userData = window.FirebaseService.getCurrentUserData();
      if (userData && userData.adsDisabled === true) {
        btnHeader.classList.add("d-none");
        btnHeader.classList.remove("d-flex");
        return;
      }
    }

    btnHeader.classList.remove("d-none");
    btnHeader.classList.add("d-flex");
  }

  function injectRemoveAdsModal() {
    if (document.getElementById("removeAdsModal")) return;

    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "removeAdsModal";
    modal.tabIndex = -1;
    modal.setAttribute("aria-labelledby", "removeAdsModalTitle");
    modal.setAttribute("aria-hidden", "true");
    modal.style.zIndex = "1080";

    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered" style="max-width: 520px;">
        <div class="modal-content text-white border-0">
          
          <!-- Modal Header -->
          <div class="modal-header d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <img src="/assets/icons/ad-blocker.svg" alt="Remover Anúncios" width="22" height="22" style="filter: brightness(0) invert(1);" />
              <h5 class="modal-title fw-bold mb-0" id="removeAdsModalTitle" style="font-size: 1.1rem;">
                Remover Anúncios
              </h5>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar modal"></button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body">
            
            <!-- Step Indicators -->
            <div class="remove-ads-steps-indicator" aria-label="Progresso do pedido">
              <div class="remove-ads-step-dot active" id="dot-step-1" title="Passo 1: Autenticação"></div>
              <div class="remove-ads-step-dot" id="dot-step-2" title="Passo 2: Vantagens"></div>
              <div class="remove-ads-step-dot" id="dot-step-3" title="Passo 3: Pagamento PIX"></div>
              <div class="remove-ads-step-dot" id="dot-step-4" title="Passo 4: Finalização"></div>
            </div>

            <!-- PASSO 1: Autenticação -->
            <div class="remove-ads-step active" id="remove-ads-step-1">
              <div id="step-1-logged-out" class="text-center py-2">
                <div class="mb-3">
                  <i class="bi bi-person-lock text-warning" style="font-size: 2.5rem;"></i>
                </div>
                <h6 class="fw-bold text-white mb-2">Login Necessário</h6>
                <p class="text-secondary small mb-4" style="line-height: 1.5;">
                  Para associar a remoção de anúncios à sua conta e manter seu acesso limpo em qualquer dispositivo, por favor entre na sua conta ou crie uma nova.
                </p>
                <div class="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                  <button type="button" class="btn btn-outline-light px-4 py-2 fw-semibold" id="btn-remove-ads-login" style="border-radius: var(--radius-sm); font-size: 0.9rem;">
                    <i class="bi bi-box-arrow-in-right me-1"></i> Entrar
                  </button>
                  <button type="button" class="btn btn-primary px-4 py-2 fw-semibold" id="btn-remove-ads-register" style="border-radius: var(--radius-sm); font-size: 0.9rem;">
                    <i class="bi bi-person-plus-fill me-1"></i> Criar conta
                  </button>
                </div>
              </div>

              <div id="step-1-logged-in" class="text-center py-2 d-none">
                <div class="mb-3">
                  <i class="bi bi-check-circle-fill text-success" style="font-size: 2.5rem;"></i>
                </div>
                <h6 class="fw-bold text-white mb-2">Conta Conectada</h6>
                <p class="text-secondary small mb-3">
                  Você está logado como <strong class="text-white" id="remove-ads-user-display">usuário</strong>. A remoção de anúncios será vinculada a este perfil.
                </p>
                <button type="button" class="btn btn-primary w-100 py-2.5 fw-bold mt-2" id="btn-step-1-next" style="border-radius: var(--radius-sm);">
                  Continuar <i class="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>

            <!-- PASSO 2: Vantagens -->
            <div class="remove-ads-step" id="remove-ads-step-2">
              <h6 class="fw-bold text-white mb-3 text-center">Benefícios do Plano Sem Anúncios</h6>
              
              <div class="d-flex flex-column gap-2 mb-4">
                <div class="benefit-list-item">
                  <i class="bi bi-shield-check"></i>
                  <span>Nenhum anúncio no chat</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-slash-circle"></i>
                  <span>Nenhum banner ou imagem publicitária</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-window-x"></i>
                  <span>Nenhuma propaganda pop-up</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-signpost-split"></i>
                  <span>Nenhum redirecionamento externo</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-lightning-charge-fill text-warning"></i>
                  <span>Carregamento mais rápido do bate-papo</span>
                </div>
                <div class="benefit-list-item">
                  <i class="bi bi-stars text-info"></i>
                  <span>Navegação 100% limpa, rápida e sem distrações</span>
                </div>
              </div>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary-custom py-2 px-3 fw-semibold flex-shrink-0" id="btn-step-2-back" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-arrow-left me-1"></i> Voltar
                </button>
                <button type="button" class="btn btn-primary py-2 w-100 fw-bold" id="btn-step-2-next" style="border-radius: var(--radius-sm);">
                  Continuar para Pagamento <i class="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>

            <!-- PASSO 3: Pagamento PIX -->
            <div class="remove-ads-step" id="remove-ads-step-3">
              <h6 class="fw-bold text-white mb-2 text-center">Pagamento via PIX</h6>
              <p class="text-secondary small text-center mb-3">
                Realize o pagamento via PIX para desativar todos os anúncios da sua conta.
              </p>

              <div class="p-3 mb-3 rounded-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                <label class="form-label text-secondary small fw-bold mb-1">Chave PIX (Telefone):</label>
                <div class="d-flex align-items-center gap-2">
                  <div class="pix-key-box flex-grow-1 text-center" id="pix-key-value">
                    5511913303930
                  </div>
                  <button type="button" class="btn btn-outline-light py-2 px-3 flex-shrink-0" id="btn-copy-pix" title="Copiar Chave PIX" aria-label="Copiar Chave PIX" style="border-radius: var(--radius-sm);">
                    <i class="bi bi-copy" id="copy-pix-icon"></i>
                    <span id="copy-pix-text" class="ms-1 small fw-semibold">Copiar</span>
                  </button>
                </div>
              </div>

              <div class="p-3 mb-4 rounded-3" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25);">
                <div class="d-flex align-items-start gap-2">
                  <i class="bi bi-info-circle-fill text-info mt-0.5"></i>
                  <p class="mb-0 text-white-50 small" style="line-height: 1.4;">
                    Após efetuar o pagamento, clique em <strong>"Avançar"</strong> para enviar o comprovante diretamente pelo WhatsApp.
                  </p>
                </div>
              </div>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary-custom py-2 px-3 fw-semibold flex-shrink-0" id="btn-step-3-back" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-arrow-left me-1"></i> Voltar
                </button>
                <button type="button" class="btn btn-primary py-2 w-100 fw-bold" id="btn-step-3-next" style="border-radius: var(--radius-sm);">
                  Avançar <i class="bi bi-arrow-right ms-1"></i>
                </button>
              </div>
            </div>

            <!-- PASSO 4: Instruções e WhatsApp -->
            <div class="remove-ads-step" id="remove-ads-step-4">
              <div class="text-center py-2">
                <div class="mb-3">
                  <i class="bi bi-whatsapp text-success" style="font-size: 3rem;"></i>
                </div>
                <h6 class="fw-bold text-white mb-2">Envio do Comprovante</h6>
                <p class="text-secondary small mb-4" style="line-height: 1.5;">
                  Tudo pronto! Clique no botão abaixo para abrir o WhatsApp e nos enviar o comprovante do pagamento PIX. Nossa equipe ativará o plano sem anúncios na sua conta imediatamente.
                </p>

                <a href="https://wa.me/5511913303930?text=Ol%C3%A1!%20Fiz%20o%20pagamento%20para%20remover%20os%20an%C3%BAncios%20no%20Papos.%20Segue%20o%20comprovante%3A" 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   class="btn btn-success w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-lg mb-3"
                   style="border-radius: var(--radius-sm); font-size: 1rem; background-color: #25d366; border: none;"
                   title="Enviar Comprovante pelo WhatsApp">
                  <i class="bi bi-whatsapp fs-5"></i>
                  <span>Enviar Comprovante no WhatsApp</span>
                </a>

                <button type="button" class="btn btn-secondary-custom w-100 py-2 fw-semibold" id="btn-step-4-back" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-arrow-left me-1"></i> Voltar ao PIX
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    attachRemoveAdsEvents(modal);
  }

  function updateStepUI(step) {
    currentStep = step;
    
    // Hide all steps
    document.querySelectorAll(".remove-ads-step").forEach((el) => {
      el.classList.remove("active");
    });

    // Show active step
    const target = document.getElementById(`remove-ads-step-${step}`);
    if (target) target.classList.add("active");

    // Update step dots
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

    // Step 1 check logged in status
    if (step === 1) {
      const loggedIn = isUserLoggedIn();
      const loggedOutBox = document.getElementById("step-1-logged-out");
      const loggedInBox = document.getElementById("step-1-logged-in");
      const userDisplay = document.getElementById("remove-ads-user-display");

      if (loggedIn) {
        if (loggedOutBox) loggedOutBox.classList.add("d-none");
        if (loggedInBox) loggedInBox.classList.remove("d-none");
        if (userDisplay && window.FirebaseService && window.FirebaseService.getCurrentUser()) {
          const user = window.FirebaseService.getCurrentUser();
          userDisplay.textContent = user.displayName || user.email || "Usuário";
        }
      } else {
        if (loggedOutBox) loggedOutBox.classList.remove("d-none");
        if (loggedInBox) loggedInBox.classList.add("d-none");
      }
    }
  }

  function attachRemoveAdsEvents(modalEl) {
    // Copy PIX button
    const btnCopyPix = modalEl.querySelector("#btn-copy-pix");
    if (btnCopyPix) {
      btnCopyPix.addEventListener("click", () => {
        const pixVal = "5511913303930";
        navigator.clipboard.writeText(pixVal).then(() => {
          const icon = modalEl.querySelector("#copy-pix-icon");
          const text = modalEl.querySelector("#copy-pix-text");
          if (icon) icon.className = "bi bi-check-lg text-success";
          if (text) {
            text.textContent = "Copiado!";
            text.className = "ms-1 small fw-bold text-success";
          }
          setTimeout(() => {
            if (icon) icon.className = "bi bi-copy";
            if (text) {
              text.textContent = "Copiar";
              text.className = "ms-1 small fw-semibold";
            }
          }, 2500);
        }).catch((err) => {
          console.error("Erro ao copiar PIX:", err);
        });
      });
    }

    // Step 1 Auth buttons
    const btnLogin = modalEl.querySelector("#btn-remove-ads-login");
    const btnRegister = modalEl.querySelector("#btn-remove-ads-register");

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

    // Step 1 Next
    const btnStep1Next = modalEl.querySelector("#btn-step-1-next");
    if (btnStep1Next) {
      btnStep1Next.addEventListener("click", () => updateStepUI(2));
    }

    // Step 2 Next & Back
    const btnStep2Next = modalEl.querySelector("#btn-step-2-next");
    const btnStep2Back = modalEl.querySelector("#btn-step-2-back");
    if (btnStep2Next) btnStep2Next.addEventListener("click", () => updateStepUI(3));
    if (btnStep2Back) btnStep2Back.addEventListener("click", () => updateStepUI(1));

    // Step 3 Next & Back
    const btnStep3Next = modalEl.querySelector("#btn-step-3-next");
    const btnStep3Back = modalEl.querySelector("#btn-step-3-back");
    if (btnStep3Next) btnStep3Next.addEventListener("click", () => updateStepUI(4));
    if (btnStep3Back) btnStep3Back.addEventListener("click", () => updateStepUI(2));

    // Step 4 Back
    const btnStep4Back = modalEl.querySelector("#btn-step-4-back");
    if (btnStep4Back) btnStep4Back.addEventListener("click", () => updateStepUI(3));
  }

  function initRemoveAds() {
    injectRemoveAdsModal();

    const btnHeader = document.getElementById("btn-remove-ads");
    if (btnHeader) {
      btnHeader.addEventListener("click", () => {
        const modalEl = document.getElementById("removeAdsModal");
        if (modalEl) {
          updateStepUI(1);
          const bModal = new bootstrap.Modal(modalEl);
          bModal.show();
        }
      });
    }

    // Check ads status periodically / on auth change
    if (window.FirebaseService && typeof window.FirebaseService.onAuthChange === "function") {
      window.FirebaseService.onAuthChange(() => {
        checkUserAdsStatus();
      });
    }

    // Also check on load
    setTimeout(checkUserAdsStatus, 1000);
    setTimeout(checkUserAdsStatus, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRemoveAds);
  } else {
    initRemoveAds();
  }
})();
