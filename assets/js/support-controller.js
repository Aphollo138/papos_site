/**
 * support-controller.js - Support Tickets System (User Side)
 * Handles ticket creation, listing, ticket details, real-time updates and login requirement modal.
 */

(function () {
  let userTickets = [];
  let userTicketsUnsubscribe = null;
  let activeTicketId = null;
  let knownTicketReplies = {};

  // Utility to format timestamp to Brazilian date string
  function formatDate(ts) {
    if (!ts) return "N/A";
    const date = new Date(ts);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // Get status badge HTML
  function getStatusBadge(status) {
    switch (status) {
      case "aberto":
        return `<span class="badge bg-warning text-dark fw-bold px-2.5 py-1" style="font-size: 0.75rem;"><i class="bi bi-clock-history me-1"></i>Aberto</span>`;
      case "em_andamento":
        return `<span class="badge bg-info text-dark fw-bold px-2.5 py-1" style="font-size: 0.75rem;"><i class="bi bi-arrow-repeat me-1"></i>Em andamento</span>`;
      case "encerrado":
        return `<span class="badge bg-secondary text-white fw-bold px-2.5 py-1" style="font-size: 0.75rem;"><i class="bi bi-check-circle-fill me-1"></i>Encerrado</span>`;
      default:
        return `<span class="badge bg-secondary text-white fw-bold px-2.5 py-1" style="font-size: 0.75rem;">${status}</span>`;
    }
  }

  // Inject Custom Support CSS
  function injectSupportCSS() {
    if (document.getElementById("support-custom-css")) return;
    const style = document.createElement("style");
    style.id = "support-custom-css";
    style.textContent = `
      #supportModal .modal-content, #authRequiredSupportModal .modal-content {
        background-color: #0b0b0b !important;
        color: #d7d7d7 !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 18px !important;
      }
      #supportModal .modal-header, #authRequiredSupportModal .modal-header {
        background-color: #111111 !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      .support-card {
        background-color: #171717 !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 14px !important;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .support-card:hover {
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      .support-ticket-item {
        cursor: pointer;
      }
      .support-ticket-item:hover {
        background-color: #222222 !important;
      }
      #supportModal input.form-control,
      #supportModal select.form-select,
      #supportModal textarea.form-control {
        background-color: #141414 !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        border-radius: 10px !important;
        padding: 0.65rem 0.9rem;
        font-size: 1rem !important; /* Prevents auto zoom on mobile browsers */
      }
      #supportModal input.form-control:focus,
      #supportModal select.form-select:focus,
      #supportModal textarea.form-control:focus {
        border-color: #0d6efd !important;
        box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.2) !important;
        outline: none !important;
      }
      .support-tab-btn {
        border-radius: 10px !important;
        font-size: 0.85rem;
        font-weight: 600;
        padding: 0.5rem 1rem;
        transition: all 0.2s ease;
      }
      .support-reply-box {
        background-color: #0f1f38 !important;
        border: 1px solid rgba(13, 110, 253, 0.3) !important;
        border-radius: 12px !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Inject Support Modals UI
  function injectSupportModals() {
    injectSupportCSS();

    // 1. Auth Required Modal (For unauthenticated users trying to open support)
    if (!document.getElementById("authRequiredSupportModal")) {
      const authModalEl = document.createElement("div");
      authModalEl.id = "authRequiredSupportModal";
      authModalEl.className = "modal fade";
      authModalEl.tabIndex = -1;
      authModalEl.setAttribute("aria-hidden", "true");
      authModalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered" style="max-width: 420px;">
          <div class="modal-content shadow-lg text-white">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title fw-bold d-flex align-items-center gap-2" style="font-size: 1.1rem;">
                <i class="bi bi-shield-lock-fill text-primary"></i>
                <span>Entrar para continuar</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body py-4 text-center">
              <div class="mb-3">
                <div class="avatar-circle d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary p-3 mb-2" style="width: 64px; height: 64px;">
                  <i class="bi bi-headset fs-2"></i>
                </div>
              </div>
              <p class="text-white-50 mb-0" style="font-size: 0.95rem; line-height: 1.5;">
                É necessário estar logado para abrir um chamado de suporte.
              </p>
            </div>
            <div class="modal-footer border-0 pt-0 d-flex gap-2">
              <button type="button" class="btn btn-secondary flex-grow-1 py-2" data-bs-dismiss="modal" style="border-radius: 10px; font-size: 0.88rem;">Cancelar</button>
              <button type="button" class="btn btn-primary flex-grow-1 py-2 fw-bold d-flex align-items-center justify-content-center gap-2" id="btn-auth-required-login" style="border-radius: 10px; font-size: 0.88rem;">
                <i class="bi bi-box-arrow-in-right"></i>
                <span>Entrar</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(authModalEl);

      // Connect "Entrar" button inside required modal to trigger #authModal
      const loginBtn = authModalEl.querySelector("#btn-auth-required-login");
      loginBtn.addEventListener("click", () => {
        const modalInstance = bootstrap.Modal.getInstance(authModalEl);
        if (modalInstance) modalInstance.hide();
        const authModalTarget = document.getElementById("authModal");
        if (authModalTarget) {
          const authModalInstance = new bootstrap.Modal(authModalTarget);
          authModalInstance.show();
        }
      });
    }

    // 2. Main Support Modal (For authenticated users)
    if (!document.getElementById("supportModal")) {
      const supportModalEl = document.createElement("div");
      supportModalEl.id = "supportModal";
      supportModalEl.className = "modal fade";
      supportModalEl.tabIndex = -1;
      supportModalEl.setAttribute("aria-hidden", "true");
      supportModalEl.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable" style="max-width: 820px; width: 95%;">
          <div class="modal-content shadow-2xl text-white d-flex flex-column" style="min-height: 580px;">
            
            <!-- Modal Header -->
            <div class="modal-header px-4 py-3 d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center gap-2">
                <div class="bg-primary bg-opacity-20 text-primary p-2 rounded-3 d-flex align-items-center justify-content-center">
                  <i class="bi bi-headset fs-5"></i>
                </div>
                <div>
                  <h5 class="modal-title fw-bold text-white mb-0" style="font-size: 1.15rem;">Suporte e Chamados</h5>
                  <div class="small text-secondary" style="font-size: 0.78rem;">Central de Atendimento ao Usuário</div>
                </div>
              </div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>

            <!-- Navigation Tabs Bar -->
            <div class="px-4 pt-3 pb-2 border-bottom border-secondary border-opacity-25 bg-black bg-opacity-30 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div class="d-flex gap-2">
                <button class="btn btn-primary support-tab-btn" id="btn-tab-my-tickets">
                  <i class="bi bi-ticket-detailed me-1.5"></i> Meus Chamados
                </button>
                <button class="btn btn-outline-secondary text-white support-tab-btn" id="btn-tab-new-ticket">
                  <i class="bi bi-plus-circle me-1.5"></i> Novo Chamado
                </button>
              </div>
              <span class="small text-secondary" id="support-tickets-count-badge">0 chamados</span>
            </div>

            <!-- Modal Body Container -->
            <div class="modal-body p-4 flex-grow-1 overflow-y-auto" style="background-color: #0b0b0b;">
              
              <!-- VIEW 1: MEUS CHAMADOS (LIST) -->
              <div id="support-view-list" class="d-block">
                <div id="support-tickets-loading" class="text-center py-5">
                  <div class="spinner-border text-primary mb-3" role="status"></div>
                  <div class="text-secondary small">Carregando seus chamados...</div>
                </div>

                <div id="support-tickets-empty" class="text-center py-5 d-none">
                  <i class="bi bi-chat-square-dots text-secondary fs-1 mb-3 d-block"></i>
                  <h6 class="fw-bold text-white mb-1">Nenhum chamado encontrado</h6>
                  <p class="text-secondary small mb-3">Você ainda não possui solicitações de suporte cadastradas.</p>
                  <button class="btn btn-primary btn-sm px-3 py-2 fw-semibold" id="btn-empty-create-ticket">
                    <i class="bi bi-plus-lg me-1"></i> Abrir um chamado agora
                  </button>
                </div>

                <div id="support-tickets-container" class="d-none d-flex flex-column gap-3">
                  <!-- Filled dynamically with tickets -->
                </div>
              </div>

              <!-- VIEW 2: NOVO CHAMADO (FORM) -->
              <div id="support-view-form" class="d-none">
                <form id="form-create-support-ticket" novalidate>
                  <div class="mb-3">
                    <label for="support-subject" class="form-label fw-semibold text-white small mb-1">
                      Assunto <span class="text-danger">*</span>
                    </label>
                    <input type="text" class="form-control" id="support-subject" maxlength="100" placeholder="Breve resumo do assunto..." required />
                    <div class="form-text text-secondary" style="font-size: 0.75rem;">Máximo de 100 caracteres.</div>
                  </div>

                  <div class="row g-3 mb-3">
                    <div class="col-md-6">
                      <label for="support-email" class="form-label fw-semibold text-white small mb-1">
                        Seu E-mail de Contato <span class="text-danger">*</span>
                      </label>
                      <input type="email" class="form-control" id="support-email" placeholder="seuemail@exemplo.com" required />
                    </div>

                    <div class="col-md-6">
                      <label for="support-category" class="form-label fw-semibold text-white small mb-1">
                        Categoria <span class="text-danger">*</span>
                      </label>
                      <select class="form-select" id="support-category" required>
                        <option value="BUG">BUG (Erro na plataforma)</option>
                        <option value="Remover anúncio">Remover anúncio</option>
                        <option value="Denúncia de usuário">Denúncia de usuário</option>
                        <option value="Sugestão de melhoria">Sugestão de melhoria</option>
                      </select>
                    </div>
                  </div>

                  <div class="mb-4">
                    <label for="support-message" class="form-label fw-semibold text-white small mb-1">
                      Descrição Detalhada <span class="text-danger">*</span>
                    </label>
                    <textarea class="form-control" id="support-message" rows="6" maxlength="3000" placeholder="Descreva o problema ou solicitação detalhadamente..." style="resize: none;" required></textarea>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                      <span class="text-danger small d-none" id="support-form-error">Preencha todos os campos corretamente.</span>
                      <span class="text-secondary small ms-auto" style="font-size: 0.78rem;"><span id="support-char-count">0</span>/3000</span>
                    </div>
                  </div>

                  <div class="d-flex justify-content-end gap-2 pt-2 border-top border-secondary border-opacity-25">
                    <button type="button" class="btn btn-secondary-custom px-4 py-2" id="btn-support-cancel" style="border-radius: 10px; font-size: 0.88rem;">Cancelar</button>
                    <button type="submit" class="btn btn-primary px-4 py-2 fw-bold d-flex align-items-center gap-2" id="btn-support-submit" style="border-radius: 10px; font-size: 0.88rem;">
                      <span id="support-submit-spinner" class="spinner-border spinner-border-sm d-none" role="status"></span>
                      <i class="bi bi-send-fill" id="support-submit-icon"></i>
                      <span>Enviar chamado</span>
                    </button>
                  </div>
                </form>
              </div>

              <!-- VIEW 3: DETALHES DO CHAMADO (DETAIL) -->
              <div id="support-view-detail" class="d-none">
                <button class="btn btn-sm btn-outline-secondary text-white mb-3 d-flex align-items-center gap-1.5" id="btn-back-to-list">
                  <i class="bi bi-arrow-left"></i> <span>Voltar para Meus Chamados</span>
                </button>

                <div class="support-card p-4 mb-4">
                  <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3 pb-3 border-bottom border-secondary border-opacity-25">
                    <div>
                      <div class="d-flex align-items-center gap-2">
                        <span class="fw-mono fw-bold text-primary" id="detail-ticket-id" style="font-size: 1.1rem;">SUP-000000</span>
                        <span id="detail-ticket-status-badge"></span>
                      </div>
                      <div class="text-secondary small mt-1" id="detail-ticket-date">Data: ...</div>
                    </div>
                    <div class="text-md-end">
                      <span class="badge bg-dark border border-secondary text-white px-2.5 py-1" id="detail-ticket-category">Categoria</span>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label class="text-secondary small fw-bold text-uppercase" style="letter-spacing: 0.05em;">Assunto</label>
                    <h6 class="text-white fw-bold mb-0 mt-1" id="detail-ticket-subject">...</h6>
                  </div>

                  <div class="mb-3">
                    <label class="text-secondary small fw-bold text-uppercase mb-1" style="letter-spacing: 0.05em;">E-mail de contato</label>
                    <div class="text-white-50 small font-monospace" id="detail-ticket-email">...</div>
                  </div>

                  <div>
                    <label class="text-secondary small fw-bold text-uppercase mb-1" style="letter-spacing: 0.05em;">Mensagem enviada</label>
                    <div class="p-3 rounded-3 text-white" style="background-color: #111111; border: 1px solid rgba(255,255,255,0.06); font-size: 0.92rem; white-space: pre-wrap; word-break: break-word;" id="detail-ticket-message">...</div>
                  </div>
                </div>

                <!-- Admin Response Card -->
                <div class="support-reply-box p-4" id="detail-ticket-reply-card">
                  <div class="d-flex align-items-center gap-2 mb-2">
                    <i class="bi bi-shield-check text-primary fs-5"></i>
                    <h6 class="fw-bold text-white mb-0">Resposta do Administrador</h6>
                  </div>
                  <div class="text-white p-3 rounded-3 mt-2" style="background-color: rgba(0,0,0,0.4); font-size: 0.92rem; white-space: pre-wrap; word-break: break-word;" id="detail-ticket-reply-text">
                    Aguardando resposta da equipe de suporte...
                  </div>
                  <div class="text-secondary small text-end mt-2" id="detail-ticket-updated-at"></div>
                </div>

              </div>

            </div>
          </div>
        </div>
      `;
      document.body.appendChild(supportModalEl);

      // Setup Support Modal Interactions
      setupSupportModalEvents();
    }
  }

  // Switch between views inside support modal
  function showSupportView(viewName) {
    const viewList = document.getElementById("support-view-list");
    const viewForm = document.getElementById("support-view-form");
    const viewDetail = document.getElementById("support-view-detail");

    const btnList = document.getElementById("btn-tab-my-tickets");
    const btnForm = document.getElementById("btn-tab-new-ticket");

    if (!viewList || !viewForm || !viewDetail) return;

    viewList.classList.add("d-none");
    viewForm.classList.add("d-none");
    viewDetail.classList.add("d-none");

    btnList.className = "btn btn-outline-secondary text-white support-tab-btn";
    btnForm.className = "btn btn-outline-secondary text-white support-tab-btn";

    if (viewName === "form") {
      viewForm.classList.remove("d-none");
      btnForm.className = "btn btn-primary support-tab-btn";
      
      // Auto prefill email
      const emailInput = document.getElementById("support-email");
      if (emailInput && window.FirebaseService) {
        const currentUser = window.FirebaseService.getCurrentUser();
        if (currentUser && currentUser.email) {
          emailInput.value = currentUser.email;
        }
      }
    } else if (viewName === "detail") {
      viewDetail.classList.remove("d-none");
    } else {
      viewList.classList.remove("d-none");
      btnList.className = "btn btn-primary support-tab-btn";
    }
  }

  // Render User Tickets List
  function renderUserTicketsList() {
    const loadingEl = document.getElementById("support-tickets-loading");
    const emptyEl = document.getElementById("support-tickets-empty");
    const containerEl = document.getElementById("support-tickets-container");
    const badgeCountEl = document.getElementById("support-tickets-count-badge");

    if (!loadingEl || !emptyEl || !containerEl) return;

    loadingEl.classList.add("d-none");

    if (badgeCountEl) {
      badgeCountEl.textContent = `${userTickets.length} chamado(s)`;
    }

    if (userTickets.length === 0) {
      emptyEl.classList.remove("d-none");
      containerEl.classList.add("d-none");
      containerEl.innerHTML = "";
      return;
    }

    emptyEl.classList.add("d-none");
    containerEl.classList.remove("d-none");

    let html = "";
    userTickets.forEach((ticket) => {
      const hasReply = Boolean(ticket.adminReply);
      html += `
        <div class="support-card support-ticket-item p-3" data-id="${ticket.id}">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
            <div class="d-flex align-items-center gap-2">
              <span class="fw-bold font-monospace text-primary" style="font-size: 0.95rem;">${ticket.ticketId || "SUP-000000"}</span>
              ${getStatusBadge(ticket.status)}
              ${hasReply ? `<span class="badge bg-primary text-white" style="font-size: 0.7rem;"><i class="bi bi-chat-left-text me-1"></i>Respondido</span>` : ''}
            </div>
            <span class="text-secondary small" style="font-size: 0.78rem;">${formatDate(ticket.createdAt)}</span>
          </div>

          <h6 class="text-white fw-bold mb-1 text-truncate" style="font-size: 0.95rem;">${ticket.subject || "Sem assunto"}</h6>
          
          <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-secondary border-opacity-10">
            <span class="badge bg-dark border border-secondary text-white-50" style="font-size: 0.75rem;">${ticket.category || "BUG"}</span>
            <span class="text-primary small fw-semibold d-flex align-items-center gap-1">
              Ver detalhes <i class="bi bi-chevron-right"></i>
            </span>
          </div>
        </div>
      `;
    });

    containerEl.innerHTML = html;

    // Attach click event to ticket items
    containerEl.querySelectorAll(".support-ticket-item").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        openTicketDetail(id);
      });
    });
  }

  // Open Ticket Detail View
  function openTicketDetail(ticketDocId) {
    const ticket = userTickets.find((t) => t.id === ticketDocId || t.ticketId === ticketDocId);
    if (!ticket) return;

    activeTicketId = ticket.id;

    document.getElementById("detail-ticket-id").textContent = ticket.ticketId || "SUP-000000";
    document.getElementById("detail-ticket-status-badge").innerHTML = getStatusBadge(ticket.status);
    document.getElementById("detail-ticket-date").textContent = `Criado em: ${formatDate(ticket.createdAt)}`;
    document.getElementById("detail-ticket-category").textContent = ticket.category || "BUG";
    document.getElementById("detail-ticket-subject").textContent = ticket.subject || "Sem assunto";
    document.getElementById("detail-ticket-email").textContent = ticket.email || "Não informado";
    document.getElementById("detail-ticket-message").textContent = ticket.message || "";

    const replyCard = document.getElementById("detail-ticket-reply-card");
    const replyText = document.getElementById("detail-ticket-reply-text");
    const replyDate = document.getElementById("detail-ticket-updated-at");

    if (ticket.adminReply) {
      replyCard.className = "support-reply-box p-4 border-primary";
      replyText.textContent = ticket.adminReply;
      replyDate.textContent = `Atualizado em: ${formatDate(ticket.updatedAt)}`;
    } else {
      replyCard.className = "support-card p-4";
      replyText.innerHTML = `<span class="text-secondary italic"><i class="bi bi-clock me-1"></i>Aguardando resposta da administração...</span>`;
      replyDate.textContent = "";
    }

    showSupportView("detail");
  }

  // Setup Event Listeners inside Support Modal
  function setupSupportModalEvents() {
    const btnTabList = document.getElementById("btn-tab-my-tickets");
    const btnTabForm = document.getElementById("btn-tab-new-ticket");
    const btnEmptyCreate = document.getElementById("btn-empty-create-ticket");
    const btnBackToList = document.getElementById("btn-back-to-list");
    const btnCancel = document.getElementById("btn-support-cancel");
    const form = document.getElementById("form-create-support-ticket");
    const textareaMsg = document.getElementById("support-message");
    const charCountEl = document.getElementById("support-char-count");

    if (btnTabList) btnTabList.addEventListener("click", () => showSupportView("list"));
    if (btnTabForm) btnTabForm.addEventListener("click", () => showSupportView("form"));
    if (btnEmptyCreate) btnEmptyCreate.addEventListener("click", () => showSupportView("form"));
    if (btnBackToList) btnBackToList.addEventListener("click", () => showSupportView("list"));
    if (btnCancel) btnCancel.addEventListener("click", () => showSupportView("list"));

    // Character counter
    if (textareaMsg && charCountEl) {
      textareaMsg.addEventListener("input", () => {
        charCountEl.textContent = textareaMsg.value.length;
      });
    }

    // Submit Ticket Form
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const subjectInput = document.getElementById("support-subject");
        const emailInput = document.getElementById("support-email");
        const categoryInput = document.getElementById("support-category");
        const messageInput = document.getElementById("support-message");
        const formError = document.getElementById("support-form-error");

        const submitBtn = document.getElementById("btn-support-submit");
        const submitSpinner = document.getElementById("support-submit-spinner");
        const submitIcon = document.getElementById("support-submit-icon");

        const subject = subjectInput ? subjectInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const category = categoryInput ? categoryInput.value : "BUG";
        const message = messageInput ? messageInput.value.trim() : "";

        // Validate
        if (!subject || !email || !message || subject.length > 100 || message.length > 3000) {
          if (formError) {
            formError.textContent = "Por favor, preencha todos os campos corretamente.";
            formError.classList.remove("d-none");
          }
          return;
        }

        // Email regex check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          if (formError) {
            formError.textContent = "Por favor, insira um e-mail válido.";
            formError.classList.remove("d-none");
          }
          return;
        }

        if (formError) formError.classList.add("d-none");

        // UI Loading
        submitBtn.disabled = true;
        if (submitSpinner) submitSpinner.classList.remove("d-none");
        if (submitIcon) submitIcon.classList.add("d-none");

        try {
          if (!window.FirebaseService) throw new Error("Serviço Firebase não disponível.");

          const newTicket = await window.FirebaseService.createSupportTicket({
            subject,
            email,
            category,
            message
          });

          // Show Toast notification
          showSupportToast(`Chamado <strong>${newTicket.ticketId}</strong> criado com sucesso!`, "success");

          // Reset Form
          form.reset();
          if (charCountEl) charCountEl.textContent = "0";

          // Switch to detail or list view
          showSupportView("list");

        } catch (err) {
          console.error("Erro ao criar chamado:", err);
          if (formError) {
            formError.textContent = err.message || "Erro ao salvar chamado. Tente novamente.";
            formError.classList.remove("d-none");
          }
        } finally {
          submitBtn.disabled = false;
          if (submitSpinner) submitSpinner.classList.add("d-none");
          if (submitIcon) submitIcon.classList.remove("d-none");
        }
      });
    }
  }

  // Toast notification helper
  function showSupportToast(msgHtml, type = "success") {
    let container = document.getElementById("support-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "support-toast-container";
      container.className = "toast-container position-fixed bottom-0 end-0 p-3";
      container.style.zIndex = "1090";
      document.body.appendChild(container);
    }

    const toastEl = document.createElement("div");
    toastEl.className = `toast align-items-center text-white bg-${type === "success" ? "success" : "primary"} border-0 shadow-lg`;
    toastEl.setAttribute("role", "alert");
    toastEl.setAttribute("aria-live", "assertive");
    toastEl.setAttribute("aria-atomic", "true");
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi bi-${type === "success" ? "check-circle-fill" : "info-circle-fill"} fs-5"></i>
          <div>${msgHtml}</div>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
      </div>
    `;

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 4500 });
    toast.show();
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
  }

  // Listen to User Tickets in Realtime
  function startUserTicketsListener() {
    if (!window.FirebaseService) return;
    const currentUser = window.FirebaseService.getCurrentUser();
    if (!currentUser) return;

    if (userTicketsUnsubscribe) {
      userTicketsUnsubscribe();
      userTicketsUnsubscribe = null;
    }

    userTicketsUnsubscribe = window.FirebaseService.subscribeToUserTickets(currentUser.uid, (list) => {
      // Check for new admin replies to notify user in real time
      list.forEach((ticket) => {
        if (ticket.adminReply && knownTicketReplies[ticket.id] !== undefined && knownTicketReplies[ticket.id] !== ticket.adminReply) {
          showSupportToast(`Seu chamado <strong>${ticket.ticketId}</strong> recebeu uma resposta do suporte!`, "info");
        }
        knownTicketReplies[ticket.id] = ticket.adminReply || "";
      });

      userTickets = list || [];
      renderUserTicketsList();

      // If active ticket detail is open, update its content live
      if (activeTicketId) {
        const currentTicket = userTickets.find((t) => t.id === activeTicketId);
        if (currentTicket) openTicketDetail(currentTicket.id);
      }
    });
  }

  // Handle Support Button Click
  function handleSupportButtonClick() {
    injectSupportModals();

    const currentUser = window.FirebaseService ? window.FirebaseService.getCurrentUser() : null;

    if (!currentUser) {
      // Show login required modal
      const authRequiredModal = document.getElementById("authRequiredSupportModal");
      if (authRequiredModal) {
        const instance = new bootstrap.Modal(authRequiredModal);
        instance.show();
      }
    } else {
      // Show support modal
      const supportModal = document.getElementById("supportModal");
      if (supportModal) {
        const instance = new bootstrap.Modal(supportModal);
        instance.show();
        startUserTicketsListener();
        showSupportView("list");
      }
    }
  }

  // Initialize Support Controller
  function initSupportSystem() {
    injectSupportModals();

    // Attach click handler to header support button
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("#btn-open-support");
      if (btn) {
        e.preventDefault();
        handleSupportButtonClick();
      }
    });

    // Start listener if user is already logged in
    if (window.FirebaseService && typeof window.FirebaseService.subscribeToAuth === "function") {
      window.FirebaseService.subscribeToAuth((user) => {
        if (user) {
          startUserTicketsListener();
        } else {
          if (userTicketsUnsubscribe) {
            userTicketsUnsubscribe();
            userTicketsUnsubscribe = null;
          }
          userTickets = [];
        }
      });
    }
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSupportSystem);
  } else {
    initSupportSystem();
  }
})();
