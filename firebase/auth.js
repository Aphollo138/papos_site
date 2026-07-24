import { auth, db } from "./firebase.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  updateProfile, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
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
  // Get active user from Firebase Auth
  getCurrentUser() {
    return auth.currentUser;
  },

  // Sync user profile to Firestore, check bans/suspensions, and return profile data
  async syncUserProfile() {
    const user = auth.currentUser;
    if (!user) return null;

    const userDocRef = doc(db, "users", user.uid);
    try {
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
        const updatePayload = {};

        if (data.admin === undefined) {
          data.admin = false;
          updatePayload.admin = false;
          needsUpdate = true;
        }

        // Auto-migrate old permanentId format to new USR-000001 format
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

        return data;
      }

      // Generate a brand new unique permanent ID (format USR-000001)
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

  // Listen to Auth State Changes
  subscribeToAuth(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Register user
  async register(email, password, nickname) {
    // 1. Create the account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. Update their display name
    await updateProfile(user, {
      displayName: nickname
    });
    
    return user;
  },

  // Login user
  async login(email, password, rememberMe = true) {
    // 1. Set persistence based on rememberMe checkbox
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    
    // 2. Sign in
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  // Logout user
  async logout() {
    await signOut(auth);
  },

  // Forgot Password / Reset Password
  async resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  },

  // Update profile details (nickname, photoUrl)
  async updateProfileDetails(nickname, photoUrl) {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");
    
    const updatePayload = {};
    if (nickname) updatePayload.displayName = nickname;
    if (photoUrl) updatePayload.photoURL = photoUrl;
    
    await updateProfile(user, updatePayload);
  },

  // --- FIRESTORE PRIVATE CHATS HISTORIES ---
 
  // Save a private message (for logged-in user inbox/outbox history)
  async savePrivateMessage(partnerNickname, messageObj) {
    const user = auth.currentUser;
    if (!user) return;

    // Strict guard: DO NOT save bot messages in Firestore privateChats
    if (
      partnerNickname === "Bot_Papos" ||
      messageObj.sender === "Bot_Papos" ||
      messageObj.senderId === "Bot_Papos" ||
      messageObj.recipient === "Bot_Papos"
    ) {
      return;
    }

    // Use a unique document path under the user's subcollection
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
 
  // Mark all messages from a partner as read
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
 
  // Delete a private message document
  async deletePrivateMessage(messageId) {
    const user = auth.currentUser;
    if (!user) return;
 
    const docRef = doc(db, "users", user.uid, "privateChats", messageId);
    await deleteDoc(docRef);
  },
 
  // Delete an entire private conversation thread with partnerNickname
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

  // Real-time listener for user's private messages
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
 
      // Sort messages for each partner by timestamp
      Object.keys(privateChats).forEach(partner => {
        privateChats[partner].sort((a, b) => a.timestamp - b.timestamp);
      });
 
      callback(privateChats);
    }, (error) => {
      console.error("Erro ao sincronizar mensagens do Firestore:", error);
    });
  },

  // Real-time listener for user profile document to check ban, suspension, and admin statuses dynamically
  subscribeToUserProfile(callback) {
    const user = auth.currentUser;
    if (!user) {
      callback(null);
      return () => {};
    }

    const userDocRef = doc(db, "users", user.uid);
    return onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null);
      }
    }, (error) => {
      console.error("Erro ao sincronizar perfil do usuário do Firestore:", error);
    });
  },

  // Real-time listener for users with admin == true
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

  // Real-time listener exclusively for 'users' collection (Admin panel)
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
          return; // Skip non-user documents
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

  // Directly update user document fields in Firestore
  async updateUserField(targetUid, fieldsPayload) {
    if (!targetUid) return;
    const targetDocRef = doc(db, "users", targetUid);
    await updateDoc(targetDocRef, fieldsPayload);
  },

  // --- SUPPORT TICKETS (CHAMADOS) ---

  // Create a new support ticket in collection 'supportTickets'
  async createSupportTicket(ticketData) {
    const user = auth.currentUser;
    if (!user) throw new Error("É necessário estar logado para abrir um chamado de suporte.");

    // Count user's existing tickets + timestamp/random string for unique friendly ticket ID (e.g. SUP-100001)
    let userTicketCount = 1;
    try {
      const userTicketsQuery = query(collection(db, "supportTickets"), where("uid", "==", user.uid));
      const userTicketsSnap = await getDocs(userTicketsQuery);
      userTicketCount = userTicketsSnap.size + 1;
    } catch (e) {
      console.warn("Could not fetch user ticket count:", e);
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const ticketId = `SUP-${String(userTicketCount).padStart(3, "0")}${randomSuffix}`;

    const payload = {
      ticketId,
      uid: user.uid,
      displayName: user.displayName || (user.email ? user.email.split("@")[0] : "Usuário"),
      email: (ticketData.email || user.email || "").trim(),
      subject: (ticketData.subject || "").trim().slice(0, 100),
      category: ticketData.category || "BUG",
      message: (ticketData.message || "").trim().slice(0, 3000),
      status: "aberto",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      closedAt: null,
      closedBy: null,
      adminReply: null
    };

    const docRef = await addDoc(collection(db, "supportTickets"), payload);
    return { id: docRef.id, ...payload };
  },

  // Real-time listener for user's own support tickets
  subscribeToUserTickets(uid, callback) {
    if (!uid) return () => {};
    const q = query(collection(db, "supportTickets"), where("uid", "==", uid));
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    }, (error) => {
      console.error("Erro ao escutar chamados do usuário no Firestore:", error);
    });
  },

  // Real-time listener for all support tickets (admin use)
  subscribeToAllTickets(callback) {
    const q = collection(db, "supportTickets");
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    }, (error) => {
      console.error("Erro ao escutar todos os chamados no Firestore:", error);
    });
  },

  // Admin reply to support ticket
  async replyToSupportTicket(ticketDocId, adminReply) {
    if (!ticketDocId) return;
    const ticketRef = doc(db, "supportTickets", ticketDocId);
    const snap = await getDoc(ticketRef);
    const currentStatus = snap.exists() ? snap.data().status : "aberto";
    const newStatus = currentStatus === "aberto" ? "em_andamento" : currentStatus;
    
    await updateDoc(ticketRef, {
      adminReply: adminReply.trim(),
      status: newStatus,
      updatedAt: Date.now()
    });
  },

  // Admin close support ticket
  async closeSupportTicket(ticketDocId, closedBy) {
    if (!ticketDocId) return;
    const ticketRef = doc(db, "supportTickets", ticketDocId);
    await updateDoc(ticketRef, {
      status: "encerrado",
      closedAt: Date.now(),
      closedBy: closedBy || "Administrador",
      updatedAt: Date.now()
    });
  }
};

// Expose services on the window object
window.FirebaseService = FirebaseService;
export default FirebaseService;
export { auth, db };
