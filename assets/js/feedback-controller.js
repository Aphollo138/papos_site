/**
 * feedback-controller.js
 * Gerenciamento do Sistema de Avaliações (Feedback) do Papo.net
 */

(function () {
  let selectedRating = 0;
  let hoveredRating = 0;

  function injectFeedbackModal() {
    if (document.getElementById("feedbackModal")) return;

    const modalHTML = `
      <div class="modal fade" id="feedbackModal" tabindex="-1" aria-labelledby="feedbackModalLabel" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content text-white border-0 shadow-lg" style="background-color: #1a1e24; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08) !important;">
            
            <!-- Header -->
            <div class="modal-header border-0 pb-0 px-4 pt-4 position-relative d-flex align-items-center justify-content-between">
              <h5 class="modal-title fw-bold text-white d-flex align-items-center gap-2" id="feedbackModalLabel" style="font-size: 1.25rem;">
                <span>⭐ Avalie o Papo.net</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar" style="font-size: 0.9rem;"></button>
            </div>

            <!-- Body -->
            <div class="modal-body px-4 py-3">
              <p class="small mb-4 text-center" style="color: #9f9f9f; font-size: 0.95rem; line-height: 1.5;">
                Sua opinião é muito importante para continuarmos melhorando a plataforma.
              </p>

              <!-- Star Rating Container -->
              <div class="d-flex justify-content-center align-items-center gap-2 mb-4 py-2" id="feedback-stars-container" role="group" aria-label="Avaliação por estrelas">
                <button type="button" class="feedback-star-btn" data-star="1" aria-label="1 Estrela">
                  <i class="bi bi-star"></i>
                </button>
                <button type="button" class="feedback-star-btn" data-star="2" aria-label="2 Estrelas">
                  <i class="bi bi-star"></i>
                </button>
                <button type="button" class="feedback-star-btn" data-star="3" aria-label="3 Estrelas">
                  <i class="bi bi-star"></i>
                </button>
                <button type="button" class="feedback-star-btn" data-star="4" aria-label="4 Estrelas">
                  <i class="bi bi-star"></i>
                </button>
                <button type="button" class="feedback-star-btn" data-star="5" aria-label="5 Estrelas">
                  <i class="bi bi-star"></i>
                </button>
              </div>

              <!-- Comment Field -->
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label for="feedback-comment" class="form-label text-white fw-medium small mb-0">Seu Comentário</label>
                  <span class="small" id="feedback-char-count" style="color: #9f9f9f; font-size: 0.8rem;">0 / 400</span>
                </div>
                <textarea 
                  class="form-control bg-dark text-white border-secondary" 
                  id="feedback-comment" 
                  rows="4" 
                  maxlength="400" 
                  placeholder="Conte-nos o que você achou do Papo.net ou dê uma sugestão..." 
                  style="font-size: 16px; border-radius: 10px; background-color: #121519 !important; border-color: rgba(255,255,255,0.12) !important; color: #fff !important; resize: none;"></textarea>
              </div>

              <!-- Validation Alert Message -->
              <div class="alert alert-danger d-none py-2 px-3 small mb-3 align-items-center gap-2" id="feedback-error-msg" role="alert" style="border-radius: 8px; font-size: 0.875rem;">
                <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                <span>Selecione uma nota e escreva um comentário.</span>
              </div>
            </div>

            <!-- Footer -->
            <div class="modal-footer border-0 px-4 pb-4 pt-0">
              <button type="button" class="btn btn-success fw-bold w-100 py-2.5 d-flex align-items-center justify-content-center gap-2" id="btn-submit-feedback" style="border-radius: 10px; font-size: 1rem; background-color: #10b981; border: none; transition: all 0.2s ease;">
                <span id="btn-submit-feedback-text">Enviar Avaliação</span>
                <span id="btn-submit-feedback-spinner" class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
              </button>
            </div>

          </div>
        </div>
      </div>

      <style>
        .feedback-star-btn {
          background: none;
          border: none;
          padding: 6px 8px;
          font-size: 2.2rem;
          color: rgba(255, 255, 255, 0.22);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.2s ease;
          line-height: 1;
          outline: none !important;
        }
        .feedback-star-btn:hover,
        .feedback-star-btn:focus-visible {
          transform: scale(1.22);
        }
        .feedback-star-btn.active,
        .feedback-star-btn.hovered {
          color: #f59e0b !important;
          transform: scale(1.15);
        }
        #feedbackModal .form-control:focus {
          box-shadow: 0 0 0 0.25rem rgba(16, 185, 129, 0.25);
          border-color: #10b981 !important;
        }
      </style>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    setupModalEvents();
  }

  function setupModalEvents() {
    const modalEl = document.getElementById("feedbackModal");
    if (!modalEl) return;

    const starBtns = modalEl.querySelectorAll(".feedback-star-btn");
    const commentInput = document.getElementById("feedback-comment");
    const charCountEl = document.getElementById("feedback-char-count");
    const submitBtn = document.getElementById("btn-submit-feedback");
    const errorMsg = document.getElementById("feedback-error-msg");

    function renderStars() {
      const activeRating = hoveredRating || selectedRating;
      starBtns.forEach((btn) => {
        const starVal = parseInt(btn.getAttribute("data-star"), 10);
        const icon = btn.querySelector("i");
        if (starVal <= activeRating) {
          btn.classList.add("active");
          if (icon) {
            icon.className = "bi bi-star-fill";
          }
        } else {
          btn.classList.remove("active");
          if (icon) {
            icon.className = "bi bi-star";
          }
        }
      });
    }

    starBtns.forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        hoveredRating = parseInt(btn.getAttribute("data-star"), 10);
        renderStars();
      });

      btn.addEventListener("mouseleave", () => {
        hoveredRating = 0;
        renderStars();
      });

      btn.addEventListener("click", () => {
        selectedRating = parseInt(btn.getAttribute("data-star"), 10);
        renderStars();
        if (errorMsg) errorMsg.classList.add("d-none");
      });
    });

    if (commentInput && charCountEl) {
      commentInput.addEventListener("input", () => {
        const len = commentInput.value.length;
        charCountEl.textContent = `${len} / 400`;
        if (errorMsg) errorMsg.classList.add("d-none");
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        const comment = commentInput ? commentInput.value.trim() : "";

        if (selectedRating <= 0 || !comment) {
          if (errorMsg) errorMsg.classList.remove("d-none");
          return;
        }

        if (errorMsg) errorMsg.classList.add("d-none");

        // Set Loading State
        submitBtn.disabled = true;
        const btnText = document.getElementById("btn-submit-feedback-text");
        const btnSpinner = document.getElementById("btn-submit-feedback-spinner");
        if (btnText) btnText.textContent = "Enviando...";
        if (btnSpinner) btnSpinner.classList.remove("d-none");

        try {
          const fService = window.FirebaseService || (typeof FirebaseService !== "undefined" ? FirebaseService : null);
          if (fService && typeof fService.addFeedback === "function") {
            await fService.addFeedback({
              stars: selectedRating,
              comment: comment
            });
          } else {
            console.warn("FirebaseService.addFeedback não disponível no momento.");
          }

          if (window.showToast) {
            window.showToast("Obrigado pela sua avaliação ❤️", "success");
          } else if (window.showAdminToast) {
            window.showAdminToast("Obrigado pela sua avaliação ❤️", "success");
          } else {
            alert("Obrigado pela sua avaliação ❤️");
          }

          // Close modal and reset form
          const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
          bsModal.hide();

          resetForm();
        } catch (err) {
          console.error("Erro ao enviar avaliação:", err);
          if (window.showToast) {
            window.showToast("Erro ao enviar avaliação. Tente novamente.", "error");
          }
        } finally {
          submitBtn.disabled = false;
          if (btnText) btnText.textContent = "Enviar Avaliação";
          if (btnSpinner) btnSpinner.classList.add("d-none");
        }
      });
    }

    modalEl.addEventListener("hidden.bs.modal", () => {
      resetForm();
    });
  }

  function resetForm() {
    selectedRating = 0;
    hoveredRating = 0;

    const modalEl = document.getElementById("feedbackModal");
    if (!modalEl) return;

    const starBtns = modalEl.querySelectorAll(".feedback-star-btn");
    starBtns.forEach((btn) => {
      btn.classList.remove("active");
      const icon = btn.querySelector("i");
      if (icon) icon.className = "bi bi-star";
    });

    const commentInput = document.getElementById("feedback-comment");
    if (commentInput) commentInput.value = "";

    const charCountEl = document.getElementById("feedback-char-count");
    if (charCountEl) charCountEl.textContent = "0 / 400";

    const errorMsg = document.getElementById("feedback-error-msg");
    if (errorMsg) errorMsg.classList.add("d-none");
  }

  window.openFeedbackModal = function () {
    injectFeedbackModal();
    const modalEl = document.getElementById("feedbackModal");
    if (modalEl) {
      const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      bsModal.show();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    injectFeedbackModal();
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    injectFeedbackModal();
  }
})();
