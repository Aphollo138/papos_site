

const CHAT_CONFIG = {
  
  productionServerUrl: "https://papos-site.onrender.com",
  
  
  getWebSocketUrl() {
    const isLocalhost = window.location.hostname === "localhost" || 
                        window.location.hostname === "127.0.0.1" || 
                        window.location.hostname === "0.0.0.0" ||
                        window.location.hostname.includes("ais-dev-") || 
                        window.location.hostname.includes("ais-pre-") || 
                        window.location.hostname.includes(".run.app");   
    
    if (isLocalhost) {
     
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}`;
    } else {
      
      let cleanUrl = this.productionServerUrl.trim();
      if (cleanUrl.endsWith("/")) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      return cleanUrl.replace(/^http/, "ws");
    }
  }
};


window.CHAT_CONFIG = CHAT_CONFIG;

const ChatEngine = {
  
  getUser() {
    return localStorage.getItem("papos_nickname") || null;
  },

  
  saveUser(nickname) {
    if (!nickname || nickname.trim() === "") return false;
    localStorage.setItem("papos_nickname", nickname.trim());
    return true;
  },

  
  logoutUser() {
    localStorage.removeItem("papos_nickname");
  },

 
  connectSocket() {
    const wsUrl = window.CHAT_CONFIG.getWebSocketUrl();
    console.log("[ChatEngine] Conectando WebSocket em:", wsUrl);
    const socket = new WebSocket(wsUrl);
    return socket;
  },

  
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
    
    
    const toggles = document.querySelectorAll(".theme-toggle-img");
    toggles.forEach(img => {
      img.src = (theme === "dark") ? "/assets/img/toggle-on.svg" : "/assets/img/toggle-off.svg";
      img.alt = (theme === "dark") ? "Tema Escuro Ligado" : "Tema Claro Ligado";
    });

   
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
    const cleanName = name.trim();
    const initial = cleanName.charAt(0).toUpperCase();
    
    
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


ChatEngine.initTheme();


document.addEventListener("DOMContentLoaded", () => {
  // Let style sheets know JavaScript is working
  document.documentElement.classList.add('js-enabled');
  document.documentElement.classList.add('js-active');
  
  ChatEngine.init();

  
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
