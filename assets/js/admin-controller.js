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

    // Inject custom CSS for modern dark theme
    if (!document.getElementById("admin-panel-custom-css")) {
      const styleEl = document.createElement("style");
      styleEl.id = "admin-panel-custom-css";
      styleEl.textContent = `
        /* Dark Minimalist Admin Theme */
        #adminPanelModal .modal-content {
          background-color: #0b0b0b !important;
          color: #d7d7d7 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        #adminPanelModal .modal-header {
          background-color: #111111 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          height: 64px;
        }

        #admin-sidebar {
          width: 260px;
          background-color: #111111 !important;
          border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
          transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s ease;
        }

        #admin-sidebar.collapsed {
          width: 80px !important;
          padding-left: 0.6rem !important;
          padding-right: 0.6rem !important;
        }

        #admin-sidebar .sidebar-text {
          transition: opacity 0.2s ease;
          white-space: nowrap;
        }

        #admin-sidebar.collapsed .sidebar-text,
        #admin-sidebar.collapsed .sidebar-header-label,
        #admin-sidebar.collapsed .sidebar-footer {
          display: none !important;
          opacity: 0;
          width: 0;
          overflow: hidden;
        }

        #admin-sidebar.collapsed .btn-admin-tab {
          justify-content: center !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        .btn-admin-tab {
          border-radius: 12px !important;
          font-size: 0.88rem;
          padding: 0.75rem 1rem;
          transition: all 0.2s ease-in-out;
          color: #9f9f9f !important;
          background-color: transparent !important;
          border: 1px solid transparent !important;
        }

        .btn-admin-tab:hover {
          background-color: #242424 !important;
          color: #ffffff !important;
        }

        .btn-admin-tab.active {
          background-color: #171717 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .admin-card {
          background-color: #171717 !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 18px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .admin-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
        }

        #adminPanelModal input.form-control,
        #adminPanelModal select.form-select,
        #adminPanelModal textarea.form-control {
          background-color: #141414 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px !important;
          padding: 0.7rem 1rem;
          font-size: 0.9rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        #adminPanelModal input.form-control::placeholder,
        #adminPanelModal textarea.form-control::placeholder {
          color: #666666 !important;
        }

        #adminPanelModal input.form-control:focus,
        #adminPanelModal select.form-select:focus,
        #adminPanelModal textarea.form-control:focus {
          border-color: rgba(255, 255, 255, 0.3) !important;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08) !important;
          outline: none !important;
        }

        #adminPanelModal .table-responsive {
          background-color: #171717 !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 18px !important;
          overflow: hidden;
        }

        #adminPanelModal table {
          color: #d7d7d7 !important;
          border-color: rgba(255, 255, 255, 0.05) !important;
        }

        #adminPanelModal thead th {
          background-color: #111111 !important;
          color: #9f9f9f !important;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          position: sticky;
          top: 0;
          z-index: 2;
        }

        #adminPanelModal tbody tr {
          background-color: #171717 !important;
          transition: background-color 0.15s ease;
        }

        #adminPanelModal tbody tr:nth-of-type(even) {
          background-color: #141414 !important;
        }

        #adminPanelModal tbody tr:hover {
          background-color: #242424 !important;
        }

        /* Custom Buttons */
        .btn-admin-primary {
          background-color: #ffffff !important;
          color: #0b0b0b !important;
          font-weight: 600 !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 0.65rem 1.25rem;
          transition: all 0.2s ease !important;
        }
        .btn-admin-primary:hover {
          background-color: #e2e2e2 !important;
          transform: translateY(-1px);
        }

        .btn-admin-dark {
          background-color: #171717 !important;
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          border-radius: 12px !important;
          padding: 0.65rem 1.25rem;
          transition: all 0.2s ease !important;
        }
        .btn-admin-dark:hover {
          background-color: #242424 !important;
          border-color: rgba(255, 255, 255, 0.25) !important;
        }

        /* Custom Scrollbar */
        #adminPanelModal *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        #adminPanelModal *::-webkit-scrollbar-track {
          background: #0b0b0b;
        }
        #adminPanelModal *::-webkit-scrollbar-thumb {
          background: #333333;
          border-radius: 4px;
        }
        #adminPanelModal *::-webkit-scrollbar-thumb:hover {
          background: #555555;
        }

        @media (max-width: 768px) {
          #admin-sidebar {
            position: absolute;
            top: 64px;
            bottom: 0;
            left: 0;
            z-index: 100;
            width: 240px;
            transform: translateX(0);
          }
          #admin-sidebar.collapsed {
            transform: translateX(-100%);
            width: 240px !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 1. Floating Trigger Button (Bottom Left)
    const triggerContainer = document.createElement("div");
    triggerContainer.id = "admin-trigger-container";
    triggerContainer.className = "position-fixed bottom-0 start-0 m-3 d-none";
    triggerContainer.style.zIndex = "1050";
    triggerContainer.innerHTML = `
      <button class="btn btn-dark border border-secondary px-3 py-2 shadow-lg d-flex align-items-center gap-2 text-white" id="btn-admin-panel-trigger" style="border-radius: 12px; font-size: 0.85rem; background-color: #111111; border-color: rgba(255,255,255,0.1) !important; cursor: pointer; transition: transform 0.2s ease-in-out;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        <i class="bi bi-shield-lock-fill text-white fs-6"></i>
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
        <div class="modal-content border-0 rounded-0 h-100 w-100 text-white d-flex flex-column" style="background-color: #0b0b0b !important;">
          
          <!-- Top Bar Header -->
          <div class="modal-header border-bottom px-4 py-3 flex-shrink-0 d-flex align-items-center justify-content-between" style="background-color: #111111; border-color: rgba(255,255,255,0.08) !important; height: 64px;">
            <div class="d-flex align-items-center gap-3">
              <button class="btn btn-dark border-0 p-2 text-white d-flex align-items-center justify-content-center" id="btn-toggle-sidebar" title="Alternar Menu" style="background-color: #1a1a1a; border-radius: 8px; width: 36px; height: 36px; cursor: pointer;">
                <i class="bi bi-list fs-5"></i>
              </button>
              <div class="d-flex align-items-center gap-2">
                <img src="/favicon.svg" alt="Papos" style="width: 28px; height: 28px; object-fit: contain;" class="me-1" />
                <h5 class="modal-title text-white fw-bold mb-0" style="font-size: 1.1rem; letter-spacing: -0.01em;">
                  Painel de Administração
                </h5>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>

          <!-- Main Layout Body (Collapsible Sidebar + Scrollable Content) -->
          <div class="modal-body p-0 d-flex flex-grow-1 overflow-hidden" style="height: calc(100vh - 64px); position: relative;">
            
            <!-- Collapsible Left Sidebar -->
            <div class="d-flex flex-column p-3 flex-shrink-0" id="admin-sidebar" style="background-color: #111111;">
              <div class="px-2 mb-3 sidebar-header-label" style="font-size: 0.68rem; letter-spacing: 0.1em; color: #9f9f9f; font-weight: 700;">MENU PRINCIPAL</div>
              
              <ul class="nav nav-pills flex-column gap-2 border-0 w-100" id="adminTab" role="tablist">
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab active text-start text-white w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-users" data-tab="users" type="button" role="tab">
                    <i class="bi bi-people fs-5 flex-shrink-0"></i>
                    <span class="fw-medium sidebar-text">Usuários</span>
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-global" data-tab="global" type="button" role="tab">
                    <i class="bi bi-megaphone fs-5 flex-shrink-0"></i>
                    <span class="fw-medium sidebar-text">Mensagem Global</span>
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-individual" data-tab="individual" type="button" role="tab">
                    <i class="bi bi-chat-left-text fs-5 flex-shrink-0"></i>
                    <span class="fw-medium sidebar-text">Mensagem Individual</span>
                  </button>
                </li>
                <li class="nav-item w-100" role="presentation">
                  <button class="nav-link btn-admin-tab text-start w-100 border-0 d-flex align-items-center gap-3" id="tab-btn-ads" data-tab="ads" type="button" role="tab">
                    <i class="bi bi-badge-ad fs-5 flex-shrink-0"></i>
                    <span class="fw-medium sidebar-text">Anúncios</span>
                  </button>
                </li>
              </ul>

              <div class="mt-auto pt-3 border-top px-2 sidebar-footer" style="border-color: rgba(255,255,255,0.08) !important;">
                <div class="small" style="font-size: 0.75rem; color: #9f9f9f;">Status do Servidor</div>
                <div class="d-flex align-items-center gap-2 mt-1">
                  <span class="spinner-grow spinner-grow-sm text-success" style="width: 8px; height: 8px;"></span>
                  <span class="text-white small fw-medium" style="font-size: 0.8rem;">Conectado em tempo real</span>
                </div>
              </div>
            </div>

            <!-- Main Content Area (Right Side, Scrollable) -->
            <div class="flex-grow-1 p-4 overflow-y-auto h-100" style="background-color: #0b0b0b;">
              
              <!-- TAB 1: USERS -->
              <div class="admin-tab-content d-flex flex-column h-100" id="admin-content-users">
                <div class="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between mb-4">
                  <div>
                    <h5 class="text-white fw-bold mb-1" style="font-size: 1.25rem;">Usuários Cadastrados</h5>
                    <p class="small mb-0" style="color: #9f9f9f;">Consultando a coleção <code class="text-white fw-bold" style="background-color: #171717; padding: 2px 6px; border-radius: 4px;">users</code> do Firestore em tempo real.</p>
                  </div>
                  <div class="input-group" style="max-width: 380px;">
                    <span class="input-group-text border-0 text-white" style="background-color: #141414; border-top-left-radius: 12px; border-bottom-left-radius: 12px;"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control" id="admin-users-search" placeholder="Buscar por nome, email, ID ou UID..." style="border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important;">
                  </div>
                </div>

                <div class="table-responsive flex-grow-1">
                  <table class="table align-middle mb-0" style="font-size: 0.85rem;">
                    <thead>
                      <tr>
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
                      <!-- Filled dynamically -->
                    </tbody>
                  </table>
                </div>

                <!-- Pagination Footer -->
                <div class="d-flex justify-content-between align-items-center mt-3 pt-2">
                  <span class="small" id="admin-users-pagination-info" style="color: #9f9f9f;">Mostrando 0-0 de 0 usuários</span>
                  <div class="d-flex gap-2">
                    <button class="btn btn-admin-dark btn-sm px-3" id="admin-users-btn-prev">Anterior</button>
                    <button class="btn btn-admin-dark btn-sm px-3" id="admin-users-btn-next">Próximo</button>
                  </div>
                </div>
              </div>

              <!-- TAB 2: GLOBAL ANNOUNCEMENT -->
              <div class="admin-tab-content d-none flex-column h-100 max-w-2xl" id="admin-content-global">
                <div class="mb-4">
                  <h5 class="text-white fw-bold mb-1" style="font-size: 1.25rem;">Aviso Global</h5>
                  <p class="small mb-0" style="color: #9f9f9f;">Enviar uma notificação modal em tempo real para todos os usuários online na plataforma.</p>
                </div>

                <div class="admin-card p-4 mb-4">
                  <label for="admin-global-message" class="form-label text-white fw-semibold mb-2">Conteúdo da Mensagem</label>
                  <textarea class="form-control" id="admin-global-message" rows="6" placeholder="Escreva o comunicado oficial para todos os usuários..." style="resize: none;"></textarea>
                </div>

                <button class="btn btn-admin-primary py-2.5 px-4 fw-bold align-self-start d-flex align-items-center gap-2" id="btn-admin-send-global">
                  <i class="bi bi-send-fill"></i>
                  <span>Enviar Aviso Global</span>
                </button>
              </div>

              <!-- TAB 3: INDIVIDUAL MESSAGE -->
              <div class="admin-tab-content d-none flex-column h-100 max-w-2xl" id="admin-content-individual">
                <div class="mb-4">
                  <h5 class="text-white fw-bold mb-1" style="font-size: 1.25rem;">Mensagem Individual</h5>
                  <p class="small mb-0" style="color: #9f9f9f;">Enviar aviso privado para um usuário específico selecionando da lista ou pelo UID.</p>
                </div>

                <div class="admin-card p-4 mb-4">
                  <div class="mb-3">
                    <label for="admin-individual-user-select" class="form-label text-white fw-semibold mb-1">Selecione o Usuário</label>
                    <select class="form-select" id="admin-individual-user-select">
                      <option value="">Selecione um usuário cadastrado...</option>
                    </select>
                  </div>

                  <div class="mb-3">
                    <label for="admin-individual-target-id" class="form-label text-white fw-semibold mb-1">Ou digite o ID Interno / UID do Usuário</label>
                    <input type="text" class="form-control" id="admin-individual-target-id" placeholder="Ex: USR-000031 ou Firebase UID">
                  </div>

                  <div class="mb-0">
                    <label for="admin-individual-message" class="form-label text-white fw-semibold mb-1">Conteúdo da Mensagem Privada</label>
                    <textarea class="form-control" id="admin-individual-message" rows="5" placeholder="Escreva a notificação direta..." style="resize: none;"></textarea>
                  </div>
                </div>

                <button class="btn btn-admin-primary py-2.5 px-4 fw-bold align-self-start d-flex align-items-center gap-2" id="btn-admin-send-individual">
                  <i class="bi bi-send-fill"></i>
                  <span>Enviar Mensagem Individual</span>
                </button>
              </div>

              <!-- TAB 4: ADS MANAGEMENT -->
              <div class="admin-tab-content d-none flex-column h-100 max-w-2xl" id="admin-content-ads">
                <div class="mb-4">
                  <h5 class="text-white fw-bold mb-1" style="font-size: 1.25rem;">Gerenciamento de Anúncios</h5>
                  <p class="small mb-0" style="color: #9f9f9f;">Pesquise um usuário por Firebase UID, ID Interno (ex: USR-000001) ou email para definir a permissão de exibição de anúncios.</p>
                </div>

                <div class="admin-card p-4 mb-4">
                  <div class="mb-3">
                    <label for="admin-ads-search-input" class="form-label text-white fw-semibold mb-1">Pesquisar Usuário</label>
                    <div class="input-group">
                      <input type="text" class="form-control" id="admin-ads-search-input" placeholder="Digite UID, ID Interno (USR-...) ou Email..." style="border-top-right-radius: 0 !important; border-bottom-right-radius: 0 !important;">
                      <button class="btn btn-admin-dark px-4 fw-bold" id="btn-admin-ads-search" type="button" style="border-top-left-radius: 0 !important; border-bottom-left-radius: 0 !important;">
                        <i class="bi bi-search me-1"></i> Pesquisar
                      </button>
                    </div>
                  </div>

                  <!-- User Result Box (Hidden by default) -->
                  <div id="admin-ads-user-result" class="d-none border rounded-3 p-3 mt-3" style="background-color: #141414; border-color: rgba(255,255,255,0.08) !important;">
                    <div class="d-flex align-items-center gap-3 mb-3 pb-3 border-bottom" style="border-color: rgba(255,255,255,0.08) !important;">
                      <div id="admin-ads-user-avatar" class="avatar-circle d-inline-flex align-items-center justify-content-center text-white fw-bold rounded-circle flex-shrink-0" style="width: 48px; height: 48px; font-size: 1.2rem; background-color: #242424;">U</div>
                      <div>
                        <h6 id="admin-ads-user-name" class="text-white fw-bold mb-0">Nome do Usuário</h6>
                        <div id="admin-ads-user-uid" class="small font-monospace" style="font-size: 0.78rem; color: #9f9f9f;">UID: ...</div>
                        <div id="admin-ads-user-status" class="mt-1"></div>
                      </div>
                    </div>

                    <div class="form-check form-switch py-2">
                      <input class="form-check-input" type="checkbox" role="switch" id="admin-ads-disabled-switch" style="cursor: pointer; width: 2.5em; height: 1.3em;">
                      <label class="form-check-label text-white fw-medium ms-2" for="admin-ads-disabled-switch" style="cursor: pointer;">
                        Ocultar anúncios para este usuário (adsDisabled = true)
                      </label>
                    </div>
                    <div class="form-text small mt-1" style="color: #9f9f9f;">
                      Quando marcado como ocultar, o servidor responderá <code>showAds: false</code> para este usuário e nenhum script da Monetag será carregado.
                    </div>

                    <div class="mt-4 pt-2 border-top text-end" style="border-color: rgba(255,255,255,0.08) !important;">
                      <button class="btn btn-admin-primary px-4 fw-bold" id="btn-admin-ads-save">
                        <i class="bi bi-check-circle-fill me-1"></i> Salvar Permissão
                      </button>
                    </div>
                  </div>

                  <!-- Not Found Msg -->
                  <div id="admin-ads-user-notfound" class="d-none alert border text-white mt-3 mb-0" style="background-color: #141414; border-color: rgba(255,255,255,0.08) !important; color: #d7d7d7 !important;">
                    <i class="bi bi-exclamation-triangle me-1 text-warning"></i> Nenhum usuário localizado com a chave informada.
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

    // Sidebar collapse toggle
    const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
    const adminSidebar = document.getElementById("admin-sidebar");
    if (btnToggleSidebar && adminSidebar) {
      btnToggleSidebar.addEventListener("click", () => {
        adminSidebar.classList.toggle("collapsed");
      });
    }

    // Tab buttons switching
    const tabBtns = document.querySelectorAll(".btn-admin-tab");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => {
          b.classList.remove("active");
        });
        btn.classList.add("active");

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
      const avatarHTML = `<div class="avatar-circle d-inline-flex align-items-center justify-content-center text-white fw-bold rounded-circle flex-shrink-0" style="width: 32px; height: 32px; font-size: 0.75rem; background-color: #242424;">${initial}</div>`;

      const isOnline = onlineUsersWS.some((w) => w.uid === u.uid || w.permanentId === u.permanentId);
      const statusBadge = isOnline
        ? `<span class="badge px-2 py-1" style="background-color: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.2);"><i class="bi bi-circle-fill me-1" style="font-size: 0.45rem;"></i>Online</span>`
        : `<span class="badge px-2 py-1" style="background-color: rgba(255, 255, 255, 0.05); color: #9f9f9f; border: 1px solid rgba(255, 255, 255, 0.08);">Offline</span>`;

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
          <button class="btn btn-outline-warning btn-sm py-1 px-2 btn-admin-unsuspend" data-uid="${u.uid}" style="font-size: 0.72rem; border-radius: 8px;">
            <i class="bi bi-play-circle me-1"></i>Remover Suspensão
          </button>
        `;
      } else {
        suspendHTML = `
          <div class="btn-group">
            <button type="button" class="btn btn-warning btn-sm py-1 px-2 text-dark fw-bold dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" style="font-size: 0.72rem; border-radius: 8px;">
              Suspender
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow" style="font-size: 0.75rem; background-color: #171717; border: 1px solid rgba(255,255,255,0.1);">
              <li><a class="dropdown-item text-white py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="300000">5 Minutos</a></li>
              <li><a class="dropdown-item text-white py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="600000">10 Minutos</a></li>
              <li><a class="dropdown-item text-white py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="1800000">30 Minutos</a></li>
              <li><a class="dropdown-item text-white py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="3600000">1 Hora</a></li>
              <li><a class="dropdown-item text-white py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="86400000">24 Horas</a></li>
              <li><hr class="dropdown-divider" style="border-color: rgba(255,255,255,0.1);"></li>
              <li><a class="dropdown-item text-danger py-1.5 btn-admin-suspend" href="#" data-uid="${u.uid}" data-ms="3153600000000">Permanente</a></li>
            </ul>
          </div>
        `;
      }

      // Ban / Unban buttons
      const isBanned = u.banned === true;
      let banHTML = "";
      if (isBanned) {
        banHTML = `
          <button class="btn btn-outline-success btn-sm py-1 px-2 btn-admin-unban" data-uid="${u.uid}" style="font-size: 0.72rem; border-radius: 8px;">
            <i class="bi bi-check-circle me-1"></i>Remover Banimento
          </button>
        `;
      } else {
        banHTML = `
          <button class="btn btn-danger btn-sm py-1 px-2 btn-admin-ban" data-uid="${u.uid}" style="font-size: 0.72rem; border-radius: 8px;">
            Banir
          </button>
        `;
      }

      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.05)";
      tr.innerHTML = `
        <td class="ps-3">
          <div class="d-flex align-items-center gap-2">
            ${avatarHTML}
            <div>
              <div class="fw-bold text-white">${u.nickname}</div>
              <div class="small" style="font-size: 0.75rem; color: #9f9f9f;">${u.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge font-monospace px-2 py-1" style="background-color: #242424; color: #ffffff; border: 1px solid rgba(255,255,255,0.08);">${u.permanentId}</span></td>
        <td><span class="font-monospace small" style="color: #9f9f9f;" title="${u.uid}">${u.uid.substring(0, 10)}...</span></td>
        <td><span style="color: #d7d7d7;">${u.age}</span></td>
        <td><span style="color: #d7d7d7;">${u.gender}</span></td>
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
      if (u.uid) {
        const option = document.createElement("option");
        option.value = u.uid;
        option.textContent = `${u.nickname || "Usuário"} - ${u.permanentId || u.uid} (${u.email || ""})`;
        select.appendChild(option);
      }
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
          <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden" style="background-color: #171717; border: 1px solid rgba(255, 255, 255, 0.08) !important;">
            <div class="modal-header border-bottom p-3" style="border-color: rgba(255, 255, 255, 0.08) !important; background-color: #111111;">
              <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2" style="font-size: 1rem;">
                <i class="bi bi-question-circle-fill text-warning"></i>
                <span id="admin-confirm-title">Confirmar</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body p-3">
              <p class="text-white-50 mb-0" id="admin-confirm-text" style="font-size: 0.85rem; line-height: 1.4; color: #d7d7d7 !important;"></p>
            </div>
            <div class="modal-footer border-top p-2 d-flex gap-2" style="border-color: rgba(255, 255, 255, 0.08) !important;">
              <button type="button" class="btn btn-admin-dark flex-grow-1 py-2" data-bs-dismiss="modal" style="font-size: 0.8rem;">Cancelar</button>
              <button type="button" class="btn btn-admin-primary flex-grow-1 py-2" id="admin-confirm-submit-btn" style="font-size: 0.8rem;">Confirmar</button>
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
          if (data && (data.type === "admin:broadcast" || data.type === "admin:private" || data.type === "global_warning" || data.type === "individual_warning" || data.type === "admin-global-message" || data.type === "admin-private-message")) {
            console.log("Mensagem administrativa recebida.");
            console.log("Exibindo popup.");
            if (typeof window.showIncomingAdminWarningModal === "function") {
              window.showIncomingAdminWarningModal(
                data.message || data.text,
                data.title || "Mensagem da Administração"
              );
            } else if (typeof window.showAdminWarningModal === "function") {
              window.showAdminWarningModal(
                data.message || data.text,
                data.title || "Mensagem da Administração"
              );
            }
          }
        } catch (e) {}
      });

      return ws;
    };
  }

  function showIncomingAdminWarningModal(text, title = "Mensagem da Administração") {
    if (typeof window.showAdminWarningModal === "function") {
      window.showAdminWarningModal(text, title);
    }
  }

  window.getChatSocket = function () {
    return currentSocketInstance || window.activeChatSocket;
  };

})();
