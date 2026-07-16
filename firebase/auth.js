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
  getDocs, 
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

  
  subscribeToAuth(callback) {
    return onAuthStateChanged(auth, callback);
  },

  
  async register(email, password, nickname) {
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    
    await updateProfile(user, {
      displayName: nickname
    });
    
    return user;
  },

  
  async login(email, password, rememberMe = true) {
    
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  
  async logout() {
    await signOut(auth);
  },

  
  async resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
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
    if (!user || !user.email) return;

    
    const docId = `${user.email}_${messageObj.id}`;
    const docRef = doc(db, "privateChats", docId);

    const messageData = {
      userEmail: user.email,
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
    if (!user || !user.email) return;

    const q = query(
      collection(db, "privateChats"),
      where("userEmail", "==", user.email),
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
    if (!user || !user.email) return;

    const docId = `${user.email}_${messageId}`;
    const docRef = doc(db, "privateChats", docId);
    await deleteDoc(docRef);
  },

  
  subscribeToPrivateMessages(callback) {
    const user = auth.currentUser;
    if (!user || !user.email) {
      callback({});
      return () => {};
    }

    const q = query(
      collection(db, "privateChats"),
      where("userEmail", "==", user.email)
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
  }
};


window.FirebaseService = FirebaseService;
export default FirebaseService;
export { auth, db };
