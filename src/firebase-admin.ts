import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Ensure Firebase Admin SDK is initialized only once
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "papo-net";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@papo-net.iam.gserviceaccount.com";
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin SDK não configurado. Verifique as variáveis de ambiente.");
}

  // Sanitize line breaks in private key if passed as escaped string
  privateKey = privateKey.replace(/\\n/g, "\n");

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();


/**
 * Validates an ID Token sent by the frontend using Firebase Admin SDK
 */
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

/**
 * Checks if the user is explicitly flagged as admin in Firestore (users/{uid}.admin == true)
 */
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

/**
 * Middleware for Express administrative endpoints
 */
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
