import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export const isFirebaseAdminConfigured = Boolean(process.env.FIREBASE_PRIVATE_KEY);

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "hale-palisade-2pthm";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com`;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      console.log("[FCM] Firebase Admin SDK inicializado com sucesso usando FIREBASE_PRIVATE_KEY.");
    } catch (err: any) {
      console.error("[FirebaseAdmin] Erro ao inicializar com FIREBASE_PRIVATE_KEY:", err?.message || err);
    }
  } else {
    try {
      initializeApp({ projectId });
    } catch (err: any) {}
    console.warn("[FCM] Push está desativado por ausência da variável de ambiente FIREBASE_PRIVATE_KEY.");
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminMessaging = getMessaging();

export async function verifyIdToken(idToken: string) {
  try {
    if (!idToken) return null;
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("[FirebaseAdmin] Failed to verify ID Token:", error);
    return null;
  }
}

export async function checkAdminByUid(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return data?.admin === true;
    }
    return false;
  } catch (error) {
    console.error("[FirebaseAdmin] Error checking admin in Firestore for UID:", uid, error);
    return false;
  }
}

export async function authenticateAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "401 Unauthorized: Header Authorization com Bearer token é obrigatório." });
    }

    const idToken = authHeader.split("Bearer ")[1]?.trim();
    if (!idToken) {
      return res.status(401).json({ error: "401 Unauthorized: Token de autenticação ausente." });
    }

    const decoded = await verifyIdToken(idToken);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({ error: "401 Unauthorized: Token de ID inválido ou expirado." });
    }

    const isAdmin = await checkAdminByUid(decoded.uid);
    if (!isAdmin) {
      return res.status(403).json({ error: "403 Forbidden: Usuário não possui privilégios de administrador." });
    }

    req.user = decoded;
    req.adminUid = decoded.uid;
    next();
  } catch (err) {
    console.error("[FirebaseAdmin] Error in authenticateAdmin middleware:", err);
    return res.status(500).json({ error: "500 Internal Server Error" });
  }
}