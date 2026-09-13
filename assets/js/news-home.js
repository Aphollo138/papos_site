/**
 * Papos — Sistema de Novidades (Página Inicial)
 * Exibição oficial de comunicados com expiração programada e controle de dispensa.
 */

(function () {
  let currentActiveNews = null;
  let isSubscribed = false;

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getUserKey() {
    // 1. Usuário autenticado
    if (window.FirebaseService && typeof window.FirebaseService.getCurrentUser === "function") {
      const user = window.FirebaseService.getCurrentUser();
      if (user && user.uid) {
        return "uid_" + user.uid;
      }
    }
    // 2. Visitante anônimo persistente
    const permId = localStorage.getItem("papos_permanent_id") || localStorage.getItem("papo_guest_id") || "guest_default";
    return "guest_" + permId;
  }

  function isNewsDismissed(newsId) {
    if (!newsId) return true;

    // Verificação de sessão (fechamento temporário)
    try {
      if (sessionStorage.getItem("papos_dismissed_session_" + newsId) === "true") {
        return true;
      }
    } catch (e) {}

    // Verificação permanente ("Não mostrar novamente")
    try {
      const userKey = getUserKey();
      const rawDismissed = localStorage.getItem("papos_dismissed_news_" + userKey);
      if (rawDismissed) {
        const list = JSON.parse(rawDismissed);
        if (Array.isArray(list) && list.includes(newsId)) {
          return true;
        }
      }
    } catch (e) {}

    // Verificação no perfil do usuário logado se disponível
    try {
      if (window.FirebaseService && typeof window.FirebaseService.getCurrentUser === "function") {
        const user = window.FirebaseService.getCurrentUser();
        if (user && Array.isArray(user.dismissedNews) && user.dismissedNews.includes(newsId)) {
          return true;
        }
      }
    } catch (e) {}

    return false;
  }

  function dismissNews(newsId, permanent) {
    if (!newsId) return;

    if (permanent) {
      try {
        const userKey = getUserKey();
        const rawDismissed = localStorage.getItem("papos_dismissed_news_" + userKey);
        let list = [];
        if (rawDismissed) {
          try { list = JSON.parse(rawDismissed); } catch (err) {}
        }
        if (!Array.isArray(list)) list = [];
        if (!list.includes(newsId)) {
          list.push(newsId);
          localStorage.setItem("papos_dismissed_news_" + userKey, JSON.stringify(list));
        }

        // Se logado, persiste também no Firebase
        if (window.FirebaseService && typeof window.FirebaseService.getCurrentUser === "function") {
          const user = window.FirebaseService.getCurrentUser();
          if (user && user.uid && typeof window.FirebaseService.dismissNewsForUser === "function") {
            window.FirebaseService.dismissNewsForUser(user.uid, newsId);
          }
        }
      } catch (e) {
        console.warn("Erro ao salvar dispensa permanente da novidade:", e);
      }
    } else {
      // Dispensa apenas nesta sessão
      try {
        sessionStorage.setItem("papos_dismissed_session_" + newsId, "true");
      } catch (e) {}
    }

    hideNewsCard();
  }

  function hideNewsCard() {
    const container = document.getElementById("papos-home-news-container");
    if (!container) return;
    const card = container.querySelector(".papos-home-news-card");
    if (card) {
      card.style.opacity = "0";
      card.style.transform = "translateY(-8px)";
      setTimeout(() => {
        container.classList.add("d-none");
        container.innerHTML = "";
      }, 250);
    } else {
      container.classList.add("d-none");
      container.innerHTML = "";
    }
  }

  function renderNews(news) {
    const container = document.getElementById("papos-home-news-container");
    if (!container) return;

    currentActiveNews = news;

    container.innerHTML = `
      <div class="papos-home-news-card d-flex flex-column flex-md-row align-items-start gap-3" id="papos-active-news-card" data-news-id="${escapeHtml(news.id)}">
        
        <!-- Topo Mobile / Lateral Desktop com a Logo Oficial do Papos -->
        <div class="d-flex align-items-center justify-content-between w-100 d-md-contents">
          <div class="d-flex align-items-center gap-2.5">
            <div class="papos-news-logo flex-shrink-0" style="width: 36px; height: 36px; color: #00e676; display: flex; align-items: center; justify-content: center;">
              <svg class="papo-logo-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="width: 100%; height: 100%;" aria-hidden="true">
                <mask id="logo-mask-news-card">
                  <rect x="0" y="0" width="100" height="100" fill="white" />
                  <line x1="18" y1="74" x2="78" y2="26" stroke="black" stroke-width="10" stroke-linecap="round" />
                </mask>
                <g mask="url(#logo-mask-news-card)">
                  <path d="M 50,14 A 36,36 0 1,1 24.5,75.5 L 14,86 L 28.5,79.5 A 36,36 0 0,1 50,14 Z M 50,22 A 28,28 0 1,0 50,78 A 28,28 0 1,0 50,22 Z" fill-rule="evenodd" fill="currentColor" />
                  <path d="M 35,66 L 45,32 L 62,32 C 70,32 70,49 60,49 L 47,49 L 42,66 Z M 49,39 L 56,39 C 60,39 60,44 56,44 L 47,44 Z" fill-rule="evenodd" fill="currentColor" />
                </g>
                <line x1="18" y1="74" x2="78" y2="26" stroke-width="5" stroke-linecap="round" stroke="currentColor" fill="none" />
                <circle cx="78" cy="26" r="6" fill="currentColor" />
              </svg>
            </div>
            <div class="d-md-none">
              <span class="papos-news-badge"><i class="bi bi-megaphone-fill me-1"></i>Comunicado Oficial</span>
            </div>
          </div>
          <button type="button" class="papos-news-close btn-papos-news-close d-md-none" aria-label="Fechar novidade" title="Fechar">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <!-- Conteúdo do Comunicado -->
        <div class="flex-grow-1 w-100 pe-md-2">
          <div class="d-none d-md-flex align-items-center gap-2 mb-1.5">
            <span class="papos-news-badge"><i class="bi bi-megaphone-fill me-1"></i>Comunicado Oficial</span>
          </div>
          
          <h5 class="papos-news-title mb-1.5">${escapeHtml(news.title)}</h5>
          <div class="papos-news-content mb-3">${escapeHtml(news.content)}</div>

          <!-- Ações e Checkbox -->
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-2.5 border-top" style="border-color: rgba(255, 255, 255, 0.08) !important;">
            <label class="papos-news-checkbox-label d-flex align-items-center gap-2 mb-0" for="papos-news-dont-show-checkbox">
              <input type="checkbox" id="papos-news-dont-show-checkbox" class="form-check-input mt-0" style="cursor: pointer; width: 1.1em; height: 1.1em; border-radius: 4px;">
              <span>Não mostrar novamente</span>
            </label>

            <button type="button" class="papos-news-btn-ack d-inline-flex align-items-center gap-1.5" id="btn-papos-news-ack">
              <span>Entendido</span>
              <i class="bi bi-check2"></i>
            </button>
          </div>
        </div>

        <!-- Botão Fechar Desktop -->
        <button type="button" class="papos-news-close btn-papos-news-close d-none d-md-flex align-items-center justify-content-center flex-shrink-0" aria-label="Fechar novidade" title="Fechar" style="margin-top: -4px; margin-right: -4px;">
          <i class="bi bi-x-lg"></i>
        </button>

      </div>
    `;

    container.classList.remove("d-none");

    // Eventos de fechamento
    const closeBtns = container.querySelectorAll(".btn-papos-news-close");
    const ackBtn = container.querySelector("#btn-papos-news-ack");
    const checkbox = container.querySelector("#papos-news-dont-show-checkbox");

    const handleClose = () => {
      const isPermanent = checkbox ? checkbox.checked : false;
      dismissNews(news.id, isPermanent);
    };

    closeBtns.forEach((btn) => btn.addEventListener("click", handleClose));
    if (ackBtn) ackBtn.addEventListener("click", handleClose);
  }

  function handleNewsUpdate(list) {
    if (!Array.isArray(list) || list.length === 0) {
      hideNewsCard();
      return;
    }

    const now = Date.now();
    // Filtra apenas ativas (expiração futura)
    const activeList = list.filter((item) => (item.expiresAt || 0) > now);

    if (activeList.length === 0) {
      hideNewsCard();
      return;
    }

    // Ordena da mais recente para a mais antiga
    activeList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const latestNews = activeList[0];

    // Verifica se o usuário dispensou essa novidade
    if (isNewsDismissed(latestNews.id)) {
      hideNewsCard();
      return;
    }

    // Se já está exibindo essa mesma novidade e nada mudou, apenas retorna
    if (
      currentActiveNews &&
      currentActiveNews.id === latestNews.id &&
      currentActiveNews.title === latestNews.title &&
      currentActiveNews.content === latestNews.content
    ) {
      return;
    }

    renderNews(latestNews);
  }

  function startNewsWatcher() {
    if (isSubscribed) return;

    if (window.FirebaseService && typeof window.FirebaseService.subscribeToNews === "function") {
      isSubscribed = true;
      window.FirebaseService.subscribeToNews(handleNewsUpdate);
    } else {
      // Tenta novamente caso o script Firebase ainda esteja carregando
      setTimeout(startNewsWatcher, 300);
    }
  }

  // Inicialização quando DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startNewsWatcher);
  } else {
    startNewsWatcher();
  }
})();
