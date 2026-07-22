/**
 * admin-controller.js - Dynamic Administrative Panel Injection and Controls
 * Fullscreen modern dashboard with real-time Firestore integration.
 */

(function () {
  let firestoreUsers = [];
  let onlineUsersWS = [];
  let auditLogs = [];
  let currentPage = 1;
  const itemsPerPage = 10;
  let searchQuery = "";
  let activeTab = "users"; // "users", "global", "individual", "audits"
  let isFirestoreSubscribed = false;

  // Initialize Firestore user real-time listener
  function initFirestoreUsersListener() {
    if (isFirestoreSubscribed) return;
    if (window.FirebaseService && typeof window.FirebaseService.subscribeToAllUsers === "function") {
      isFirestoreSubscribed = true;
      window.FirebaseService.subscribeToAllUsers((usersList) => {
        firestoreUsers = usersList || [];
        renderUsersTable();
        renderIndividualUserSelect();
      });
    }
  }

  // Inject Admin trigger button and full screen Bootstrap Modal
  function injectAdminPanelUI() {
    if (document.getElementById("admin-trigger-container")) return;

    // 1. Floating Trigger Button (Bottom Left)
    const triggerContainer = document.createElement("div");
    triggerContainer.id = "admin-trigger-container";
    triggerContainer.className = "position-fixed bottom-0 start-0 m-3 d-none";
    triggerContainer.style.zIndex = "1050";
    triggerContainer.innerHTML = `
      <button class="btn btn-dark border-secondary px-3 py-2 shadow d-flex align-items-center gap-2 text-white" id="btn-admin-panel-trigger" style="border-radius: var(--radius-sm); font-size: 0.85rem; background-color: var(--surface-secondary); cursor: pointer; transition: transform 0.2s ease-in-out;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        <i class="bi bi-shield-lock-fill text-success fs-6"></i>
        <span class="fw-bold">Painel Admin</span>
      </button>
    `;
    document.body.appendChild(triggerContainer);

    // 2. Fullscreen Admin Modal (100% width, 100% height, dark theme)
    const adminModal = document.createElement("div");
    adminModal.id = "adminPanelModal";
    adminModal.className = "modal fade p-0";
    adminModal.tabIndex = -1;
    adminModal.setAttribute("aria-hidden", "true");
    adminModal.style.zIndex = "1060";
    adminModal.innerHTML = `
      <div class="modal-dialog modal-fullscreen m-0 p-0" style="max-width: 100vw; height: 100vh;">
        <div class="modal-content border-0 rounded-0 h-100 w-100 bg-dark text-white d-flex flex-column" style="background-color: #0e1017 !important;">
          
          <!-- Top Bar Header -->
          <div class="modal-header border-bottom border-secondary px-4 py-3 flex-shrink-0" style="background-color: #141824; height: 60px;">
            <div class="d-flex align-items-center gap-3">
              <div class="rounded-2 p-2 bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
                <i class="bi bi-shield-lock-fill fs-5"></i>
              </div>
              <div>
                <h5 class="modal-title text-white fw-bold mb-0" style="font-family: var(--font-display); font-size: 1.1rem;">
                  Painel de Moderação & Administração
                </h5>
                <span class="text-secondary small" style="font-size: 0.75rem;">Gerenciamento completo em tempo real</span>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>

          <!-- Main Layout Body (Fixed Sidebar + Scrollable Content) -->
          <div class="modal-body p-0 d-flex flex-grow-1 overflow-hidden" style="height: calc(100vh - 60px);">
            
            <!-- Fixed Left Sidebar -->
            <div class="d-flex flex-column border-end border-secondary p-3 flex-shrink-0" style="width: 260px; background-color: #11141f;">
              <div class="px-2 mb-3 text-secondary uppercase tracking-wider small fw-bold" style="font-size: 0.7rem; letter-spacing: 0.08em;">MENU PRINCIPAL</div>
              
              <ul class="nav nav-pills flex-column gap-2 border-0 w-100" id="adminTab" role="tablist">
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab active text-start text-white w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-users" data-tab="users" type="button" role="tab" style="border-radius: 8px; font-size: 0.9rem; padding: 0.75rem 1rem; transition: all 0.2s; background-color: #1f2433;">
                    <i class="bi bi-people-fill text-success fs-5"></i>
                    <span class="fw-medium">Usuários</span>
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start text-white-50 w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-global" data-tab="global" type="button" role="tab" style="border-radius: 8px; font-size: 0.9rem; padding: 0.75rem 1rem; transition: all 0.2s; background-color: transparent;">
                    <i class="bi bi-megaphone-fill text-info fs-5"></i>
                    <span class="fw-medium">Mensagem Global</span>
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start text-white-50 w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-individual" data-tab="individual" type="button" role="tab" style="border-radius: 8px; font-size: 0.9rem; padding: 0.75rem 1rem; transition: all 0.2s; background-color: transparent;">
                    <i class="bi bi-chat-text-fill text-warning fs-5"></i>
                    <span class="fw-medium">Mensagem Individual</span>
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start text-white-50 w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-audits" data-tab="audits" type="button" role="tab" style="border-radius: 8px; font-size: 0.9rem; padding: 0.75rem 1rem; transition: all 0.2s; background-color: transparent;">
                    <i class="bi bi-journal-text text-secondary fs-5"></i>
                    <span class="fw-medium">Auditoria</span>
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start text-white-50 w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-ads" data-tab="ads" type="button" role="tab" style="border-radius: 8px; font-size: 0.9rem; padding: 0.75rem 1rem; transition: all 0.2s; background-color: transparent;">
                    <i class="bi bi-badge-ad-fill text-danger fs-5"></i>
                    <span class="fw-medium">Anúncios</span>
                  </button>
                </li>
              </ul>

              <div class="mt-auto pt-3 border-top border-secondary px-2">
                <div class="small text-secondary" style="font-size: 0.75rem;">Status do Servidor</div>
                <div class="d-flex align-items-center gap-2 mt-1">
                  <span class="spinner-grow spinner-grow-sm text-success" style="width: 8px; height: 8px;"></span>
                  <span class="text-success small fw-medium" style="font-size: 0.8rem;">Conectado em tempo real</span>
                </div>
              </div>
            </div>

            <!-- Main Content Area (Right Side, Scrollable) -->
            <div class="flex-grow-1 p-4 overflow-y-auto h-100" style="background-color: #0e1017;">
              
              <!-- TAB 1: USERS (EXCLUSIVELY FROM FIRESTORE 'users' COLLECTION) -->
              <div class="admin-tab-content d-flex flex-column h-100" id="admin-content-users">
                <div class="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between mb-4">
                  <div>
                    <h5 class="text-white fw-bold mb-1">Usuários Cadastrados</h5>
                    <p class="text-secondary small mb-0">Consultando exclusivamente a coleção <code class="text-info fw-bold">users</code> no Firestore em tempo real.</p>
                  </div>
                  <div class="input-group" style="max-width: 380px;">
                    <span class="input-group-text bg-dark border-secondary text-secondary"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control bg-dark text-white border-secondary border-start-0" id="admin-users-search" placeholder="Buscar por nome, email, ID interno ou UID...">
                  </div>
                </div>

                <div class="table-responsive flex-grow-1 border border-secondary rounded-3" style="background-color: #141824;">
                  <table class="table table-dark table-hover border-secondary align-middle mb-0" style="font-size: 0.85rem;">
                    <thead class="table-dark text-secondary" style="background-color: #1a1f2e;">
                      <tr class="border-secondary">
                        <th class="ps-3 py-3">Avatar & Nome</th>
                        <th class="py-3">ID Interno</th>
                        <th class="py-3">UID</th>
                        <th class="py-3">Idade</th>
                        <th class="py-3">Sexo</th>
                        <th class="py-3">Status</th>
                        <th class="py-3 text-center">Administrador</th>
                        <th class="pe-3 py-3 text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody id="admin-users-table-body">
                      <!-- Filled dynamically from 'users' collection -->
                    </tbody>
                  </table>
                </div>

                <!-- Pagination Footer -->
                <div class="d-flex justify-content-between align-items-center mt-3 pt-2">
                  <span class="text-secondary small" id="admin-users-pagination-info">Mostrando 0-0 de 0 usuários</span>
                  <div class="d-flex gap-2">
                    <button class="btn btn-outline-secondary btn-sm px-3" id="admin-users-btn-prev">Anterior</button>
                    <button class="btn btn-outline-secondary btn-sm px-3" id="admin-users-btn-next">Próximo</button>
                  </div>
                </div>
              </div>

              <!-- TAB 2: GLOBAL ANNOUNCEMENT -->
              <div class="admin-tab-content d-none flex-column h-100 max-w-2xl" id="admin-content-global">
                <div class="mb-4">
                  <h5 class="text-white fw-bold mb-1">Aviso Global</h5>
                  <p class="text-secondary small mb-0">Enviar uma notificação modal em tempo real para todos os usuários online na plataforma.</p>
                </div>

                <div class="card border-secondary bg-dark p-4 rounded-3 shadow-sm mb-4" style="background-color: #141824 !important;">
                  <label for="admin-global-message" class="form-label text-white fw-semibold mb-2">Conteúdo da Mensagem</label>
                  <textarea class="form-control bg-dark text-white border-secondary p-3" id="admin-global-message" rows="6" placeholder="Escreva o comunicado oficial para todos os usuários..." style="resize: none; font-size: 0.95rem;"></textarea>
                </div>

                <button class="btn btn-success py-2.5 px-4 fw-bold align-self-start d-flex align-items-center gap-2" id="btn-admin-send-global" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-send-fill"></i>
                  <span>Enviar Aviso Global</span>
                </button>
              </div>

              <!-- TAB 3: INDIVIDUAL MESSAGE -->
              <div class="admin-tab-content d-none flex-column h-100 max-w-2xl" id="admin-content-individual">
                <div class="mb-4">
                  <h5 class="text-white fw-bold mb-1">Mensagem Individual</h5>
                  <p class="text-secondary small mb-0">Enviar aviso privado para um usuário específico buscando pelo ID Interno (ex: USR-000031) ou selecionando da lista.</p>
                </div>

                <div class="card border-secondary bg-dark p-4 rounded-3 shadow-sm mb-4" style="background-color: #141824 !important;">
                  <div class="mb-3">
                    <label for="admin-individual-user-select" class="form-label text-white fw-semibold mb-1">Selecione o Usuário</label>
                    <select class="form-select bg-dark text-white border-secondary mb-2" id="admin-individual-user-select">
                      <option value="">Selecione um usuário cadastrado...</option>
                    </select>
                  </div>

                  <div class="mb-3">
                    <label for="admin-individual-target-id" class="form-label text-white fw-semibold mb-1">Ou digite o ID Interno / UID do Usuário</label>
                    <input type="text" class="form-control bg-dark text-white border-secondary" id="admin-individual-target-id" placeholder="Ex: USR-000031">
                  </div>

                  <div class="mb-0">
                    <label for="admin-individual-message" class="form-label text-white fw-semibold mb-1">Conteúdo da Mensagem Privada</label>
                    <textarea class="form-control bg-dark text-white border-secondary p-3" id="admin-individual-message" rows="5" placeholder="Escreva a notificação direta..." style="resize: none; font-size: 0.95rem;"></textarea>
                  </div>
                </div>

                <button class="btn btn-success py-2.5 px-4 fw-bold align-self-start d-flex align-items-center gap-2" id="btn-admin-send-individual" style="border-radius: var(--radius-sm);">
                  <i class="bi bi-send-fill"></i>
                  <span>Enviar Mensagem Individual</span>
                </button>
              </div>

              <!-- TAB 4: AUDIT LOGS -->
              <div class="admin-tab-content d-none flex-column h-100" id="admin-content-audits">
                <div class="d-flex align-items-center justify-content-between mb-4">
                  <div>
                    <h5 class="text-white fw-bold mb-1">Logs de Auditoria</h5>
                    <p class="text-secondary small mb-0">Histórico completo de ações administrativas registradas na coleção <code class="text-info fw-bold">audits</code>.</p>
                  </div>
                  <button class="btn btn-outline-secondary btn-sm px-3" id="btn-refresh-audit-logs">
                    <i class="bi bi-arrow-clockwise me-1"></i> Atualizar Logs
                  </button>
                </div>

                <div class="table-responsive flex-grow-1 border border-secondary rounded-3" style="background-color: #141824;">
                  <table class="table table-dark table-striped table-hover border-secondary align-middle mb-0" style="font-size: 0.8rem;">
                    <thead class="table-dark text-secondary" style="background-color: #1a1f2e;">
                      <tr class="border-secondary">
                        <th class="ps-3 py-3">Data/Hora</th>
                        <th class="py-3">Administrador</th>
                        <th class="py-3">Ação</th>
                        <th class="py-3">Alvo</th>
                        <th class="pe-3 py-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody id="admin-audits-table-body">
                      <!-- Filled dynamically -->
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- TAB 5: ADS MANAGEMENT -->
              <div class="admin-tab-content d-none flex-column h-100 max-w-2xl" id="admin-content-ads">
                <div class="mb-4">
                  <h5 class="text-white fw-bold mb-1">Gerenciamento de Anúncios</h5>
                  <p class="text-secondary small mb-0">Pesquise um usuário por UID do Firebase, ID Interno (ex: USR-000001) ou email para definir a permissão de exibição de anúncios.</p>
                </div>

                <div class="card border-secondary bg-dark p-4 rounded-3 shadow-sm mb-4" style="background-color: #141824 !important;">
                  <div class="mb-3">
                    <label for="admin-ads-search-input" class="form-label text-white fw-semibold mb-1">Pesquisar Usuário</label>
                    <div class="input-group">
                      <input type="text" class="form-control bg-dark text-white border-secondary" id="admin-ads-search-input" placeholder="Digite UID, ID Interno (USR-...) ou Email...">
                      <button class="btn btn-outline-secondary px-4 fw-bold text-white" id="btn-admin-ads-search" type="button">
                        <i class="bi bi-search me-1"></i> Pesquisar
                      </button>
                    </div>
                  </div>

                  <!-- User Result Box (Hidden by default) -->
                  <div id="admin-ads-user-result" class="d-none border border-secondary rounded-3 p-3 mt-3" style="background-color: #1a1f2e;">
                    <div class="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom border-secondary">
                      <div id="admin-ads-user-avatar" class="avatar-circle d-inline-flex align-items-center justify-content-center text-white fw-bold rounded-circle flex-shrink-0" style="width: 48px; height: 48px; font-size: 1.2rem; background-color: #2b3245;">U</div>
                      <div>
                        <h6 id="admin-ads-user-name" class="text-white fw-bold mb-0">Nome do Usuário</h6>
                        <div id="admin-ads-user-uid" class="small text-secondary font-monospace" style="font-size: 0.78rem;">UID: ...</div>
                        <div id="admin-ads-user-status" class="mt-1"></div>
                      </div>
                    </div>

                    <div class="form-check form-switch py-2">
                      <input class="form-check-input" type="checkbox" role="switch" id="admin-ads-disabled-switch" style="cursor: pointer; width: 2.5em; height: 1.3em;">
                      <label class="form-check-label text-white fw-medium ms-2" for="admin-ads-disabled-switch" style="cursor: pointer;">
                        Ocultar anúncios para este usuário (adsDisabled = true)
                      </label>
                    </div>
                    <div class="form-text text-secondary small mt-1">
                      Quando marcado como ocultar, o servidor responderá <code>showAds: false</code> para este usuário e nenhum script da Monetag será carregado.
                    </div>

                    <div class="mt-4 pt-2 border-top border-secondary text-end">
                      <button class="btn btn-success px-4 fw-bold" id="btn-admin-ads-save">
                        <i class="bi bi-check-circle-fill me-1"></i> Salvar
                      </button>
                    </div>
                  </div>

                  <!-- Not Found Msg -->
                  <div id="admin-ads-user-notfound" class="d-none alert alert-dark border-secondary text-secondary mt-3 mb-0" style="background-color: #11141f;">
                    <i class="bi bi-exclamation-triangle me-1"></i> Nenhum usuário localizado com a chave informada.
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(adminModal);

    // Attach listeners
    setupAdminPanelListeners();
    initFirestoreUsersListener();
  }

  function setupAdminPanelListeners() {
    const triggerBtn = document.getElementById("btn-admin-panel-trigger");
    const modalEl = document.getElementById("adminPanelModal");
    if (!triggerBtn || !modalEl) return;

    const bootstrapModal = new bootstrap.Modal(modalEl);

    triggerBtn.addEventListener("click", () => {
      bootstrapModal.show();
      initFirestoreUsersListener();
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
        btn.style.backgroundColor = "#1f2433";

        activeTab = btn.getAttribute("data-tab");
        showActiveTabContent();
      });
    });

    // Search input
    const searchInput = document.getElementById("admin-users-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        currentPage = 1;
        renderUsersTable();
      });
    }

    // Pagination
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

    // Select change in individual message tab
    const selectEl = document.getElementById("admin-individual-user-select");
    const targetInput = document.getElementById("admin-individual-target-id");
    if (selectEl && targetInput) {
      selectEl.addEventListener("change", (e) => {
        if (e.target.value) {
          targetInput.value = e.target.value;
        }
      });
    }

    // Send global announcement
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
          "Deseja realmente enviar este aviso global para TODOS os usuários conectados?",
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
        const textEl = document.getElementById("admin-individual-message");
        const targetVal = targetInput ? targetInput.value.trim() : "";
        const text = textEl ? textEl.value.trim() : "";

        if (!targetVal) {
          window.showAdminToast("Por favor, selecione um usuário ou digite o ID Interno / UID.", "error");
          return;
        }
        if (!text) {
          window.showAdminToast("Por favor, digite a mensagem individual.", "error");
          return;
        }

        window.showAdminConfirmModal(
          "Confirmar Mensagem Individual",
          `Deseja realmente enviar esta mensagem para o usuário (${targetVal})?`,
          () => {
            window.showAdminLoading(true);
            sendAdminAction({
              type: "admin_action",
              action: "individual_warning",
              targetId: targetVal,
              targetUid: targetVal,
              text: text
            });
            textEl.value = "";
          }
        );
      });
    }

    // Refresh audit logs
    const btnRefreshAudits = document.getElementById("btn-refresh-audit-logs");
    if (btnRefreshAudits) {
      btnRefreshAudits.addEventListener("click", () => {
        requestAuditLogs();
      });
    }

    // Ads Management tab handlers
    let activeAdsSearchUid = "";

    const btnAdsSearch = document.getElementById("btn-admin-ads-search");
    if (btnAdsSearch) {
      btnAdsSearch.addEventListener("click", () => {
        const inputEl = document.getElementById("admin-ads-search-input");
        const term = inputEl ? inputEl.value.trim().toLowerCase() : "";

        const resultBox = document.getElementById("admin-ads-user-result");
        const notFoundBox = document.getElementById("admin-ads-user-notfound");

        if (!term) {
          window.showAdminToast("Digite um UID, ID Interno ou Email para pesquisar.", "error");
          return;
        }

        const found = firestoreUsers.find((u) => {
          const uidMatch = u.uid && u.uid.toLowerCase() === term;
          const permMatch = u.permanentId && u.permanentId.toLowerCase() === term;
          const internalMatch = u.internalId && u.internalId.toLowerCase() === term;
          const emailMatch = u.email && u.email.toLowerCase() === term;
          const nickMatch = u.nickname && u.nickname.toLowerCase().includes(term);
          return uidMatch || permMatch || internalMatch || emailMatch || nickMatch;
        });

        if (found) {
          activeAdsSearchUid = found.uid;
          if (notFoundBox) notFoundBox.classList.add("d-none");
          if (resultBox) resultBox.classList.remove("d-none");

          const avatarEl = document.getElementById("admin-ads-user-avatar");
          const nameEl = document.getElementById("admin-ads-user-name");
          const uidEl = document.getElementById("admin-ads-user-uid");
          const statusEl = document.getElementById("admin-ads-user-status");
          const switchEl = document.getElementById("admin-ads-disabled-switch");

          if (avatarEl) {
            avatarEl.textContent = (found.nickname || "U").charAt(0).toUpperCase();
            avatarEl.style.backgroundColor = window.ChatEngine ? window.ChatEngine.getAvatarColor(found.nickname) : "#2b3245";
          }
          if (nameEl) nameEl.textContent = `${found.nickname || "Usuário"} (${found.permanentId || found.internalId || "N/A"})`;
          if (uidEl) uidEl.textContent = `UID: ${found.uid}`;
          if (statusEl) {
            statusEl.innerHTML = found.adsDisabled === true 
              ? `<span class="badge bg-danger">Anúncios Ocultados (adsDisabled = true)</span>` 
              : `<span class="badge bg-success">Anúncios Exibidos (adsDisabled = false)</span>`;
          }
          if (switchEl) switchEl.checked = (found.adsDisabled === true);
        } else {
          activeAdsSearchUid = "";
          if (resultBox) resultBox.classList.add("d-none");
          if (notFoundBox) notFoundBox.classList.remove("d-none");
        }
      });
    }

    const btnAdsSave = document.getElementById("btn-admin-ads-save");
    if (btnAdsSave) {
      btnAdsSave.addEventListener("click", () => {
        if (!activeAdsSearchUid) {
          window.showAdminToast("Nenhum usuário selecionado.", "error");
          return;
        }
        const switchEl = document.getElementById("admin-ads-disabled-switch");
        const adsDisabled = switchEl ? switchEl.checked : false;

        window.showAdminLoading(true);

        try {
          if (window.FirebaseService && typeof window.FirebaseService.updateUserField === "function") {
            window.FirebaseService.updateUserField(activeAdsSearchUid, { adsDisabled: adsDisabled }).catch((err) => {
              console.error("Erro ao atualizar adsDisabled no Firestore:", err);
            });
          }
          sendAdminAction({
            type: "admin_action",
            action: "set_ads_status",
            targetUid: activeAdsSearchUid,
            adsDisabled: adsDisabled
          });
        } catch (err) {
          window.showAdminLoading(false);
          window.showAdminToast("Erro ao executar operação.", "error");
        }
      });
    }
  }

  function showActiveTabContent() {
    const contents = document.querySelectorAll(".admin-tab-content");
    contents.forEach((c) => {
      c.classList.add("d-none");
      c.classList.remove("d-flex");
    });

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
    if (!searchQuery) return firestoreUsers;
    return firestoreUsers.filter((u) => {
      const name = (u.nickname || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const pid = (u.permanentId || "").toLowerCase();
      const uid = (u.uid || "").toLowerCase();
      return (
        name.includes(searchQuery) ||
        email.includes(searchQuery) ||
        pid.includes(searchQuery) ||
        uid.includes(searchQuery)
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
          <td colspan="8" class="text-center text-secondary py-5">Nenhum usuário cadastrado encontrado.</td>
        </tr>
      `;
      if (pagInfo) pagInfo.textContent = "Mostrando 0-0 de 0 usuários";
      return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filtered.length);
    const paginated = filtered.slice(startIndex, endIndex);

    paginated.forEach((u) => {
      const initial = u.nickname ? u.nickname.trim().charAt(0).toUpperCase() : "U";
      const avatarHTML = `<div class="avatar-circle d-inline-flex align-items-center justify-content-center text-white fw-bold rounded-circle flex-shrink-0" style="width: 32px; height: 32px; font-size: 0.75rem; background-color: #2b3245;">${initial}</div>`;

      const isOnline = onlineUsersWS.some((w) => w.uid === u.uid || w.permanentId === u.permanentId);
      const statusBadge = isOnline
        ? `<span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-20 px-2 py-1"><i class="bi bi-circle-fill me-1" style="font-size: 0.45rem;"></i>Online</span>`
        : `<span class="badge bg-secondary bg-opacity-20 text-secondary border border-secondary border-opacity-20 px-2 py-1">Offline</span>`;

      // Admin Switch Bootstrap
      const adminSwitch = `
        <div class="form-check form-switch mb-0 d-flex justify-content-center">
          <input class="form-check-input btn-admin-toggle-switch" type="checkbox" role="switch" ${u.admin ? "checked" : ""} data-uid="${u.uid}" style="cursor: pointer; width: 2.2em; height: 1.15em;">
        </div>
      `;

      // Suspend / Unsuspend buttons
      const isSuspended = u.suspendedUntil && u.suspendedUntil > Date.now();
      let suspendHTML = "";
      if (isSuspended) {
        suspendHTML = `
          <button class="btn btn-outline-warning btn-sm py-1 px-2 btn-admin-unsuspend" data-uid="${u.uid}" style="font-size: 0.72rem;">
            <i class="bi bi-play-circle me-1"></i>Remover Suspensão
          </button>
        `;
      } else {
        suspendHTML = `
          <div class="btn-group">
            <button type="button" class="btn btn-warning btn-sm py-1 px-2 text-dark fw-bold dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" style="font-size: 0.72rem;">
              Suspender
            </button>
            <ul class="dropdown-menu dropdown-menu-end dropdown-menu-dark bg-dark border-secondary shadow" style="font-size: 0.75rem;">
              <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="300000">5 Minutos</a></li>
              <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="600000">10 Minutos</a></li>
              <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="1800000">30 Minutos</a></li>
              <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="3600000">1 Hora</a></li>
              <li><a class="dropdown-item py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="86400000">24 Horas</a></li>
              <li><hr class="dropdown-divider border-secondary"></li>
              <li><a class="dropdown-item py-1.5 text-danger btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="3153600000000">Permanente</a></li>
            </ul>
          </div>
        `;
      }

      // Ban / Unban buttons
      const isBanned = u.banned === true;
      let banHTML = "";
      if (isBanned) {
        banHTML = `
          <button class="btn btn-outline-success btn-sm py-1 px-2 btn-admin-unban" data-uid="${u.uid}" style="font-size: 0.72rem;">
            <i class="bi bi-check-circle me-1"></i>Remover Banimento
          </button>
        `;
      } else {
        banHTML = `
          <button class="btn btn-danger btn-sm py-1 px-2 btn-admin-ban" data-uid="${u.uid}" style="font-size: 0.72rem;">
            Banir
          </button>
        `;
      }

      const tr = document.createElement("tr");
      tr.className = "border-secondary";
      tr.innerHTML = `
        <td class="ps-3">
          <div class="d-flex align-items-center gap-2">
            ${avatarHTML}
            <div>
              <div class="fw-bold text-white">${u.nickname}</div>
              <div class="small text-secondary" style="font-size: 0.75rem;">${u.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge bg-secondary bg-opacity-20 text-white font-monospace border border-secondary border-opacity-20 px-2 py-1">${u.permanentId}</span></td>
        <td><span class="font-monospace text-secondary small" title="${u.uid}">${u.uid.substring(0, 10)}...</span></td>
        <td><span class="text-white-50">${u.age}</span></td>
        <td><span class="text-white-50">${u.gender}</span></td>
        <td>${statusBadge}</td>
        <td class="text-center">${adminSwitch}</td>
        <td class="pe-3 text-end">
          <div class="d-inline-flex gap-1">
            ${suspendHTML}
            ${banHTML}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (pagInfo) {
      pagInfo.textContent = `Mostrando ${startIndex + 1}-${endIndex} de ${filtered.length} usuários`;
    }

    // Attach Switch listeners for real-time Firestore admin updates
    const switches = tbody.querySelectorAll(".btn-admin-toggle-switch");
    switches.forEach((sw) => {
      sw.addEventListener("change", (e) => {
        const targetUid = sw.getAttribute("data-uid");
        const newAdminState = sw.checked;

        window.showAdminLoading(true);

        // 1. Immediate Firestore update
        if (window.FirebaseService && typeof window.FirebaseService.updateUserField === "function") {
          window.FirebaseService.updateUserField(targetUid, { admin: newAdminState }).catch((err) => {
            console.error("Erro ao atualizar admin no Firestore:", err);
            sw.checked = !newAdminState; // revert on failure
          });
        }

        // 2. Notify backend for server session state and audit log
        sendAdminAction({
          type: "admin_action",
          action: "set_admin",
          targetUid: targetUid,
          adminState: newAdminState
        });
      });
    });

    // Attach Suspend buttons
    const suspendBtns = tbody.querySelectorAll(".btn-admin-suspend");
    suspendBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetUid = btn.getAttribute("data-uid");
        const ms = Number(btn.getAttribute("data-ms"));
        const minutes = Math.round(ms / 60000);
        const msg = minutes > 50000000 ? "permanentemente" : `por ${minutes} minutos`;

        window.showAdminConfirmModal(
          "Confirmar Suspensão",
          `Deseja realmente SUSPENDER este usuário ${msg}?`,
          () => {
            window.showAdminLoading(true);
            if (window.FirebaseService && typeof window.FirebaseService.updateUserField === "function") {
              window.FirebaseService.updateUserField(targetUid, { suspendedUntil: Date.now() + ms });
            }
            sendAdminAction({
              type: "admin_action",
              action: "suspend",
              targetUid: targetUid,
              durationMs: ms
            });
          }
        );
      });
    });

    // Attach Unsuspend buttons
    const unsuspendBtns = tbody.querySelectorAll(".btn-admin-unsuspend");
    unsuspendBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetUid = btn.getAttribute("data-uid");
        window.showAdminConfirmModal(
          "Remover Suspensão",
          "Deseja realmente remover a suspensão deste usuário?",
          () => {
            window.showAdminLoading(true);
            if (window.FirebaseService && typeof window.FirebaseService.updateUserField === "function") {
              window.FirebaseService.updateUserField(targetUid, { suspendedUntil: null });
            }
            sendAdminAction({
              type: "admin_action",
              action: "unsuspend",
              targetUid: targetUid
            });
          }
        );
      });
    });

    // Attach Ban buttons
    const banBtns = tbody.querySelectorAll(".btn-admin-ban");
    banBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetUid = btn.getAttribute("data-uid");
        window.showAdminConfirmModal(
          "Confirmar Banimento",
          "Deseja realmente BANIR este usuário permanentemente? O acesso e sessões serão invalidados.",
          () => {
            window.showAdminLoading(true);
            if (window.FirebaseService && typeof window.FirebaseService.updateUserField === "function") {
              window.FirebaseService.updateUserField(targetUid, { banned: true });
            }
            sendAdminAction({
              type: "admin_action",
              action: "ban",
              targetUid: targetUid
            });
          }
        );
      });
    });

    // Attach Unban buttons
    const unbanBtns = tbody.querySelectorAll(".btn-admin-unban");
    unbanBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetUid = btn.getAttribute("data-uid");
        window.showAdminConfirmModal(
          "Remover Banimento",
          "Deseja realmente remover o banimento deste usuário?",
          () => {
            window.showAdminLoading(true);
            if (window.FirebaseService && typeof window.FirebaseService.updateUserField === "function") {
              window.FirebaseService.updateUserField(targetUid, { banned: false });
            }
            sendAdminAction({
              type: "admin_action",
              action: "unban",
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

    select.innerHTML = '<option value="">Selecione um usuário cadastrado...</option>';
    firestoreUsers.forEach((u) => {
      const option = document.createElement("option");
      option.value = u.permanentId || u.uid;
      option.textContent = `${u.nickname} - ${u.permanentId} (${u.email})`;
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
          <td colspan="5" class="text-center text-secondary py-5">Nenhum registro de auditoria encontrado.</td>
        </tr>
      `;
      return;
    }

    auditLogs.forEach((log) => {
      const dateStr = new Date(log.timestamp).toLocaleString("pt-BR");
      let actionBadge = "bg-primary";
      if (log.action === "ban") actionBadge = "bg-danger";
      else if (log.action === "suspension") actionBadge = "bg-warning text-dark";
      else if (log.action === "set_admin") actionBadge = "bg-info text-dark";
      else if (log.action === "unsuspend" || log.action === "unban") actionBadge = "bg-success";

      const tr = document.createElement("tr");
      tr.className = "border-secondary";
      tr.innerHTML = `
        <td class="ps-3"><span class="text-secondary small">${dateStr}</span></td>
        <td><div class="fw-bold text-white-50">${log.adminEmail || "Admin"}</div></td>
        <td><span class="badge ${actionBadge} text-uppercase px-2 py-1" style="font-size: 0.65rem;">${log.action}</span></td>
        <td><div class="fw-bold text-white text-truncate" style="max-width: 140px;">${log.targetNickname || "Todos"}</div></td>
        <td class="pe-3"><div class="text-secondary text-break">${log.details || ""}</div></td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function sendAdminAction(payload) {
    const chatSocket = window.getChatSocket ? window.getChatSocket() : null;
    if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
      const currentUser = window.FirebaseService && window.FirebaseService.getCurrentUser ? window.FirebaseService.getCurrentUser() : null;
      if (currentUser && typeof currentUser.getIdToken === "function") {
        try {
          const idToken = await currentUser.getIdToken();
          payload.idToken = idToken;
          payload.authorization = `Bearer ${idToken}`;
        } catch (e) {
          console.error("[Admin] Erro ao obter ID Token:", e);
        }
      }
      chatSocket.send(JSON.stringify(payload));
    } else {
      console.error("[Admin] Socket offline ou indisponível!");
      window.showAdminLoading(false);
      window.showAdminToast("Servidor desconectado. Verifique sua conexão.", "error");
    }
  }

  function requestOnlineUsers() {
    sendAdminAction({ type: "get_online_users" });
  }

  function requestAuditLogs() {
    sendAdminAction({ type: "get_audit_logs" });
  }

  function refreshAdminData() {
    initFirestoreUsersListener();
    requestOnlineUsers();
    if (activeTab === "audits") {
      requestAuditLogs();
    }
  }

  // Export handlers to window object for WebSocket responses
  window.handleAdminOnlineUsers = function (users) {
    onlineUsersWS = users || [];
    renderUsersTable();
  };

  window.handleAdminAuditLogs = function (logs) {
    auditLogs = logs || [];
    renderAuditLogsTable();
  };

  window.refreshAdminData = function () {
    refreshAdminData();
  };

  // Admin Warning Modal (Non-blocking)
  window.showAdminWarningModal = function (text, title = "Aviso da Administração", onCloseCallback = null) {
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
          <div class="modal-content border-secondary shadow-lg rounded-4 overflow-hidden" style="background-color: #141824;">
            <div class="modal-header border-secondary p-3">
              <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
                <span id="admin-warning-title">${title}</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-white mb-0" id="admin-warning-text" style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5;"></p>
            </div>
            <div class="modal-footer border-secondary p-2">
              <button type="button" class="btn btn-secondary w-100 py-2" data-bs-dismiss="modal">Entendido</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    document.getElementById("admin-warning-title").textContent = title;
    document.getElementById("admin-warning-text").textContent = text;

    const bModal = new bootstrap.Modal(modalEl);
    if (onCloseCallback) {
      modalEl.addEventListener("hidden.bs.modal", () => {
        onCloseCallback();
      }, { once: true });
    }
    bModal.show();
  };

  // Confirm Action Modal
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
          <div class="modal-content border-secondary shadow-lg rounded-4 overflow-hidden" style="background-color: #141824;">
            <div class="modal-header border-secondary p-3">
              <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2" style="font-size: 1rem;">
                <i class="bi bi-question-circle-fill text-warning"></i>
                <span id="admin-confirm-title">Confirmar</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body p-3">
              <p class="text-white-50 mb-0" id="admin-confirm-text" style="font-size: 0.85rem; line-height: 1.4;"></p>
            </div>
            <div class="modal-footer border-secondary p-2 d-flex gap-2">
              <button type="button" class="btn btn-secondary flex-grow-1 py-2" data-bs-dismiss="modal" style="font-size: 0.8rem;">Cancelar</button>
              <button type="button" class="btn btn-danger flex-grow-1 py-2" id="admin-confirm-submit-btn" style="font-size: 0.8rem;">Confirmar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);
    }

    document.getElementById("admin-confirm-title").textContent = title;
    document.getElementById("admin-confirm-text").textContent = text;

    const bModal = new bootstrap.Modal(modalEl);
    const submitBtn = modalEl.querySelector("#admin-confirm-submit-btn");

    const handleConfirm = () => {
      onConfirm();
      bModal.hide();
      submitBtn.removeEventListener("click", handleConfirm);
    };

    submitBtn.addEventListener("click", handleConfirm, { once: true });
    bModal.show();
  };

  // Toast Notification System
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

  // Global Loading overlay
  let adminLoadingTimer = null;

  window.showAdminLoading = function (show = true) {
    if (adminLoadingTimer) {
      clearTimeout(adminLoadingTimer);
      adminLoadingTimer = null;
    }

    let loader = document.getElementById("admin-global-loader");
    if (show) {
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "admin-global-loader";
        loader.className = "position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center animate-fade-in";
        loader.style.zIndex = "1200";
        loader.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
        loader.innerHTML = `
          <div class="d-flex flex-column align-items-center gap-3">
            <div class="spinner-border text-success" role="status" style="width: 3rem; height: 3rem;">
              <span class="visually-hidden">Processando...</span>
            </div>
            <span class="text-white fw-medium small tracking-wide">Processando ação administrativa...</span>
          </div>
        `;
        document.body.appendChild(loader);
      }
      // Safety guard: auto close after 6 seconds so buttons never freeze
      adminLoadingTimer = setTimeout(() => {
        const activeLoader = document.getElementById("admin-global-loader");
        if (activeLoader) {
          activeLoader.remove();
          if (window.showAdminToast) window.showAdminToast("Operação processada.", "success");
        }
      }, 6000);
    } else if (loader) {
      loader.style.opacity = "0";
      loader.style.transition = "opacity 0.2s ease";
      setTimeout(() => {
        if (loader && loader.parentNode) loader.remove();
      }, 200);
    }
  };

  // Expose UI trigger
  window.injectAdminPanelUI = injectAdminPanelUI;

  // Global Socket interceptor
  const originalConnect = window.ChatEngine ? window.ChatEngine.connectSocket : null;
  let currentSocketInstance = null;

  if (window.ChatEngine) {
    window.ChatEngine.connectSocket = function () {
      const ws = originalConnect.call(window.ChatEngine);
      currentSocketInstance = ws;

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type === "user-permissions") {
            console.log("Permissões recebidas.");
            console.log(`admin=${data.admin}`);
            console.log(`adsDisabled=${data.adsDisabled}`);

            if (data.admin) {
              if (typeof window.mostrarPainelAdmin === "function") {
                window.mostrarPainelAdmin();
              } else {
                injectAdminPanelUI();
                const trg = document.getElementById("admin-trigger-container");
                if (trg) trg.classList.remove("d-none");
              }
            } else {
              if (typeof window.esconderPainelAdmin === "function") {
                window.esconderPainelAdmin();
              } else {
                const trg = document.getElementById("admin-trigger-container");
                if (trg) trg.classList.add("d-none");
              }
            }

            if (data.adsDisabled) {
              if (typeof window.desabilitarMonetag === "function") {
                window.desabilitarMonetag();
              }
            } else {
              if (typeof window.habilitarMonetag === "function") {
                window.habilitarMonetag();
              }
            }
          }
          if (data && (data.type === "admin_verified" || data.type === "admin-status")) {
            const isAdmin = data.admin === true || data.isAdmin === true;
            if (isAdmin) {
              injectAdminPanelUI();
              const trg = document.getElementById("admin-trigger-container");
              if (trg) trg.classList.remove("d-none");
            } else {
              const trg = document.getElementById("admin-trigger-container");
              if (trg) trg.classList.add("d-none");
            }
          }
          if (data && (data.type === "admin_action_success" || data.type === "success")) {
            if (window.showAdminLoading) window.showAdminLoading(false);
            if (window.showAdminToast) window.showAdminToast(data.message || "Operação realizada com sucesso.", "success");
          }
          if (data && data.type === "admin_action_error") {
            if (window.showAdminLoading) window.showAdminLoading(false);
            if (window.showAdminToast) window.showAdminToast(data.message || "Erro ao executar operação.", "error");
          }
          if (data && (data.type === "global_warning" || data.type === "individual_warning" || data.type === "admin-global-message" || data.type === "admin-private-message")) {
            showIncomingAdminWarningModal(
              data.message || data.text,
              data.title || (data.type === "global_warning" || data.type === "admin-global-message" ? "Comunicado Global" : "Mensagem da Administração")
            );
          }
        } catch (e) {}
      });

      return ws;
    };
  }

  function showIncomingAdminWarningModal(text, title = "Aviso Administrativo") {
    let modalEl = document.getElementById("adminIncomingWarningModal");
    if (modalEl) modalEl.remove();

    modalEl = document.createElement("div");
    modalEl.id = "adminIncomingWarningModal";
    modalEl.className = "modal fade";
    modalEl.tabIndex = -1;
    modalEl.style.zIndex = "1100";
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered" style="max-width: 500px;">
        <div class="modal-content bg-dark text-white border-warning shadow-lg" style="background-color: #141824 !important; border-width: 2px;">
          <div class="modal-header border-bottom border-secondary py-3 px-4" style="background-color: #1a1f2e;">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-exclamation-triangle-fill text-warning fs-4"></i>
              <h5 class="modal-title text-white fw-bold mb-0">${title}</h5>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body p-4 text-white-50" style="font-size: 0.95rem; line-height: 1.6;">
            <p class="text-white mb-0" style="white-space: pre-line;">${text}</p>
          </div>
          <div class="modal-footer border-top border-secondary p-3">
            <button type="button" class="btn btn-warning fw-bold px-4 text-dark" data-bs-dismiss="modal">Entendido</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
  }

  window.getChatSocket = function () {
    return currentSocketInstance || window.activeChatSocket;
  };

})();
