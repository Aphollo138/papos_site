
import { app, auth, db } from "/firebase/firebase.js";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from "firebase/messaging";

const VAPID_KEY = "BA3N8_2cx65vzUqBzGtlIjblc8ocugABMJjQBxUZaxJ_bAR96s8IvzcbCbnkxSckb8G-GrQqnGX2d1MMD56wWlA";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

class PushNotificationManager {
  constructor() {
    this.messaging = null;
    this.swRegistration = null;
    this.currentToken = null;
    this.isSupported = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

   
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.log("[PushController] Navegador não suporta Push Notifications.");
      return;
    }

    try {
      const supported = await isMessagingSupported();
      if (!supported) {
        console.log("[PushController] Firebase Messaging não é suportado neste ambiente.");
        return;
      }

      this.isSupported = true;
      this.messaging = getMessaging(app);

      
      await this.initServiceWorker();

      
      this.setupForegroundListener();

      
      this.setupServiceWorkerMessageListener();

      
      if (Notification.permission === "granted") {
        console.log("[PushController] Permissão já concedida. Sincronizando token...");
        await this.syncToken();
      } else if (Notification.permission === "default") {
        
        this.setupIntelligentTriggers();
      }

      
      this.bindCardEvents();

      
      this.checkUrlForNotificationAction();
    } catch (err) {
      console.warn("[PushController] Erro ao inicializar:", err);
    }
  }

  async initServiceWorker() {
    try {
      this.swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/"
      });
      console.log("[PushController] Service Worker registrado com sucesso.");
    } catch (err) {
      console.warn("[PushController] Falha ao registrar Service Worker:", err);
    }
  }

  setupForegroundListener() {
    if (!this.messaging) return;
    try {
      onMessage(this.messaging, (payload) => {
        console.log("[PushController] Mensagem recebida em primeiro plano:", payload);
        const title = payload.notification?.title || payload.data?.title || "Nova Notificação";
        const body = payload.notification?.body || payload.data?.body || "";

       
        const privateNick = payload.data?.privateNick;
        if (privateNick && window.activePrivateRecipient && window.activePrivateRecipient.toLowerCase() === privateNick.toLowerCase()) {
          return;
        }

        
        if (window.showAdminToast) {
          window.showAdminToast(`${title}: ${body}`, "info");
        } else if (window.appendSystemMessage) {
          window.appendSystemMessage(`🔔 ${title}: ${body}`);
        }
      });
    } catch (e) {
      console.warn("[PushController] Erro ao registrar onMessage:", e);
    }
  }

  setupServiceWorkerMessageListener() {
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

  setupIntelligentTriggers() {
   
    let visits = 0;
    try {
      visits = parseInt(localStorage.getItem("papos_visit_count") || "0", 10) + 1;
      localStorage.setItem("papos_visit_count", String(visits));
    } catch (e) {}

    
    if (this.isDismissed()) {
      return;
    }

  
    if (visits >= 3) {
      setTimeout(() => {
        this.showCard();
      }, 5000);
      return;
    }

    
    setTimeout(() => {
      if (!this.isDismissed() && Notification.permission === "default") {
        this.showCard();
      }
    }, 120000); 

    
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const unreadCount = parseInt(localStorage.getItem("papos_unread_background") || "0", 10);
        if (unreadCount > 0 && !this.isDismissed() && Notification.permission === "default") {
          this.showCard();
          localStorage.removeItem("papos_unread_background");
        }
      }
    });
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
    }
  }

  hideCard() {
    const card = document.getElementById("push-notification-card");
    if (card) {
      card.classList.add("d-none");
    }
  }

  dismiss(days = 7) {
    this.hideCard();
    try {
      const until = Date.now() + (days * 24 * 60 * 60 * 1000);
      localStorage.setItem("papos_push_dismissed_until", String(until));
    } catch (e) {}
  }

  bindCardEvents() {
    const btnEnable = document.getElementById("btn-push-card-enable");
    const btnDismiss = document.getElementById("btn-push-card-dismiss");
    const btnClose = document.getElementById("btn-push-card-close");

    if (btnEnable) {
      btnEnable.addEventListener("click", async () => {
        btnEnable.disabled = true;
        btnEnable.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Ativando...`;
        await this.requestPermissionAndSubscribe();
        btnEnable.disabled = false;
        btnEnable.textContent = "Ativar";
      });
    }

    if (btnDismiss) {
      btnDismiss.addEventListener("click", () => {
        this.dismiss(7);
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", () => {
        this.dismiss(7);
      });
    }
  }

  async requestPermissionAndSubscribe() {
    if (!this.isSupported) {
      alert("Seu navegador não suporta notificações push.");
      this.hideCard();
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        this.hideCard();
        localStorage.setItem("papos_push_enabled", "true");
        await this.syncToken();

        if (window.showAdminToast) {
          window.showAdminToast("Notificações push ativadas com sucesso! Você receberá avisos quando responderem suas mensagens.", "success");
        } else {
          alert("Notificações push ativadas com sucesso!");
        }
      } else if (permission === "denied") {
        this.hideCard();
        this.dismiss(30); // Não insistir por 30 dias se bloqueou
        console.warn("[PushController] O usuário bloqueou as notificações.");
      } else {
        this.hideCard();
        this.dismiss(7);
      }
    } catch (err) {
      console.error("[PushController] Erro ao solicitar permissão:", err);
      this.hideCard();
    }
  }

  async syncToken() {
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
        this.currentToken = token;
        localStorage.setItem("papos_fcm_token", token);
        await this.saveTokenToBackendAndFirestore(token);
      } else {
        console.warn("[PushController] Nenhum token FCM retornado.");
      }
    } catch (err) {
      console.warn("[PushController] Erro ao obter token FCM:", err);
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
      console.warn("[PushController] Aviso ao salvar no Firestore client-side:", fsErr);
    }

    
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
      console.warn("[PushController] Aviso ao registrar token via API:", apiErr);
    }

    
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
