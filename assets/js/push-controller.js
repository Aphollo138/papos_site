
import { app, auth, db } from "/firebase/firebase.js";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from "firebase/messaging";

const VAPID_KEY = "BA3N8_2cx65vzUqBzGtlIjblc8ocugABMJjQBxUZaxJ_bAR96s8IvzcbCbnkxSckb8G-GrQqnGX2d1MMD56wWlA";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class PushNotificationManager {
  constructor() {
    this.messaging = null;
    this.swRegistration = null;
    this.currentToken = null;
    this.isSupported = false;
    this.initialized = false;
    this.isIOS = false;
    this.isStandalone = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // Detectar ambiente iOS (iPhone / iPad)
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // Detectar se está rodando como Web App / PWA instalado na Tela de Início
    this.isStandalone = window.matchMedia("(display-mode: standalone)").matches || 
      Boolean(navigator.standalone);

    // Conectar eventos do Card no DOM imediatamente
    this.bindCardEvents();

    
    if (this.isIOS && !this.isStandalone) {
      if (!this.isDismissed()) {
        setTimeout(() => {
          if (!this.isDismissed()) {
            this.showIOSGuidanceCard();
          }
        }, 1500);
      }
      return;
    }

    // Verificar se o navegador suporta notificações e Service Worker
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.log("[Push] Navegador não suporta Push Notifications.");
      return;
    }

    console.log("[Push] Permission:", Notification.permission);

    try {
      const supported = await isMessagingSupported();
      if (!supported) {
        console.log("[Push] Firebase Messaging não é suportado neste ambiente.");
        return;
      }

      this.isSupported = true;
      this.initMessaging();

      // Registrar Service Worker em segundo plano para que já esteja pronto
      await this.initServiceWorker();

      // Escutar mensagens em primeiro plano (quando o site já está aberto)
      this.setupForegroundListener();

      // Configurar escuta de mensagens enviadas pelo Service Worker (ex: cliques)
      this.setupServiceWorkerMessageListener();

      // Verificar estado da permissão
      if (Notification.permission === "granted") {
        // Se a permissão já foi concedida, NÃO mostrar o banner
        // Sincronizar o token FCM silenciosamente
        await this.syncToken();
      } else if (Notification.permission === "default") {
        // Permissão padrão: mostrar o banner após 1.5 segundos se não foi dispensado
        if (!this.isDismissed()) {
          setTimeout(() => {
            if (Notification.permission === "default" && !this.isDismissed()) {
              this.showCard();
            }
          }, 1500);
        }
      } else if (Notification.permission === "denied") {
        // Permissão bloqueada pelo usuário: não exibir o banner automaticamente
        console.log("[Push] Notificações foram bloqueadas pelo usuário nas configurações do navegador.");
      }

      // Verificar parâmetro na URL para abrir sala ou privado (caso tenha clicado na notificação)
      this.checkUrlForNotificationAction();
    } catch (err) {
      console.warn("[Push] Erro ao inicializar:", err);
    }
  }

  initMessaging() {
    if (!this.messaging && app) {
      try {
        this.messaging = getMessaging(app);
        console.log("[Push] Firebase Messaging inicializado");
      } catch (e) {
        console.warn("[Push] Falha ao inicializar getMessaging:", e);
      }
    }
  }

  async initServiceWorker() {
    if (this.swRegistration) return this.swRegistration;
    if (!("serviceWorker" in navigator)) return null;

    try {
      this.swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/"
      });
      console.log("[Push] Service Worker registrado");
      return this.swRegistration;
    } catch (err) {
      console.warn("[Push] Falha ao registrar Service Worker:", err);
      return null;
    }
  }

  setupForegroundListener() {
    if (!this.messaging) return;
    try {
      onMessage(this.messaging, (payload) => {
        console.log("[Push] Mensagem recebida:", payload);
        console.log("[Push] Notificação processada");

        const title = payload.notification?.title || payload.data?.title || "Papos";
        const body = payload.notification?.body || payload.data?.body || "Nova mensagem na sala.";

        // Se o usuário está com a aba ativa e na conversa com o remetente, evitar toast redundante
        const privateNick = payload.data?.privateNick;
        if (privateNick && window.activePrivateRecipient && window.activePrivateRecipient.toLowerCase() === privateNick.toLowerCase()) {
          return;
        }

        // Exibir toast discreto na tela
        if (window.showAdminToast) {
          window.showAdminToast(`${title}: ${body}`, "info");
        } else if (window.appendSystemMessage) {
          window.appendSystemMessage(`🔔 ${title}: ${body}`);
        }
      });
    } catch (e) {
      console.warn("[Push] Erro ao registrar onMessage:", e);
    }
  }

  setupServiceWorkerMessageListener() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (!event.data) return;
      if (event.data.action === "OPEN_PRIVATE_CHAT" && event.data.nickname) {
        if (typeof window.openPrivateChat === "function") {
          window.openPrivateChat(event.data.nickname);
        }
      } else if (event.data.action === "JOIN_ROOM" && event.data.roomId) {
        if (typeof window.joinRoom === "function") {
          window.joinRoom(event.data.roomId);
        }
      }
    });
  }

  checkUrlForNotificationAction() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const dm = urlParams.get("dm");
      if (dm) {
        setTimeout(() => {
          if (typeof window.openPrivateChat === "function") {
            window.openPrivateChat(dm);
          }
        }, 1200);
      }
    } catch (e) {}
  }

  isDismissed() {
    try {
      const dismissedUntil = localStorage.getItem("papos_push_dismissed_until");
      if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  showCard() {
    if (Notification.permission !== "default") return;
    const card = document.getElementById("push-notification-card");
    if (card) {
      card.classList.remove("d-none");
      console.log("[Push] Banner exibido");
    }
  }

  showIOSGuidanceCard() {
    const card = document.getElementById("push-notification-card");
    const titleEl = document.getElementById("push-card-title");
    const descEl = document.getElementById("push-card-desc");
    const btnEnable = document.getElementById("btn-push-card-enable");
    const btnDismiss = document.getElementById("btn-push-card-dismiss");

    if (card) {
      if (titleEl) titleEl.textContent = "🔔 Notificações no iPhone";
      if (descEl) descEl.textContent = "Para receber notificações no iPhone, adicione o Papos à Tela de Início e abra o Papos pelo ícone instalado.";
      if (btnEnable) {
        btnEnable.textContent = "Entendi";
        btnEnable.onclick = () => {
          this.dismiss(1);
        };
      }
      if (btnDismiss) {
        btnDismiss.style.display = "none";
      }
      card.classList.remove("d-none");
      console.log("[Push] Banner exibido");
    }
  }

  hideCard() {
    const card = document.getElementById("push-notification-card");
    if (card) {
      card.classList.add("d-none");
    }
  }

  dismiss(days = 1) {
    this.hideCard();
    try {
      const until = Date.now() + (days * ONE_DAY_MS);
      localStorage.setItem("papos_push_dismissed_until", String(until));
    } catch (e) {}
  }

  bindCardEvents() {
    const btnEnable = document.getElementById("btn-push-card-enable");
    const btnDismiss = document.getElementById("btn-push-card-dismiss");
    const btnClose = document.getElementById("btn-push-card-close");

    if (btnEnable) {
      btnEnable.addEventListener("click", async () => {
        // Se estiver no fluxo iOS de orientação, o clique apenas fecha
        if (this.isIOS && !this.isStandalone) {
          this.dismiss(1);
          return;
        }

        console.log("[Push] Usuário clicou para ativar");
        btnEnable.disabled = true;
        btnEnable.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Ativando...`;
        await this.requestPermissionAndSubscribe();
        btnEnable.disabled = false;
        btnEnable.textContent = "Quero ser avisado";
      });
    }

    if (btnDismiss) {
      btnDismiss.addEventListener("click", () => {
        this.dismiss(1);
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", () => {
        this.dismiss(1);
      });
    }
  }

  async requestPermissionAndSubscribe() {
    if (!this.isSupported && !("Notification" in window)) {
      alert("Seu navegador não suporta notificações push.");
      this.hideCard();
      return;
    }

    try {
      // Solicitar permissão apenas após o clique explícito do usuário
      const permission = await Notification.requestPermission();
      console.log("[Push] Permission:", permission);

      if (permission === "granted") {
        this.hideCard();
        localStorage.setItem("papos_push_enabled", "true");

        // Inicializar SW e Messaging
        await this.initServiceWorker();
        this.initMessaging();
        this.setupForegroundListener();
        this.setupServiceWorkerMessageListener();

        // Obter e salvar o token
        await this.syncToken();

        if (window.showAdminToast) {
          window.showAdminToast("Notificações push ativadas com sucesso! Você receberá avisos quando conversarem nas salas.", "success");
        } else {
          alert("Notificações push ativadas com sucesso!");
        }
      } else if (permission === "denied") {
        this.hideCard();
        this.dismiss(7);
        console.warn("[Push] O usuário bloqueou as notificações.");
        if (window.showAdminToast) {
          window.showAdminToast("As notificações estão bloqueadas no navegador. Ative-as nas configurações do navegador para receber avisos do Papos.", "warning");
        }
      } else {
        // Usuário dispensou a caixa do navegador sem responder
        this.hideCard();
        this.dismiss(1);
      }
    } catch (err) {
      console.error("[Push] Erro técnico ao solicitar permissão:", err?.message || err);
      this.hideCard();
    }
  }

  async syncToken() {
    this.initMessaging();
    if (!this.messaging) return;

    try {
      if (!this.swRegistration) {
        await this.initServiceWorker();
      }

      const token = await getToken(this.messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: this.swRegistration
      });

      if (token) {
        console.log("[Push] Token obtido");
        this.currentToken = token;
        localStorage.setItem("papos_fcm_token", token);
        await this.saveTokenToBackendAndFirestore(token);
        console.log("[Push] Token salvo");
      } else {
        console.error("[Push] Erro ao obter token: nenhum token retornado pelo FCM.");
      }
    } catch (err) {
      console.error("[Push] Erro técnico ao obter token:", err?.message || err);
    }
  }

  getIdentity() {
    const anonymousId = window.SecurityIdentity ? window.SecurityIdentity.getGuestId() : (localStorage.getItem("papo_guest_id") || localStorage.getItem("papos_permanent_id") || "");
    const currentUser = auth.currentUser;
    const uid = currentUser ? currentUser.uid : null;
    const nickname = (window.ChatEngine && window.ChatEngine.currentNickname) || localStorage.getItem("papos_nickname") || "Visitante";

    return { anonymousId, uid, nickname };
  }

  async saveTokenToBackendAndFirestore(token) {
    const { anonymousId, uid, nickname } = this.getIdentity();

    // 1. Salvar no Firestore diretamente (client-side)
    try {
      if (anonymousId) {
        const anonDocRef = doc(db, "anonymous_push", anonymousId);
        await setDoc(anonDocRef, {
          anonymousId: anonymousId,
          nickname: nickname || "Visitante",
          nicknameLower: (nickname || "Visitante").toLowerCase(),
          tokens: arrayUnion(token),
          updatedAt: Date.now(),
          userAgent: navigator.userAgent
        }, { merge: true });
      }

      if (uid) {
        const userDocRef = doc(db, "user_push", uid);
        await setDoc(userDocRef, {
          uid: uid,
          nickname: nickname,
          nicknameLower: (nickname || "").toLowerCase(),
          tokens: arrayUnion(token),
          updatedAt: Date.now()
        }, { merge: true });
      }
    } catch (fsErr) {
      console.warn("[Push] Aviso ao salvar no Firestore client-side:", fsErr?.message || fsErr);
    }

    // 2. Notificar o backend via API POST
    try {
      await fetch("/api/push/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          anonymousId: anonymousId,
          uid: uid,
          nickname: nickname,
          userAgent: navigator.userAgent
        })
      });
    } catch (apiErr) {
      console.warn("[Push] Aviso ao registrar token via API:", apiErr?.message || apiErr);
    }

    // 3. Notificar via WebSocket se estiver conectado
    try {
      if (window.ChatEngine && window.ChatEngine.socket && window.ChatEngine.socket.readyState === WebSocket.OPEN) {
        window.ChatEngine.socket.send(JSON.stringify({
          type: "register_push_token",
          token: token,
          anonymousId: anonymousId,
          uid: uid,
          nickname: nickname
        }));
      }
    } catch (wsErr) {}
  }
}

export const PushController = new PushNotificationManager();

if (typeof window !== "undefined") {
  window.PushController = PushController;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => PushController.init());
  } else {
    PushController.init();
  }
}
