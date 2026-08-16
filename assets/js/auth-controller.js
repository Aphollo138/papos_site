import { auth, db } from "./firebase.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  sendEmailVerification,
  updateProfile, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  addDoc,
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  writeBatch
} from "firebase/firestore";

const FirebaseService = {
  
  getCurrentUser() {
    return auth.currentUser;
  },

  async syncUserProfile() {
    const user = auth.currentUser;
    if (!user) return null;

    if (!user.emailVerified) {
      await signOut(auth);
      return null;
    }

    const clientId = window.SecurityIdentity ? window.SecurityIdentity.getClientId() : "";
    const fingerprint = window.SecurityIdentity ? window.SecurityIdentity.getFingerprint() : "";

    const userDocRef = doc(db, "users", user.uid);
    try {
      // Security collection check
      try {
        const secSnap = await getDoc(doc(db, "security", "bans"));
        if (secSnap.exists()) {
          const sec = secSnap.data();
          const now = Date.now();
          if (
            (user.uid && Array.isArray(sec.uids) && sec.uids.includes(user.uid)) ||
            (fingerprint && Array.isArray(sec.fingerprints) && sec.fingerprints.includes(fingerprint)) ||
            (clientId && Array.isArray(sec.clientIds) && sec.clientIds.includes(clientId))
          ) {
            await signOut(auth);
            localStorage.removeItem("papos_nickname");
            window.location.href = "/?error=banned";
            return null;
          }

          const uUntil = sec.suspendedUids ? sec.suspendedUids[user.uid] : null;
          const fpUntil = sec.suspendedFingerprints ? sec.suspendedFingerprints[fingerprint] : null;
          const cidUntil = sec.suspendedClientIds ? sec.suspendedClientIds[clientId] : null;
          const maxUntil = Math.max(uUntil || 0, fpUntil || 0, cidUntil || 0);

          if (maxUntil > now) {
            const secRemaining = Math.ceil((maxUntil - now) / 60000);
            await signOut(auth);
            localStorage.removeItem("papos_nickname");
            window.location.href = `/?error=suspended&remaining=${secRemaining}`;
            return null;
          }
        }
      } catch (e) {}

      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.banned) {
          await signOut(auth);
          localStorage.removeItem("papos_nickname");
          window.location.href = "/?error=banned";
          return null;
        }
        if (data.suspendedUntil && data.suspendedUntil > Date.now()) {
          const remaining = Math.ceil((data.suspendedUntil - Date.now()) / 60000);
          await signOut(auth);
          localStorage.removeItem("papos_nickname");
          window.location.href = `/?error=suspended&remaining=${remaining}`;
          return null;
        }

        let needsUpdate = false;
        const updatePayload = {
          lastSeen: Date.now(),
          lastLogin: Date.now()
        };
        needsUpdate = true;

        if (fingerprint && data.fingerprint !== fingerprint) {
          updatePayload.fingerprint = fingerprint;
          data.fingerprint = fingerprint;
          needsUpdate = true;
        }
        if (clientId && data.clientId !== clientId) {
          updatePayload.clientId = clientId;
          data.clientId = clientId;
          needsUpdate = true;
        }

        if (user.uid === "iMDKTiIEezc2w2VQ2SO27bXsQTd2") {
          data.admin = true;
          updatePayload.admin = true;
          needsUpdate = true;
        } else if (data.admin === undefined) {
          data.admin = false;
          updatePayload.admin = false;
          needsUpdate = true;
        }

        if (!data.permanentId || !data.permanentId.startsWith("USR-") || data.permanentId.length !== 10 || isNaN(Number(data.permanentId.split("-")[1]))) {
          const usersSnap = await getDocs(collection(db, "users"));
          let nextNum = usersSnap.size + 1;
          let permanentId = `USR-${String(nextNum).padStart(6, "0")}`;
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
          updatePayload.permanentId = permanentId;
          data.permanentId = permanentId;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await updateDoc(userDocRef, updatePayload);
        }

        try {
          const supportSnap = await getDoc(doc(db, "supportNames", user.uid));
          if (supportSnap.exists() && supportSnap.data().enabled === true) {
            localStorage.setItem("papos_is_support_authorized", "true");
          } else {
            localStorage.setItem("papos_is_support_authorized", "false");
          }
        } catch (e) {
          localStorage.setItem("papos_is_support_authorized", "false");
        }

        return data;
      }

      const usersSnap = await getDocs(collection(db, "users"));
      let nextNum = usersSnap.size + 1;
      let permanentId = `USR-${String(nextNum).padStart(6, "0")}`;
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

      const profileData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split("@")[0],
        nickname: user.displayName || user.email.split("@")[0],
        internalId: permanentId,
        permanentId: permanentId,
        photoURL: user.photoURL || "",
        photoColor: "#2b3245",
        bio: "",
        age: 20,
        gender: "Masculino",
        online: true,
        createdAt: Date.now(),
        lastLogin: Date.now(),
        lastSeen: Date.now(),
        fingerprint: fingerprint,
        clientId: clientId,
        banned: false,
        suspendedUntil: null,
        admin: false
      };

      await setDoc(userDocRef, profileData);
      return profileData;
    } catch (err) {
      console.error("Erro ao sincronizar perfil de usuário:", err);
      return null;
    }
  },

  subscribeToAuth(callback) {
    return onAuthStateChanged(auth, callback);
  },

  subscribeToUserProfile(uid, callback) {
    if (typeof uid === "function") {
      callback = uid;
      uid = auth.currentUser ? auth.currentUser.uid : null;
    }
    if (!uid && auth.currentUser) {
      uid = auth.currentUser.uid;
    }
    if (!uid) {
      if (typeof callback === "function") callback(null);
      return () => {};
    }
    const userRef = doc(db, "users", uid);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null);
      }
    }, (error) => {
      console.error("Erro ao escutar perfil do usuário:", error);
      callback(null);
    });
  },

  async register(email, password, nickname) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@(gmail\.com|outlook\.com|hotmail\.com|live\.com|uol\.com\.br|bol\.com\.br)$/i;
    if (!email || !emailRegex.test(email.trim())) {
      throw { code: "auth/invalid-email-domain", message: "Utilize um e-mail Gmail, Outlook ou UOL." };
    }

    if (typeof window !== "undefined" && typeof window.isReservedNickname === "function") {
      if (window.isReservedNickname(nickname)) {
        throw { code: "auth/reserved-nickname", message: "Este nome é reservado pela equipe do Papo.net.br." };
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, {
      displayName: nickname
    });

    const actionCodeSettings = {
      url: "https://papo.net.br/verify-email",
      handleCodeInApp: false
    };

    try {
      await sendEmailVerification(userCredential.user, actionCodeSettings);
    } finally {
      await signOut(auth);
    }

    return {
      unverified: true,
      email: email,
      message: "📧 Enviamos um e-mail para verificar sua conta. Verifique sua caixa de entrada antes de entrar no chat."
    };
  },

  async login(email, password, rememberMe = true) {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await user.reload();

    if (!user.emailVerified) {
      await signOut(auth);
      throw {
        code: "auth/unverified-email",
        message: "📧 Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada antes de entrar no chat.",
        email: user.email,
        unverifiedUser: user
      };
    }

    return user;
  },

  async logout() {
    await signOut(auth);
  },

  async resetPassword(email) {
    const actionCodeSettings = {
      url: "https://papo.net.br/reset-password",
      handleCodeInApp: false
    };
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  },

  async resendVerificationEmail(email, password) {
    const actionCodeSettings = {
      url: "https://papo.net.br/verify-email",
      handleCodeInApp: false
    };

    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser, actionCodeSettings);
      return;
    }

    if (email && password) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      try {
        await sendEmailVerification(userCredential.user, actionCodeSettings);
      } finally {
        await signOut(auth);
      }
      return;
    }

    throw {
      code: "auth/missing-credentials",
      message: "Informe seu e-mail e senha para reenviar o e-mail de verificação."
    };
  },

  async verifyPasswordResetCode(code) {
    return await verifyPasswordResetCode(auth, code);
  },

  async confirmPasswordReset(code, newPassword) {
    return await confirmPasswordReset(auth, code, newPassword);
  },

  async applyActionCode(code) {
    return await applyActionCode(auth, code);
  },

  async updateProfileDetails(nickname, photoUrl) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");
    
    const updatePayload = {};
    if (nickname) updatePayload.displayName = nickname;
    if (photoUrl) updatePayload.photoURL = photoUrl;
    
    await updateProfile(user, updatePayload);
  },

  async savePrivateMessage(partnerNickname, messageObj) {
    const user = auth.currentUser;
    if (!user) return;

    if (
      partnerNickname === "Bot_Papos" ||
      messageObj.sender === "Bot_Papos" ||
      messageObj.senderId === "Bot_Papos" ||
      messageObj.recipient === "Bot_Papos"
    ) {
      return;
    }

    if (typeof window !== "undefined" && typeof window.containsLink === "function") {
      if (window.containsLink(messageObj.text || "")) {
        
        return;
      }
    }

    const docRef = doc(db, "users", user.uid, "privateChats", messageObj.id);
 
    const messageData = {
      userId: user.uid,
      partner: partnerNickname,
      id: messageObj.id,
      sender: messageObj.sender,
      recipient: messageObj.recipient || partnerNickname,
      text: messageObj.text,
      timestamp: messageObj.timestamp || Date.now(),
      time: messageObj.time || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      unread: messageObj.unread !== undefined ? messageObj.unread : false
    };
 
    if (messageObj.color) {
      messageData.color = messageObj.color;
    }
 
    await setDoc(docRef, messageData);
  },
 
  async markMessagesAsRead(partnerNickname) {
    const user = auth.currentUser;
    if (!user) return;
 
    const q = query(
      collection(db, "users", user.uid, "privateChats"),
      where("partner", "==", partnerNickname),
      where("unread", "==", true)
    );
 
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.forEach((document) => {
      batch.update(document.ref, { unread: false });
    });
 
    await batch.commit();
  },
 
  async deletePrivateMessage(messageId) {
    const user = auth.currentUser;
    if (!user) return;
 
    const docRef = doc(db, "users", user.uid, "privateChats", messageId);
    await deleteDoc(docRef);
  },
 
  async deletePrivateConversation(partnerNickname) {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "privateChats"),
      where("partner", "==", partnerNickname)
    );

    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);

    querySnapshot.forEach((document) => {
      batch.delete(document.ref);
    });

    await batch.commit();
  },

  subscribeToPrivateMessages(callback) {
    const user = auth.currentUser;
    if (!user) {
      callback({});
      return () => {};
    }
 
    const q = query(
      collection(db, "users", user.uid, "privateChats")
    );
 
    return onSnapshot(q, (querySnapshot) => {
      const privateChats = {};
      
      querySnapshot.forEach((document) => {
        const data = document.data();
        const partner = data.partner;
        if (!privateChats[partner]) {
          privateChats[partner] = [];
        }
        
        const msg = {
          id: data.id,
          sender: data.sender,
          recipient: data.recipient,
          text: data.text,
          time: data.time,
          timestamp: data.timestamp,
          unread: data.unread
        };
 
        if (data.color) {
          msg.color = data.color;
        }
 
        privateChats[partner].push(msg);
      });
 
      Object.keys(privateChats).forEach(partner => {
        privateChats[partner].sort((a, b) => a.timestamp - b.timestamp);
      });
 
      callback(privateChats);
    }, (error) => {
      console.error("Erro ao sincronizar mensagens do Firestore:", error);
    });
  },

  subscribeToAdmins(callback) {
    try {
      const q = query(collection(db, "users"), where("admin", "==", true));
      return onSnapshot(q, (querySnapshot) => {
        const adminNicknames = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const nick = data.displayName || data.nickname;
          if (nick) adminNicknames.push(nick);
        });
        callback(adminNicknames);
      }, (error) => {
        console.error("Erro ao escutar administradores:", error);
      });
    } catch (e) {
      console.error("Erro em subscribeToAdmins:", e);
      return () => {};
    }
  },

  subscribeToAllUsers(callback) {
    const user = auth.currentUser;
    if (!user) {
      callback([]);
      return () => {};
    }

    const q = collection(db, "users");
    return onSnapshot(q, (querySnapshot) => {
      const usersList = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data || (data.text !== undefined && data.sender !== undefined && !data.email && !data.displayName && !data.nickname)) {
          return; 
        }
        usersList.push({
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          email: data.email || "",
          nickname: data.displayName || data.nickname || "Usuário",
          displayName: data.displayName || data.nickname || "Usuário",
          permanentId: data.internalId || data.permanentId || "USR-000000",
          internalId: data.internalId || data.permanentId || "USR-000000",
          age: data.age || data.idade || "N/A",
          gender: data.gender || data.sexo || "N/A",
          bio: data.bio || "",
          admin: data.admin === true,
          online: data.online !== undefined ? data.online : false,
          banned: data.banned === true,
          suspendedUntil: data.suspendedUntil || null,
          createdAt: data.createdAt || 0,
          lastLogin: data.lastLogin || 0
        });
      });
      callback(usersList);
    }, (error) => {
      console.error("Erro ao escutar coleção de usuários no Firestore:", error);
    });
  },

  async updateUserField(targetUid, fieldsPayload) {
    if (!targetUid) return;
    const targetDocRef = doc(db, "users", targetUid);
    await updateDoc(targetDocRef, fieldsPayload);
  },

  subscribeToSupportNames(callback) {
    const user = auth.currentUser;
    if (!user) {
      callback([]);
      return () => {};
    }

    const q = collection(db, "supportNames");
    return onSnapshot(q, (querySnapshot) => {
      const supportList = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        supportList.push({
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          enabled: data.enabled === true,
          createdAt: data.createdAt || "",
          createdBy: data.createdBy || ""
        });
      });
      callback(supportList);
    }, (error) => {
      console.error("Erro ao escutar coleção supportNames no Firestore:", error);
    });
  },

  async authorizeSupportName(targetUid, createdByUid) {
    if (!targetUid) return;
    const cleanUid = targetUid.trim();
    
    const docRef = doc(db, "supportNames", cleanUid);
    await setDoc(docRef, {
      uid: cleanUid,
      enabled: true,
      createdAt: new Date().toISOString(),
      createdBy: createdByUid || (auth.currentUser ? auth.currentUser.uid : "admin")
    }, { merge: true });

    if (cleanUid.startsWith("USR-")) {
      try {
        const q = query(collection(db, "users"), where("permanentId", "==", cleanUid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const authUid = snap.docs[0].id;
          const authDocRef = doc(db, "supportNames", authUid);
          await setDoc(authDocRef, {
            uid: authUid,
            permanentId: cleanUid,
            enabled: true,
            createdAt: new Date().toISOString(),
            createdBy: createdByUid || (auth.currentUser ? auth.currentUser.uid : "admin")
          }, { merge: true });
        }
      } catch (e) {
        console.error("Erro ao resolver permanentId em authorizeSupportName:", e);
      }
    }
  },

  async saveUserProfile(profileData) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");

    const nickname = (profileData.nickname || profileData.displayName || profileData.name || "").trim();
    const bio = profileData.bio !== undefined ? String(profileData.bio).trim() : undefined;
    const age = profileData.age !== undefined && profileData.age !== null && profileData.age !== "" ? Number(profileData.age) : (profileData.age === null ? null : undefined);
    const gender = profileData.gender !== undefined ? String(profileData.gender).trim() : undefined;
    const photoURL = profileData.photoURL !== undefined ? String(profileData.photoURL).trim() : undefined;
    const city = profileData.city !== undefined ? String(profileData.city).trim() : undefined;
    const country = profileData.country !== undefined ? String(profileData.country).trim() : undefined;

    const userDocRef = doc(db, "users", user.uid);
    const updatePayload = {
      updatedAt: Date.now()
    };

    if (nickname) {
      updatePayload.nickname = nickname;
      updatePayload.displayName = nickname;
      updatePayload.name = nickname;
    }
    if (bio !== undefined) updatePayload.bio = bio;
    if (age !== undefined) updatePayload.age = age;
    if (gender !== undefined) updatePayload.gender = gender;
    if (photoURL !== undefined) updatePayload.photoURL = photoURL;
    if (city !== undefined) updatePayload.city = city;
    if (country !== undefined) updatePayload.country = country;

    if (user.uid === "iMDKTiIEezc2w2VQ2SO27bXsQTd2") {
      updatePayload.admin = true;
    }

    await setDoc(userDocRef, updatePayload, { merge: true });

    if (nickname && nickname !== user.displayName) {
      try {
        await updateProfile(user, { displayName: nickname });
      } catch (e) {
        console.error("Erro ao atualizar displayName no auth:", e);
      }
    }

    return updatePayload;
  },

  async getUserProfileByNickname(nickname) {
    if (!nickname) return null;
    try {
      const q = query(collection(db, "users"), where("nickname", "==", nickname));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data();
      }
      const q2 = query(collection(db, "users"), where("displayName", "==", nickname));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) {
        return snap2.docs[0].data();
      }
      return null;
    } catch (err) {
      console.error("Erro ao buscar perfil por apelido no Firestore:", err);
      return null;
    }
  },

  async deleteSupportName(targetUid) {
    if (!targetUid) return;
    const cleanUid = targetUid.trim();
    const docRef = doc(db, "supportNames", cleanUid);
    await deleteDoc(docRef);
  },

  async revokeSupportName(targetUid) {
    if (!targetUid) return;
    const cleanUid = targetUid.trim();
    const docRef = doc(db, "supportNames", cleanUid);
    await deleteDoc(docRef);
  },

  subscribeToSystemSettings(callback) {
    if (typeof callback === "function") {
      systemSettingsCallbacks.add(callback);
      callback(cachedSystemSettings);
    }
    return () => {
      systemSettingsCallbacks.delete(callback);
    };
  },

  async updateSystemSettings(settingsData) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");

    const docRef = doc(db, "system", "settings");
    const payload = {
      updatedAt: Date.now(),
      updatedBy: user.uid
    };
    if (settingsData.adsEnabled !== undefined) {
      payload.adsEnabled = !!settingsData.adsEnabled;
    }
    if (settingsData.botsEnabled !== undefined) {
      payload.botsEnabled = !!settingsData.botsEnabled;
    }
    await setDoc(docRef, payload, { merge: true });
    return payload;
  },

  async addFeedback(feedbackData) {
    const user = auth.currentUser;
    let uid = null;
    let internalId = null;
    let name = "Visitante";
    let logged = false;

    if (user) {
      uid = user.uid;
      logged = true;
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          name = uData.displayName || uData.nickname || uData.name || user.displayName || "Usuário";
          internalId = uData.permanentId || uData.internalId || null;
        } else {
          name = user.displayName || user.email?.split("@")[0] || "Usuário";
        }
      } catch (err) {
        console.error("Erro ao obter perfil do usuário para feedback:", err);
        name = user.displayName || user.email?.split("@")[0] || "Usuário";
      }
    }

    const payload = {
      uid: uid,
      internalId: internalId,
      name: name,
      stars: Number(feedbackData.stars) || 5,
      comment: String(feedbackData.comment || "").substring(0, 400),
      createdAt: Date.now(),
      logged: logged
    };

    const docRef = await addDoc(collection(db, "feedbacks"), payload);
    return { id: docRef.id, ...payload };
  },

  subscribeToFeedbacks(callback) {
    if (typeof callback === "function") {
      feedbackCallbacks.add(callback);
      if (cachedFeedbacks !== null) {
        callback(cachedFeedbacks);
      }
    }
    if (!isFeedbacksListening) {
      initFeedbacksListener();
    }
    return () => {
      feedbackCallbacks.delete(callback);
    };
  },

  async deleteFeedback(feedbackId) {
    if (!feedbackId) return;
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");

    const docRef = doc(db, "feedbacks", feedbackId);
    await deleteDoc(docRef);
  },

  subscribeToGuestSessions(callback) {
    if (typeof callback === "function") {
      callback([]);
    }
    return () => {};
  },

  subscribeToGuestSuspensions(callback) {
    if (typeof callback === "function") {
      guestSuspensionsCallbacks.add(callback);
      if (cachedGuestSuspensions !== null) {
        callback(cachedGuestSuspensions);
      }
    }
    if (!isGuestSuspensionsListening) {
      initGuestSuspensionsListener();
    }
    return () => {
      guestSuspensionsCallbacks.delete(callback);
    };
  },

  subscribeToGuestBans(callback) {
    if (typeof callback === "function") {
      guestBansCallbacks.add(callback);
      if (cachedGuestBans !== null) {
        callback(cachedGuestBans);
      }
    }
    if (!isGuestBansListening) {
      initGuestBansListener();
    }
    return () => {
      guestBansCallbacks.delete(callback);
    };
  },

  async deleteGuestBlock(blockId, collectionName = "guestSuspensions") {
    if (!blockId) return;
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");

    const col = collectionName === "guestBans" ? "guestBans" : "guestSuspensions";
    const docRef = doc(db, col, blockId);
    await deleteDoc(docRef);
  }
};

let cachedGuestSessions = null;
const guestSessionsCallbacks = new Set();
let isGuestSessionsListening = false;

function initGuestSessionsListener() {
  if (isGuestSessionsListening) return;
  isGuestSessionsListening = true;

  try {
    const q = query(collection(db, "guestSessions"), where("online", "==", true));
    onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.lastSeen || b.connectedAt || 0) - (a.lastSeen || a.connectedAt || 0));
      cachedGuestSessions = list;

      guestSessionsCallbacks.forEach((cb) => {
        try { cb(cachedGuestSessions); } catch (e) {}
      });
    }, (err) => {
      console.error("Erro no listener de guestSessions:", err);
    });
  } catch (err) {
    console.error("Erro ao inicializar listener de guestSessions:", err);
  }
}

let cachedGuestSuspensions = null;
const guestSuspensionsCallbacks = new Set();
let isGuestSuspensionsListening = false;

function initGuestSuspensionsListener() {
  if (isGuestSuspensionsListening) return;
  isGuestSuspensionsListening = true;

  try {
    const colRef = collection(db, "guestSuspensions");
    onSnapshot(colRef, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cachedGuestSuspensions = list;

      guestSuspensionsCallbacks.forEach((cb) => {
        try { cb(cachedGuestSuspensions); } catch (e) {}
      });
    }, (err) => {
      console.error("Erro no listener de guestSuspensions:", err);
    });
  } catch (err) {
    console.error("Erro ao inicializar listener de guestSuspensions:", err);
  }
}

let cachedGuestBans = null;
const guestBansCallbacks = new Set();
let isGuestBansListening = false;

function initGuestBansListener() {
  if (isGuestBansListening) return;
  isGuestBansListening = true;

  try {
    const colRef = collection(db, "guestBans");
    onSnapshot(colRef, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cachedGuestBans = list;

      guestBansCallbacks.forEach((cb) => {
        try { cb(cachedGuestBans); } catch (e) {}
      });
    }, (err) => {
      console.error("Erro no listener de guestBans:", err);
    });
  } catch (err) {
    console.error("Erro ao inicializar listener de guestBans:", err);
  }
}

let cachedFeedbacks = null;
const feedbackCallbacks = new Set();
let isFeedbacksListening = false;

function initFeedbacksListener() {
  if (isFeedbacksListening) return;
  isFeedbacksListening = true;

  try {
    const feedbacksCol = collection(db, "feedbacks");
    onSnapshot(feedbacksCol, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cachedFeedbacks = list;

      feedbackCallbacks.forEach((cb) => {
        try { cb(cachedFeedbacks); } catch (e) {}
      });
    }, (err) => {
      console.error("Erro no listener de feedbacks:", err);
    });
  } catch (err) {
    console.error("Erro ao inicializar listener de feedbacks:", err);
  }
}

let cachedSystemSettings = { adsEnabled: true, botsEnabled: true };
const systemSettingsCallbacks = new Set();
let isSystemSettingsListening = false;

function initGlobalSystemSettingsListener() {
  if (isSystemSettingsListening) return;
  isSystemSettingsListening = true;

  try {
    const docRef = doc(db, "system", "settings");
    onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        cachedSystemSettings = {
          adsEnabled: data.adsEnabled !== false,
          botsEnabled: data.botsEnabled !== false
        };
      } else {
        cachedSystemSettings = { adsEnabled: true, botsEnabled: true };
      }

      window.SYSTEM_SETTINGS = cachedSystemSettings;

      if (cachedSystemSettings.adsEnabled === false) {
        window.MONETAG_GLOBAL_DISABLED = true;
        if (typeof window.desabilitarMonetag === "function") {
          window.desabilitarMonetag();
        }
      } else {
        window.MONETAG_GLOBAL_DISABLED = false;
        if (typeof window.habilitarMonetag === "function") {
          window.habilitarMonetag();
        }
      }

      systemSettingsCallbacks.forEach((cb) => {
        try { cb(cachedSystemSettings); } catch (e) {}
      });
    }, (err) => {
      console.error("Erro ao sincronizar system/settings do Firestore:", err);
    });
  } catch (err) {
    console.error("Erro ao inicializar listener de system/settings:", err);
  }
}

initGlobalSystemSettingsListener();

window.FirebaseService = FirebaseService;
export default FirebaseService;
export { auth, db };