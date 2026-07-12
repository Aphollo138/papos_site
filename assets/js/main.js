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

 
  renderAvatar(name, sizeClass = "") {
    if (!name || name.trim() === "") name = "A";
    const initial = name.trim().charAt(0).toUpperCase();
    const bgColor = this.getAvatarColor(name);
    return `<div class="avatar-circle ${sizeClass}" style="background-color: ${bgColor}" title="${name}">${initial}</div>`;
  },

  init() {
    this.initTheme();
  }
};


ChatEngine.initTheme();


document.addEventListener("DOMContentLoaded", () => {
  
  document.documentElement.classList.add('js-enabled');
  document.documentElement.classList.add('js-active');
  
  ChatEngine.init();

  
  const serverIndicator = document.getElementById("active-server-indicator");
  if (serverIndicator) {
    const wsUrl = window.CHAT_CONFIG.getWebSocketUrl();
    const serverHost = wsUrl.replace(/^ws(s)?:\/\//, "");
    serverIndicator.textContent = `Servidor ativo: ${serverHost}`;
  }

  
  const progressBar = document.getElementById("scroll-progress-bar");
  window.addEventListener("scroll", () => {
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    if (progressBar) {
      progressBar.style.width = scrolled + "%";
    }

    
    const header = document.querySelector(".navbar-custom");
    if (header) {
      if (window.scrollY > 20) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    }
  });

 
  const revealElements = document.querySelectorAll(".scroll-reveal");
  if ("IntersectionObserver" in window) {
    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          
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
    
    revealElements.forEach(el => el.classList.add("revealed"));
  }

  
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


window.ChatEngine = ChatEngine;
