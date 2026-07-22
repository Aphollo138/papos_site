/**
 * monetization.js - Gerenciador Centralizado de Monetização (Monetag) para o Papos
 * 
 * Este arquivo gerencia de forma isolada, segura, assíncrona e à prova de falhas a inicialização
 * dos formatos de anúncios da Monetag, protegendo a experiência do usuário e garantindo que
 * nenhum erro de rede ou bloqueador de anúncios quebre as funcionalidades essenciais do site.
 * 
 * Formatos configurados conforme as zonas oficiais criadas no painel da Monetag:
 * 
 * MONETAG_IN_PAGE_PUSH — <script>(function(s){s.dataset.zone='11276687',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
 * MONETAG_VIGNETTE_BANNER — <script>(function(s){s.dataset.zone='11276686',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>
 */

// Configuração simples para ativar/desativar cada formato individualmente de forma rápida
window.MONETAG_CONFIG = {
  enableInPagePush: true,  // Altere para false para desativar o In-Page Push
  enableVignette: true     // Altere para false para desativar o Vignette Banner
};

(function() {
  // Evita que o script de gerenciamento seja inicializado mais de uma vez na mesma página
  if (window.MONETAG_MANAGER_INITIALIZED) return;
  window.MONETAG_MANAGER_INITIALIZED = true;

  console.log("[Monetag Manager] Verificando permissão do servidor no backend para exibição de anúncios...");

  // Controle interno para evitar que scripts idênticos sejam inseridos mais de uma vez
  let inPagePushLoaded = false;
  let vignetteLoaded = false;

  /**
   * Consulta o backend para saber se este usuário tem anúncios ativados ou desativados
   */
  async function checkServerAdsPermission() {
    if (window.MONETAG_DISABLED === true) {
      console.log("[Monetag Manager] Anúncios desativados via WebSocket para este usuário.");
      return false;
    }
    try {
      let uid = "";
      const storedAuth = localStorage.getItem("papos_auth_user") || localStorage.getItem("firebase_user");
      if (storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth);
          uid = parsed.uid || "";
        } catch (e) {}
      }
      if (!uid && window.FirebaseService && typeof window.FirebaseService.getCurrentUser === "function") {
        const u = window.FirebaseService.getCurrentUser();
        if (u) uid = u.uid;
      }

      const url = uid ? `/api/user/ads-status?uid=${encodeURIComponent(uid)}` : `/api/user/ads-status`;
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.showAds === false) {
        window.MONETAG_DISABLED = true;
        return false;
      }
      return data && data.showAds === true;
    } catch (e) {
      console.warn("[Monetag Manager] Erro ao consultar servidor, aplicando padrão:", e);
      return !window.MONETAG_DISABLED;
    }
  }

  /**
   * Inicializa o In-Page Push de forma assíncrona
   */
  function loadInPagePush() {
    if (window.MONETAG_DISABLED === true) {
      console.log("[Monetag Manager] Anúncios desativados. In-Page Push ignorado.");
      return;
    }
    if (!window.MONETAG_CONFIG || !window.MONETAG_CONFIG.enableInPagePush) {
      console.log("[Monetag Manager] In-Page Push está desativado nas configurações.");
      return;
    }
    if (inPagePushLoaded) return;
    inPagePushLoaded = true;

    try {
      console.log("[Monetag Manager] Carregando In-Page Push (Zona: 11276687)...");
      const s = document.createElement('script');
      s.dataset.zone = '11276687';
      s.src = 'https://nap5k.com/tag.min.js';
      s.async = true; // Carregamento assíncrono para nunca bloquear a renderização

      const parent = [document.documentElement, document.body].filter(Boolean).pop();
      if (parent) {
        parent.appendChild(s);
        console.log("[Monetag Manager] Script In-Page Push adicionado com sucesso.");
      }
    } catch (error) {
      console.error("[Monetag Manager] Falha silenciosa ao carregar In-Page Push:", error);
    }
  }

  /**
   * Inicializa o Vignette Banner de forma controlada e assíncrona
   */
  function loadVignette() {
    if (window.MONETAG_DISABLED === true) {
      console.log("[Monetag Manager] Anúncios desativados. Vignette Banner ignorado.");
      return;
    }
    if (!window.MONETAG_CONFIG || !window.MONETAG_CONFIG.enableVignette) {
      console.log("[Monetag Manager] Vignette Banner está desativado nas configurações.");
      return;
    }
    if (vignetteLoaded) return;

    // Frequência de exibição extremamente controlada: apenas uma vez por sessão do navegador
    const sessionKey = "papos_vignette_shown_session";
    if (sessionStorage.getItem(sessionKey)) {
      console.log("[Monetag Manager] Vignette Banner omitido para respeitar a frequência de exibição nesta sessão.");
      return;
    }

    vignetteLoaded = true;
    sessionStorage.setItem(sessionKey, "true");

    try {
      console.log("[Monetag Manager] Carregando Vignette Banner (Zona: 11276686)...");
      const s = document.createElement('script');
      s.dataset.zone = '11276686';
      s.src = 'https://n6wxm.com/vignette.min.js';
      s.async = true; // Carregamento assíncrono para evitar qualquer lentidão visual

      const parent = [document.documentElement, document.body].filter(Boolean).pop();
      if (parent) {
        parent.appendChild(s);
        console.log("[Monetag Manager] Script Vignette Banner adicionado com sucesso.");
      }
    } catch (error) {
      console.error("[Monetag Manager] Falha silenciosa ao carregar Vignette Banner:", error);
    }
  }

  /**
   * Injeta estilos CSS para garantir estabilidade visual, responsividade,
   * e que os anúncios não cubram controles do chat, teclado mobile ou o campo de digitação.
   */
  function injectSafetyStyles() {
    try {
      const style = document.createElement("style");
      style.textContent = `
        /* Garante que o rodapé do chat (campo de mensagem) fique sempre acima das camadas de anúncios */
        .chat-input-area {
          position: relative !important;
          z-index: 1050 !important;
        }
        /* Garante que o cabeçalho do chat fique acima dos anúncios flutuantes */
        .chat-header {
          position: relative !important;
          z-index: 1050 !important;
        }
        /* Garante que o menu offcanvas de membros e o modal de salas se sobreponham aos anúncios */
        .offcanvas, .modal {
          z-index: 1060 !important;
        }
        /* Impede qualquer rolagem horizontal provocada por banners flutuantes */
        html, body {
          overflow-x: hidden !important;
        }
      `;
      document.head.appendChild(style);
    } catch (e) {
      console.error("[Monetag Manager] Falha ao injetar estilos de segurança de layout:", e);
    }
  }

  /**
   * Avalia a rota atual e define a política de carregamento específica para cada página
   */
  function setupPageSpecificPlacement() {
    injectSafetyStyles();

    const path = window.location.pathname;

    // 1. ÁREA DE CONVERSA ATIVA (chat.html)
    // Regra: Somente carrega In-Page Push e EXCLUSIVAMENTE após o WebSocket conectar e as mensagens carregarem.
    // Nunca carrega Vignette Banner na tela de chat ativo para não atrapalhar o fluxo de conversa.
    if (path.includes("/chat")) {
      console.log("[Monetag Manager] Canal de chat detectado. Adiantando conexão WebSocket sem interrupções...");

      const checkInterval = setInterval(() => {
        try {
          const container = document.getElementById("chat-messages-container");
          if (container) {
            // Verifica se as mensagens da sala foram renderizadas no DOM
            const activeElements = container.querySelectorAll(".msg-bubble, .msg-system");
            if (activeElements.length > 0) {
              clearInterval(checkInterval);
              console.log("[Monetag Manager] Chat carregado e mensagens ativas. Carregando In-Page Push com delay de 3s...");
              setTimeout(loadInPagePush, 3000);
            }
          }
        } catch (err) {
          console.error("[Monetag Manager] Falha ao verificar estado das mensagens do chat:", err);
        }
      }, 1000);

      // Timeout de segurança para interromper o intervalo caso ocorra instabilidade de rede ou sala vazia
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!inPagePushLoaded) {
          console.log("[Monetag Manager] Tempo esgotado para sincronização do feed. Carregando In-Page Push de forma segura.");
          loadInPagePush();
        }
      }, 15000);

      return;
    }

    // 2. PÁGINA DE SELEÇÃO DE SALAS (rooms.html)
    // Regra: In-Page Push carrega com delay suave de 1.5s. Vignette Banner carrega após 3.5s (transição natural).
    if (path.includes("/salas")) {
      console.log("[Monetag Manager] Página de Salas Ativas detectada.");
      setTimeout(loadInPagePush, 1500);
      setTimeout(loadVignette, 3500);
      return;
    }

    // 3. LANDING PAGE (index.html / /pagina-inicial)
    // Regra: In-Page Push carrega com delay de 2s. Vignette Banner carrega somente em inatividade do usuário (6s)
    // ou se o usuário interagir com o campo de apelido (transição natural ao se preparar para entrar).
    if (path === "/" || path === "" || path.includes("/pagina-inicial") || path.includes("/index.html")) {
      console.log("[Monetag Manager] Landing Page principal detectada.");
      
      setTimeout(loadInPagePush, 2000);

      const idleTimeout = setTimeout(() => {
        console.log("[Monetag Manager] Usuário ocioso na página principal por 6s. Carregando Vignette Banner...");
        loadVignette();
      }, 6000);

      // Otimiza o carregamento se o usuário começar a interagir com o formulário
      const nickInput = document.getElementById("user-nickname");
      if (nickInput) {
        const handleInteraction = () => {
          clearTimeout(idleTimeout);
          console.log("[Monetag Manager] Digitação detectada. Preparando Vignette Banner...");
          setTimeout(loadVignette, 2000);
          nickInput.removeEventListener("input", handleInteraction);
        };
        nickInput.addEventListener("input", handleInteraction);
      }
      return;
    }

    // 4. PÁGINAS INFORMATIVAS SECUNDÁRIAS (Privacidade, Termos de Uso, Meu Perfil)
    // Regra: Carrega formatos padrão de forma limpa e sequencial
    console.log("[Monetag Manager] Página informativa secundária detectada.");
    setTimeout(loadInPagePush, 1500);
    setTimeout(loadVignette, 3000);
  }

  async function initMonetag() {
    const showAds = await checkServerAdsPermission();
    if (!showAds) {
      console.log("[Monetag Manager] Anúncios desativados pelo servidor para este usuário. Nenhum script Monetag será carregado.");
      return;
    }
    setupPageSpecificPlacement();
  }

  // Inicialização segura quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMonetag);
  } else {
    initMonetag();
  }
})();
