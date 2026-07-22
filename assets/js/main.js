/**
 * main.js - Core State, Theme management, Navbar reactions, and Reveal Animations
 */

// Configuração centralizada do servidor do Chat (Express + WebSocket)
const CHAT_CONFIG = {
  // Altere esta variável para apontar para o seu servidor backend do Render quando estiver em produção
  productionServerUrl: "https://papos-site.onrender.com",
  
  // Função para retornar a URL do WebSocket de forma dinâmica
  getWebSocketUrl() {
    const isLocalhost = window.location.hostname === "localhost" || 
                        window.location.hostname === "127.0.0.1" || 
                        window.location.hostname === "0.0.0.0" ||
                        window.location.hostname.includes("ais-dev-") || // AI Studio dev
                        window.location.hostname.includes("ais-pre-") || // AI Studio preview
                        window.location.hostname.includes(".run.app");   // AI Studio run.app
    
    if (isLocalhost) {
      // Se estiver rodando localmente, conecta ao mesmo host
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}`;
    } else {
      // Em produção, converte o link do Render (HTTPS) para o protocolo WebSocket correto (WSS)
      let cleanUrl = this.productionServerUrl.trim();
      if (cleanUrl.endsWith("/")) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      return cleanUrl.replace(/^http/, "ws");
    }
  }
};

// Expor globalmente para a aplicação usar em qualquer lugar
window.CHAT_CONFIG = CHAT_CONFIG;

// Global modal helper for admin warnings (Global & Individual) across all pages
window.showAdminWarningModal = function (text, title = "Aviso Administrativo", onCloseCallback = null) {
  let modalEl = document.getElementById("adminIncomingWarningModal");
  if (modalEl) {
    try {
      const existing = bootstrap.Modal.getInstance(modalEl);
      if (existing) existing.hide();
    } catch(e) {}
    modalEl.remove();
  }

  modalEl = document.createElement("div");
  modalEl.id = "adminIncomingWarningModal";
  modalEl.className = "modal fade";
  modalEl.tabIndex = -1;
  modalEl.style.zIndex = "1150";
  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered" style="max-width: 500px;">
      <div class="modal-content bg-dark text-white border-warning shadow-lg" style="background-color: #141824 !important; border-width: 2px; border-radius: 12px;">
        <div class="modal-header border-bottom border-secondary py-3 px-4" style="background-color: #1a1f2e; border-top-left-radius: 10px; border-top-right-radius: 10px;">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill text-warning fs-4"></i>
            <h5 class="modal-title text-white fw-bold mb-0">${title || "Aviso Administrativo"}</h5>
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
  if (typeof onCloseCallback === "function") {
    modalEl.addEventListener("hidden.bs.modal", () => {
      onCloseCallback();
      modalEl.remove();
    }, { once: true });
  } else {
    modalEl.addEventListener("hidden.bs.modal", () => {
      modalEl.remove();
    }, { once: true });
  }
  bsModal.show();
};

const ChatEngine = {
  // Get persistent nickname
  getUser() {
    return localStorage.getItem("papos_nickname") || null;
  },

  // Save persistent nickname
  saveUser(nickname) {
    if (!nickname || nickname.trim() === "") return false;
    localStorage.setItem("papos_nickname", nickname.trim());
    return true;
  },

  // Clear nickname (logout)
  logoutUser() {
    localStorage.removeItem("papos_nickname");
  },

  // Initiate WebSocket connection on correct host/port
  connectSocket() {
    const wsUrl = window.CHAT_CONFIG.getWebSocketUrl();
    console.log("[ChatEngine] Conectando WebSocket em:", wsUrl);
    const socket = new WebSocket(wsUrl);
    return socket;
  },

  // Theme Management
  initTheme() {
    const savedTheme = localStorage.getItem("papos_theme");
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.setTheme(prefersDark ? "dark" : "light");
    }
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("papos_theme", theme);
    
    // Update all toggle image elements on the page
    const toggles = document.querySelectorAll(".theme-toggle-img");
    toggles.forEach(img => {
      img.src = (theme === "dark") ? "/assets/img/toggle-on.svg" : "/assets/img/toggle-off.svg";
      img.alt = (theme === "dark") ? "Tema Escuro Ligado" : "Tema Claro Ligado";
    });

    // Sync any standard checkbox toggles if they exist (backward compatibility)
    const togglerCheckbox = document.getElementById("theme-toggle-checkbox");
    if (togglerCheckbox) {
      togglerCheckbox.checked = (theme === "dark");
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    this.setTheme(next);
  },

  // Avatar visual color generation based on name
  getAvatarColor(name) {
    if (!name) return "#ffffff";
    const colors = [
      "#f43f5e", "#ec4899", "#d946ef", "#a855f7", 
      "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", 
      "#06b6d4", "#14b8a6", "#10b981", "#22c55e"
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  },

  // HTML Avatar bubble builder
  renderAvatar(name, sizeClass = "") {
    if (!name || name.trim() === "") name = "A";
    const cleanName = name.trim();
    const initial = cleanName.charAt(0).toUpperCase();
    
    // Suporte para foto de perfil válida do LocalStorage se houver
    let photoUrl = null;
    const currentUser = localStorage.getItem("papos_nickname");
    if (cleanName === currentUser || cleanName === "Você") {
      photoUrl = localStorage.getItem("papos_photo");
    } else {
      photoUrl = localStorage.getItem(`papos_photo_${cleanName}`);
    }
    
    if (photoUrl && photoUrl.trim() !== "" && !photoUrl.includes("undefined") && !photoUrl.includes("null")) {
      return `<img src="${photoUrl}" class="avatar-circle ${sizeClass}" alt="${cleanName}" title="${cleanName}" referrerPolicy="no-referrer" style="object-fit: cover;" />`;
    }
    
    const bgColor = this.getAvatarColor(cleanName);
    return `<div class="avatar-circle ${sizeClass}" style="background-color: ${bgColor}" title="${cleanName}">${initial}</div>`;
  },

  init() {
    this.initTheme();
  }
};

// Global Admin Panel Controls
window.mostrarPainelAdmin = function () {
  try {
    console.log("Admin confirmado");
    let btn = document.querySelector("#admin-button");
    if (!btn) {
      console.log("Criando botão admin");
      console.log("Criando botão");
      btn = document.createElement("button");
      btn.id = "admin-button";
      btn.type = "button";
      btn.className = "btn btn-dark shadow-lg d-flex align-items-center justify-content-center gap-2 text-white border-0";
      btn.style.cssText = "position: fixed; bottom: 20px; left: 20px; z-index: 99999; border-radius: 50px; padding: 10px 18px; font-weight: 600; font-size: 0.88rem; background: linear-gradient(135deg, #1f2937, #111827); box-shadow: 0 10px 25px rgba(0,0,0,0.5); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;";
      btn.innerHTML = `<i class="bi bi-shield-lock-fill text-success fs-6"></i><span>Painel Admin</span>`;
      btn.onmouseover = () => { btn.style.transform = 'scale(1.06)'; };
      btn.onmouseout = () => { btn.style.transform = 'scale(1)'; };
      btn.onclick = () => {
        if (window.injectAdminPanelUI) {
          window.injectAdminPanelUI();
        }
        const modalEl = document.getElementById("adminPanelModal") || document.getElementById("adminModal");
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
          const bsModal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
          bsModal.show();
        }
      };
      document.body.appendChild(btn);
      console.log("Botão criado");
      console.log("Botão inserido");
    } else {
      btn.style.display = "flex";
      btn.classList.remove("d-none");
    }

    if (!window.injectAdminPanelUI) {
      if (!document.querySelector('script[src*="admin-controller.js"]')) {
        const s = document.createElement("script");
        s.src = "/assets/js/admin-controller.js";
        s.onload = () => {
          if (window.injectAdminPanelUI) window.injectAdminPanelUI();
          console.log("Painel pronto");
        };
        document.head.appendChild(s);
      }
    } else {
      window.injectAdminPanelUI();
      console.log("Painel pronto");
    }

    const trigger = document.getElementById("admin-trigger-container");
    if (trigger) {
      trigger.classList.remove("d-none");
    }
    console.log("Painel exibido.");
  } catch (err) {
    console.error("Erro ao exibir painel admin:", err);
  }
};

window.esconderPainelAdmin = function () {
  try {
    const btn = document.querySelector("#admin-button");
    if (btn) {
      btn.style.display = "none";
      btn.classList.add("d-none");
    }
    const trigger = document.getElementById("admin-trigger-container");
    if (trigger) {
      trigger.classList.add("d-none");
    }
    const modalEl = document.getElementById("adminModal") || document.getElementById("adminPanelModal");
    if (modalEl && window.bootstrap && window.bootstrap.Modal) {
      const inst = window.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
    }
  } catch (err) {
    console.error("Erro ao esconder painel admin:", err);
  }
};

// Expor globalmente para a aplicação usar em qualquer lugar
window.ChatEngine = ChatEngine;

// Apply theme before page renders to avoid white flashes
ChatEngine.initTheme();

// URL Query Error Handler for Banned/Suspended redirect visual states
(function handleUrlErrors() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("error")) {
    const errorType = params.get("error");
    let message = "";
    let title = "Acesso Negado";
    if (errorType === "banned") {
      message = "Você foi banido permanentemente pela administração deste chat.";
      title = "Conta Banida";
    } else if (errorType === "suspended") {
      const remaining = params.get("remaining") || "algum tempo";
      message = `Sua conta está suspensa pela administração. Tempo restante: ${remaining} minuto(s).`;
      title = "Conta Suspensa";
    }

    if (message) {
      // Clean query parameters from URL without reloading
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, "", newUrl);

      document.addEventListener("DOMContentLoaded", () => {
        if (window.showAdminWarningModal) {
          window.showAdminWarningModal(message, title);
        } else {
          // Dynamic fallback modal
          const modalEl = document.createElement("div");
          modalEl.className = "modal fade";
          modalEl.id = "urlErrorModal";
          modalEl.tabIndex = -1;
          modalEl.setAttribute("aria-hidden", "true");
          modalEl.style.zIndex = "1100";
          modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content border-secondary shadow-lg rounded-4 overflow-hidden" style="background-color: var(--surface); color: #fff;">
                <div class="modal-header border-secondary p-3">
                  <h5 class="modal-title fw-bold d-flex align-items-center gap-2">
                    <i class="bi bi-exclamation-triangle-fill text-danger"></i>
                    <span>${title}</span>
                  </h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar" style="filter: invert(1);"></button>
                </div>
                <div class="modal-body p-4 text-white-50">
                  <p class="mb-0" style="font-size: 0.95rem; line-height: 1.5;">${message}</p>
                </div>
                <div class="modal-footer border-secondary p-2">
                  <button type="button" class="btn btn-secondary-custom w-100 py-2" data-bs-dismiss="modal">Entendido</button>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(modalEl);
          const bModal = new bootstrap.Modal(modalEl);
          bModal.show();
        }
      });
    }
  }
})();

// Global reveal scroll animations, progress indicator and navbar resize
document.addEventListener("DOMContentLoaded", () => {
  // Let style sheets know JavaScript is working
  document.documentElement.classList.add('js-enabled');
  document.documentElement.classList.add('js-active');
  
  ChatEngine.init();

  // 1. Reading Progress Bar Logic
  const progressBar = document.getElementById("scroll-progress-bar");
  window.addEventListener("scroll", () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    if (progressBar) {
      progressBar.style.width = scrolled + "%";
    }

    // 2. Navbar Shrink / Floating Behavior
    const header = document.querySelector(".navbar-custom");
    if (header) {
      if (window.scrollY > 20) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    }
  });

  // 3. Staggered Entrance Scroll Reveal Animations
  const revealElements = document.querySelectorAll(".scroll-reveal");
  if ("IntersectionObserver" in window) {
    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          // Stop observing so it only triggers once
          scrollObserver.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.05,
      rootMargin: "0px 0px -40px 0px"
    });

    revealElements.forEach(el => scrollObserver.observe(el));
  } else {
    // Fallback if IntersectionObserver is not supported
    revealElements.forEach(el => el.classList.add("revealed"));
  }

  // 4. Keyboard support for theme toggle button
  const themeToggleWrappers = document.querySelectorAll(".theme-switch-container");
  themeToggleWrappers.forEach(wrap => {
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ChatEngine.toggleTheme();
      }
    });
  });
});

// Bind globally
window.ChatEngine = ChatEngine;
window.ChatEngineInitialized = true;
