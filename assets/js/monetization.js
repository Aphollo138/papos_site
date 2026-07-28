
window.MONETAG_CONFIG = {
  enableInPagePush: true,  
  enableVignette: true     
};

(function() {
  
  if (window.MONETAG_MANAGER_INITIALIZED) return;
  window.MONETAG_MANAGER_INITIALIZED = true;

  let inPagePushLoaded = false;
  let vignetteLoaded = false;

  async function checkServerAdsPermission() {
    if (window.MONETAG_DISABLED === true) {
      
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
      
      if (window.MONETAG_DISABLED) 
      return !window.MONETAG_DISABLED;
    }
  }

  function loadInPagePush() {
    if (window.MONETAG_DISABLED === true) {
      
      return;
    }
    if (!window.MONETAG_CONFIG || !window.MONETAG_CONFIG.enableInPagePush) {
      
      return;
    }
    if (inPagePushLoaded) return;
    inPagePushLoaded = true;

    try {
      
      const s = document.createElement('script');
      s.dataset.zone = '11276687';
      s.src = 'https://nap5k.com/tag.min.js';
      s.async = true;

      const parent = [document.documentElement, document.body].filter(Boolean).pop();
      if (parent) {
        parent.appendChild(s);
        
      }
    } catch (error) {
      console.error("[Monetag Manager] Falha silenciosa ao carregar In-Page Push:", error);
    }
  }

  function loadVignette() {
    if (window.MONETAG_DISABLED === true) {
      
      return;
    }
    if (!window.MONETAG_CONFIG || !window.MONETAG_CONFIG.enableVignette) {
      
      return;
    }
    if (vignetteLoaded) return;

    const sessionKey = "papos_vignette_shown_session";
    if (sessionStorage.getItem(sessionKey)) {
      
      return;
    }

    vignetteLoaded = true;
    sessionStorage.setItem(sessionKey, "true");

    try {
      
      const s = document.createElement('script');
      s.dataset.zone = '11276686';
      s.src = 'https://n6wxm.com/vignette.min.js';
      s.async = true; 

      const parent = [document.documentElement, document.body].filter(Boolean).pop();
      if (parent) {
        parent.appendChild(s);
        
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
      
      const checkInterval = setInterval(() => {
        try {
          const container = document.getElementById("chat-messages-container");
          if (container) {
            
            const activeElements = container.querySelectorAll(".msg-bubble, .msg-system");
            if (activeElements.length > 0) {
              clearInterval(checkInterval);
              
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
          
          loadInPagePush();
        }
      }, 15000);

      return;
    }

    if (path.includes("/salas")) {
      
      setTimeout(loadInPagePush, 1500);
      setTimeout(loadVignette, 3500);
      return;
    }

    if (path === "/" || path === "" || path.includes("/pagina-inicial") || path.includes("/index.html")) {
      
      setTimeout(loadInPagePush, 2000);

      const idleTimeout = setTimeout(() => {
        
        loadVignette();
      }, 6000);

      const nickInput = document.getElementById("user-nickname");
      if (nickInput) {
        const handleInteraction = () => {
          clearTimeout(idleTimeout);
          
          setTimeout(loadVignette, 2000);
          nickInput.removeEventListener("input", handleInteraction);
        };
        nickInput.addEventListener("input", handleInteraction);
      }
      return;
    }

    setTimeout(loadInPagePush, 1500);
    setTimeout(loadVignette, 3000);
  }

  async function initMonetag() {
    const showAds = await checkServerAdsPermission();
    if (!showAds) {
      
      return;
    }
    if (window.MONETAG_DISABLED === true) {
      
      return;
    }
    setupPageSpecificPlacement();
  }

  window.initMonetag = initMonetag;

  window.desabilitarMonetag = function desabilitarMonetag() {
    try {
      window.MONETAG_DISABLED = true;
      
      const scripts = document.querySelectorAll('script');
      scripts.forEach(s => {
        const src = s.src || '';
        const isMonetag = (s.dataset && s.dataset.zone) ||
          src.includes('nap5k.com') ||
          src.includes('n6wxm.com') ||
          src.includes('tag.min.js') ||
          src.includes('vignette.min.js') ||
          src.includes('monetag') ||
          src.includes('popunder') ||
          src.includes('inpage');
        if (isMonetag) {
          s.remove();
          
        }
      });

      const adContainers = document.querySelectorAll('[id*="monetag"], [class*="monetag"], [data-zone], [id*="inpage"], [id*="vignette"], [id*="popunder"]');
      adContainers.forEach(el => el.remove());
    } catch (err) {
      console.error("Erro ao desabilitar Monetag:", err);
    }
  };

  window.habilitarMonetag = function habilitarMonetag() {
    try {
      window.MONETAG_DISABLED = false;
      
      if (typeof window.initMonetag === "function") {
        window.initMonetag();
      }
    } catch (err) {
      console.error("[PERMISSIONS] Erro ao habilitar Monetag:", err);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMonetag);
  } else {
    initMonetag();
  }
})();