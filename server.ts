import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import fs from "fs";
import crypto from "crypto";
import https from "https";
import { verifyIdToken, checkAdminByUid, authenticateAdmin, adminDb } from "./src/firebase-admin";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || "",
  firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || "(default)"
};

const firebaseApp = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
});
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const systemSettings = {
  adsEnabled: true,
  botsEnabled: true
};

try {
  const settingsDocRef = doc(db, "system", "settings");
  onSnapshot(settingsDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      systemSettings.adsEnabled = data.adsEnabled !== false;
      systemSettings.botsEnabled = data.botsEnabled !== false;
    } else {
      systemSettings.adsEnabled = true;
      systemSettings.botsEnabled = true;
    }
  }, (err) => {
    console.error("[SystemSettings] Listener error:", err);
  });
} catch (err) {
  console.error("[SystemSettings] Failed to attach listener:", err);
}

async function verifyFirebaseIdToken(token: string, projectId: string): Promise<any | null> {
  const decoded = await verifyIdToken(token);
  if (decoded) return decoded;
  
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64] = parts;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp > nowInSeconds && payload.uid) {
      return payload;
    }
  } catch (e) {}
  return null;
}

interface SecurityBansDoc {
  fingerprints?: string[];
  clientIds?: string[];
  ips?: string[];
  uids?: string[];
  suspendedFingerprints?: Record<string, number>;
  suspendedClientIds?: Record<string, number>;
  suspendedIps?: Record<string, number>;
  suspendedUids?: Record<string, number>;
}

let securityBansCache: SecurityBansDoc | null = null;
let securityBansCacheTime = 0;

async function getSecurityBans(): Promise<SecurityBansDoc> {
  const now = Date.now();
  if (securityBansCache && (now - securityBansCacheTime < 10000)) {
    return securityBansCache;
  }
  try {
    const secDoc = await adminDb.collection("security").doc("bans").get();
    if (secDoc.exists) {
      securityBansCache = secDoc.data() as SecurityBansDoc;
    } else {
      securityBansCache = { fingerprints: [], clientIds: [], ips: [], uids: [] };
    }
  } catch (err) {
    if (!securityBansCache) securityBansCache = { fingerprints: [], clientIds: [], ips: [], uids: [] };
  }
  securityBansCacheTime = now;
  return securityBansCache;
}

function invalidateSecurityBansCache() {
  securityBansCacheTime = 0;
}

async function checkUserBlockStatus(
  uid?: string,
  fingerprint?: string,
  clientId?: string,
  ip?: string,
  guestId?: string
): Promise<{ blocked: boolean; reason: string; until?: number }> {
  // 1. Check user document in Firestore if UID is provided
  if (uid) {
    try {
      const userDocSnap = await adminDb.collection("users").doc(uid).get();
      if (userDocSnap.exists) {
        const data = userDocSnap.data();
        if (data?.banned) {
          return { blocked: true, reason: "ban" };
        }
        if (data?.suspendedUntil && data.suspendedUntil > Date.now()) {
          return { blocked: true, reason: "suspension", until: data.suspendedUntil };
        }
      }
    } catch (err) {
      console.error("[Moderation] Error checking user block status for", uid, err);
    }
  }

  // 2. Check guestBans collection
  try {
    const bansSnap = await adminDb.collection("guestBans").get();
    if (!bansSnap.empty) {
      for (const docSnap of bansSnap.docs) {
        const b = docSnap.data();
        const matchGid = Boolean(guestId && b.guestId && b.guestId === guestId);
        const matchFp = Boolean(fingerprint && b.fingerprint && b.fingerprint === fingerprint);
        const matchIp = Boolean(ip && b.ip && b.ip === ip);
        if (matchGid || matchFp || matchIp) {
          return { blocked: true, reason: "ban" };
        }
      }
    }
  } catch (err) {
    console.error("[Moderation] Error checking guestBans:", err);
  }

  // 3. Check guestSuspensions collection
  try {
    const susSnap = await adminDb.collection("guestSuspensions").get();
    if (!susSnap.empty) {
      const now = Date.now();
      for (const docSnap of susSnap.docs) {
        const s = docSnap.data();
        if (s.expiresAt && s.expiresAt > now) {
          const matchGid = Boolean(guestId && s.guestId && s.guestId === guestId);
          const matchFp = Boolean(fingerprint && s.fingerprint && s.fingerprint === fingerprint);
          const matchIp = Boolean(ip && s.ip && s.ip === ip);
          if (matchGid || matchFp || matchIp) {
            return { blocked: true, reason: "suspension", until: s.expiresAt };
          }
        }
      }
    }
  } catch (err) {
    console.error("[Moderation] Error checking guestSuspensions:", err);
  }

  // 4. Check security/bans document for UID, Fingerprint, Client ID, or IP
  const bans = await getSecurityBans();
  const now = Date.now();

  if (uid && Array.isArray(bans.uids) && bans.uids.includes(uid)) {
    return { blocked: true, reason: "ban" };
  }
  if (fingerprint && Array.isArray(bans.fingerprints) && bans.fingerprints.includes(fingerprint)) {
    return { blocked: true, reason: "ban" };
  }
  if (clientId && Array.isArray(bans.clientIds) && bans.clientIds.includes(clientId)) {
    return { blocked: true, reason: "ban" };
  }
  if (ip && Array.isArray(bans.ips) && bans.ips.includes(ip)) {
    return { blocked: true, reason: "ban" };
  }

  // Check active suspensions
  if (uid && bans.suspendedUids && bans.suspendedUids[uid] > now) {
    return { blocked: true, reason: "suspension", until: bans.suspendedUids[uid] };
  }
  if (fingerprint && bans.suspendedFingerprints && bans.suspendedFingerprints[fingerprint] > now) {
    return { blocked: true, reason: "suspension", until: bans.suspendedFingerprints[fingerprint] };
  }
  if (clientId && bans.suspendedClientIds && bans.suspendedClientIds[clientId] > now) {
    return { blocked: true, reason: "suspension", until: bans.suspendedClientIds[clientId] };
  }
  if (ip && bans.suspendedIps && bans.suspendedIps[ip] > now) {
    return { blocked: true, reason: "suspension", until: bans.suspendedIps[ip] };
  }

  return { blocked: false, reason: "" };
}

async function checkIsAdmin(uid: string | undefined): Promise<boolean> {
  if (typeof uid !== "string" || !uid) {
    return false;
  }
  return await checkAdminByUid(uid);
}

const INITIAL_ROOMS = [
  { id: "room-1", name: "Bate-Papo Geral 💬", desc: "A sala principal para falar sobre qualquer assunto, mandar memes ou só ver o que o pessoal está comentando.", count: 0, icon: "chat-dots" },
  { id: "room-2", name: "Tecnologia & Devs 💻", desc: "Espaço descontraído para falar sobre programação, hardware, carreira tech e inteligência artificial.", count: 0, icon: "code" },
  { id: "room-6", name: "Cantinho dos Desabafos ❤️", desc: "Um espaço seguro para desabafar sobre o dia a dia, pedir conselhos e dar aquele apoio a quem precisa.", count: 0, icon: "heart" },
  { id: "room-7", name: "Novas Amizades 🤝", desc: "Sem compromisso. Entre para dar um oi, descobrir afinidades e trocar uma ideia leve com gente nova.", count: 0, icon: "people" },
  { id: "room-4", name: "Música & Playlists 🎧", desc: "Compartilhe o que você está escutando agora, indique artistas independentes e monte playlists colaborativas.", count: 0, icon: "music" },
  { id: "room-5", name: "Amizade & Jogos 🎮", desc: "Para quem quer achar duo, montar party ou apenas discutir o meta atual e os lançamentos dos games.", count: 0, icon: "game" },
  { id: "room-9", name: "Relacionamentos & Amor 🌹", desc: "Debates saudáveis sobre relacionamentos, encontros, vida a dois e as ciladas de aplicativos de paquera.", count: 0, icon: "heart-half" },
  { id: "room-10", name: "Clube da Madrugada 🌙", desc: "A sala das corujas. Conversas profundas, pensamentos aleatórios e companheirismo nas horas de silêncio.", count: 0, icon: "moon" },
  { id: "room-11", name: "Papo Brasil 🇧🇷", desc: "Mistura boa de sotaques de norte a sul. Fale sobre cultura local, piadas internas de cada estado e rotina.", count: 0, icon: "globe" }
];

const INITIAL_MESSAGES: Record<string, any[]> = {
  "room-1": [
    { id: "m-init-1", sender: "Ana Silva", text: "Olá pessoal! Sejam bem-vindos ao novo Chat Online!", time: "15:40", isSystem: false },
    { id: "m-init-2", sender: "Carlos Dev", text: "Nossa, que interface bonita e fluida! Bootstrap 5 combinou muito.", time: "15:42", isSystem: false },
    { id: "m-init-3", sender: "Sistema", text: "Canal aberto para conversação livre de anúncios.", time: "15:43", isSystem: true }
  ],
  "room-2": [
    { id: "m-init-4", sender: "Guilherme", text: "Alguém aí já experimentou o novo motor do Node ou está focado em Bun?", time: "14:10", isSystem: false },
    { id: "m-init-5", sender: "Mariana Tech", text: "Eu uso muito Node em produção, mas Bun é absurdamente rápido em testes locais.", time: "14:15", isSystem: false }
  ],
  "room-10": [
    { id: "m-init-6", sender: "Gabriel_Coruja", text: "Alguém aí acordado ainda?", time: "02:15", isSystem: false },
    { id: "m-init-7", sender: "Luiza_Nights", text: "Sempre kkk. Tô terminando um livro e perdi o sono total.", time: "02:17", isSystem: false }
  ]
};

const rooms = [...INITIAL_ROOMS];
const messages = { ...INITIAL_MESSAGES } as Record<string, any[]>;

Object.keys(messages).forEach(roomId => {
  messages[roomId].forEach(msg => {
    if (!msg.timestamp && msg.time) {
      try {
        const [h, m] = msg.time.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        msg.timestamp = d.getTime();
      } catch (e) {
        msg.timestamp = Date.now();
      }
    }
  });
});

const BOTS = [
  { nickname: "Mariana_Tech", rooms: ["room-1", "room-2", "room-7"] },
  { nickname: "Carlos_Meme", rooms: ["room-1", "room-4", "room-11"] },
  { nickname: "Lucas_Gamer", rooms: ["room-1", "room-5", "room-10"] },
  { nickname: "Beatriz_Vibes", rooms: ["room-1", "room-6", "room-7"] },
  { nickname: "Thiago_Melo", rooms: ["room-1", "room-4", "room-10"] },
  { nickname: "Aline_Viajante", rooms: ["room-1", "room-7", "room-11"] },
  { nickname: "Rafa_Relacionamentos", rooms: ["room-1", "room-9"] },
  { nickname: "Bot_Papos", rooms: ["room-1"] }
];

const BOT_MESSAGES: Record<string, string[]> = {
  "room-1": [
    "Eae pessoal! Como está o dia de vocês por aí?",
    "Gente, qual o melhor filme ou série que vocês assistiram recentemente?",
    "Nossa, essa nova interface do chat ficou muito rápida e limpa de usar!",
    "Alguém aí curte cozinhar? Fiz uma lasanha hoje que ficou sensacional!",
    "Se vocês pudessem ter qualquer superpoder no mundo real, qual escolheriam?",
    "Qual é a comida favorita de vocês? Eu sou viciada em pizza com borda recheada!",
    "Alguém acordado por aqui pra bater um papo leve?"
  ],
  "room-2": [
    "Vocês usam TypeScript em tudo hoje em dia ou ainda têm projetos rodando em JS puro?",
    "O que vocês acham da febre de Inteligência Artificial no dia a dia do desenvolvimento de software?",
    "Alguém aí já experimentou o Tailwind CSS v4? Achei o compilador absurdamente rápido!",
    "Qual sistema operacional vocês usam para programar? Linux, Mac ou Windows padrão?",
    "Estou estudando Docker hoje para subir umas instâncias. Que tecnologia fantástica!",
    "Qual foi o primeiro código de vocês? O meu foi um clássico HTML piscando em fã-clube kkk",
    "Cursor AI ou VS Code limpo com atalhos? O que vocês preferem para trabalhar?"
  ],
  "room-6": [
    "Às vezes é bom tirar um tempo para nós mesmos e relaxar das pressões diárias. Respirem fundo!",
    "Se o dia hoje foi difícil, lembrem-se de que amanhã é uma nova oportunidade para recomeçar.",
    "Nada melhor do que colocar uma música relaxante nos fones de ouvido e deitar depois de um dia corrido.",
    "O apoio mútuto de vocês aqui nessa sala é muito bonito de ver, de verdade! ❤️",
    "Se alguém precisar conversar ou desabafar sobre qualquer assunto, estamos aqui para ouvir sem julgamentos."
  ],
  "room-7": [
    "Oi gente! Sou nova por aqui na sala de amizades. De onde vocês são?",
    "Quais são os principais hobbies de vocês para se distrair no tempo livre?",
    "Alguém aí gosta de ler? Me indiquem livros legais de mistério ou ficção científica!",
    "Uma das melhores coisas da internet é conhecer pessoas legais com os mesmos gostos."
  ],
  "room-4": [
    "Alguém aí escuta Lo-Fi ou Synthwave instrumental para focar no trabalho ou estudos?",
    "Quais bandas clássicas do rock nacional vocês mais escutam? Legião, Capital Inicial, Skank...",
    "Tô ouvindo a nova playlist oficial do chat e tem muita indicação boa de MPB!",
    "Vocês tocam algum instrumento musical? Eu tento arranhar um violão kkk"
  ],
  "room-5": [
    "Alguém aí joga algum game cooperativo? Tipo Overcooked, It Takes Two ou Minecraft?",
    "Vocês estão ansiosos pelo próximo grande lançamento do GTA VI?",
    "Melhor jogo de todos os tempos na opinião sincera de vocês. Sem brigas, valendo!",
    "Quem prefere jogar no celular? Mandem IDs do Wild Rift, Free Fire ou Brawl Stars!"
  ],
  "room-9": [
    "O que vocês acham de aplicativos de namoro hoje em dia? Realmente funcionam ou é só cilada?",
    "Qual foi o encontro (date) mais engraçado ou bizarro que vocês já tiveram?",
    "Relacionamento à distância realmente dá certo com compromisso ou é receita para dor de cabeça?"
  ],
  "room-10": [
    "A sala dos sobreviventes da madrugada kkk. O que vocês estão fazendo acordados a essa hora?",
    "A madrugada tem um silêncio maravilhoso que ajuda muito a concentrar e pensar na vida.",
    "Quem aí sofre de insônia crônica ou só tem o fuso horário totalmente desregulado? 🙋‍♀️"
  ],
  "room-11": [
    "Qual a melhor comida típica do estado de vocês? Aqui em SP é o famoso pastel de feira com caldo de cana!",
    "Eae galera do sul ao norte! Como está o clima e a temperatura na cidade de vocês hoje?",
    "Pão de queijo quentinho com café coado na hora não tem erro, mineiro sabe muito bem o que faz!"
  ]
};

interface ClientSession {
  ws: WebSocket;
  nickname: string;
  roomId: string;
  lastMessageTime: number[]; 
  bio?: string;
  age?: number;
  gender?: string;
  photoUrl?: string;
  uid?: string;
  guestId?: string;
  email?: string;
  permanentId?: string;
  internalId?: string;
  joinTime?: number;
  connectedAt?: number;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  fingerprint?: string;
  clientId?: string;
  ip?: string;
}

const activeSessions = new Map<WebSocket, ClientSession>();

function getOnlineGuestsList(): any[] {
  const guestsMap = new Map<string, any>();
  activeSessions.forEach((s) => {
    // ONLY non-authenticated guests (no uid and not isAuthenticated)
    if (!s.uid && !s.isAuthenticated) {
      const gId = s.guestId || (s.fingerprint ? `GST-${s.fingerprint.substring(0, 8).toUpperCase()}` : "GST-UNK");
      if (!guestsMap.has(gId)) {
        guestsMap.set(gId, {
          guestId: gId,
          nickname: s.nickname || "Visitante",
          room: s.roomId || "room-1",
          fingerprint: s.fingerprint || "",
          ip: s.ip || "N/A",
          socketId: s.clientId || "",
          online: true,
          connectedAt: s.connectedAt || Date.now(),
          lastSeen: Date.now()
        });
      }
    }
  });
  return Array.from(guestsMap.values());
}

function notifyAdminsGuestList() {
  const guests = getOnlineGuestsList();
  activeSessions.forEach((s, key) => {
    if (s.isAuthenticated && s.uid && s.isAdmin && key.readyState === WebSocket.OPEN) {
      try {
        key.send(JSON.stringify({ type: "admin_online_guests", guests }));
      } catch (e) {}
    }
  });
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function sanitizeHTML(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function containsLink(str: string): boolean {
  if (!str || typeof str !== "string") return false;

  let text = str;

  try {
    if (text.includes("%")) {
      text = decodeURIComponent(text);
    }
  } catch (e) {
    text = text
      .replace(/%3a/gi, ":")
      .replace(/%2f/gi, "/")
      .replace(/%2e/gi, ".")
      .replace(/%20/gi, " ");
  }

  try {
    text = text.normalize("NFKC");
  } catch (e) {}

  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u200E\u200F\u202A-\u202E\u0000-\u001F\u007F-\u009F]/g, "");

  const lower = text.toLowerCase();

  if (/(?:https?|ftp|file|wss?):\/\/|www\./i.test(lower)) {
    return true;
  }

  if (/\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/.test(lower)) {
    return true;
  }
  if (/(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}|::1|fe80::/i.test(lower)) {
    return true;
  }

  let normalized = lower
    .replace(/\s*(?:\[|\(|\{|<)\s*(?:dot|ponto|\.)\s*(?:\]|\)|\}|>)\s*/gi, ".")
    .replace(/\s+(?:dot|ponto)\s+/gi, ".")
    .replace(/\s*(?:\[|\(|\{|<)\s*(com|net|org|br|io|gg|gov|edu|app|dev|xyz|me|info|site|online|store|tech|link|live|tv|cc|to|tk|pt|ar|mx)\s*(?:\]|\)|\}|>)\s*/gi, ".$1");

  normalized = normalized
    .replace(/([a-z0-9])\s*,\s*([a-z]{2,10})\b/gi, "$1.$2")
    .replace(/([a-z0-9])\s*\/\s*(com|net|org|br|io|gg|gov|edu|app|dev|xyz|me|info|site|online|store|tech|link|live|tv|cc|to|tk)\b/gi, "$1.$2");

  const collapsedSpaces = normalized
    .replace(/([a-z0-9])\s+\.\s+([a-z0-9])/gi, "$1.$2")
    .replace(/([a-z0-9])\.\s+([a-z0-9])/gi, "$1.$2")
    .replace(/([a-z0-9])\s+\.([a-z0-9])/gi, "$1.$2");

  const tldList = [
    "com", "net", "org", "gov", "edu", "mil", "br", "io", "gg", "co", "app", "dev",
    "xyz", "me", "info", "online", "site", "store", "top", "tk", "ml", "ga", "cf",
    "gq", "link", "live", "tech", "space", "club", "fun", "icu", "vip", "shop", "pro",
    "biz", "tv", "cc", "cx", "to", "ws", "mobi", "asia", "cat", "jobs", "tel", "travel",
    "work", "life", "world", "page", "run", "blog", "cloud", "digital", "email", "games",
    "group", "media", "news", "ones", "zone", "ru", "cn", "uk", "de", "us", "fr", "ca",
    "it", "nl", "es", "eu", "pt", "ar", "mx", "cl", "pe", "uy"
  ];
  const tldPattern = tldList.join("|");

  const domainRegex = new RegExp(`\\b[a-z0-9\\-]+\\.(?:${tldPattern})(?:\\.[a-z]{2,4})?(?:\\/[^\\s]*)?\\b`, "i");

  if (domainRegex.test(collapsedSpaces)) {
    return true;
  }

  const noSpaces = lower.replace(/\s+/g, "");
  if (noSpaces.includes(".") && domainRegex.test(noSpaces)) {
    return true;
  }

  return false;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json());
  const PORT = Number(process.env.PORT) || 3000;

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://papo.net.br",
      "https://papos-site.onrender.com"
    ];
    
    if (origin) {
      const isAllowed = allowedOrigins.includes(origin) || 
        origin.includes("localhost") || 
        origin.includes("127.0.0.1") || 
        origin.includes("run.app") || 
        origin.includes("vercel.app");
        
      if (isAllowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      }
    }
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activeConnections: activeSessions.size });
  });

  async function checkAdsPermission(uid?: string): Promise<boolean> {
    if (systemSettings.adsEnabled === false) {
      return false;
    }
    if (!uid || typeof uid !== "string") {
      return true; 
    }
    try {
      const userDocRef = doc(db, "users", uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.adsDisabled === true || data.admin === true) {
          return false;
        }
      }
    } catch (err) {
      console.error("[AdsPermission] Error checking Firestore:", err);
    }
    return true;
  }

  app.get("/api/user/ads-status", async (req, res) => {
    try {
      const uid = (req.query.uid as string) || "";
      const showAds = await checkAdsPermission(uid);
      res.json({ showAds });
    } catch (err) {
      res.json({ showAds: true });
    }
  });

  function isReservedNickname(nickname: string): boolean {
    if (!nickname || typeof nickname !== "string") return false;

    let norm = nickname;
    try {
      norm = norm.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch (e) {}

    norm = norm
      .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u200E\u200F\u202A-\u202E\u0000-\u001F\u007F-\u009F]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (!norm) return false;

    const reservedRoots = [
      "admin",
      "administrador",
      "moderador",
      "mod",
      "staff",
      "equipe",
      "suporte",
      "owner",
      "fundador",
      "desenvolvedor",
      "dev",
      "oficial",
      "system",
      "sistema",
      "root",
      "master",
      "ceo",
      "adm"
    ];

    return reservedRoots.some(root => norm.includes(root));
  }

  async function isAuthorizedForReservedNickname(uid: string | null | undefined, nickname: string): Promise<boolean> {
    
    if (!isReservedNickname(nickname)) {
      return true;
    }

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      
      return false;
    }

    const cleanUid = uid.trim();

    if (cleanUid === "iMDKTiIEezc2w2VQ2SO27bXsQTd2") {
      
      return true;
    }

    let isUserAdmin = false;
    let isSupportEnabled = false;

    try {
      
      const userDocSnap = await getDoc(doc(db, "users", cleanUid));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.admin === true || userData.uid === "iMDKTiIEezc2w2VQ2SO27bXsQTd2") {
          isUserAdmin = true;
        }
      } else {
        
        const permQuery = query(collection(db, "users"), where("permanentId", "==", cleanUid));
        const permSnap = await getDocs(permQuery);
        if (!permSnap.empty) {
          const permData = permSnap.docs[0].data();
          if (permData.admin === true || permSnap.docs[0].id === "iMDKTiIEezc2w2VQ2SO27bXsQTd2") {
            isUserAdmin = true;
          }
        }
      }

      if (!isUserAdmin) {
        const supportDocSnap = await getDoc(doc(db, "supportNames", cleanUid));
        if (supportDocSnap.exists()) {
          const supportData = supportDocSnap.data();
          if (supportData.enabled === true) {
            isSupportEnabled = true;
          }
        } else {
          
          const supQuery = query(collection(db, "supportNames"), where("uid", "==", cleanUid));
          const supSnap = await getDocs(supQuery);
          if (!supSnap.empty) {
            const supData = supSnap.docs[0].data();
            if (supData.enabled === true) {
              isSupportEnabled = true;
            }
          }
        }
      }
    } catch (err) {
      console.error("[Reserved Nick] Erro ao consultar Firestore:", err);
    }

    const permitido = isUserAdmin || isSupportEnabled;

    return permitido;
  }

  app.post("/api/profile/validate", async (req, res) => {
    const { bio, age, gender, nickname, uid } = req.body;
    let authUid = uid;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      const token = req.headers.authorization.split("Bearer ")[1];
      try {
        const decoded = await verifyFirebaseIdToken(token, firebaseConfig.projectId);
        if (decoded && decoded.uid) {
          authUid = decoded.uid;
        }
      } catch (e) {}
    }
    
    if (nickname && typeof nickname === "string") {
      if (isReservedNickname(nickname)) {
        const isAuth = await isAuthorizedForReservedNickname(authUid, nickname);
        if (isAuth) {
          
        } else {
          
          res.status(400).json({ error: "Este nome é reservado pela equipe do Papo.net.br." });
          return;
        }
      }
    }

    if (bio !== undefined && bio !== null && typeof bio === "string" && bio.length > 400) {
      res.status(400).json({ error: "A biografia não pode ter mais de 400 caracteres." });
      return;
    }
    
    if (age !== undefined && age !== null) {
      const ageNum = Number(age);
      if (isNaN(ageNum) || ageNum < 17 || ageNum > 80 || !Number.isInteger(ageNum)) {
        res.status(400).json({ error: "A idade deve ser um número inteiro entre 17 e 80 anos." });
        return;
      }
    }

    if (gender !== undefined && gender !== null && gender !== "") {
      const validGenders = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
      if (!validGenders.includes(gender)) {
        res.status(400).json({ error: "O sexo selecionado é inválido." });
        return;
      }
    }
    
    res.json({ success: true });
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    
    if (origin) {
      const isAllowed = 
        origin.includes("localhost") || 
        origin.includes("127.0.0.1") || 
        origin.includes("papo.net.br") ||
        origin.includes("onrender.com") ||
        origin.includes("run.app") ||
        origin.includes("vercel.app");
        
      if (!isAllowed) {
        
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  function sendToClient(ws: WebSocket, type: string, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  function broadcastToRoom(roomId: string, type: string, payload: any, excludeWs?: WebSocket) {
    activeSessions.forEach((session, ws) => {
      if (session.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        if (excludeWs && ws === excludeWs) return;
        ws.send(JSON.stringify({ type, ...payload }));
      }
    });
  }

  function getRoomOnlineUsers(roomId: string): string[] {
    const list: string[] = [];
    activeSessions.forEach((session) => {
      if (session.roomId === roomId && session.nickname) {
        list.push(session.nickname);
      }
    });
    
    BOTS.forEach(bot => {
      if (bot.rooms.includes(roomId)) {
        list.push(bot.nickname);
      }
    });

    return Array.from(new Set(list)); 
  }

  function updateRoomCounts() {
    rooms.forEach((room) => {
      let count = 0;
      activeSessions.forEach((session) => {
        if (session.roomId === room.id) {
          count++;
        }
      });
      room.count = count;
    });
  }

  function broadcastRoomsList() {
    updateRoomCounts();
    const roomsPayload = { rooms };
    activeSessions.forEach((session, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "room_list", ...roomsPayload }));
      }
    });
  }

  wss.on("connection", (ws: WebSocket, req: any) => {
    const clientIp = (req && req.headers ? (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "") : "").split(",")[0].trim();
    
    activeSessions.set(ws, {
      ws,
      nickname: "",
      roomId: "",
      ip: clientIp,
      lastMessageTime: [],
      connectedAt: Date.now()
    });

    updateRoomCounts();
    sendToClient(ws, "room_list", { rooms });

    ws.on("message", async (rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage.toString());
        const session = activeSessions.get(ws);
        if (!session) return;

        if (payload.fingerprint) session.fingerprint = payload.fingerprint;
        if (payload.clientId) session.clientId = payload.clientId;
        if (payload.guestId) session.guestId = payload.guestId;

        if (!session.uid && (session.guestId || session.fingerprint)) {
          notifyAdminsGuestList();
        }

        const sessionUid = session.uid;
        if (sessionUid || session.fingerprint || session.clientId || session.ip) {
          const blockCheck = await checkUserBlockStatus(sessionUid, session.fingerprint, session.clientId, session.ip);
          if (blockCheck.blocked) {
            if (blockCheck.reason === "ban") {
              sendToClient(ws, "banned", {});
            } else {
              sendToClient(ws, "suspended", { until: blockCheck.until });
            }
            try { ws.close(); } catch (e) {}
            activeSessions.delete(ws);
            return;
          }
        }

        switch (payload.type) {
          case "authenticate":
          case "sync_auth":
          case "admin_auth": {
            const token = payload.token || payload.idToken;
            if (!token) return;

            try {
              const decoded = await verifyFirebaseIdToken(token, firebaseConfig.projectId);
              if (!decoded) {
                return;
              }

              const uid = decoded.uid;
              const email = decoded.email;

              if (typeof uid !== "string" || !uid || typeof email !== "string" || !email) {
                return;
              }

              const blockCheck = await checkUserBlockStatus(uid, session.fingerprint, session.clientId, session.ip);
              if (blockCheck.blocked) {
                if (blockCheck.reason === "ban") {
                  sendToClient(ws, "banned", {});
                } else {
                  sendToClient(ws, "suspended", { until: blockCheck.until });
                }
                try { ws.close(); } catch (e) {}
                activeSessions.delete(ws);
                return;
              }

              session.uid = uid;
              session.email = email;
              session.isAuthenticated = true;
              session.joinTime = session.joinTime || Date.now();
              notifyAdminsGuestList();

              const userDocRef = doc(db, "users", uid);
              const docSnap = await getDoc(userDocRef);
              let permanentId = "";
              let nickname = decoded.name || email.split("@")[0];
              let isAdminUser = false;
              let isAdsDisabled = false;

              if (docSnap.exists()) {
                const userData = docSnap.data();
                permanentId = userData.permanentId;
                nickname = userData.nickname || nickname;
                isAdminUser = userData.admin === true || uid === "iMDKTiIEezc2w2VQ2SO27bXsQTd2";
                isAdsDisabled = userData.adsDisabled === true || isAdminUser;

                if (isReservedNickname(nickname)) {
                  const isAuth = await isAuthorizedForReservedNickname(uid, nickname);
                  if (isAuth) {
                    
                  } else {
                    
                    nickname = `Membro_${permanentId.replace(/[^a-zA-Z0-9]/g, "")}`;
                    await updateDoc(userDocRef, { nickname });
                  }
                }

                if (userData.admin === undefined) {
                  await updateDoc(userDocRef, { admin: false });
                }

                if (!permanentId || !permanentId.startsWith("USR-") || permanentId.length !== 10 || isNaN(Number(permanentId.split("-")[1]))) {
                  const usersSnap = await getDocs(collection(db, "users"));
                  let nextNum = usersSnap.size + 1;
                  permanentId = `USR-${String(nextNum).padStart(6, "0")}`;
                  let unique = false;
                  while (!unique) {
                    const q = query(collection(db, "users"), where("permanentId", "==", permanentId));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                      unique = true;
                    } else {
                      nextNum++;
                      permanentId = `USR-${String(nextNum).padStart(6, "0")}`;
                    }
                  }
                  await updateDoc(userDocRef, { permanentId });
                }
              } else {
                
                const usersSnap = await getDocs(collection(db, "users"));
                let nextNum = usersSnap.size + 1;
                permanentId = `USR-${String(nextNum).padStart(6, "0")}`;
                let unique = false;
                while (!unique) {
                  
                  const q = query(collection(db, "users"), where("permanentId", "==", permanentId));
                  const snap = await getDocs(q);
                  if (snap.empty) {
                    unique = true;
                  } else {
                    nextNum++;
                    permanentId = `USR-${String(nextNum).padStart(6, "0")}`;
                  }
                }

                isAdminUser = false;

                if (isReservedNickname(nickname)) {
                  const isAuth = await isAuthorizedForReservedNickname(uid, nickname);
                  if (isAuth) {
                    
                  } else {
                    
                    nickname = `Membro_${permanentId.replace(/[^a-zA-Z0-9]/g, "")}`;
                  }
                }

                await setDoc(userDocRef, {
                  uid,
                  email,
                  nickname,
                  permanentId,
                  createdAt: Date.now(),
                  banned: false,
                  suspendedUntil: null,
                  admin: false,
                  adsDisabled: false
                });
              }

              session.permanentId = permanentId;
              session.nickname = nickname;
              session.isAdmin = isAdminUser;

              sendToClient(ws, "admin-status", { admin: isAdminUser });
              sendToClient(ws, "admin_verified", { isAdmin: isAdminUser });
              sendToClient(ws, "ads-status", { disabled: isAdsDisabled });

              sendToClient(ws, "user-permissions", {
                type: "user-permissions",
                admin: isAdminUser,
                adsDisabled: isAdsDisabled
              });

              try {
                const notifQuery = query(collection(db, "notifications"), where("uid", "==", uid));
                const notifSnap = await getDocs(notifQuery);
                if (!notifSnap.empty) {
                  for (const notifDoc of notifSnap.docs) {
                    const notifData = notifDoc.data();
                    const msgText = notifData.message || notifData.text || "";
                    const msgTitle = notifData.title || "Mensagem da Administração";
                    if (msgText) {
                      sendToClient(ws, "admin-private-message", {
                        title: msgTitle,
                        message: msgText,
                        text: msgText
                      });
                      sendToClient(ws, "individual_warning", {
                        title: msgTitle,
                        message: msgText,
                        text: msgText
                      });
                      
                    }
                    await deleteDoc(notifDoc.ref);
                  }
                }
              } catch (notifErr) {
                console.error("[ADMIN] Erro ao entregar notificações pendentes:", notifErr);
              }

            } catch (err) {
              console.error("[SecureAuth] Error syncing auth:", err);
            }
            break;
          }

          case "set-admin":
          case "set_admin":
          case "set-ads-status":
          case "set_ads_status":
          case "admin-global-message":
          case "global_warning":
          case "admin:broadcast":
          case "admin-private-message":
          case "individual_warning":
          case "admin:private":
          case "suspend":
          case "unsuspend":
          case "ban":
          case "unban":
          case "admin_action": {
            
            const actionToken = payload.idToken || payload.token;
            if (actionToken) {
              const decodedActionToken = await verifyIdToken(actionToken);
              if (decodedActionToken && decodedActionToken.uid) {
                session.uid = decodedActionToken.uid;
                session.email = decodedActionToken.email || session.email;
              } else {
                sendToClient(ws, "admin_action_error", { message: "401 Unauthorized: ID Token do Firebase Admin inválido ou expirado." });
                return;
              }
            }

            if (typeof session.uid !== "string" || !session.uid) {
              
              sendToClient(ws, "admin_action_error", { message: "403 Forbidden: Sessão não autenticada." });
              return;
            }

            const isAuthorized = await checkIsAdmin(session.uid);
            if (!isAuthorized) {
              
              sendToClient(ws, "admin_action_error", { message: "403 Forbidden: Acesso restrito a administradores." });
              return;
            }

            const action = payload.action || payload.type;
            const targetUid = payload.targetUid || payload.uid || payload.targetId;
            const targetId = payload.targetId || payload.targetUid || payload.uid;
            const adminState = payload.adminState !== undefined ? payload.adminState : payload.admin;
            const durationMs = payload.durationMs;
            const text = payload.text || payload.message;
            
            if (action === "set_admin" || action === "set-admin") {
              const target = targetUid || targetId;
              if (typeof target !== "string" || !target) return;
              const adminBool = !!adminState;

              const targetDocRef = doc(db, "users", target);
              await updateDoc(targetDocRef, { admin: adminBool });

              let targetName = "Desconhecido";
              try {
                const docSnap = await getDoc(targetDocRef);
                if (docSnap.exists()) {
                  targetName = docSnap.data().nickname || docSnap.data().displayName || "Desconhecido";
                }
              } catch (e) {}

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "set_admin",
                targetUid: target,
                targetNickname: targetName,
                details: adminBool ? "Nomeado Administrador" : "Removido de Administrador",
                timestamp: Date.now()
              });

              const succMsg = `Status de administrador alterado com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "advanced_ban" || action === "ban") {
              if (typeof targetUid !== "string" || !targetUid) return;

              const doBanUid = payload.banUid !== undefined ? !!payload.banUid : true;
              const doBanFp = payload.banFingerprint !== undefined ? !!payload.banFingerprint : true;
              const doBanCid = payload.banClientId !== undefined ? !!payload.banClientId : true;
              const doBanIp = payload.banIp !== undefined ? !!payload.banIp : false;

              let targetName = "Desconhecido";
              let fp = "";
              let cid = "";
              let lastIp = "";

              try {
                const userDocSnap = await adminDb.collection("users").doc(targetUid).get();
                if (userDocSnap.exists) {
                  const uData = userDocSnap.data();
                  targetName = uData?.nickname || uData?.displayName || "Desconhecido";
                  fp = uData?.fingerprint || "";
                  cid = uData?.clientId || "";
                  lastIp = uData?.lastIp || "";
                }
              } catch (e) {}

              if (doBanUid) {
                await adminDb.collection("users").doc(targetUid).set({ banned: true }, { merge: true });
              }

              try {
                const secRef = adminDb.collection("security").doc("bans");
                const secDoc = await secRef.get();
                let secData: SecurityBansDoc = secDoc.exists ? (secDoc.data() as SecurityBansDoc) : {};

                const fingerprints = new Set(secData.fingerprints || []);
                const clientIds = new Set(secData.clientIds || []);
                const ips = new Set(secData.ips || []);
                const uids = new Set(secData.uids || []);

                if (doBanUid && targetUid) uids.add(targetUid);
                if (doBanFp && fp) fingerprints.add(fp);
                if (doBanCid && cid) clientIds.add(cid);
                if (doBanIp && lastIp) ips.add(lastIp);

                await secRef.set({
                  uids: Array.from(uids),
                  fingerprints: Array.from(fingerprints),
                  clientIds: Array.from(clientIds),
                  ips: Array.from(ips)
                }, { merge: true });

                invalidateSecurityBansCache();
              } catch (err) {
                console.error("[Admin] Error updating security bans doc:", err);
              }

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "ban",
                targetUid: targetUid,
                targetNickname: targetName,
                details: `Banido permanentemente (Multicamadas: UID=${doBanUid}, FP=${doBanFp}, CID=${doBanCid}, IP=${doBanIp})`,
                timestamp: Date.now()
              });

              activeSessions.forEach((s, key) => {
                const matchUid = doBanUid && s.uid === targetUid;
                const matchFp = doBanFp && fp && s.fingerprint === fp;
                const matchCid = doBanCid && cid && s.clientId === cid;
                const matchIp = doBanIp && lastIp && s.ip === lastIp;

                if (matchUid || matchFp || matchCid || matchIp) {
                  sendToClient(key, "banned", {});
                  try { key.close(); } catch (err) {}
                  activeSessions.delete(key);
                }
              });

              const succMsg = `Usuário ${targetName} banido com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "advanced_suspend" || action === "suspend") {
              if (typeof targetUid !== "string" || !targetUid) return;

              const durMs = Number(payload.durationMs) || Number(durationMs) || 3600000;
              const suspendedUntil = Date.now() + durMs;

              const doSusUid = payload.suspendUid !== undefined ? !!payload.suspendUid : true;
              const doSusFp = payload.suspendFingerprint !== undefined ? !!payload.suspendFingerprint : true;
              const doSusCid = payload.suspendClientId !== undefined ? !!payload.suspendClientId : true;
              const doSusIp = payload.suspendIp !== undefined ? !!payload.suspendIp : false;

              let targetName = "Desconhecido";
              let fp = "";
              let cid = "";
              let lastIp = "";

              try {
                const userDocSnap = await adminDb.collection("users").doc(targetUid).get();
                if (userDocSnap.exists) {
                  const uData = userDocSnap.data();
                  targetName = uData?.nickname || uData?.displayName || "Desconhecido";
                  fp = uData?.fingerprint || "";
                  cid = uData?.clientId || "";
                  lastIp = uData?.lastIp || "";
                }
              } catch (e) {}

              if (doSusUid) {
                await adminDb.collection("users").doc(targetUid).set({ suspendedUntil }, { merge: true });
              }

              try {
                const secRef = adminDb.collection("security").doc("bans");
                const secDoc = await secRef.get();
                let secData: SecurityBansDoc = secDoc.exists ? (secDoc.data() as SecurityBansDoc) : {};

                const susUids = secData.suspendedUids || {};
                const susFps = secData.suspendedFingerprints || {};
                const susCids = secData.suspendedClientIds || {};
                const susIps = secData.suspendedIps || {};

                if (doSusUid && targetUid) susUids[targetUid] = suspendedUntil;
                if (doSusFp && fp) susFps[fp] = suspendedUntil;
                if (doSusCid && cid) susCids[cid] = suspendedUntil;
                if (doSusIp && lastIp) susIps[lastIp] = suspendedUntil;

                await secRef.set({
                  suspendedUids: susUids,
                  suspendedFingerprints: susFps,
                  suspendedClientIds: susCids,
                  suspendedIps: susIps
                }, { merge: true });

                invalidateSecurityBansCache();
              } catch (err) {
                console.error("[Admin] Error updating security suspensions doc:", err);
              }

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "suspension",
                targetUid: targetUid,
                targetNickname: targetName,
                details: `Suspenso por ${Math.round(durMs / 60000)} minutos (Multicamadas: UID=${doSusUid}, FP=${doSusFp}, CID=${doSusCid}, IP=${doSusIp})`,
                timestamp: Date.now()
              });

              activeSessions.forEach((s, key) => {
                const matchUid = doSusUid && s.uid === targetUid;
                const matchFp = doSusFp && fp && s.fingerprint === fp;
                const matchCid = doSusCid && cid && s.clientId === cid;
                const matchIp = doSusIp && lastIp && s.ip === lastIp;

                if (matchUid || matchFp || matchCid || matchIp) {
                  sendToClient(key, "suspended", { until: suspendedUntil });
                  try { key.close(); } catch (err) {}
                  activeSessions.delete(key);
                }
              });

              const succMsg = `Usuário ${targetName} suspenso com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "unban") {
              if (typeof targetUid !== "string" || !targetUid) return;

              let targetName = "Desconhecido";
              let fp = "";
              let cid = "";
              let lastIp = "";

              try {
                const docSnap = await adminDb.collection("users").doc(targetUid).get();
                if (docSnap.exists) {
                  const uData = docSnap.data();
                  targetName = uData?.nickname || uData?.displayName || "Desconhecido";
                  fp = uData?.fingerprint || "";
                  cid = uData?.clientId || "";
                  lastIp = uData?.lastIp || "";
                }
              } catch (e) {}

              await adminDb.collection("users").doc(targetUid).set({ banned: false }, { merge: true });

              try {
                const secRef = adminDb.collection("security").doc("bans");
                const secDoc = await secRef.get();
                if (secDoc.exists) {
                  const secData = secDoc.data() as SecurityBansDoc;
                  const uids = (secData.uids || []).filter(id => id !== targetUid);
                  const fingerprints = (secData.fingerprints || []).filter(id => id !== fp);
                  const clientIds = (secData.clientIds || []).filter(id => id !== cid);
                  const ips = (secData.ips || []).filter(id => id !== lastIp);

                  await secRef.set({ uids, fingerprints, clientIds, ips }, { merge: true });
                  invalidateSecurityBansCache();
                }
              } catch (err) {
                console.error("[Admin] Error unbanning in security doc:", err);
              }

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "unban",
                targetUid: targetUid,
                targetNickname: targetName,
                details: "Banimento removido (Multicamadas)",
                timestamp: Date.now()
              });

              const succMsg = `Banimento do usuário ${targetName} removido com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "unsuspend") {
              if (typeof targetUid !== "string" || !targetUid) return;

              let targetName = "Desconhecido";
              let fp = "";
              let cid = "";
              let lastIp = "";

              try {
                const docSnap = await adminDb.collection("users").doc(targetUid).get();
                if (docSnap.exists) {
                  const uData = docSnap.data();
                  targetName = uData?.nickname || uData?.displayName || "Desconhecido";
                  fp = uData?.fingerprint || "";
                  cid = uData?.clientId || "";
                  lastIp = uData?.lastIp || "";
                }
              } catch (e) {}

              await adminDb.collection("users").doc(targetUid).set({ suspendedUntil: null }, { merge: true });

              try {
                const secRef = adminDb.collection("security").doc("bans");
                const secDoc = await secRef.get();
                if (secDoc.exists) {
                  const secData = secDoc.data() as SecurityBansDoc;
                  const susUids = { ...(secData.suspendedUids || {}) };
                  const susFps = { ...(secData.suspendedFingerprints || {}) };
                  const susCids = { ...(secData.suspendedClientIds || {}) };
                  const susIps = { ...(secData.suspendedIps || {}) };

                  delete susUids[targetUid];
                  if (fp) delete susFps[fp];
                  if (cid) delete susCids[cid];
                  if (lastIp) delete susIps[lastIp];

                  await secRef.set({
                    suspendedUids: susUids,
                    suspendedFingerprints: susFps,
                    suspendedClientIds: susCids,
                    suspendedIps: susIps
                  }, { merge: true });

                  invalidateSecurityBansCache();
                }
              } catch (err) {
                console.error("[Admin] Error unsuspending in security doc:", err);
              }

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "unsuspend",
                targetUid: targetUid,
                targetNickname: targetName,
                details: "Suspensão removida (Multicamadas)",
                timestamp: Date.now()
              });

              const succMsg = `Suspensão do usuário ${targetName} removida com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "kick_guest") {
              const targetGuestId = payload.targetGuestId || payload.guestId;
              if (!targetGuestId) return;

              let kickedCount = 0;
              activeSessions.forEach((s, key) => {
                // NEVER disconnect the admin or any logged-in user!
                if (key === ws || s.uid || s.isAuthenticated) return;

                const matchSocketId = Boolean(payload.socketId && s.clientId === payload.socketId);
                const matchGid = Boolean(s.guestId === targetGuestId);
                const matchFp = Boolean(s.fingerprint && payload.fingerprint && s.fingerprint === payload.fingerprint);

                if (matchSocketId || matchGid || matchFp) {
                  sendToClient(key, "kicked_by_moderation", { message: "Sua conexão foi encerrada pela moderação." });
                  try { key.close(); } catch (e) {}
                  activeSessions.delete(key);
                  kickedCount++;
                }
              });

              notifyAdminsGuestList();

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "kick_guest",
                targetUid: targetGuestId,
                targetNickname: payload.nickname || targetGuestId,
                details: "Conexão de visitante encerrada pela moderação",
                timestamp: Date.now()
              });

              const succMsg = `Visitante ${targetGuestId} desconectado com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "suspend_guest") {
              const targetGuestId = payload.targetGuestId || payload.guestId;
              const durMs = Number(payload.durationMs) || 1800000;
              const expiresAt = Date.now() + durMs;

              const doBanGid = payload.banGuestId !== undefined ? !!payload.banGuestId : true;
              const doBanFp = payload.banFingerprint !== undefined ? !!payload.banFingerprint : true;
              const doBanIp = payload.banIp !== undefined ? !!payload.banIp : false;

              const guestFp = payload.fingerprint || "";
              const guestIp = payload.ip || "";

              await adminDb.collection("guestSuspensions").add({
                guestId: doBanGid ? targetGuestId : "",
                fingerprint: doBanFp ? guestFp : "",
                ip: doBanIp ? guestIp : "",
                type: "suspension",
                reason: payload.reason || "Suspensão temporária de visitante por moderação",
                durationMs: durMs,
                expiresAt: expiresAt,
                createdAt: Date.now(),
                adminEmail: session.email || "Admin",
                adminUid: session.uid
              });

              activeSessions.forEach((s, key) => {
                // NEVER disconnect the admin or any logged-in user!
                if (key === ws || s.uid || s.isAuthenticated) return;

                const matchGid = Boolean(doBanGid && targetGuestId && s.guestId === targetGuestId);
                const matchFp = Boolean(doBanFp && guestFp && s.fingerprint === guestFp);
                const matchIp = Boolean(doBanIp && guestIp && s.ip === guestIp);

                if (matchGid || matchFp || matchIp) {
                  sendToClient(key, "suspended", { until: expiresAt, message: "Sua conexão foi suspensa pela moderação." });
                  try { key.close(); } catch (e) {}
                  activeSessions.delete(key);
                }
              });

              notifyAdminsGuestList();

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "suspend_guest",
                targetUid: targetGuestId,
                targetNickname: payload.nickname || targetGuestId,
                details: `Convidado suspenso por ${Math.round(durMs / 60000)}m (GId=${doBanGid}, FP=${doBanFp}, IP=${doBanIp})`,
                timestamp: Date.now()
              });

              const succMsg = `Visitante ${targetGuestId} suspenso com sucesso por ${Math.round(durMs / 60000)} minutos.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "ban_guest") {
              const targetGuestId = payload.targetGuestId || payload.guestId;

              const doBanGid = payload.banGuestId !== undefined ? !!payload.banGuestId : true;
              const doBanFp = payload.banFingerprint !== undefined ? !!payload.banFingerprint : true;
              const doBanIp = payload.banIp !== undefined ? !!payload.banIp : false;

              const guestFp = payload.fingerprint || "";
              const guestIp = payload.ip || "";

              await adminDb.collection("guestBans").add({
                guestId: doBanGid ? targetGuestId : "",
                fingerprint: doBanFp ? guestFp : "",
                ip: doBanIp ? guestIp : "",
                type: "ban",
                reason: payload.reason || "Banimento permanente de visitante por moderação",
                createdAt: Date.now(),
                adminEmail: session.email || "Admin",
                adminUid: session.uid
              });

              activeSessions.forEach((s, key) => {
                // NEVER disconnect the admin or any logged-in user!
                if (key === ws || s.uid || s.isAuthenticated) return;

                const matchGid = Boolean(doBanGid && targetGuestId && s.guestId === targetGuestId);
                const matchFp = Boolean(doBanFp && guestFp && s.fingerprint === guestFp);
                const matchIp = Boolean(doBanIp && guestIp && s.ip === guestIp);

                if (matchGid || matchFp || matchIp) {
                  sendToClient(key, "banned", { message: "Seu acesso de visitante foi bloqueado permanentemente pela moderação." });
                  try { key.close(); } catch (e) {}
                  activeSessions.delete(key);
                }
              });

              notifyAdminsGuestList();

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "ban_guest",
                targetUid: targetGuestId,
                targetNickname: payload.nickname || targetGuestId,
                details: `Convidado banido permanentemente (GId=${doBanGid}, FP=${doBanFp}, IP=${doBanIp})`,
                timestamp: Date.now()
              });

              const succMsg = `Visitante ${targetGuestId} banido permanentemente com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "remove_guest_block" || action === "unsuspend_guest_block") {
              const blockId = payload.blockId || payload.id;
              const colName = payload.collectionName === "guestBans" ? "guestBans" : "guestSuspensions";
              if (!blockId) return;

              try {
                await adminDb.collection(colName).doc(blockId).delete();
              } catch (e) {
                console.error("Error removing guest block:", e);
              }

              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "remove_guest_block",
                targetUid: blockId,
                targetNickname: blockId,
                details: `Bloqueio de visitante removido (${colName})`,
                timestamp: Date.now()
              });

              const succMsg = `Bloqueio de visitante removido com sucesso.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "global_warning" || action === "admin-global-message" || action === "admin:broadcast") {
              if (typeof text !== "string" || !text) {
                sendToClient(ws, "admin_action_error", { message: "Mensagem do aviso global não pode estar vazia." });
                return;
              }

              const connectedClientsCount = activeSessions.size;
              
              addDoc(collection(db, "audits"), {
                adminUid: session.uid || "ADMIN",
                adminEmail: session.email || "admin",
                action: "global_warning",
                targetUid: "ALL",
                targetNickname: "Todos Usuários",
                details: text.substring(0, 100),
                timestamp: Date.now()
              }).catch(() => {});

              addDoc(collection(db, "adminMessages"), {
                id: "ADM-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
                type: "global",
                targetUid: "ALL",
                message: text,
                createdBy: session.email || session.uid || "ADMIN",
                createdAt: Date.now()
              }).catch(() => {});

              let recipientCount = 0;
              activeSessions.forEach((s, key) => {
                if (key.readyState === WebSocket.OPEN) {
                  const bcastPayload = {
                    type: "admin:broadcast",
                    title: "Mensagem da Administração",
                    message: text,
                    text: text,
                    timestamp: Date.now()
                  };
                  try {
                    key.send(JSON.stringify(bcastPayload));
                  } catch (e) {}

                  sendToClient(key, "admin-global-message", {
                    title: "Mensagem da Administração",
                    message: text,
                    text: text,
                    timestamp: Date.now()
                  });
                  sendToClient(key, "global_warning", {
                    title: "Mensagem da Administração",
                    message: text,
                    text: text,
                    timestamp: Date.now()
                  });
                  recipientCount++;
                }
              });

              const succMsg = `Mensagem global enviada para ${recipientCount} usuários.`;
              sendToClient(ws, "success", { message: succMsg });
              sendToClient(ws, "admin_action_success", { message: succMsg });

            } else if (action === "individual_warning" || action === "admin-private-message" || action === "admin:private") {
              const searchKey = typeof targetUid === "string" ? targetUid.trim() : (typeof targetId === "string" ? targetId.trim() : "");

              if (!searchKey || typeof text !== "string" || !text) {
                sendToClient(ws, "admin_action_error", { message: "ID do usuário e mensagem são obrigatórios." });
                return;
              }

              let targetSocket: WebSocket | null = null;
              let targetSession: any = null;
              let resolvedUid = searchKey;

              activeSessions.forEach((s, key) => {
                if (key.readyState === WebSocket.OPEN) {
                  const isMatch = (s.uid && s.uid === searchKey) ||
                                  (s.permanentId && s.permanentId === searchKey) ||
                                  (s.uid && s.uid.toLowerCase() === searchKey.toLowerCase());
                  if (isMatch) {
                    targetSocket = key;
                    targetSession = s;
                    if (s.uid) resolvedUid = s.uid;
                  }
                }
              });

              if (targetSocket) {
                
                const privPayload = {
                  type: "admin:private",
                  title: "Mensagem da Administração",
                  message: text,
                  text: text,
                  timestamp: Date.now()
                };

                try {
                  (targetSocket as WebSocket).send(JSON.stringify(privPayload));
                } catch (e) {}

                sendToClient(targetSocket, "admin-private-message", {
                  title: "Mensagem da Administração",
                  message: text,
                  text: text,
                  timestamp: Date.now()
                });
                sendToClient(targetSocket, "individual_warning", {
                  title: "Mensagem da Administração",
                  message: text,
                  text: text,
                  timestamp: Date.now()
                });

                addDoc(collection(db, "audits"), {
                  adminUid: session.uid || "ADMIN",
                  adminEmail: session.email || "admin",
                  action: "individual_warning",
                  targetUid: resolvedUid,
                  targetNickname: targetSession?.nickname || "Desconhecido",
                  details: text.substring(0, 100),
                  timestamp: Date.now()
                }).catch(() => {});

                addDoc(collection(db, "adminMessages"), {
                  id: "ADM-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
                  type: "private",
                  targetUid: resolvedUid,
                  message: text,
                  createdBy: session.email || session.uid || "ADMIN",
                  createdAt: Date.now()
                }).catch(() => {});

                const succMsg = `Mensagem enviada com sucesso para o usuário.`;
                sendToClient(ws, "success", { message: succMsg });
                sendToClient(ws, "admin_action_success", { message: succMsg });
              } else {
                
                sendToClient(ws, "admin_action_error", { message: "Usuário offline." });
              }

            } else if (action === "set_ads_status" || action === "set-ads-status") {
              const searchKey = targetUid || targetId;
              if (typeof searchKey !== "string" || !searchKey) return;
              const adsDisabled = payload.adsDisabled !== undefined ? !!payload.adsDisabled : !!payload.disabled;

              let resolvedUid = searchKey;

              try {
                let targetDocRef = doc(db, "users", searchKey);
                let docSnap = await getDoc(targetDocRef);
                if (!docSnap.exists()) {
                  const q = query(collection(db, "users"), where("permanentId", "==", searchKey));
                  const qSnap = await getDocs(q);
                  if (!qSnap.empty) {
                    docSnap = qSnap.docs[0];
                    resolvedUid = docSnap.id;
                    targetDocRef = doc(db, "users", resolvedUid);
                  }
                }

                await updateDoc(targetDocRef, { adsDisabled: adsDisabled });
                
                activeSessions.forEach((s, key) => {
                  if (s.uid === resolvedUid || s.permanentId === searchKey) {
                    sendToClient(key, "ads-status", { disabled: adsDisabled });
                  }
                });

                addDoc(collection(db, "audits"), {
                  adminUid: session.uid || "ADMIN",
                  adminEmail: session.email || "admin",
                  action: "set_ads_status",
                  targetUid: resolvedUid,
                  targetNickname: docSnap.exists() ? (docSnap.data().nickname || "Desconhecido") : "Desconhecido",
                  details: adsDisabled ? "Anúncios Ocultados (adsDisabled = true)" : "Anúncios Exibidos Normalmente (adsDisabled = false)",
                  timestamp: Date.now()
                }).catch(() => {});

                const succMsg = "Permissão de anúncios atualizada com sucesso.";
                sendToClient(ws, "success", { message: succMsg });
                sendToClient(ws, "admin_action_success", { message: succMsg });
              } catch (err: any) {
                console.error("[Admin] Error setting ads status:", err);
                sendToClient(ws, "admin_action_error", { message: err?.message || "Erro ao atualizar permissão de anúncios no Firestore." });
              }
            }

            break;
          }

          case "get_online_guests":
          case "get_online_users": {
            const token = payload.idToken || payload.token;
            if (token) {
              const decoded = await verifyIdToken(token);
              if (decoded && decoded.uid) {
                session.uid = decoded.uid;
              }
            }

            if (typeof session.uid !== "string" || !session.uid) {
              sendToClient(ws, "admin_action_error", { message: "403 Forbidden: Sessão não autenticada." });
              return;
            }

            const isAuthorized = await checkIsAdmin(session.uid);
            if (!isAuthorized) {
              sendToClient(ws, "admin_action_error", { message: "403 Forbidden: Acesso restrito a administradores." });
              return;
            }

            session.isAdmin = true;

            const onlineUsers: any[] = [];
            activeSessions.forEach((s) => {
              if (s.isAuthenticated && s.uid) {
                onlineUsers.push({
                  uid: s.uid,
                  nickname: s.nickname || "Desconhecido",
                  email: s.email || "",
                  permanentId: s.permanentId || "",
                  joinTime: s.joinTime || Date.now(),
                  roomId: s.roomId || "room-1",
                  online: true
                });
              }
            });

            sendToClient(ws, "admin_online_users", { users: onlineUsers });
            sendToClient(ws, "admin_online_guests", { guests: getOnlineGuestsList() });
            break;
          }

          case "get_audit_logs": {
            const token = payload.idToken || payload.token;
            if (token) {
              const decoded = await verifyIdToken(token);
              if (decoded && decoded.uid) {
                session.uid = decoded.uid;
              }
            }

            if (typeof session.uid !== "string" || !session.uid) {
              sendToClient(ws, "admin_action_error", { message: "403 Forbidden: Sessão não autenticada." });
              return;
            }

            const isAuthorized = await checkIsAdmin(session.uid);
            if (!isAuthorized) {
              sendToClient(ws, "admin_action_error", { message: "403 Forbidden: Acesso restrito a administradores." });
              return;
            }

            try {
              const q = query(collection(db, "audits"));
              const docSnap = await getDocs(q);
              const logs: any[] = [];
              docSnap.forEach((docDoc) => {
                logs.push({
                  id: docDoc.id,
                  ...docDoc.data()
                });
              });

              logs.sort((a, b) => b.timestamp - a.timestamp);

              sendToClient(ws, "admin_audit_logs", { logs });
            } catch (err) {
              console.error("[Admin] Error retrieving audit logs:", err);
            }
            break;
          }
          case "join": {
            const nickname = sanitizeHTML(payload.nickname?.trim() || "").substring(0, 15);
            const roomId = payload.roomId || "room-1";

            if (!nickname || nickname.length < 2) {
              sendToClient(ws, "error", { message: "Apelido inválido ou muito curto." });
              return;
            }

            if (isReservedNickname(nickname)) {
              const isAuth = await isAuthorizedForReservedNickname(session.uid, nickname);
              if (isAuth) {
                
              } else {
                
                sendToClient(ws, "error", { message: "Este nome é reservado pela equipe do Papo.net.br." });
                return;
              }
            }

            activeSessions.forEach((s, key) => {
              if (key !== ws && s.nickname && s.nickname.toLowerCase() === nickname.toLowerCase()) {
                try {
                  key.close();
                } catch (err) {}
                activeSessions.delete(key);
              }
            });

            let taken = false;
            activeSessions.forEach((s, key) => {
              if (key !== ws && s.roomId === roomId && s.nickname.toLowerCase() === nickname.toLowerCase()) {
                taken = true;
              }
            });

            const finalNickname = taken ? `${nickname}#${Math.floor(100 + Math.random() * 900)}` : nickname;

            const oldRoomId = session.roomId;
            const oldNickname = session.nickname;

            session.nickname = finalNickname;
            session.roomId = roomId;
            session.bio = payload.bio !== undefined ? sanitizeHTML(payload.bio) : session.bio;
            session.age = payload.age !== undefined && payload.age !== null ? Number(payload.age) : session.age;
            session.gender = payload.gender !== undefined ? sanitizeHTML(payload.gender) : session.gender;
            session.photoUrl = payload.photoUrl !== undefined ? sanitizeHTML(payload.photoUrl) : session.photoUrl;

            if (!session.uid) {
              notifyAdminsGuestList();
            }

            if (oldRoomId && oldRoomId !== roomId) {
              const leftUsers = getRoomOnlineUsers(oldRoomId);
              broadcastToRoom(oldRoomId, "user_left", {
                nickname: oldNickname,
                time: getCurrentTime(),
                timestamp: Date.now(),
                onlineUsers: leftUsers
              });
            }

            if (!messages[roomId]) {
              messages[roomId] = [];
            }

            sendToClient(ws, "room_state", {
              roomId,
              nickname: finalNickname,
              messages: messages[roomId],
              onlineUsers: getRoomOnlineUsers(roomId)
            });

            broadcastToRoom(roomId, "user_joined", {
              nickname: finalNickname,
              time: getCurrentTime(),
              timestamp: Date.now(),
              onlineUsers: getRoomOnlineUsers(roomId)
            }, ws);

            const roomBots = BOTS.filter(b => b.rooms.includes(roomId) && (systemSettings.botsEnabled || ["bot_papos", "bots_papos"].includes(b.nickname.toLowerCase())));
            if (roomBots.length > 0) {
              const welcomeBot = roomBots[Math.floor(Math.random() * roomBots.length)];
              
              setTimeout(() => {
                broadcastToRoom(roomId, "typing", {
                  nickname: welcomeBot.nickname,
                  isTyping: true
                });
              }, 500);

              setTimeout(() => {
                
                broadcastToRoom(roomId, "typing", {
                  nickname: welcomeBot.nickname,
                  isTyping: false
                });

                const welcomePhrases = [
                  `Seja muito bem-vindo(a) @${finalNickname}! Fique à vontade para puxar assunto por aqui.`,
                  `Opa, eae @${finalNickname}! Tudo tranquilo por aí?`,
                  `Seja bem-vindo(a), @${finalNickname}! Qual a boa de hoje?`,
                  `Oi @${finalNickname}, seja super bem-vindo ao nosso espaço!`
                ];
                const text = welcomePhrases[Math.floor(Math.random() * welcomePhrases.length)];
                
                const welcomeMsgId = "bot-welcome-" + Date.now();
                const welcomeMsg = {
                  id: welcomeMsgId,
                  sender: welcomeBot.nickname,
                  text,
                  time: getCurrentTime(),
                  timestamp: Date.now(),
                  isSystem: false,
                  reactions: {}
                };

                if (!messages[roomId]) messages[roomId] = [];
                messages[roomId].push(welcomeMsg);
                broadcastToRoom(roomId, "message", { message: welcomeMsg });
              }, 2500);
            }

            broadcastRoomsList();

            if (!oldNickname) {
              
              setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) return;
                sendToClient(ws, "private_typing", {
                  from: "Bot_Papos",
                  isTyping: true
                });
              }, 1200);

              setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) return;
                
                sendToClient(ws, "private_typing", {
                  from: "Bot_Papos",
                  isTyping: false
                });

                const welcomeText = `Olá! Seja muito bem-vindo ao **Papos**! 👋\n\nSou o assistente virtual do chat e vou te explicar como tudo funciona por aqui de forma simples:\n\n💬 **Salas Públicas**: Use o botão **Salas** no topo para explorar canais públicos (Geral, Tecnologia, Música...) e debater com todo mundo!\n\n🔒 **Conversas Privadas (DM)**: Para abrir um privado 100% seguro com qualquer usuário, basta clicar sobre o nome dele na lista de membros online à esquerda!\n\n🎨 **Cores de Mensagem**: Personalize suas mensagens clicando no ícone de **paleta** (agora posicionado elegantemente à direita do botão enviar!).\n\n😀 **Emojis**: Use o novo seletor de **emojis** do chat para enviar reações rápidas!\n\n↔️ **Ajustar Painel**: Arraste a linha divisória lateral para ajustar o tamanho da sua lista de conversas.\n\nSinta-se em casa! Qualquer dúvida, pode me mandar uma mensagem direta por aqui! 😊`;

                const pmPayload = {
                  type: "private_message",
                  id: "pm-welcome-" + Date.now(),
                  senderId: "Bot_Papos",
                  senderName: "Bot_Papos",
                  recipientId: finalNickname,
                  recipientName: finalNickname,
                  content: welcomeText,
                  timestamp: Date.now(),
                  conversationId: ["bot_papos", finalNickname.toLowerCase()].sort().join("--"),
                  isDeleted: false
                };
                sendToClient(ws, "private_message", pmPayload);
              }, 4000);
            }
            break;
          }

          case "join_room": {
            const roomId = payload.roomId;
            if (!roomId || !session.nickname) return;

            const oldRoomId = session.roomId;
            if (oldRoomId === roomId) return;

            session.roomId = roomId;

            if (oldRoomId) {
              const leftUsers = getRoomOnlineUsers(oldRoomId);
              broadcastToRoom(oldRoomId, "user_left", {
                nickname: session.nickname,
                time: getCurrentTime(),
                timestamp: Date.now(),
                onlineUsers: leftUsers
              });
            }

            if (!messages[roomId]) {
              messages[roomId] = [];
            }

            sendToClient(ws, "room_state", {
              roomId,
              nickname: session.nickname,
              messages: messages[roomId],
              onlineUsers: getRoomOnlineUsers(roomId)
            });

            broadcastToRoom(roomId, "user_joined", {
              nickname: session.nickname,
              time: getCurrentTime(),
              timestamp: Date.now(),
              onlineUsers: getRoomOnlineUsers(roomId)
            }, ws);

            const roomBots = BOTS.filter(b => b.rooms.includes(roomId) && (systemSettings.botsEnabled || ["bot_papos", "bots_papos"].includes(b.nickname.toLowerCase())));
            if (roomBots.length > 0) {
              const welcomeBot = roomBots[Math.floor(Math.random() * roomBots.length)];
              
              setTimeout(() => {
                broadcastToRoom(roomId, "typing", {
                  nickname: welcomeBot.nickname,
                  isTyping: true
                });
              }, 500);

              setTimeout(() => {
                
                broadcastToRoom(roomId, "typing", {
                  nickname: welcomeBot.nickname,
                  isTyping: false
                });

                const welcomePhrases = [
                  `Seja bem-vindo(a) à sala, @${session.nickname}!`,
                  `Eae @${session.nickname}! Chegou na sala certa. Como vão as coisas?`,
                  `Oi @${session.nickname}! Como vai? Que bom ver você por aqui.`
                ];
                const text = welcomePhrases[Math.floor(Math.random() * welcomePhrases.length)];
                
                const welcomeMsgId = "bot-welcome-" + Date.now();
                const welcomeMsg = {
                  id: welcomeMsgId,
                  sender: welcomeBot.nickname,
                  text,
                  time: getCurrentTime(),
                  timestamp: Date.now(),
                  isSystem: false,
                  reactions: {}
                };

                if (!messages[roomId]) messages[roomId] = [];
                messages[roomId].push(welcomeMsg);
                broadcastToRoom(roomId, "message", { message: welcomeMsg });
              }, 2500);
            }

            broadcastRoomsList();
            break;
          }

          case "message": {
            if (!session.nickname || !session.roomId) {
              sendToClient(ws, "error", { message: "Você precisa se identificar antes de enviar mensagens." });
              return;
            }

            const now = Date.now();
            session.lastMessageTime = session.lastMessageTime.filter(t => now - t < 4000); 
            if (session.lastMessageTime.length >= 4) {
              sendToClient(ws, "error", { message: "Você está enviando mensagens rápido demais. Aguarde um instante." });
              return;
            }
            session.lastMessageTime.push(now);

            const rawText = payload.text || "";
            if (containsLink(rawText) || (payload.replyTo && containsLink(payload.replyTo.text || ""))) {
              sendToClient(ws, "error", { message: "Links não são permitidos nas conversas." });
              return;
            }

            const text = sanitizeHTML(rawText).trim().substring(0, 250);
            if (!text) return;

            const color = payload.color ? sanitizeHTML(payload.color).substring(0, 15) : undefined;
            const msgId = "m-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
            const msgObj = {
              id: msgId,
              sender: session.nickname,
              text,
              time: getCurrentTime(),
              timestamp: Date.now(),
              isSystem: false,
              color,
              replyTo: payload.replyTo ? {
                id: payload.replyTo.id,
                sender: payload.replyTo.sender,
                text: payload.replyTo.text
              } : null,
              reactions: {}
            };

            if (!messages[session.roomId]) {
              messages[session.roomId] = [];
            }
            messages[session.roomId].push(msgObj);

            if (messages[session.roomId].length > 100) {
              messages[session.roomId].shift();
            }

            broadcastToRoom(session.roomId, "message", { message: msgObj });
            break;
          }

          case "private_message": {
            if (!session.nickname) return;
            const toNick = payload.to?.trim();
            const rawText = payload.text || "";

            if (!toNick || !rawText) return;

            if (containsLink(rawText)) {
              sendToClient(ws, "error", { message: "Links não são permitidos nas conversas." });
              return;
            }

            const text = sanitizeHTML(rawText).trim().substring(0, 250);
            if (!text) return;

            const color = payload.color ? sanitizeHTML(payload.color).substring(0, 15) : undefined;

            let targetWs: WebSocket | null = null;
            activeSessions.forEach((s, key) => {
              if (s.nickname.toLowerCase() === toNick.toLowerCase()) {
                targetWs = key;
              }
            });

            const pmId = payload.id || ("pm-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6));

            if (toNick.toLowerCase() === session.nickname.toLowerCase()) return;

            if (targetWs && targetWs !== ws) {
              const pmPayload = {
                type: "private_message",
                id: pmId,
                senderId: session.nickname,
                senderName: session.nickname,
                recipientId: toNick,
                recipientName: toNick,
                content: text,
                timestamp: Date.now(),
                conversationId: [session.nickname.toLowerCase(), toNick.toLowerCase()].sort().join("--"),
                isDeleted: false,
                color
              };
              
              sendToClient(targetWs, "private_message", pmPayload);
              
              sendToClient(ws, "private_message", pmPayload);
            } else {
              
              const isBot = BOTS.some(b => b.nickname.toLowerCase() === toNick.toLowerCase());
              if (isBot) {
                const isExemptBot = ["bot_papos", "bots_papos"].includes(toNick.toLowerCase());
                if (!systemSettings.botsEnabled && !isExemptBot) {
                  sendToClient(ws, "error", { message: `Usuário '${toNick}' não está online.` });
                  return;
                }
                const pmPayload = {
                  type: "private_message",
                  id: pmId,
                  senderId: session.nickname,
                  senderName: session.nickname,
                  recipientId: toNick,
                  recipientName: toNick,
                  content: text,
                  timestamp: Date.now(),
                  conversationId: [session.nickname.toLowerCase(), toNick.toLowerCase()].sort().join("--"),
                  isDeleted: false,
                  color
                };
                
                sendToClient(ws, "private_message", pmPayload);

                setTimeout(() => {
                  if (ws.readyState !== WebSocket.OPEN) return;
                  sendToClient(ws, "private_typing", {
                    from: toNick,
                    isTyping: true
                  });
                }, 200);

                setTimeout(() => {
                  if (ws.readyState !== WebSocket.OPEN) return;
                  
                  sendToClient(ws, "private_typing", {
                    from: toNick,
                    isTyping: false
                  });

                  let botReplies = [];
                  if (toNick.toLowerCase() === "bot_papos") {
                    botReplies = [
                      "Olá! Como assistente do Papos, posso te ajudar. Lembra que você pode ver todas as salas públicas clicando em **Salas** no menu superior!",
                      "Quer mudar a cor da sua mensagem? Basta clicar no ícone da **Paleta de Cores** no campo de envio (no celular, clique no ícone de três pontos para abrir as opções!).",
                      "Dica: Se quiser iniciar um chat privado com qualquer outra pessoa, basta clicar sobre o nome dela na lista de usuários online à esquerda!",
                      "Sinta-se à vontade para me perguntar qualquer dúvida sobre o funcionamento do chat! Estou sempre por aqui de olho para garantir a melhor experiência."
                    ];
                  } else {
                    botReplies = [
                      "Opa! Tudo bem? Estou meio ocupado(a) lendo as novidades nos canais públicos agora, mas depois a gente se fala!",
                      "Haha que bacana! Me conta mais sobre isso depois lá no canal principal pra todo mundo interagir junto!",
                      "Oi oi! Tudo ótimo por aqui. Dá uma olhada no canal geral, o pessoal tá trocando uma ideia super bacana lá!",
                      "Eae! No momento tô focado(a) nos debates das salas públicas, mas adorei seu alô!",
                      "Opa, valeu pelo salve! Vamos papear lá no chat principal?"
                    ];
                  }
                  const randomReply = botReplies[Math.floor(Math.random() * botReplies.length)];
                  sendToClient(ws, "private_message", {
                    type: "private_message",
                    id: "pm-reply-" + Date.now(),
                    senderId: toNick,
                    senderName: toNick,
                    recipientId: session.nickname,
                    recipientName: session.nickname,
                    content: randomReply,
                    timestamp: Date.now(),
                    conversationId: [toNick.toLowerCase(), session.nickname.toLowerCase()].sort().join("--"),
                    isDeleted: false
                  });
                }, 1700);
              } else {
                sendToClient(ws, "error", { message: `Usuário '${toNick}' não está online.` });
              }
            }
            break;
          }

          case "typing": {
            if (!session.nickname || !session.roomId) return;
            broadcastToRoom(session.roomId, "typing", {
              nickname: session.nickname,
              isTyping: !!payload.isTyping
            }, ws);
            break;
          }

          case "private_typing": {
            if (!session.nickname) return;
            const toNick = payload.to?.trim();
            if (!toNick) return;

            let targetWs: WebSocket | null = null;
            activeSessions.forEach((s, key) => {
              if (s.nickname.toLowerCase() === toNick.toLowerCase()) {
                targetWs = key;
              }
            });

            if (targetWs) {
              sendToClient(targetWs, "private_typing", {
                from: session.nickname,
                isTyping: !!payload.isTyping
              });
            }
            break;
          }

          case "reaction": {
            if (!session.nickname || !session.roomId) return;
            const { messageId, emoji } = payload;
            if (!messageId || !emoji) return;

            const roomMsgs = messages[session.roomId] || [];
            const msgObj = roomMsgs.find(m => m.id === messageId);
            if (msgObj) {
              if (!msgObj.reactions) msgObj.reactions = {};
              if (!msgObj.reactions[emoji]) msgObj.reactions[emoji] = [];
              
              const reactors = msgObj.reactions[emoji];
              const index = reactors.indexOf(session.nickname);
              if (index > -1) {
                reactors.splice(index, 1); 
              } else {
                reactors.push(session.nickname);
              }

              if (reactors.length === 0) {
                delete msgObj.reactions[emoji];
              }

              broadcastToRoom(session.roomId, "reaction_update", {
                messageId,
                reactions: msgObj.reactions
              });
            }
            break;
          }

          case "create_room": {
            if (!session.nickname) return;
            const name = sanitizeHTML(payload.name || "").trim().substring(0, 30);
            const desc = sanitizeHTML(payload.desc || "").trim().substring(0, 120);

            if (!name) return;

            if (rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
              sendToClient(ws, "error", { message: "Já existe uma sala com este nome." });
              return;
            }

            const newId = "room-" + Date.now();
            const newRoom = {
              id: newId,
              name,
              desc: desc || "Uma nova sala criada por um membro da comunidade.",
              count: 0,
              icon: "chat-dots"
            };

            rooms.push(newRoom);
            messages[newId] = [
              { id: `sys-init-${newId}`, sender: "Sistema", text: `Sala '${name}' foi criada com sucesso por ${session.nickname}.`, time: getCurrentTime(), timestamp: Date.now(), isSystem: true }
            ];

            sendToClient(ws, "room_created", { room: newRoom });

            broadcastRoomsList();
            break;
          }

          case "delete_message": {
            if (!session.nickname || !session.roomId) return;
            const { messageId } = payload;
            if (!messageId) return;

            const roomMsgs = messages[session.roomId] || [];
            const index = roomMsgs.findIndex(m => m.id === messageId);
            if (index > -1) {
              const msgObj = roomMsgs[index];
              
              if (!msgObj.isSystem && msgObj.sender === session.nickname) {
                roomMsgs.splice(index, 1);
                broadcastToRoom(session.roomId, "message_deleted", { messageId });
              } else {
                sendToClient(ws, "error", { message: "Você não possui permissão para excluir esta mensagem." });
              }
            }
            break;
          }

          case "delete_private_message": {
            if (!session.nickname) return;
            const { messageId, to } = payload;
            if (!messageId || !to) return;

            let targetWs: WebSocket | null = null;
            activeSessions.forEach((s, key) => {
              if (s.nickname.toLowerCase() === to.toLowerCase()) {
                targetWs = key;
              }
            });

            sendToClient(ws, "private_message_deleted", { messageId, partner: to });

            if (targetWs) {
              sendToClient(targetWs, "private_message_deleted", { messageId, partner: session.nickname });
            }
            break;
          }

          case "delete_private_conversation": {
            if (!session.nickname) return;
            const { partner } = payload;
            if (!partner) return;

            let targetWs: WebSocket | null = null;
            activeSessions.forEach((s, key) => {
              if (s.nickname.toLowerCase() === partner.toLowerCase()) {
                targetWs = key;
              }
            });

            sendToClient(ws, "private_conversation_deleted", { partner });

            if (targetWs) {
              sendToClient(targetWs, "private_conversation_deleted", { partner: session.nickname });
            }
            break;
          }

          case "get_profile": {
            const requestedNickname = payload.nickname;
            if (!requestedNickname || typeof requestedNickname !== "string") {
              sendToClient(ws, "error", { message: "Apelido inválido." });
              return;
            }

            let foundSession: ClientSession | null = null;
            activeSessions.forEach((s) => {
              if (s.nickname && s.nickname.toLowerCase() === requestedNickname.toLowerCase()) {
                foundSession = s;
              }
            });

            let bio = "";
            let age: number | null = null;
            let gender = "";
            let photoUrl = "";
            let permanentId = "";
            const isOnline = !!foundSession;

            if (foundSession) {
              bio = (foundSession as ClientSession).bio || "";
              age = (foundSession as ClientSession).age || null;
              gender = (foundSession as ClientSession).gender || "";
              photoUrl = (foundSession as ClientSession).photoUrl || "";
              permanentId = (foundSession as ClientSession).permanentId || "";
            }

            try {
              const q = query(collection(db, "users"), where("nickname", "==", requestedNickname));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const userData = snap.docs[0].data();
                if (!bio) bio = userData.bio || "";
                if (!age) age = userData.age || null;
                if (!gender) gender = userData.gender || "";
                if (!photoUrl) photoUrl = userData.photoUrl || "";
                if (!permanentId) permanentId = userData.permanentId || "";
              }
            } catch (err) {
              console.error("[Firestore] Error fetching profile:", err);
            }

            if (!permanentId) {
              if (BOTS.some(b => b.nickname.toLowerCase() === requestedNickname.toLowerCase())) {
                permanentId = "BOT-ASSISTANT";
              } else {
                permanentId = "USR-Membro";
              }
            }

            sendToClient(ws, "profile_data", {
              nickname: foundSession ? (foundSession as ClientSession).nickname : requestedNickname,
              photoUrl,
              bio,
              age,
              gender,
              online: isOnline,
              permanentId
            });
            break;
          }

          case "update_profile": {
            const oldNickname = session.nickname;
            let newNickname = payload.nickname || payload.displayName || payload.name;
            
            if (newNickname && typeof newNickname === "string") {
              newNickname = sanitizeHTML(newNickname.trim());
              if (newNickname !== oldNickname) {
                if (payload.uid && !session.uid) session.uid = payload.uid;
                const uidCandidate = payload.uid || session.uid;
                if (isReservedNickname(newNickname)) {
                  const isAuth = await isAuthorizedForReservedNickname(uidCandidate, newNickname);
                  if (!isAuth) {
                    sendToClient(ws, "error", { message: "Este nome é reservado pela equipe do Papo.net.br." });
                    break;
                  }
                }
                session.nickname = newNickname;
              }
            }

            session.bio = payload.bio !== undefined ? sanitizeHTML(payload.bio) : session.bio;
            session.age = payload.age !== undefined && payload.age !== null ? Number(payload.age) : session.age;
            session.gender = payload.gender !== undefined ? sanitizeHTML(payload.gender) : session.gender;
            session.photoUrl = payload.photoUrl !== undefined ? sanitizeHTML(payload.photoUrl) : session.photoUrl;

            if (session.uid) {
              try {
                const userRef = doc(db, "users", session.uid);
                await setDoc(userRef, {
                  nickname: session.nickname,
                  displayName: session.nickname,
                  name: session.nickname,
                  bio: session.bio,
                  age: session.age,
                  gender: session.gender,
                  updatedAt: Date.now()
                }, { merge: true });
              } catch (e) {
                console.error("[update_profile] Erro ao atualizar Firestore:", e);
              }
            } else {
              notifyAdminsGuestList();
            }

            if (session.roomId) {
              broadcastToRoom(session.roomId, "user_joined", {
                user: {
                  nickname: session.nickname,
                  joinedAt: session.joinTime || Date.now()
                }
              });
            }
            break;
          }

          case "pong": {
            
            break;
          }
        }
      } catch (err) {
        console.error("Error processing websocket message:", err);
      }
    });

    ws.on("close", () => {
      const session = activeSessions.get(ws);
      if (session) {
        const { nickname, roomId } = session;
        activeSessions.delete(ws);

        if (!session.uid) {
          notifyAdminsGuestList();
        }

        if (nickname && roomId) {
          
          const leftUsers = getRoomOnlineUsers(roomId);
          broadcastToRoom(roomId, "user_left", {
            nickname,
            time: getCurrentTime(),
            timestamp: Date.now(),
            onlineUsers: leftUsers
          });
        }
        broadcastRoomsList();
      }
    });

    ws.on("error", (err) => {
      console.error("Websocket connection error:", err);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.CLOSED) {
        activeSessions.delete(ws);
        return;
      }
      ws.ping(); 
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  if (process.env.NODE_ENV !== "production") {
    
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom" 
    });

    const serveTemplate = async (req: express.Request, res: express.Response, next: express.NextFunction, filePath: string) => {
      try {
        const fs = await import("fs");
        if (fs.existsSync(filePath)) {
          let html = fs.readFileSync(filePath, "utf-8");
          html = await vite.transformIndexHtml(req.originalUrl || req.url, html);
          res.status(200).set({ "Content-Type": "text/html" }).end(html);
        } else {
          res.status(404).end("Not Found");
        }
      } catch (e) {
        next(e);
      }
    };

    app.get("/robots.txt", (req, res) => res.sendFile(path.resolve(process.cwd(), "public/robots.txt")));
    app.get("/sitemap.xml", (req, res) => res.sendFile(path.resolve(process.cwd(), "public/sitemap.xml")));
    app.get("/manifest.json", (req, res) => res.sendFile(path.resolve(process.cwd(), "public/manifest.json")));

    app.get("/", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "index.html")));
    app.get("/pagina-inicial", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "index.html")));
    app.get("/salas", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/rooms.html")));
    app.get("/chat", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/chat.html")));
    app.get("/perfil", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/profile.html")));
    app.get("/privacidade", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/privacy.html")));
    app.get("/termos", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/terms.html")));
    app.get("/sobre", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/about.html")));
    app.get("/contato", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/contact.html")));
    app.get("/regras", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "pages/rules.html")));

    app.get("/blog", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/index.html")));
    app.get("/blog/", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/index.html")));
    app.get("/blog/index.html", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/index.html")));
    app.get("/blog/categoria.html", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/categoria.html")));
    app.get("/blog/artigo.html", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/artigo.html")));
    app.get("/blog/:slug", (req, res, next) => {
      const slug = req.params.slug;
      if (slug === "index.html" || slug === "categoria.html" || slug === "artigo.html") {
        return serveTemplate(req, res, next, path.resolve(process.cwd(), `blog/${slug}`));
      }
      if (slug.endsWith(".html")) {
        return serveTemplate(req, res, next, path.resolve(process.cwd(), "blog", slug));
      }
      serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/artigo.html"));
    });
    app.get("/entrar", (req, res) => {
      res.redirect("/#login-anchor");
    });

    app.get("/pages/:page.html", (req, res, next) => {
      serveTemplate(req, res, next, path.resolve(process.cwd(), "pages", `${req.params.page}.html`));
    });

    app.use(vite.middlewares);
  } else {
    
    const distPath = path.join(process.cwd(), "dist");

    app.use("/assets", express.static(path.join(process.cwd(), "assets")));

    app.use(express.static(distPath));

    app.get("/", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get("/pagina-inicial", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get("/salas", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "rooms.html"));
    });
    app.get("/chat", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "chat.html"));
    });
    app.get("/perfil", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "profile.html"));
    });
    app.get("/privacidade", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "privacy.html"));
    });
    app.get("/termos", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "terms.html"));
    });
    app.get("/sobre", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "about.html"));
    });
    app.get("/contato", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "contact.html"));
    });
    app.get("/regras", (req, res) => {
      res.sendFile(path.join(distPath, "pages", "rules.html"));
    });

    app.get("/blog", (req, res) => {
      res.sendFile(path.join(distPath, "blog", "index.html"));
    });
    app.get("/blog/", (req, res) => {
      res.sendFile(path.join(distPath, "blog", "index.html"));
    });
    app.get("/blog/index.html", (req, res) => {
      res.sendFile(path.join(distPath, "blog", "index.html"));
    });
    app.get("/blog/categoria.html", (req, res) => {
      res.sendFile(path.join(distPath, "blog", "categoria.html"));
    });
    app.get("/blog/artigo.html", (req, res) => {
      res.sendFile(path.join(distPath, "blog", "artigo.html"));
    });
    app.get("/blog/:slug", (req, res) => {
      const slug = req.params.slug;
      if (slug === "index.html" || slug === "categoria.html" || slug === "artigo.html") {
        return res.sendFile(path.join(distPath, "blog", slug));
      }
      if (slug.endsWith(".html")) {
        return res.sendFile(path.join(distPath, "blog", slug));
      }
      res.sendFile(path.join(distPath, "blog", "artigo.html"));
    });
    app.get("/entrar", (req, res) => {
      res.redirect("/#login-anchor");
    });

    app.get("/pages/:page.html", (req, res) => {
      res.sendFile(path.join(distPath, "pages", `${req.params.page}.html`));
    });
    
    app.use((req, res, next) => {
      const ext = path.extname(req.path);
      if (ext && ext !== ".html") {
        res.status(404).set("Content-Type", "text/plain").send("Not Found");
        return;
      }
      next();
    });

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const currentlyTypingBots = new Set<string>();

  const triggerBotSpeech = (bot: typeof BOTS[0]) => {
    const isExemptBot = ["bot_papos", "bots_papos"].includes(bot.nickname.toLowerCase());
    if (!systemSettings.botsEnabled && !isExemptBot) return;
    if (currentlyTypingBots.has(bot.nickname)) return;
    
    const roomId = bot.rooms[Math.floor(Math.random() * bot.rooms.length)];
    const roomMsgs = BOT_MESSAGES[roomId];
    if (!roomMsgs || roomMsgs.length === 0) return;

    let text = "";
    if (bot.nickname === "Bot_Papos") {
      
      if (Math.random() > 0.15) return; 
      const paposTips = [
        "Olá pessoal! Se quiserem saber as novidades ou tirar dúvidas sobre o chat, basta clicar no meu nome na lista de online e me mandar uma DM privada! 😊",
        "Dica: Personalize o visual das suas mensagens clicando no botão da paleta colorida no campo de texto!",
        "Dica: Você pode acessar canais sobre tecnologia, música, desabafos e jogos clicando no botão 'Salas' no menu superior! 💬",
        "Sintam-se livres para criar discussões amigáveis por aqui! Respeitem as regras e se divirtam. 🚀",
        "Sabia que você pode enviar dezenas de reações e emojis com o novo menu seletor de emojis ao lado do botão enviar?"
      ];
      text = paposTips[Math.floor(Math.random() * paposTips.length)];
    } else {
      text = roomMsgs[Math.floor(Math.random() * roomMsgs.length)];
    }

    const msgId = "bot-m-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const msgObj = {
      id: msgId,
      sender: bot.nickname,
      text,
      time: getCurrentTime(),
      timestamp: Date.now(),
      isSystem: false,
      reactions: {}
    };

    currentlyTypingBots.add(bot.nickname);
    broadcastToRoom(roomId, "typing", {
      nickname: bot.nickname,
      isTyping: true
    });

    const typingDuration = 1500 + Math.random() * 2000;
    setTimeout(() => {
      broadcastToRoom(roomId, "typing", {
        nickname: bot.nickname,
        isTyping: false
      });
      currentlyTypingBots.delete(bot.nickname);

      if (!messages[roomId]) {
        messages[roomId] = [];
      }
      messages[roomId].push(msgObj);
      if (messages[roomId].length > 100) {
        messages[roomId].shift();
      }

      broadcastToRoom(roomId, "message", { message: msgObj });
    }, typingDuration);
  };

  const botInterval = setInterval(() => {
    try {
      
      const r = Math.random();
      const count = r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
      
      const shuffled = [...BOTS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, count);

      selected.forEach((bot, index) => {
        
        setTimeout(() => {
          triggerBotSpeech(bot);
        }, index * 600);
      });
    } catch (err) {
      console.error("Error running automated bot conversation interval:", err);
    }
  }, 4500);

  wss.on("close", () => {
    clearInterval(interval);
    clearInterval(botInterval);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Express + WebSocket server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting Express/WS server:", err);
});