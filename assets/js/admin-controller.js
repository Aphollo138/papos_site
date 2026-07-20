/**
 * admin-controller.js - Dynamic Administrative Panel Injection and Controls
 */

(function () {
  let onlineUsers = [];
  let auditLogs = [];
  let currentPage = 1;
  const itemsPerPage = 8;
  let searchQuery = "";
  let activeTab = "users"; // "users", "global", "individual", "audits"

  // Dynamic injection of the Admin floating trigger button and full admin Modal
  function injectAdminPanelUI() {
    if (document.getElementById("admin-trigger-container")) return;

    // 1. Trigger Button
    const triggerContainer = document.createElement("div");
    triggerContainer.id = "admin-trigger-container";
    triggerContainer.className = "position-fixed bottom-0 start-0 m-3";
    triggerContainer.style.zIndex = "1050";
    triggerContainer.innerHTML = `
      <button class="btn btn-dark border-secondary px-3 py-2 shadow d-flex align-items-center gap-2 text-white" id="btn-admin-panel-trigger" style="border-radius: var(--radius-sm); font-size: 0.8rem; background-color: var(--surface-secondary); cursor: pointer; transition: transform 0.2s ease-in-out;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        <i class="bi bi-shield-lock text-success"></i>
        <span>Painel Admin</span>
      </button>
    `;
    document.body.appendChild(triggerContainer);

    // 2. Admin Control Panel Modal
    const adminModal = document.createElement("div");
    adminModal.id = "adminPanelModal";
    adminModal.className = "modal fade";
    adminModal.tabIndex = -1;
    adminModal.setAttribute("aria-hidden", "true");
    adminModal.style.zIndex = "1060";
    adminModal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content border-secondary shadow-lg rounded-4 overflow-hidden" style="background-color: var(--surface);">
          
          <div class="modal-header border-secondary p-3 d-flex align-items-center justify-content-between" style="background-color: var(--surface-secondary);">
            <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2" style="font-family: var(--font-display);">
              <i class="bi bi-shield-lock-fill text-success"></i>
              <span>Painel de Moderação & Auditoria</span>
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar" style="filter: invert(1);"></button>
          </div>

          <div class="modal-body p-0 d-flex flex-column flex-md-row" style="min-height: 500px;">
            <!-- Tabs Menu Left/Top using Bootstrap components -->
            <div class="col-md-3 border-end border-secondary p-3 d-flex flex-column gap-2" style="background-color: rgba(0,0,0,0.15); min-width: 220px;">
              <ul class="nav nav-pills flex-column gap-2 border-0 w-100" id="adminTab" role="tablist">
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab active text-start text-white w-100 border-0" id="tab-btn-users" data-tab="users" style="border-radius: var(--radius-sm); font-size: 0.85rem; transition: background-color 0.2s; background-color: var(--surface-secondary);" type="button" role="tab">
                    <i class="bi bi-people-fill me-2"></i> Usuários
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start text-white-50 w-100 border-0" id="tab-btn-global" data-tab="global" style="border-radius: var(--radius-sm); font-size: 0.85rem; transition: background-color 0.2s; background-color: transparent;" type="button" role="tab">
                    <i class="bi bi-megaphone-fill me-2"></i> Mensagem Global
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start text-white-50 w-100 border-0" id="tab-btn-individual" data-tab="individual" style="border-radius: var(--radius-sm); font-size: 0.85rem; transition: background-color 0.2s; background-color: transparent;" type="button" role="tab">
                    <i class="bi bi-chat-text-fill me-2"></i> Mensagem Individual
                  </button>
                </li>
              </ul>
            </div>

            <!-- Tab Content Right -->
            <div class="col-md-9 p-4 d-flex flex-column overflow-hidden">
              
              <!-- TAB 1: USERS ONLINE -->
              <div class="admin-tab-content d-flex flex-column h-100 overflow-hidden" id="admin-content-users">
                <div class="d-flex flex-column flex-sm-row gap-3 align-items-sm-center justify-content-between mb-3">
                  <h6 class="text-white fw-bold mb-0">Membros Autenticados Ativos</h6>
                  <div class="input-group" style="max-width: 300px;">
                    <span class="input-group-text bg-dark border-secondary text-secondary" style="border-radius: var(--radius-sm) 0 0 var(--radius-sm);"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control bg-dark text-white border-secondary border-start-0" id="admin-users-search" placeholder="Buscar por apelido ou ID..." style="border-radius: 0 var(--radius-sm) var(--radius-sm) 0;">
                  </div>
                </div>

                <div class="table-responsive flex-grow-1 overflow-y-auto" style="max-height: 320px;">
                  <table class="table table-dark table-hover border-secondary align-middle text-start" style="font-size: 0.8rem; background: transparent;">
                    <thead>
                      <tr class="border-secondary text-secondary">
                        <th>Usuário</th>
                        <th>Email / UID</th>
                        <th>ID Permanente</th>
                        <th>Entrada</th>
                        <th>Sala</th>
                        <th class="text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody id="admin-users-table-body">
                      <!-- Dynamically filled -->
                    </tbody>
                  </table>
                </div>

                <!-- Pagination -->
                <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-secondary">
                  <span class="text-secondary small" id="admin-users-pagination-info">Mostrando 0-0 de 0 usuários</span>
                  <div class="d-flex gap-2">
                    <button class="btn btn-secondary-custom btn-sm py-1 px-3" id="admin-users-btn-prev">Anterior</button>
                    <button class="btn btn-secondary-custom btn-sm py-1 px-3" id="admin-users-btn-next">Próximo</button>
                  </div>
                </div>
              </div>

              <!-- TAB 2: GLOBAL ANNOUNCEMENT -->
              <div class="admin-tab-content d-none flex-column h-100" id="admin-content-global">
                <h6 class="text-white fw-bold mb-2">Enviar Aviso Global</h6>
                <p class="text-secondary small mb-4">Esta mensagem será enviada instantaneamente para todos os usuários atualmente conectados na plataforma, exibindo um modal de atenção.</p>
                
                <div class="mb-4">
                  <label for="admin-global-message" class="form-label text-secondary small fw-bold">Conteúdo da Mensagem</label>
                  <textarea class="form-control bg-dark text-white border-secondary" id="admin-global-message" rows="6" placeholder="Escreva a mensagem administrativa importante aqui..." style="resize: none;"></textarea>
                </div>

                <button class="btn btn-success py-2.5 px-4 fw-bold mt-auto align-self-end" id="btn-admin-send-global" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-send-fill me-2"></i> Enviar Aviso Global
                </button>
              </div>

              <!-- TAB 3: INDIVIDUAL MESSAGE -->
              <div class="admin-tab-content d-none flex-column h-100" id="admin-content-individual">
                <h6 class="text-white fw-bold mb-2">Enviar Mensagem Individual</h6>
                <p class="text-secondary small mb-4">Selecione um usuário online e envie uma notificação administrativa direta.</p>
                
                <div class="mb-3">
                  <label for="admin-individual-user-select" class="form-label text-secondary small fw-bold">Selecione o Usuário Destinatário</label>
                  <select class="form-select bg-dark text-white border-secondary" id="admin-individual-user-select">
                    <option value="">Selecione um usuário...</option>
                    <!-- Filled dynamically -->
                  </select>
                </div>

                <div class="mb-4">
                  <label for="admin-individual-message" class="form-label text-secondary small fw-bold">Conteúdo do Aviso Privado</label>
                  <textarea class="form-control bg-dark text-white border-secondary" id="admin-individual-message" rows="5" placeholder="Escreva a mensagem individual importante aqui..." style="resize: none;"></textarea>
                </div>

                <button class="btn btn-success py-2.5 px-4 fw-bold mt-auto align-self-end" id="btn-admin-send-individual" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-send-fill me-2"></i> Enviar Notificação Direta
                </button>
              </div>

              <!-- TAB 4: AUDIT LOGS -->
              <div class="admin-tab-content d-none flex-column h-100 overflow-hidden" id="admin-content-audits">
                <div class="d-flex align-items-center justify-content-between mb-3">
                  <h6 class="text-white fw-bold mb-0">Logs de Ações da Administração</h6>
                  <button class="btn btn-secondary-custom btn-sm" id="btn-refresh-audit-logs">
                    <i class="bi bi-arrow-clockwise"></i> Atualizar Logs
                  </button>
                </div>

                <div class="table-responsive flex-grow-1 overflow-y-auto" style="max-height: 380px;">
                  <table class="table table-dark table-striped table-hover border-secondary align-middle text-start" style="font-size: 0.75rem; background: transparent;">
                    <thead>
                      <tr class="border-secondary text-secondary">
                        <th>Data/Hora</th>
                        <th>Administrador</th>
                        <th>Ação</th>
                        <th>Alvo</th>
                        <th>Detalhes</th>
                      </tr>
                    </thead>
                    <tbody id="admin-audits-table-body">
                      <!-- Filled dynamically -->
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(adminModal);

    // Setup event listeners for tabs and triggers
    setupAdminPanelListeners();
  }

  function setupAdminPanelListeners() {
    const triggerBtn = document.getElementById("btn-admin-panel-trigger");
    const modalEl = document.getElementById("adminPanelModal");
    if (!triggerBtn || !modalEl) return;

    const bootstrapModal = new bootstrap.Modal(modalEl);

    triggerBtn.addEventListener("click", () => {
      bootstrapModal.show();
      refreshAdminData();
    });

    // Tab buttons switching
    const tabBtns = document.querySelectorAll(".btn-admin-tab");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => {
          b.classList.remove("active");
          b.classList.replace("text-white", "text-white-50");
          b.style.backgroundColor = "transparent";
        });
        btn.classList.add("active");
        btn.classList.replace("text-white-50", "text-white");
        btn.style.backgroundColor = "var(--surface-secondary)";

        activeTab = btn.getAttribute("data-tab");
        showActiveTabContent();
      });
    });

    // Search users
    const searchInput = document.getElementById("admin-users-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1;
        renderUsersTable();
      });
    }

    // Pagination buttons
    const btnPrev = document.getElementById("admin-users-btn-prev");
    const btnNext = document.getElementById("admin-users-btn-next");

    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        if (currentPage > 1) {
          currentPage--;
          renderUsersTable();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        const filtered = getFilteredUsers();
        if (currentPage * itemsPerPage < filtered.length) {
          currentPage++;
          renderUsersTable();
        }
      });
    }

    // Send global warning
    const btnSendGlobal = document.getElementById("btn-admin-send-global");
    if (btnSendGlobal) {
      btnSendGlobal.addEventListener("click", () => {
        const textEl = document.getElementById("admin-global-message");
        const text = textEl ? textEl.value.trim() : "";
        if (!text) {
          window.showAdminToast("Por favor, digite o conteúdo do aviso global.", "error");
          return;
        }

        window.showAdminConfirmModal(
          "Confirmar Aviso Global",
          "Deseja realmente enviar este aviso global para TODOS os usuários online?",
          () => {
            window.showAdminLoading(true);
            sendAdminAction({
              type: "admin_action",
              action: "global_warning",
              text: text
            });
            textEl.value = "";
          }
        );
      });
    }

    // Send individual warning
    const btnSendIndividual = document.getElementById("btn-admin-send-individual");
    if (btnSendIndividual) {
      btnSendIndividual.addEventListener("click", () => {
        const selectEl = document.getElementById("admin-individual-user-select");
        const textEl = document.getElementById("admin-individual-message");
        const targetUid = selectEl ? selectEl.value : "";
        const text = textEl ? textEl.value.trim() : "";

        if (!targetUid) {
          window.showAdminToast("Por favor, selecione um usuário destinatário.", "error");
          return;
        }
        if (!text) {
          window.showAdminToast("Por favor, digite o aviso privado.", "error");
          return;
        }

        window.showAdminConfirmModal(
          "Confirmar Aviso Individual",
          "Deseja realmente enviar este aviso privado para o usuário selecionado?",
          () => {
            window.showAdminLoading(true);
            sendAdminAction({
              type: "admin_action",
              action: "individual_warning",
              targetUid: targetUid,
              text: text
            });
            textEl.value = "";
          }
        );
      });
    }

    // Refresh audit logs button
    const btnRefreshAudits = document.getElementById("btn-refresh-audit-logs");
    if (btnRefreshAudits) {
      btnRefreshAudits.addEventListener("click", () => {
        requestAuditLogs();
      });
    }
  }

  function showActiveTabContent() {
    const contents = document.querySelectorAll(".admin-tab-content");
    contents.forEach((c) => c.classList.add("d-none"));

    const activeContent = document.getElementById(`admin-content-${activeTab}`);
    if (activeContent) {
      activeContent.classList.remove("d-none");
      activeContent.classList.add("d-flex");
    }

    if (activeTab === "audits") {
      requestAuditLogs();
    }
  }

  function getFilteredUsers() {
    if (!searchQuery) return onlineUsers;
    return onlineUsers.filter((u) => {
      return (
        u.nickname.toLowerCase().includes(searchQuery) ||
        u.permanentId.toLowerCase().includes(searchQuery) ||
        u.email.toLowerCase().includes(searchQuery)
      );
    });
  }

  function renderUsersTable() {
    const tbody = document.getElementById("admin-users-table-body");
    const pagInfo = document.getElementById("admin-users-pagination-info");
    if (!tbody) return;

    tbody.innerHTML = "";
    const filtered = getFilteredUsers();
    
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-secondary py-4">Nenhum usuário online encontrado.</td>
        </tr>
      `;
      if (pagInfo) pagInfo.textContent = "Mostrando 0-0 de 0 usuários";
      return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
    const paginated = filtered.slice(startIndex, endIndex);

    paginated.forEach((u) => {
      const initial = u.nickname ? u.nickname.trim().charAt(0).toUpperCase() : "A";
      const avatarHTML = `<div class="avatar-circle avatar-xs d-inline-flex me-2" title="${u.nickname}" style="width: 24px; height: 24px; font-size: 0.65rem; background-color: var(--surface-secondary); color: var(--text-primary); border-radius: 50%; align-items: center; justify-content: center;">${initial}</div>`;

      const joinDateStr = new Date(u.joinTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const tr = document.createElement("tr");
      tr.className = "border-secondary";
      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            ${avatarHTML}
            <span class="fw-bold text-white text-truncate" style="max-width: 110px;">${u.nickname}</span>
          </div>
        </td>
        <td>
          <div class="small text-white-50" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis;" title="${u.email}">${u.email}</div>
          <div class="small text-secondary" style="font-size: 0.65rem;">UID: ${u.uid}</div>
        </td>
        <td><span class="badge bg-secondary-custom text-white font-monospace">${u.permanentId}</span></td>
        <td><span class="text-secondary small">${joinDateStr}</span></td>
        <td><span class="badge bg-success small">${u.roomId}</span></td>
        <td class="text-end">
          <div class="d-inline-flex gap-1">
            <!-- Dropdown Suspender -->
            <div class="btn-group">
              <button type="button" class="btn btn-warning btn-sm py-1 px-2 text-dark font-weight-bold dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" style="font-size: 0.7rem; border-radius: var(--radius-sm);">
                Suspender
              </button>
              <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark border-secondary bg-dark text-start" style="font-size: 0.75rem;">
                <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="300000">5 Minutos</a></li>
                <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="600000">10 Minutos</a></li>
                <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="1800000">30 Minutos</a></li>
                <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="3600000">1 Hora</a></li>
                <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="86400000">24 Horas</a></li>
                <li><hr class="dropdown-divider border-secondary"></li>
                <li><a class="dropdown-item py-1.5 text-danger btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="3153600000000">Permanente</a></li>
              </ul>
            </div>

            <!-- Botão Banir -->
            <button class="btn btn-danger btn-sm py-1 px-2 btn-admin-ban" data-uid="${u.uid}" style="font-size: 0.7rem; border-radius: var(--radius-sm); background-color: #dc3545; border-color: #dc3545;">
              Banir
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (pagInfo) {
      pagInfo.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${filtered.length} usuários`;
    }

    // Bind suspend and ban button handlers
    const suspendBtns = tbody.querySelectorAll(".btn-admin-suspend");
    suspendBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetUid = btn.getAttribute("data-uid");
        const ms = btn.getAttribute("data-ms");
        const minutes = Number(ms) / 60000;
        const msg = minutes > 50000000 ? "permanentemente" : `por ${minutes} minutos`;
        
        window.showAdminConfirmModal(
          "Confirmar Suspensão",
          `Deseja realmente SUSPENDER este usuário ${msg}?`,
          () => {
            window.showAdminLoading(true);
            sendAdminAction({
              type: "admin_action",
              action: "suspend",
              targetUid: targetUid,
              durationMs: Number(ms)
            });
          }
        );
      });
    });

    const banBtns = tbody.querySelectorAll(".btn-admin-ban");
    banBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetUid = btn.getAttribute("data-uid");
        window.showAdminConfirmModal(
          "Confirmar Banimento",
          "Deseja realmente BANIR este usuário permanentemente do chat? Esta ação desconectará e invalidará a sessão.",
          () => {
            window.showAdminLoading(true);
            sendAdminAction({
              type: "admin_action",
              action: "ban",
              targetUid: targetUid
            });
          }
        );
      });
    });
  }

  function renderIndividualUserSelect() {
    const select = document.getElementById("admin-individual-user-select");
    if (!select) return;

    // Preserve first option
    select.innerHTML = '<option value="">Selecione um usuário...</option>';
    
    onlineUsers.forEach((u) => {
      const option = document.createElement("option");
      option.value = u.uid;
      option.textContent = `${u.nickname} (${u.permanentId})`;
      select.appendChild(option);
    });
  }

  function renderAuditLogsTable() {
    const tbody = document.getElementById("admin-audits-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (auditLogs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-secondary py-4">Nenhum registro de auditoria encontrado.</td>
        </tr>
      `;
      return;
    }

    auditLogs.forEach((log) => {
      const dateStr = new Date(log.timestamp).toLocaleString("pt-BR");
      const actionBadge = log.action === "ban" ? "bg-danger" : (log.action === "suspension" ? "bg-warning text-dark" : "bg-primary");

      const tr = document.createElement("tr");
      tr.className = "border-secondary";
      tr.innerHTML = `
        <td><span class="text-secondary" style="font-size: 0.7rem;">${dateStr}</span></td>
        <td><div class="fw-bold text-white-50">${log.adminEmail || "Admin"}</div></td>
        <td><span class="badge ${actionBadge} text-uppercase" style="font-size: 0.65rem;">${log.action}</span></td>
        <td><div class="fw-bold text-white text-truncate" style="max-width: 120px;">${log.targetNickname || "Todos"}</div></td>
        <td><div class="text-secondary text-break">${log.details || ""}</div></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function sendAdminAction(payload) {
    const chatSocket = window.getChatSocket ? window.getChatSocket() : null;
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
      chatSocket.send(JSON.stringify(payload));
    } else {
      console.error("Chat WebSocket is offline or not found!");
    }
  }

  // Requests updated online authenticated user list
  function requestOnlineUsers() {
    sendAdminAction({ type: "get_online_users" });
  }

  // Requests updated audit logs
  function requestAuditLogs() {
    sendAdminAction({ type: "get_audit_logs" });
  }

  function refreshAdminData() {
    requestOnlineUsers();
    if (activeTab === "audits") {
      requestAuditLogs();
    }
  }

  // Export handlers to window for receiving Websocket triggers
  window.handleAdminOnlineUsers = function (users) {
    onlineUsers = users;
    renderUsersTable();
    renderIndividualUserSelect();
  };

  window.handleAdminAuditLogs = function (logs) {
    auditLogs = logs;
    renderAuditLogsTable();
  };

  window.refreshAdminData = function () {
    refreshAdminData();
  };

  // Warning Modals (No alerts for warnings)
  window.showAdminWarningModal = function (text, title = "Mensagem da Administração", onCloseCallback = null) {
    let modalEl = document.getElementById("adminWarningModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.id = "adminWarningModal";
      modalEl.className = "modal fade";
      modalEl.tabIndex = -1;
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.style.zIndex = "1100";
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-secondary shadow-lg rounded-4 overflow-hidden" style="background-color: var(--surface);">
            <div class="modal-header border-secondary p-3">
              <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-exclamation-triangle-fill text-warning"></i>
                <span id="admin-warning-title">${title}</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar" style="filter: invert(1);"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-white-50 mb-0" id="admin-warning-text" style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5;"></p>
            </div>
            <div class="modal-footer border-secondary p-2">
              <button type="button" class="btn btn-secondary-custom w-100 py-2" data-bs-dismiss="modal">Fechar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    document.getElementById("admin-warning-title").textContent = title;
    document.getElementById("admin-warning-text").textContent = text;

    // Clear previous event listeners to avoid memory leaks/repeated actions
    const newModalEl = modalEl.cloneNode(true);
    if (modalEl.parentNode) {
      modalEl.parentNode.replaceChild(newModalEl, modalEl);
    }
    modalEl = newModalEl;

    const bModal = new bootstrap.Modal(modalEl);

    if (onCloseCallback) {
      modalEl.addEventListener("hidden.bs.modal", () => {
        onCloseCallback();
      }, { once: true });
    }

    bModal.show();
  };

  // Confirm Modal (No native confirm)
  window.showAdminConfirmModal = function (title, text, onConfirm) {
    let modalEl = document.getElementById("adminConfirmModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.id = "adminConfirmModal";
      modalEl.className = "modal fade";
      modalEl.tabIndex = -1;
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.style.zIndex = "1110";
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-secondary shadow-lg rounded-4 overflow-hidden" style="background-color: var(--surface);">
            <div class="modal-header border-secondary p-3">
              <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2" style="font-size: 1rem;">
                <i class="bi bi-question-circle-fill text-warning"></i>
                <span id="admin-confirm-title">Confirmar</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar" style="filter: invert(1);"></button>
            </div>
            <div class="modal-body p-3">
              <p class="text-white-50 mb-0" id="admin-confirm-text" style="font-size: 0.85rem; line-height: 1.4;"></p>
            </div>
            <div class="modal-footer border-secondary p-2 d-flex gap-2">
              <button type="button" class="btn btn-secondary-custom flex-grow-1 py-2" data-bs-dismiss="modal" style="font-size: 0.8rem;">Cancelar</button>
              <button type="button" class="btn btn-danger flex-grow-1 py-2" id="admin-confirm-submit-btn" style="font-size: 0.8rem;">Confirmar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    document.getElementById("admin-confirm-title").textContent = title;
    document.getElementById("admin-confirm-text").textContent = text;

    // Clear previous event listeners
    const newModalEl = modalEl.cloneNode(true);
    if (modalEl.parentNode) {
      modalEl.parentNode.replaceChild(newModalEl, modalEl);
    }
    modalEl = newModalEl;

    const bModal = new bootstrap.Modal(modalEl);
    const submitBtn = modalEl.querySelector("#admin-confirm-submit-btn");

    submitBtn.addEventListener("click", () => {
      onConfirm();
      bModal.hide();
    });

    bModal.show();
  };

  // Toast System (No alerts)
  window.showAdminToast = function (message, type = "success") {
    let container = document.getElementById("admin-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "admin-toast-container";
      container.className = "toast-container position-fixed bottom-0 end-0 p-3";
      container.style.zIndex = "1150";
      document.body.appendChild(container);
    }

    const bgClass = type === "success" ? "bg-success" : (type === "error" ? "bg-danger" : "bg-warning text-dark");
    const iconClass = type === "success" ? "bi-check-circle-fill" : (type === "error" ? "bi-exclamation-octagon-fill" : "bi-exclamation-triangle-fill");
    
    const toastEl = document.createElement("div");
    toastEl.className = `toast align-items-center text-white ${bgClass} border-0 shadow-lg`;
    toastEl.role = "alert";
    toastEl.ariaLive = "assertive";
    toastEl.ariaAtomic = "true";
    toastEl.style.borderRadius = "var(--radius-sm)";
    
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${iconClass}"></i>
          <span>${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    
    container.appendChild(toastEl);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
    bsToast.show();
    
    toastEl.addEventListener("hidden.bs.toast", () => {
      toastEl.remove();
    });
  };

  // Global Loading overlay (No raw blocks)
  window.showAdminLoading = function (show = true) {
    let loader = document.getElementById("admin-global-loader");
    if (!loader && show) {
      loader = document.createElement("div");
      loader.id = "admin-global-loader";
      loader.className = "position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center animate-fade-in";
      loader.style.zIndex = "1200";
      loader.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      loader.innerHTML = `
        <div class="d-flex flex-column align-items-center gap-3">
          <div class="spinner-border text-success" role="status" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Processando...</span>
          </div>
          <span class="text-white fw-medium small tracking-wide" style="font-family: var(--font-sans);">Processando ação administrativa...</span>
        </div>
      `;
      document.body.appendChild(loader);
    } else if (loader && !show) {
      // Fade out effect
      loader.style.opacity = "0";
      loader.style.transition = "opacity 0.2s ease";
      setTimeout(() => {
        if (loader.parentNode) loader.remove();
      }, 200);
    }
  };

  // Expose triggers
  window.injectAdminPanelUI = injectAdminPanelUI;

  // Intercept the chat.js socket globally by exposing getChatSocket
  const originalConnect = window.ChatEngine ? window.ChatEngine.connectSocket : null;
  let currentSocketInstance = null;

  if (window.ChatEngine) {
    window.ChatEngine.connectSocket = function () {
      const ws = originalConnect.call(window.ChatEngine);
      currentSocketInstance = ws;
      
      // Inject admin trigger check when message of type admin_verified is seen
      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "admin_verified" && data.isAdmin) {
            injectAdminPanelUI();
          }
        } catch (e) {}
      });

      return ws;
    };
  }

  window.getChatSocket = function () {
    return currentSocketInstance || window.activeChatSocket;
  };

})();
