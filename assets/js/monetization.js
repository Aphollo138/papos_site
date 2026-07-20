

window.MONETAG_CONFIG = {
  enableInPagePush: true,  
  enableVignette: true     
};

(function() {
  
  if (window.MONETAG_MANAGER_INITIALIZED) return;
  window.MONETAG_MANAGER_INITIALIZED = true;

  console.log("[Monetag Manager] Inicializando gerenciamento seguro de anúncios no domínio papo.net.br...");

  
  let inPagePushLoaded = false;
  let vignetteLoaded = false;

 
  function loadInPagePush() {
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
      s.async = true; 

      const parent = [document.documentElement, document.body].filter(Boolean).pop();
      if (parent) {
        parent.appendChild(s);
        console.log("[Monetag Manager] Script In-Page Push adicionado com sucesso.");
      }
    } catch (error) {
      console.error("[Monetag Manager] Falha silenciosa ao carregar In-Page Push:", error);
    }
  }

  
  function loadVignette() {
    if (!window.MONETAG_CONFIG || !window.MONETAG_CONFIG.enableVignette) {
      console.log("[Monetag Manager] Vignette Banner está desativado nas configurações.");
      return;
    }
    if (vignetteLoaded) return;

   
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
      s.async = true; 

      const parent = [document.documentElement, document.body].filter(Boolean).pop();
      if (parent) {
        parent.appendChild(s);
        console.log("[Monetag Manager] Script Vignette Banner adicionado com sucesso.");
      }
    } catch (error) {
      console.error("[Monetag Manager] Falha silenciosa ao carregar Vignette Banner:", error);
    }
  }

  
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


  function setupPageSpecificPlacement() {
    injectSafetyStyles();

    const path = window.location.pathname;

    
    if (path.includes("/chat")) {
      console.log("[Monetag Manager] Canal de chat detectado. Adiantando conexão WebSocket sem interrupções...");

      const checkInterval = setInterval(() => {
        try {
          const container = document.getElementById("chat-messages-container");
          if (container) {
            
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

      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!inPagePushLoaded) {
          console.log("[Monetag Manager] Tempo esgotado para sincronização do feed. Carregando In-Page Push de forma segura.");
          loadInPagePush();
        }
      }, 15000);

      return;
    }

    
    if (path.includes("/salas")) {
      console.log("[Monetag Manager] Página de Salas Ativas detectada.");
      setTimeout(loadInPagePush, 1500);
      setTimeout(loadVignette, 3500);
      return;
    }

   
    if (path === "/" || path === "" || path.includes("/pagina-inicial") || path.includes("/index.html")) {
      console.log("[Monetag Manager] Landing Page principal detectada.");
      
      setTimeout(loadInPagePush, 2000);

      const idleTimeout = setTimeout(() => {
        console.log("[Monetag Manager] Usuário ocioso na página principal por 6s. Carregando Vignette Banner...");
        loadVignette();
      }, 6000);

     
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


    console.log("[Monetag Manager] Página informativa secundária detectada.");
    setTimeout(loadInPagePush, 1500);
    setTimeout(loadVignette, 3000);
  }

  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPageSpecificPlacement);
  } else {
    setupPageSpecificPlacement();
  }
})();
