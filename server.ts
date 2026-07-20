import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where } from "firebase/firestore";
import fs from "fs";
import crypto from "crypto";
import https from "https";

// Load Firebase Config safely from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || "(default)"
};

// Initialize Firebase client on the server
const firebaseApp = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
});
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Helper to fetch Google's OAuth/Securetoken public certificates for JWT signature verification
let googlePublicKeys: Record<string, string> = {};
let lastFetchTime = 0;

async function fetchGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(googlePublicKeys).length > 0 && now - lastFetchTime < 3600000) {
    return googlePublicKeys;
  }

  return new Promise((resolve, reject) => {
    https.get("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com", (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          googlePublicKeys = JSON.parse(data);
          lastFetchTime = Date.now();
          resolve(googlePublicKeys);
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

// Securely decodes and cryptographically verifies Firebase Auth ID Token (JWT)
async function verifyFirebaseIdToken(token: string, projectId: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    if (header.alg !== "RS256" || !header.kid) return null;

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));

    // Verify standard claims
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowInSeconds) {
      console.warn("[SecureAuth] Token has expired");
      return null;
    }
    if (payload.aud !== projectId) {
      console.warn("[SecureAuth] Audience mismatch:", payload.aud, "expected:", projectId);
      return null;
    }
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      console.warn("[SecureAuth] Issuer mismatch:", payload.iss);
      return null;
    }

    // Get public certificate matching kid
    const publicKeys = await fetchGooglePublicKeys();
    const cert = publicKeys[header.kid];
    if (!cert) {
      console.warn("[SecureAuth] Key ID not found in certificate roster:", header.kid);
      return null;
    }

    // Cryptographically verify signature
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(`${headerB64}.${payloadB64}`);
    const verified = verify.verify(cert, signatureB64, "base64url");

    if (verified) {
      return payload;
    }
    return null;
  } catch (err) {
    console.error("[SecureAuth] Error verifying signature:", err);
    return null;
  }
}

// Check user suspension or ban status in Firestore
async function checkUserBlockStatus(uid: string): Promise<{ blocked: boolean; reason: string; until?: number }> {
  try {
    const userDocRef = doc(db, "users", uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.banned) {
        return { blocked: true, reason: "ban" };
      }
      if (data.suspendedUntil && data.suspendedUntil > Date.now()) {
        return { blocked: true, reason: "suspension", until: data.suspendedUntil };
      }
    }
  } catch (err) {
    console.error("[Moderation] Error checking user block status for", uid, err);
  }
  return { blocked: false, reason: "" };
}

// Initial standard rooms list (matches frontend)
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

// In-memory data store
const rooms = [...INITIAL_ROOMS];
const messages = { ...INITIAL_MESSAGES } as Record<string, any[]>;

// Pre-fill initial messages with today's reliable timestamps
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

// Simulated Bot Users always active in their respective rooms
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

// Message pools for bots per room to trigger interesting conversation starters
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
  lastMessageTime: number[]; // For spam prevention rate limits
  bio?: string;
  age?: number;
  gender?: string;
  photoUrl?: string;
  uid?: string;
  email?: string;
  permanentId?: string;
  joinTime?: number;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}

const activeSessions = new Map<WebSocket, ClientSession>();

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Escapes special HTML tags to prevent XSS
function sanitizeHTML(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  app.use(express.json());
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware de segurança (CORS) para aceitar conexões apenas de origens permitidas
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

  // Simple endpoint for health checks
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activeConnections: activeSessions.size });
  });

  // Profile validation endpoint
  app.post("/api/profile/validate", (req, res) => {
    const { bio, age, gender } = req.body;
    
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

  // Attach WebSocket server on the same HTTP server instance
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    
    // Em produção, valida se a origem é permitida (localhost, papos.net.br, onrender, vercel, run.app)
    if (origin) {
      const isAllowed = 
        origin.includes("localhost") || 
        origin.includes("127.0.0.1") || 
        origin.includes("papo.net.br") ||
        origin.includes("onrender.com") ||
        origin.includes("run.app") ||
        origin.includes("vercel.app");
        
      if (!isAllowed) {
        console.warn(`[Security] Conexão WebSocket bloqueada de origem não autorizada: ${origin}`);
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Helper to send messages to a specific client safely
  function sendToClient(ws: WebSocket, type: string, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  // Helper to broadcast to a specific room
  function broadcastToRoom(roomId: string, type: string, payload: any, excludeWs?: WebSocket) {
    activeSessions.forEach((session, ws) => {
      if (session.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        if (excludeWs && ws === excludeWs) return;
        ws.send(JSON.stringify({ type, ...payload }));
      }
    });
  }

  // Get active online nickname list in a room (including active simulated bots)
  function getRoomOnlineUsers(roomId: string): string[] {
    const list: string[] = [];
    activeSessions.forEach((session) => {
      if (session.roomId === roomId && session.nickname) {
        list.push(session.nickname);
      }
    });
    
    // Inject bots allocated to this room
    BOTS.forEach(bot => {
      if (bot.rooms.includes(roomId)) {
        list.push(bot.nickname);
      }
    });

    return Array.from(new Set(list)); // Deduplicate
  }

  // Update count in rooms list based on actual connections
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

  // Broadcast overall rooms list update to all connected clients
  function broadcastRoomsList() {
    updateRoomCounts();
    const roomsPayload = { rooms };
    activeSessions.forEach((session, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "room_list", ...roomsPayload }));
      }
    });
  }

  wss.on("connection", (ws: WebSocket) => {
    // Add new inactive connection to map
    activeSessions.set(ws, {
      ws,
      nickname: "",
      roomId: "",
      lastMessageTime: []
    });

    // Send the current room list immediately to the new connection
    updateRoomCounts();
    sendToClient(ws, "room_list", { rooms });

    ws.on("message", async (rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage.toString());
        const session = activeSessions.get(ws);
        if (!session) return;

        // Security check: intercept and block any action if the session UID is banned or suspended in Firestore
        if (session.uid) {
          const blockCheck = await checkUserBlockStatus(session.uid);
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
          case "sync_auth":
          case "admin_auth": {
            const token = payload.token;
            if (!token) return;

            try {
              const decoded = await verifyFirebaseIdToken(token, firebaseConfig.projectId);
              if (!decoded) {
                console.warn("[SecureAuth] Invalid or unverified token sent");
                return;
              }

              const uid = decoded.uid;
              const email = decoded.email;

              // Check Firestore database block/suspension status
              const blockCheck = await checkUserBlockStatus(uid);
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

              // Update session data with verified details
              session.uid = uid;
              session.email = email;
              session.isAuthenticated = true;
              session.joinTime = session.joinTime || Date.now();

              // Fetch or generate permanent ID from Firestore
              const userDocRef = doc(db, "users", uid);
              const docSnap = await getDoc(userDocRef);
              let permanentId = "";
              let nickname = decoded.name || email.split("@")[0];

              if (docSnap.exists()) {
                const userData = docSnap.data();
                permanentId = userData.permanentId;
                nickname = userData.nickname || nickname;

                // Auto-migrate legacy formats to USR-XXXXXXXX format on server side too
                if (!permanentId || !permanentId.startsWith("USR-")) {
                  let unique = false;
                  while (!unique) {
                    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                    let randStr = "";
                    for (let i = 0; i < 8; i++) {
                      randStr += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    permanentId = `USR-${randStr}`;
                    
                    const q = query(collection(db, "users"), where("permanentId", "==", permanentId));
                    const snap = await getDocs(q);
                    if (snap.empty) {
                      unique = true;
                    }
                  }
                  await updateDoc(userDocRef, { permanentId });
                }
              } else {
                // Generate a random unique permanent ID (format USR-XXXXXXXX)
                let unique = false;
                while (!unique) {
                  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                  let randStr = "";
                  for (let i = 0; i < 8; i++) {
                    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
                  }
                  permanentId = `USR-${randStr}`;
                  
                  // Check uniqueness in Firestore
                  const q = query(collection(db, "users"), where("permanentId", "==", permanentId));
                  const snap = await getDocs(q);
                  if (snap.empty) {
                    unique = true;
                  }
                }

                await setDoc(userDocRef, {
                  uid,
                  email,
                  nickname,
                  permanentId,
                  createdAt: Date.now(),
                  banned: false,
                  suspendedUntil: null
                });
              }

              session.permanentId = permanentId;
              session.nickname = nickname;

              // If admin, grant admin rights and verify to client
              if (uid === "iMDKTiIEezc2w2VQ2SO27bXsQTd2") {
                session.isAdmin = true;
                sendToClient(ws, "admin_verified", { isAdmin: true });
                console.log(`[Admin] Administrator iMDKTiIEezc2w2VQ2SO27bXsQTd2 successfully authorized!`);
              } else {
                session.isAdmin = false;
                sendToClient(ws, "admin_verified", { isAdmin: false });
              }

            } catch (err) {
              console.error("[SecureAuth] Error syncing auth:", err);
            }
            break;
          }

          case "admin_action": {
            if (!session.isAdmin) {
              console.warn("[Admin] Unauthorized attempt to execute administrative action!");
              return;
            }

            const { action, targetUid, durationMs, text } = payload;
            
            if (action === "suspend") {
              if (!targetUid) return;
              const suspendedUntil = Date.now() + Number(durationMs);
              
              // 1. Update Firestore
              const targetDocRef = doc(db, "users", targetUid);
              await updateDoc(targetDocRef, {
                suspendedUntil: suspendedUntil
              });

              // Fetch target details for audit
              let targetName = "Desconhecido";
              try {
                const docSnap = await getDoc(targetDocRef);
                if (docSnap.exists()) {
                  targetName = docSnap.data().nickname || "Desconhecido";
                }
              } catch (e) {}

              // 2. Add Audit Log
              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "suspension",
                targetUid: targetUid,
                targetNickname: targetName,
                details: `Suspenso por ${Number(durationMs) / 60000} minutos`,
                timestamp: Date.now()
              });

              // 3. Find and forcefully disconnect the user in real-time
              activeSessions.forEach((s, key) => {
                if (s.uid === targetUid) {
                  sendToClient(key, "suspended", { until: suspendedUntil });
                  try { key.close(); } catch (err) {}
                  activeSessions.delete(key);
                }
              });

              // 4. Notify admin about success
              sendToClient(ws, "admin_action_success", { message: `Usuário ${targetName} suspenso com sucesso.` });
              
            } else if (action === "ban") {
              if (!targetUid) return;

              // 1. Update Firestore
              const targetDocRef = doc(db, "users", targetUid);
              await updateDoc(targetDocRef, {
                banned: true
              });

              // Fetch target details for audit
              let targetName = "Desconhecido";
              try {
                const docSnap = await getDoc(targetDocRef);
                if (docSnap.exists()) {
                  targetName = docSnap.data().nickname || "Desconhecido";
                }
              } catch (e) {}

              // 2. Add Audit Log
              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "ban",
                targetUid: targetUid,
                targetNickname: targetName,
                details: `Banido permanentemente`,
                timestamp: Date.now()
              });

              // 3. Find and forcefully disconnect the user in real-time
              activeSessions.forEach((s, key) => {
                if (s.uid === targetUid) {
                  sendToClient(key, "banned", {});
                  try { key.close(); } catch (err) {}
                  activeSessions.delete(key);
                }
              });

              // 4. Notify admin about success
              sendToClient(ws, "admin_action_success", { message: `Usuário ${targetName} banido com sucesso.` });

            } else if (action === "global_warning") {
              if (!text) return;

              // 1. Log to Audit
              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "global_warning",
                targetUid: "ALL",
                targetNickname: "Todos Usuários",
                details: text.substring(0, 100),
                timestamp: Date.now()
              });

              // 2. Broadcast warning to everyone in real-time
              activeSessions.forEach((s, key) => {
                if (key.readyState === WebSocket.OPEN) {
                  sendToClient(key, "global_warning", { text });
                }
              });

              // 3. Notify admin
              sendToClient(ws, "admin_action_success", { message: `Aviso global enviado.` });

            } else if (action === "individual_warning") {
              if (!targetUid || !text) return;

              const targetDocRef = doc(db, "users", targetUid);
              let targetName = "Desconhecido";
              try {
                const docSnap = await getDoc(targetDocRef);
                if (docSnap.exists()) {
                  targetName = docSnap.data().nickname || "Desconhecido";
                }
              } catch (e) {}

              // 1. Log to Audit
              await addDoc(collection(db, "audits"), {
                adminUid: session.uid,
                adminEmail: session.email,
                action: "individual_warning",
                targetUid: targetUid,
                targetNickname: targetName,
                details: text.substring(0, 100),
                timestamp: Date.now()
              });

              // 2. Send warning to target session
              let foundOnline = false;
              activeSessions.forEach((s, key) => {
                if (s.uid === targetUid && key.readyState === WebSocket.OPEN) {
                  sendToClient(key, "individual_warning", { text });
                  foundOnline = true;
                }
              });

              // 3. Notify admin
              sendToClient(ws, "admin_action_success", { 
                message: foundOnline ? `Aviso individual entregue para ${targetName}.` : `Aviso gravado na auditoria, mas usuário ${targetName} está offline.` 
              });
            }

            break;
          }

          case "get_online_users": {
            if (!session.isAdmin) return;

            // Fetch list of active authenticated user sessions
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
            break;
          }

          case "get_audit_logs": {
            if (!session.isAdmin) return;

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

              // Sort audit logs descending by timestamp
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

            // Terminate duplicate connections with the same nickname to prevent duplicates on reconnection
            activeSessions.forEach((s, key) => {
              if (key !== ws && s.nickname && s.nickname.toLowerCase() === nickname.toLowerCase()) {
                try {
                  key.close();
                } catch (err) {}
                activeSessions.delete(key);
              }
            });

            // Check if nickname is already taken in the SAME room
            let taken = false;
            activeSessions.forEach((s, key) => {
              if (key !== ws && s.roomId === roomId && s.nickname.toLowerCase() === nickname.toLowerCase()) {
                taken = true;
              }
            });

            const finalNickname = taken ? `${nickname}#${Math.floor(100 + Math.random() * 900)}` : nickname;

            // Handle switching rooms if already in one
            const oldRoomId = session.roomId;
            const oldNickname = session.nickname;

            session.nickname = finalNickname;
            session.roomId = roomId;
            session.bio = payload.bio !== undefined ? sanitizeHTML(payload.bio) : session.bio;
            session.age = payload.age !== undefined && payload.age !== null ? Number(payload.age) : session.age;
            session.gender = payload.gender !== undefined ? sanitizeHTML(payload.gender) : session.gender;
            session.photoUrl = payload.photoUrl !== undefined ? sanitizeHTML(payload.photoUrl) : session.photoUrl;

            // Alert old room about departure
            if (oldRoomId && oldRoomId !== roomId) {
              const leftUsers = getRoomOnlineUsers(oldRoomId);
              broadcastToRoom(oldRoomId, "user_left", {
                nickname: oldNickname,
                time: getCurrentTime(),
                timestamp: Date.now(),
                onlineUsers: leftUsers
              });
            }

            // Make sure messages list exist for the target room
            if (!messages[roomId]) {
              messages[roomId] = [];
            }

            // Send full room state (messages + online users list + confirmed nickname)
            sendToClient(ws, "room_state", {
              roomId,
              nickname: finalNickname,
              messages: messages[roomId],
              onlineUsers: getRoomOnlineUsers(roomId)
            });

            // Notify everyone in new room about arrival
            broadcastToRoom(roomId, "user_joined", {
              nickname: finalNickname,
              time: getCurrentTime(),
              timestamp: Date.now(),
              onlineUsers: getRoomOnlineUsers(roomId)
            }, ws);

            // Simulate bot welcome for new joiner
            const roomBots = BOTS.filter(b => b.rooms.includes(roomId));
            if (roomBots.length > 0) {
              const welcomeBot = roomBots[Math.floor(Math.random() * roomBots.length)];
              // Start typing at 500ms
              setTimeout(() => {
                broadcastToRoom(roomId, "typing", {
                  nickname: welcomeBot.nickname,
                  isTyping: true
                });
              }, 500);

              // Send message at 2500ms
              setTimeout(() => {
                // Stop typing
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
              // Send an automated beautiful private message from Bot_Papos
              setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) return;
                sendToClient(ws, "private_typing", {
                  from: "Bot_Papos",
                  isTyping: true
                });
              }, 1200);

              setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) return;
                // Stop typing
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

            // Notify old room departure
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

            // Send new room state
            sendToClient(ws, "room_state", {
              roomId,
              nickname: session.nickname,
              messages: messages[roomId],
              onlineUsers: getRoomOnlineUsers(roomId)
            });

            // Notify new room about arrival
            broadcastToRoom(roomId, "user_joined", {
              nickname: session.nickname,
              time: getCurrentTime(),
              timestamp: Date.now(),
              onlineUsers: getRoomOnlineUsers(roomId)
            }, ws);

            // Simulate bot welcome for switching room
            const roomBots = BOTS.filter(b => b.rooms.includes(roomId));
            if (roomBots.length > 0) {
              const welcomeBot = roomBots[Math.floor(Math.random() * roomBots.length)];
              // Start typing at 500ms
              setTimeout(() => {
                broadcastToRoom(roomId, "typing", {
                  nickname: welcomeBot.nickname,
                  isTyping: true
                });
              }, 500);

              // Send message at 2500ms
              setTimeout(() => {
                // Stop typing
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

            // Spam Rate Limiting
            const now = Date.now();
            session.lastMessageTime = session.lastMessageTime.filter(t => now - t < 4000); // Keep last 4 seconds
            if (session.lastMessageTime.length >= 4) {
              sendToClient(ws, "error", { message: "Você está enviando mensagens rápido demais. Aguarde um instante." });
              return;
            }
            session.lastMessageTime.push(now);

            const text = sanitizeHTML(payload.text || "").trim().substring(0, 250);
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

            // Cap memory storage to last 100 messages per room
            if (messages[session.roomId].length > 100) {
              messages[session.roomId].shift();
            }

            broadcastToRoom(session.roomId, "message", { message: msgObj });
            break;
          }

          case "private_message": {
            if (!session.nickname) return;
            const toNick = payload.to?.trim();
            const text = sanitizeHTML(payload.text || "").trim().substring(0, 250);

            if (!toNick || !text) return;

            const color = payload.color ? sanitizeHTML(payload.color).substring(0, 15) : undefined;

            // Find target socket
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
              // Send to recipient
              sendToClient(targetWs, "private_message", pmPayload);
              // Send confirmation to sender
              sendToClient(ws, "private_message", pmPayload);
            } else {
              // Check if recipient is a simulated Bot!
              const isBot = BOTS.some(b => b.nickname.toLowerCase() === toNick.toLowerCase());
              if (isBot) {
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
                // Echo back the sent DM so client UI appends it
                sendToClient(ws, "private_message", pmPayload);

                // Trigger a nice simulated auto-response from the bot
                // Start typing at 200ms
                setTimeout(() => {
                  if (ws.readyState !== WebSocket.OPEN) return;
                  sendToClient(ws, "private_typing", {
                    from: toNick,
                    isTyping: true
                  });
                }, 200);

                // Send message at 1700ms
                setTimeout(() => {
                  if (ws.readyState !== WebSocket.OPEN) return;
                  // Stop typing
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

            // Update in-memory message list
            const roomMsgs = messages[session.roomId] || [];
            const msgObj = roomMsgs.find(m => m.id === messageId);
            if (msgObj) {
              if (!msgObj.reactions) msgObj.reactions = {};
              if (!msgObj.reactions[emoji]) msgObj.reactions[emoji] = [];
              
              const reactors = msgObj.reactions[emoji];
              const index = reactors.indexOf(session.nickname);
              if (index > -1) {
                reactors.splice(index, 1); // Remove reaction if already reacted (toggle)
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

            // Prevent duplicate room names
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

            // Send confirmation back to creator
            sendToClient(ws, "room_created", { room: newRoom });

            // Broadcast updated list to everyone
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
              // Ensure we do not delete system messages or messages sent by other people
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

            // Direct messages are stored on client's localstorage, so we just broadcast the deletion event 
            // so both clients can remove it from their respective histories in real-time.
            let targetWs: WebSocket | null = null;
            activeSessions.forEach((s, key) => {
              if (s.nickname.toLowerCase() === to.toLowerCase()) {
                targetWs = key;
              }
            });

            // Notify the sender
            sendToClient(ws, "private_message_deleted", { messageId, partner: to });

            // Notify the recipient if online
            if (targetWs) {
              sendToClient(targetWs, "private_message_deleted", { messageId, partner: session.nickname });
            }
            break;
          }

          case "get_profile": {
            const requestedNickname = payload.nickname;
            if (!requestedNickname || typeof requestedNickname !== "string") {
              sendToClient(ws, "error", { message: "Apelido inválido." });
              return;
            }

            // Procurar nas sessões ativas (online)
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

            // Fetch/fallback from Firestore to get permanentId and details
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

            // If we still don't have permanentId (e.g., bot), set a readable placeholder
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
            session.bio = payload.bio !== undefined ? sanitizeHTML(payload.bio) : session.bio;
            session.age = payload.age !== undefined && payload.age !== null ? Number(payload.age) : session.age;
            session.gender = payload.gender !== undefined ? sanitizeHTML(payload.gender) : session.gender;
            session.photoUrl = payload.photoUrl !== undefined ? sanitizeHTML(payload.photoUrl) : session.photoUrl;
            break;
          }

          case "pong": {
            // Heartbeat response, handled by ping interval
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

        if (nickname && roomId) {
          // Notify room about departure
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

  // Keep-alive connection heartbeat check (every 30 seconds)
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.CLOSED) {
        activeSessions.delete(ws);
        return;
      }
      ws.ping(); // Send low-level WS ping frame
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  // Serve static UI assets using Vite middleware in dev, and direct express.static in production
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom" // Use custom to serve multi-page setup nicely
    });

    // Helper to serve and transform HTML templates
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

    // Clean routes in development
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

    // Blog Routes
    app.get("/blog", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/index.html")));
    app.get("/blog/", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/index.html")));
    app.get("/blog/index.html", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/index.html")));
    app.get("/blog/categoria.html", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/categoria.html")));
    app.get("/blog/artigo.html", (req, res, next) => serveTemplate(req, res, next, path.resolve(process.cwd(), "blog/artigo.html")));
    app.get("/entrar", (req, res) => {
      res.redirect("/#login-anchor");
    });

    // Fallbacks for direct HTML requests in dev
    app.get("/pages/:page.html", (req, res, next) => {
      serveTemplate(req, res, next, path.resolve(process.cwd(), "pages", `${req.params.page}.html`));
    });
    app.get("/blog/:page.html", (req, res, next) => {
      serveTemplate(req, res, next, path.resolve(process.cwd(), "blog", `${req.params.page}.html`));
    });

    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");

    // Servir arquivos estáticos da pasta "assets" raiz primeiro para que scripts não compilados funcionem
    app.use("/assets", express.static(path.join(process.cwd(), "assets")));

    // Servir arquivos estáticos do build do Vite (dist/)
    app.use(express.static(distPath));

    // Clean routes in production
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

    // Blog Routes in production
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
    app.get("/entrar", (req, res) => {
      res.redirect("/#login-anchor");
    });

    // Fallbacks for direct URLs
    app.get("/pages/:page.html", (req, res) => {
      res.sendFile(path.join(distPath, "pages", `${req.params.page}.html`));
    });
    app.get("/blog/:page.html", (req, res) => {
      res.sendFile(path.join(distPath, "blog", `${req.params.page}.html`));
    });
    
    // Evitar que arquivos estáticos com extensão ausentes (ex: .js, .css, .png, .json)
    // caiam na rota curinga "*" e retornem o index.html, gerando erro de sintaxe.
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

  // Set to keep track of bots currently typing to avoid duplicate typing events
  const currentlyTypingBots = new Set<string>();

  const triggerBotSpeech = (bot: typeof BOTS[0]) => {
    if (currentlyTypingBots.has(bot.nickname)) return;
    
    // Choose room
    const roomId = bot.rooms[Math.floor(Math.random() * bot.rooms.length)];
    const roomMsgs = BOT_MESSAGES[roomId];
    if (!roomMsgs || roomMsgs.length === 0) return;

    let text = "";
    if (bot.nickname === "Bot_Papos") {
      // Small chance to talk in general room
      if (Math.random() > 0.15) return; // limit Bot_Papos general room spam
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

    // Mark as typing
    currentlyTypingBots.add(bot.nickname);
    broadcastToRoom(roomId, "typing", {
      nickname: bot.nickname,
      isTyping: true
    });

    // Random typing duration between 1.5s and 3.5s
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

  // Periodic simulated bot conversations (every 4.5 seconds for hyper-active feel)
  const botInterval = setInterval(() => {
    try {
      // Determine how many bots will speak (1 to 3)
      const r = Math.random();
      const count = r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
      
      // Shuffle BOTS to select unique ones
      const shuffled = [...BOTS].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, count);

      selected.forEach((bot, index) => {
        // Stagger their typing starts slightly so they don't start at the exact same millisecond
        setTimeout(() => {
          triggerBotSpeech(bot);
        }, index * 600);
      });
    } catch (err) {
      console.error("Error running automated bot conversation interval:", err);
    }
  }, 4500);

  // Stop intervals when server/websocket terminates
  wss.on("close", () => {
    clearInterval(interval);
    clearInterval(botInterval);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Success! Serving at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting Express/WS server:", err);
});
