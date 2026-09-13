import { adminDb, adminMessaging, isFirebaseAdminConfigured } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// In-memory cooldown caches
const roomCooldowns = new Map<string, number>();
const recipientCooldowns = new Map<string, number>();

const ROOM_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const USER_COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes

export class PushNotificationService {
  public static init() {
    if (!isFirebaseAdminConfigured) {
      console.warn("[FCM] Push está desativado por ausência da chave privada FIREBASE_PRIVATE_KEY.");
    } else {
      console.log("[FCM] Serviço de Notificações Push FCM pronto para uso.");
    }
  }

  public static canSendRoomPush(roomId: string): boolean {
    if (!roomId) return false;
    const lastSent = roomCooldowns.get(roomId) || 0;
    const elapsed = Date.now() - lastSent;
    if (elapsed < ROOM_COOLDOWN_MS) {
      console.log(`[FCM] Notificação ignorada por cooldown da sala: ${roomId} (${Math.round((ROOM_COOLDOWN_MS - elapsed) / 1000)}s restantes)`);
      return false;
    }
    return true;
  }

  public static markRoomPushSent(roomId: string) {
    if (!roomId) return;
    roomCooldowns.set(roomId, Date.now());
  }

  public static isRecipientInCooldown(key: string): boolean {
    if (!key) return false;
    const lastSent = recipientCooldowns.get(key.toLowerCase()) || 0;
    return (Date.now() - lastSent) < USER_COOLDOWN_MS;
  }

  public static markRecipientSent(key: string) {
    if (!key) return;
    recipientCooldowns.set(key.toLowerCase(), Date.now());
  }

  public static async registerToken(params: {
    token: string;
    anonymousId?: string;
    uid?: string;
    nickname?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { token, anonymousId, uid, nickname, userAgent } = params;
    if (!token || typeof token !== "string" || token.length < 10) {
      return { success: false, error: "Token inválido" };
    }

    const now = Date.now();
    const cleanNick = (nickname || "").trim();
    const cleanAnonId = (anonymousId || "").trim();

    try {
      // 1. Visitante Anônimo
      if (cleanAnonId) {
        const anonRef = adminDb.collection("anonymous_push").doc(cleanAnonId);
        await anonRef.set({
          anonymousId: cleanAnonId,
          nickname: cleanNick || "Visitante",
          nicknameLower: (cleanNick || "Visitante").toLowerCase(),
          tokens: FieldValue.arrayUnion(token),
          userAgent: userAgent || "",
          updatedAt: now
        }, { merge: true });
      }

      // 2. Usuário Autenticado
      if (uid && typeof uid === "string" && uid.trim()) {
        const cleanUid = uid.trim();
        const userRef = adminDb.collection("user_push").doc(cleanUid);
        await userRef.set({
          uid: cleanUid,
          nickname: cleanNick,
          nicknameLower: cleanNick.toLowerCase(),
          tokens: FieldValue.arrayUnion(token),
          updatedAt: now
        }, { merge: true });
      }

      return { success: true };
    } catch (err: any) {
      console.error("[FCM] Erro ao registrar token:", err);
      return { success: false, error: err.message || "Erro ao registrar token" };
    }
  }

  public static async removeInvalidToken(token: string) {
    if (!token) return;
    try {
      // Remover de anonymous_push
      const anonSnaps = await adminDb.collection("anonymous_push")
        .where("tokens", "array-contains", token)
        .get();

      const batch = adminDb.batch();
      anonSnaps.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          tokens: FieldValue.arrayRemove(token),
          updatedAt: Date.now()
        });
      });

      // Remover de user_push
      const userSnaps = await adminDb.collection("user_push")
        .where("tokens", "array-contains", token)
        .get();

      userSnaps.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          tokens: FieldValue.arrayRemove(token),
          updatedAt: Date.now()
        });
      });

      await batch.commit();
      console.log(`[FCM] Token inválido removido: ${token.substring(0, 15)}...`);
    } catch (e: any) {
      console.warn("[FCM] Erro ao limpar token inválido:", e?.message || e);
    }
  }

  /**
   * Gatilho principal de Push:
   * Disparado EXCLUSIVAMENTE quando uma nova mensagem é enviada em uma sala.
   */
  public static async onRoomMessage(params: {
    roomId: string;
    senderSession: {
      nickname?: string;
      uid?: string;
      permanentId?: string;
      anonymousId?: string;
    };
    onlineNicknames: Set<string>;
    onlineUids: Set<string>;
    onlineAnonIds: Set<string>;
    onlinePermanentIds: Set<string>;
  }) {
    const {
      roomId,
      senderSession,
      onlineNicknames,
      onlineUids,
      onlineAnonIds,
      onlinePermanentIds
    } = params;

    if (!roomId) return;

    // Se a chave não estiver configurada no backend, push desativado com segurança
    if (!isFirebaseAdminConfigured) {
      return;
    }

    // 1. Anti-Flood / Cooldown por sala (10 minutos)
    if (!this.canSendRoomPush(roomId)) {
      return;
    }

    const senderNickLower = (senderSession.nickname || "").trim().toLowerCase();
    const senderUid = (senderSession.uid || "").trim();
    const senderAnonId = (senderSession.anonymousId || "").trim();
    const senderPermId = (senderSession.permanentId || "").trim();

    const eligibleTokenMap = new Map<string, string>(); // token -> recipientKey

    try {
      // 2. Buscar inscritos em anonymous_push
      const anonSnaps = await adminDb.collection("anonymous_push").get();
      anonSnaps.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const nickLower = (data.nicknameLower || "").toLowerCase();
        const permId = data.permanentId || "";

        // Ignorar se for o próprio remetente
        if (
          (senderAnonId && docId === senderAnonId) ||
          (senderPermId && permId === senderPermId) ||
          (senderNickLower && nickLower === senderNickLower)
        ) {
          return;
        }

        // Ignorar se estiver ONLINE no site agora
        if (
          onlineAnonIds.has(docId) ||
          (permId && onlinePermanentIds.has(permId)) ||
          (nickLower && onlineNicknames.has(nickLower))
        ) {
          console.log(`[FCM] Usuário ignorado por estar online: ${data.nickname || docId}`);
          return;
        }

        // Ignorar se o usuário estiver no cooldown individual (5 minutos)
        if (this.isRecipientInCooldown(docId) || (nickLower && this.isRecipientInCooldown(nickLower))) {
          return;
        }

        // Adicionar tokens elegíveis
        if (Array.isArray(data.tokens)) {
          data.tokens.forEach((tok: string) => {
            if (tok && typeof tok === "string" && !this.isRecipientInCooldown(tok)) {
              eligibleTokenMap.set(tok, docId);
            }
          });
        }
      });

      // 3. Buscar inscritos em user_push
      const userSnaps = await adminDb.collection("user_push").get();
      userSnaps.forEach((docSnap) => {
        const data = docSnap.data();
        const docUid = docSnap.id;
        const nickLower = (data.nicknameLower || "").toLowerCase();

        // Ignorar se for o próprio remetente
        if (
          (senderUid && docUid === senderUid) ||
          (senderNickLower && nickLower === senderNickLower)
        ) {
          return;
        }

        // Ignorar se estiver ONLINE no site agora
        if (
          onlineUids.has(docUid) ||
          (nickLower && onlineNicknames.has(nickLower))
        ) {
          console.log(`[FCM] Usuário ignorado por estar online: ${data.nickname || docUid}`);
          return;
        }

        // Ignorar se o usuário estiver no cooldown individual (5 minutos)
        if (this.isRecipientInCooldown(docUid) || (nickLower && this.isRecipientInCooldown(nickLower))) {
          return;
        }

        // Adicionar tokens elegíveis
        if (Array.isArray(data.tokens)) {
          data.tokens.forEach((tok: string) => {
            if (tok && typeof tok === "string" && !this.isRecipientInCooldown(tok)) {
              eligibleTokenMap.set(tok, docUid);
            }
          });
        }
      });
    } catch (err) {
      console.error("[FCM] Erro ao buscar inscritos no Firestore:", err);
      return;
    }

    const tokens = Array.from(eligibleTokenMap.keys());
    if (tokens.length === 0) {
      return;
    }

    // URL exata exigida: https://papo.net.br/chat?room=ROOM_ID
    const targetUrl = `https://papo.net.br/chat?room=${encodeURIComponent(roomId)}`;

    const notificationPayload = {
      tokens: tokens,
      notification: {
        title: "Papos",
        body: "Tem gente conversando na sala."
      },
      data: {
        title: "Papos",
        body: "Tem gente conversando na sala.",
        url: targetUrl,
        roomId: roomId,
        icon: "/favicon-32x32.png"
      },
      webpush: {
        fcmOptions: {
          link: targetUrl
        },
        headers: {
          Urgency: "high"
        }
      }
    };

    try {
      const response = await adminMessaging.sendEachForMulticast(notificationPayload);

      // Se pelo menos uma notificação foi enviada com sucesso, aplicamos os cooldowns
      if (response.successCount > 0) {
        this.markRoomPushSent(roomId);
        console.log(`[FCM] Push disparado para a sala: ${roomId} (destinatários: ${response.successCount})`);

        // Marcar cooldown para os destinatários que receberam com sucesso
        response.responses.forEach((resp, idx) => {
          const tok = tokens[idx];
          const recipientId = eligibleTokenMap.get(tok);
          if (resp.success) {
            this.markRecipientSent(tok);
            if (recipientId) {
              this.markRecipientSent(recipientId);
            }
          }
        });
      }

      // Tratar tokens inválidos e removê-los do Firestore sem apagar contas
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === "messaging/registration-token-not-registered" ||
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/invalid-argument"
            ) {
              const staleToken = tokens[idx];
              this.removeInvalidToken(staleToken);
            }
          }
        });
      }
    } catch (sendErr: any) {
      console.error("[FCM] Erro ao enviar multicast:", sendErr?.message || sendErr);
    }
  }

  public static async getStats() {
    let anonymousCount = 0;
    let userCount = 0;
    let totalTokens = 0;

    try {
      const anonSnaps = await adminDb.collection("anonymous_push").get();
      anonymousCount = anonSnaps.size;
      anonSnaps.forEach((d) => {
        const tokens = d.data().tokens;
        if (Array.isArray(tokens)) totalTokens += tokens.length;
      });

      const userSnaps = await adminDb.collection("user_push").get();
      userCount = userSnaps.size;
      userSnaps.forEach((d) => {
        const tokens = d.data().tokens;
        if (Array.isArray(tokens)) totalTokens += tokens.length;
      });
    } catch (e) {}

    return {
      anonymousSubscribers: anonymousCount,
      registeredSubscribers: userCount,
      totalSubscribers: anonymousCount + userCount,
      totalTokens
    };
  }
}
