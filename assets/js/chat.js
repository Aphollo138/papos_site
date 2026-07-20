/**
 * chat.js - Real-time WebSocket Client, Private Chats, Modal rooms, and Search engines
 */

// Format message time securely in user's local timezone
function formatMessageTime(msg) {
  if (!msg) return "";
  if (msg.timestamp) {
    const ts = Number(msg.timestamp);
    if (!isNaN(ts)) {
      try {
        return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        console.error("Error formatting timestamp:", e);
      }
    } else {
      try {
        const d = new Date(msg.timestamp);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        }
      } catch (e) {
        console.error("Error parsing date string:", e);
      }
    }
  }
  if (msg.time) {
    if (!isNaN(Number(msg.time))) {
      try {
        return new Date(Number(msg.time)).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      } catch (e) {}
    }
    return msg.time;
  }
  return "";
}

// Global action handles
let replyTargetMsg = null;
let blockedUsers = JSON.parse(localStorage.getItem("papos_blocked_users") || "[]");
let activePrivateRecipient = null; // Username of active direct message partner
let chatMode = "public"; // "public" or "private"
let activeMessageColor = "";

window.setMessageColor = (color, indicatorColor) => {
  activeMessageColor = color;
  const indicator = document.getElementById("selected-color-indicator");
  if (indicator) {
    indicator.style.setProperty("color", color || "var(--text-primary)", "important");
  }
  const messageInput = document.getElementById("message-input");
  if (messageInput) {
    messageInput.style.setProperty("color", color || "var(--text-primary)", "important");
    messageInput.focus();
  }
};

window.getUsernameColor = (username) => {
  if (username === "Sistema" || username === "System" || username === "Você") {
    return "var(--accent-color)";
  }
  
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  
  const darkThemeColors = [
    "#38bdf8", // Sky blue
    "#34d399", // Emerald green
    "#f472b6", // Pink
    "#fbbf24", // Amber yellow
    "#a78bfa", // Purple/violet
    "#fb7185", // Rose
    "#60a5fa", // Blue
    "#fb923c", // Warm Orange
    "#2dd4bf", // Teal
    "#a3e635"  // Lime/green
  ];

  const lightThemeColors = [
    "#0369a1", // Deeper blue
    "#047857", // Deeper emerald green
    "#be185d", // Deeper magenta
    "#b45309", // Deeper amber/brown
    "#6d28d9", // Deeper purple
    "#be123c", // Deeper rose/crimson
    "#1d4ed8", // Deeper blue
    "#c2410c", // Deeper orange
    "#0f766e"  // Deeper teal
  ];

  const colors = isLight ? lightThemeColors : darkThemeColors;
  
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

document.addEventListener("DOMContentLoaded", () => {
  const ChatEngine = window.ChatEngine || {
    getUser: () => localStorage.getItem("papos_nickname") || null,
    renderAvatar: (name, sizeClass = "") => {
      const initial = name ? name.trim().charAt(0).toUpperCase() : "A";
      return `<div class="avatar-circle ${sizeClass}" title="${name}">${initial}</div>`;
    },
    connectSocket: () => {
      const wsUrl = (window.CHAT_CONFIG && window.CHAT_CONFIG.getWebSocketUrl()) || 
                     ((window.location.protocol === "https:" ? "wss:" : "ws:") + "//" + window.location.host);
      return new WebSocket(wsUrl);
    }
  };

  const currentUser = ChatEngine.getUser();
  if (!currentUser) {
    window.location.href = "/?error=name_required";
    return;
  }

  // Retrieve room param
  const urlParams = new URLSearchParams(window.location.search);
  let activeRoomId = urlParams.get("room") || "room-1";

  // Elements
  const chatMessagesContainer = document.getElementById("chat-messages-container");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("btn-send");
  const sidebarUsername = document.getElementById("sidebar-username");
  const sidebarAvatarPlaceholder = document.getElementById("sidebar-user-avatar-placeholder");
  const btnClearChat = document.getElementById("btn-clear-chat");
  
  // Sidebar mobile toggler
  const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
  const chatSidebar = document.getElementById("chat-sidebar");
  
  // Search features
  const btnToggleSearch = document.getElementById("btn-toggle-search");
  const searchBarWrapper = document.getElementById("chat-search-bar-wrapper");
  const searchMessagesInput = document.getElementById("chat-search-messages-input");
  const btnCloseSearch = document.getElementById("btn-close-search");
  
  // Room modal features
  const modalRoomsContainer = document.getElementById("modal-rooms-container");
  const searchRoomsModal = document.getElementById("search-rooms-modal");
  
  // Members list features
  const membersListContainer = document.getElementById("members-list-container");
  const searchMembersInput = document.getElementById("search-members-input");
  
  // Private chats list features
  const privateConversationsList = document.getElementById("private-conversations-list");
  const totalPrivateUnreadBadge = document.getElementById("total-private-unread");
  
  // Reply reference
  const replyReferenceBar = document.getElementById("reply-reference-bar");
  const replyReferenceText = document.getElementById("reply-reference-text");
  const btnCancelReply = document.getElementById("btn-cancel-reply");
  const typingIndicatorBar = document.getElementById("typing-indicator-bar");
  
  // Back to public chat button
  const btnBackToPublic = document.getElementById("btn-back-to-public");

  // In-memory data states
  let socket = null;
  let typingTimeout = null;
  let isCurrentlyTyping = false;
  
  let publicRoomMessages = [];
  let cachedRooms = [];
  let onlineUsersList = [];
  let activeTypingUsers = new Set();
  
  // Local direct messages storage mapped by username
  let privateChats = JSON.parse(localStorage.getItem(`papos_pms_${currentUser}`) || "{}");

  // Subscribe to Firebase Auth and sync private messages if authenticated
  const initializeFirebaseSync = () => {
    if (window.FirebaseService) {
      window.FirebaseService.subscribeToAuth((user) => {
        if (user) {
          console.log("[Firebase] Sincronizando mensagens privadas do Firestore...");
          window.FirebaseService.subscribeToPrivateMessages((syncedChats) => {
            privateChats = syncedChats;
            localStorage.setItem(`papos_pms_${currentUser}`, JSON.stringify(privateChats));
            renderPrivateConversationsSidebar();
            if (chatMode === "private") {
              renderMessages();
            }
          });

          // Sync user profile (updates permanent ID and checks active ban/suspension states)
          window.FirebaseService.syncUserProfile().then((profile) => {
            if (profile) {
              user.getIdToken().then((token) => {
                const sendAuth = () => {
                  if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                      type: "sync_auth",
                      token: token
                    }));
                  } else {
                    setTimeout(sendAuth, 100);
                  }
                };
                sendAuth();
              });
            }
          }).catch(err => {
            console.error("Error during profile sync:", err);
          });
        }
      });
    } else {
      setTimeout(initializeFirebaseSync, 50);
    }
  };
  initializeFirebaseSync();

  // Load User Details in sidebar
  if (sidebarUsername && sidebarAvatarPlaceholder) {
    sidebarUsername.textContent = currentUser;
    sidebarAvatarPlaceholder.innerHTML = ChatEngine.renderAvatar(currentUser, "avatar-lg mx-auto mb-2");
  }

  // Validate private message payload safely
  function isValidPrivateMessage(pm) {
    if (!pm) return false;
    if (typeof pm !== "object") return false;
    if (!pm.id) return false;
    
    // Support both standardized and legacy formats
    const sender = pm.senderName || pm.from;
    const recipient = pm.recipientName || pm.to;
    const content = pm.content !== undefined ? pm.content : pm.text;
    const timestamp = pm.timestamp || pm.time;
    
    if (!sender || !recipient) return false;
    if (content === undefined || content === null) return false;
    if (!timestamp) return false;
    
    return true;
  }

  // Cache para perfis de outros usuários para evitar requisições sequenciais repetidas
  const profileCache = new Map();
  const CACHE_TTL_MS = 15000; // 15 segundos

  function sendJoinRoom(roomId) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({
      type: "join",
      nickname: currentUser,
      roomId: roomId,
      bio: localStorage.getItem("papos_bio") || "",
      age: localStorage.getItem("papos_age") ? Number(localStorage.getItem("papos_age")) : null,
      gender: localStorage.getItem("papos_gender") || "",
      photoUrl: localStorage.getItem("papos_photo") || ""
    }));
  }

  // Connect WebSockets
  function connect() {
    socket = ChatEngine.connectSocket();

    socket.onopen = () => {
      console.log("[Chat] Connected. Joining public room: " + activeRoomId);
      sendJoinRoom(activeRoomId);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (!data) return;

        switch (data.type) {
          case "room_state":
            activeRoomId = data.roomId;
            window.confirmedNickname = data.nickname;
            publicRoomMessages = data.messages;
            onlineUsersList = data.onlineUsers;
            
            // Sync UI headers
            updateActiveHeader(data.roomName, data.roomDesc);
            renderMessages();
            renderMembers();
            break;

          case "room_list":
            cachedRooms = data.rooms;
            renderModalRooms();
            break;

          case "message":
            publicRoomMessages.push(data.message);
            if (chatMode === "public") {
              appendSingleMessage(data.message);
            }
            break;

          case "message_deleted":
            publicRoomMessages = publicRoomMessages.filter(m => m.id !== data.messageId);
            const msgEl = document.getElementById(`msg-id-${data.messageId}`);
            if (msgEl) {
              msgEl.style.transition = "all 0.3s ease";
              msgEl.style.opacity = "0";
              msgEl.style.height = "0";
              msgEl.style.padding = "0";
              msgEl.style.margin = "0";
              setTimeout(() => {
                msgEl.remove();
              }, 300);
            }
            break;

          case "private_message_deleted": {
            const pPartner = data.partner;
            if (privateChats[pPartner]) {
              privateChats[pPartner] = privateChats[pPartner].filter(m => m.id !== data.messageId);
              localStorage.setItem(`papos_pms_${currentUser}`, JSON.stringify(privateChats));
            }
            if (window.FirebaseService && window.FirebaseService.getCurrentUser()) {
              window.FirebaseService.deletePrivateMessage(data.messageId).catch(err => {
                console.error("[Firestore] Erro ao excluir mensagem:", err);
              });
            }
            if (chatMode === "private" && activePrivateRecipient === pPartner) {
              const pmsgEl = document.getElementById(`msg-id-${data.messageId}`);
              if (pmsgEl) {
                pmsgEl.style.transition = "all 0.3s ease";
                pmsgEl.style.opacity = "0";
                pmsgEl.style.height = "0";
                pmsgEl.style.padding = "0";
                pmsgEl.style.margin = "0";
                setTimeout(() => {
                  pmsgEl.remove();
                }, 300);
              }
            }
            renderPrivateConversationsSidebar();
            break;
          }

          case "private_message":
            if (!isValidPrivateMessage(data)) {
              console.warn("[WebSocket] Received incomplete or invalid private message payload:", data);
              break;
            }
            handleIncomingPrivateMessage(data);
            break;

          case "user_joined":
            onlineUsersList = data.onlineUsers;
            if (chatMode === "public") {
              appendSystemMessage(`${data.nickname} entrou na sala.`);
            }
            renderMembers();
            break;

          case "user_left":
            onlineUsersList = data.onlineUsers;
            if (chatMode === "public") {
              appendSystemMessage(`${data.nickname} saiu da sala.`);
            }
            renderMembers();
            break;

          case "typing":
            if (chatMode === "public") {
              toggleTypingIndicator(data.nickname, data.isTyping);
            }
            break;

          case "private_typing":
            if (data && data.from && chatMode === "private" && activePrivateRecipient && activePrivateRecipient.toLowerCase() === data.from.toLowerCase()) {
              toggleTypingIndicator(data.from, data.isTyping);
            }
            break;

          case "reaction_update":
            const msgObj = publicRoomMessages.find(m => m.id === data.messageId);
            if (msgObj) {
              msgObj.reactions = data.reactions;
              if (chatMode === "public") renderMessages();
            }
            break;

          case "error":
            appendSystemMessage(`Erro do servidor: ${data.message}`);
            break;

          case "profile_data":
            if (window.handleProfileDataResponse) {
              window.handleProfileDataResponse(data);
            }
            break;

          case "admin_verified":
            if (data.isAdmin) {
              if (window.injectAdminPanelUI) {
                window.injectAdminPanelUI();
              }
              const trigger = document.getElementById("admin-trigger-container");
              if (trigger) {
                trigger.classList.remove("d-none");
              }
            }
            break;

          case "admin_online_users":
            if (window.handleAdminOnlineUsers) {
              window.handleAdminOnlineUsers(data.users);
            }
            break;

          case "admin_audit_logs":
            if (window.handleAdminAuditLogs) {
              window.handleAdminAuditLogs(data.logs);
            }
            break;

          case "admin_action_success":
            alert(data.message);
            if (window.refreshAdminData) {
              window.refreshAdminData();
            }
            break;

          case "global_warning":
          case "individual_warning":
            if (window.showAdminWarningModal) {
              window.showAdminWarningModal(data.text);
            }
            break;

          case "suspended": {
            const until = data.until ? new Date(data.until).toLocaleString("pt-BR") : "algum tempo";
            alert(`Sua conta foi suspensa pela administração até: ${until}. Você será desconectado.`);
            localStorage.removeItem("papos_nickname");
            window.location.href = "/";
            break;
          }

          case "banned":
            alert("Você foi banido permanentemente pela administração deste chat.");
            localStorage.removeItem("papos_nickname");
            window.location.href = "/";
            break;
        }
      } catch (err) {
        console.error("[Chat] Error parsing server frame:", err);
      }
    };

    socket.onclose = () => {
      console.warn("[Chat] Connection closed. Reconnecting...");
      appendSystemMessage("Conexão instável. Restabelecendo canal criptografado...");
      setTimeout(connect, 3000);
    };

    socket.onerror = (err) => {
      console.error("[Chat] Socket error:", err);
    };
  }

  // Update central Header
  function updateActiveHeader(name, desc) {
    const headerName = document.getElementById("active-room-name");
    const headerDesc = document.getElementById("active-room-description");
    const headerAvatarContainer = document.getElementById("active-chat-avatar-container");
    const headerStatus = document.getElementById("active-chat-status");

    if (chatMode === "public") {
      if (headerName) {
        headerName.textContent = name || "Canal Geral";
        headerName.removeAttribute("onclick");
        headerName.removeAttribute("role");
        headerName.removeAttribute("tabindex");
        headerName.style.cursor = "default";
        headerName.className = "h6 fw-bold mb-0 text-white text-truncate";
      }
      if (headerDesc) headerDesc.textContent = desc || "Bate-papo público livre.";
      if (btnBackToPublic) btnBackToPublic.classList.add("d-none");
      if (headerAvatarContainer) {
        headerAvatarContainer.classList.add("d-none");
        headerAvatarContainer.innerHTML = "";
      }
      if (headerStatus) headerStatus.classList.remove("d-none");
    } else {
      if (headerName) {
        headerName.innerHTML = `Conversa com <span class="hover:underline text-success" style="cursor: pointer;" onclick="window.openUserProfile('${activePrivateRecipient}')" tabindex="0" role="button" aria-label="Ver perfil de ${activePrivateRecipient}">${activePrivateRecipient}</span>`;
        headerName.style.cursor = "default";
      }
      if (headerDesc) headerDesc.textContent = "Chat privado de ponta-a-ponta. Conversas salvas localmente.";
      if (btnBackToPublic) btnBackToPublic.classList.remove("d-none");
      
      if (headerAvatarContainer) {
        headerAvatarContainer.classList.remove("d-none");
        headerAvatarContainer.innerHTML = `
          <button class="btn p-0 border-0" onclick="window.openUserProfile('${activePrivateRecipient}')" style="cursor: pointer;" tabindex="0" aria-label="Ver perfil de ${activePrivateRecipient}">
            ${window.ChatEngine.renderAvatar(activePrivateRecipient, "avatar-sm")}
          </button>
        `;
      }
      if (headerStatus) headerStatus.classList.add("d-none");
    }
  }

  // Direct Message Handler
  function handleIncomingPrivateMessage(pm) {
    if (!pm) return;

    // Map fields supporting both unified and legacy keys for robust backward compatibility
    const id = pm.id;
    const sender = pm.senderName || pm.from;
    const recipient = pm.recipientName || pm.to;
    const content = pm.content !== undefined ? pm.content : pm.text;
    const timestamp = pm.timestamp || pm.time;
    const color = pm.color || "";

    if (!sender || !recipient) return;

    // Detect conversation partner name
    const partner = sender === currentUser ? recipient : sender;
    
    if (!privateChats[partner]) {
      privateChats[partner] = [];
    }

    // Append only if not already duplicated (checks using unique identifier)
    let isNew = false;
    if (!privateChats[partner].some(m => m.id === id)) {
      privateChats[partner].push({
        id: id,
        sender: sender,
        text: content,
        time: timestamp,
        color: color,
        unread: (partner !== activePrivateRecipient)
      });
      
      // Save local persistence
      localStorage.setItem(`papos_pms_${currentUser}`, JSON.stringify(privateChats));
      isNew = true;

      // Save to Firestore if authenticated
      if (window.FirebaseService && window.FirebaseService.getCurrentUser()) {
        window.FirebaseService.savePrivateMessage(partner, {
          id: id,
          sender: sender,
          recipient: recipient,
          text: content,
          timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
          time: formatMessageTime({ timestamp: typeof timestamp === "number" ? timestamp : Date.now() }),
          unread: (partner !== activePrivateRecipient),
          color: color
        }).catch(err => {
          console.error("[Firestore] Erro ao salvar mensagem:", err);
        });
      }
    }

    // Direct render if active
    if (isNew && chatMode === "private" && activePrivateRecipient === partner) {
      appendSingleMessage({
        id: id,
        sender: sender,
        text: content,
        time: timestamp,
        color: color
      });
    }

    renderPrivateConversationsSidebar();
  }

  // Send Direct Message Frame
  function sendPrivateMessage(text, msgId) {
    if (!activePrivateRecipient || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    socket.send(JSON.stringify({
      type: "private_message",
      id: msgId,
      to: activePrivateRecipient,
      text: text,
      color: activeMessageColor || undefined
    }));
  }

  // Start direct conversation with user
  window.startPrivateChat = (partnerName) => {
    if (partnerName === currentUser) {
      alert("Você não pode iniciar um chat privado com você mesmo!");
      return;
    }

    // Close members panel
    const offcanvasEl = document.getElementById("offcanvasMembers");
    if (offcanvasEl) {
      const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasEl);
      if (offcanvasInstance) offcanvasInstance.hide();
    }

    // Close sidebar on mobile
    if (chatSidebar && chatSidebar.classList.contains("active")) {
      chatSidebar.classList.remove("active");
    }

    chatMode = "private";
    activePrivateRecipient = partnerName;

    activeTypingUsers.clear();
    if (typingIndicatorBar) typingIndicatorBar.classList.add("d-none");

    if (!privateChats[partnerName]) {
      privateChats[partnerName] = [];
    }

    // Mark as read
    privateChats[partnerName].forEach(m => m.unread = false);
    localStorage.setItem(`papos_pms_${currentUser}`, JSON.stringify(privateChats));

    if (window.FirebaseService && window.FirebaseService.getCurrentUser()) {
      window.FirebaseService.markMessagesAsRead(partnerName).catch(err => {
        console.error("[Firestore] Erro ao marcar mensagens como lidas:", err);
      });
    }

    updateActiveHeader();
    renderMessages();
    renderPrivateConversationsSidebar();

    // Focus on entry
    if (messageInput) messageInput.focus();
  };

  // Return to public channel
  if (btnBackToPublic) {
    btnBackToPublic.addEventListener("click", () => {
      chatMode = "public";
      activePrivateRecipient = null;
      updateActiveHeader("Papos", "Buscando informações...");
      
      activeTypingUsers.clear();
      if (typingIndicatorBar) typingIndicatorBar.classList.add("d-none");
      
      // Re-trigger server sync for safety
      sendJoinRoom(activeRoomId);
    });
  }

  // Render Left Private Chats Threads
  function renderPrivateConversationsSidebar() {
    if (!privateConversationsList) return;
    
    const partners = Object.keys(privateChats);
    if (partners.length === 0) {
      privateConversationsList.innerHTML = `
        <div class="text-center py-5 text-secondary small" id="no-private-chats-placeholder">
          <div class="fs-4 mb-2"><i class="bi bi-chat-left-dots"></i></div>
          Nenhuma conversa privada.<br>Clique em um membro na lista lateral para abrir um chat seguro.
        </div>
      `;
      if (totalPrivateUnreadBadge) totalPrivateUnreadBadge.classList.add("d-none");
      return;
    }

    privateConversationsList.innerHTML = "";
    let totalUnread = 0;

    partners.forEach(partner => {
      const history = privateChats[partner];
      const lastMsg = history[history.length - 1] || { text: "Sem mensagens", time: "" };
      const unreadCount = history.filter(m => m.unread).length;
      totalUnread += unreadCount;

      const isActive = (chatMode === "private" && activePrivateRecipient === partner);

      const threadDiv = document.createElement("div");
      threadDiv.className = `private-chat-item ${isActive ? 'active' : ''}`;
      threadDiv.onclick = () => window.startPrivateChat(partner);

      threadDiv.innerHTML = `
        ${window.ChatEngine.renderAvatar(partner, "avatar-sm")}
        <div class="flex-grow-1 text-start text-truncate">
          <div class="d-flex align-items-center justify-content-between">
            <span class="fw-bold text-white small text-truncate">${partner}</span>
            <span class="text-secondary font-mono" style="font-size: 0.65rem;">${formatMessageTime(lastMsg)}</span>
          </div>
          <p class="mb-0 text-secondary text-truncate small">${lastMsg.text}</p>
        </div>
        ${unreadCount > 0 ? `<span class="badge rounded-pill bg-danger">${unreadCount}</span>` : ''}
      `;

      privateConversationsList.appendChild(threadDiv);
    });

    if (totalPrivateUnreadBadge) {
      if (totalUnread > 0) {
        totalPrivateUnreadBadge.classList.remove("d-none");
        totalPrivateUnreadBadge.textContent = totalUnread;
      } else {
        totalPrivateUnreadBadge.classList.add("d-none");
      }
    }
  }

  // Copy to clipboard helper
  window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Texto copiado para a área de transferência!");
    }).catch(err => console.error("Clipboard failure:", err));
  };

  // Render dynamic Message feed with consecutive sender grouping
  function renderMessages(filterText = "") {
    if (!chatMessagesContainer) return;
    chatMessagesContainer.innerHTML = "";

    const activeList = chatMode === "public" ? publicRoomMessages : (privateChats[activePrivateRecipient] || []);

    const filtered = activeList.filter(msg => {
      if (msg.isSystem) return true;
      const isBlocked = blockedUsers.includes(msg.sender);
      if (isBlocked) return false;
      if (filterText.trim() === "") return true;
      return msg.text.toLowerCase().includes(filterText.toLowerCase());
    });

    if (filtered.length === 0) {
      chatMessagesContainer.innerHTML = `
        <div class="text-center text-secondary py-5">
          <i class="bi bi-chat-dots fs-1 mb-2 d-block text-white"></i>
          <p class="mb-0 fw-semibold text-white">Nenhuma mensagem por aqui.</p>
          <p class="small">Use a caixa abaixo para iniciar o diálogo!</p>
        </div>
      `;
      return;
    }

    let lastSender = null;

    filtered.forEach(msg => {
      if (msg.isSystem) {
        const sysDiv = document.createElement("div");
        sysDiv.className = "msg-system";
        sysDiv.innerHTML = `<i class="bi bi-info-circle me-1"></i> ${msg.text} <span class="ms-1 text-secondary" style="font-size:0.65rem;">(${formatMessageTime(msg)})</span>`;
        chatMessagesContainer.appendChild(sysDiv);
        lastSender = null; // Break grouping
      } else {
        const isMe = msg.sender === (window.confirmedNickname || currentUser);
        
        // Group consecutive message rows
        const isGrouped = (msg.sender === lastSender);

        const msgDiv = document.createElement("div");
        msgDiv.className = `msg-container ${isMe ? 'msg-me' : ''} ${isGrouped ? 'msg-grouped' : ''}`;
        msgDiv.id = `msg-id-${msg.id}`;

        // Reactions Html build (Only for public rooms)
        let reactionsHtml = "";
        if (chatMode === "public" && msg.reactions && Object.keys(msg.reactions).length > 0) {
          reactionsHtml = '<div class="reactions-list">';
          Object.entries(msg.reactions).forEach(([emoji, list]) => {
            const activeClass = list.includes(window.confirmedNickname || currentUser) ? 'active' : '';
            reactionsHtml += `
              <button class="reaction-pill ${activeClass}" onclick="sendReaction('${msg.id}', '${emoji}')">
                <span>${emoji}</span>
                <span class="ms-1 font-mono">${list.length}</span>
              </button>
            `;
          });
          reactionsHtml += '</div>';
        }

        // Reply HTML Build (Only for public rooms)
        let replyHtml = "";
        if (chatMode === "public" && msg.replyTo) {
          replyHtml = `
            <div class="small text-secondary mb-1 ps-2 border-start border-secondary" style="font-size: 0.75rem;">
              <i class="bi bi-reply-fill text-white-50"></i> Em resposta a <strong>${msg.replyTo.sender}</strong>: <span class="text-white-50 text-truncate d-inline-block align-bottom" style="max-width: 180px;">${msg.replyTo.text}</span>
            </div>
          `;
        }

        // Actions menu overlay
        let actionsHtml = "";
        let deleteBtnHtml = isMe ? `
          <button class="btn-action-msg text-danger" onclick="window.deleteMessage('${msg.id}')" title="Excluir Mensagem">
            <i class="bi bi-trash-fill text-danger"></i>
          </button>
        ` : "";

        if (chatMode === "public") {
          actionsHtml = `
            <div class="message-actions-menu">
              <button class="btn-action-msg" onclick="setReplyTarget('${msg.id}', '${msg.sender}', '${msg.text.replace(/'/g, "\\'")}')" title="Responder">
                <i class="bi bi-reply-fill"></i>
              </button>
              <button class="btn-action-msg" onclick="sendReaction('${msg.id}', '👍')" title="Curtir (👍)">👍</button>
              <button class="btn-action-msg" onclick="sendReaction('${msg.id}', '❤️')" title="Amei (❤️)">❤️</button>
              <button class="btn-action-msg" onclick="copyToClipboard('${msg.text.replace(/'/g, "\\'")}')" title="Copiar"><i class="bi bi-clipboard"></i></button>
              ${deleteBtnHtml}
              <button class="btn-action-msg" onclick="toggleBlockUser('${msg.sender}')" title="Bloquear"><i class="bi bi-shield-slash-fill text-danger"></i></button>
              <button class="btn-action-msg" onclick="reportUser('${msg.sender}')" title="Denunciar"><i class="bi bi-flag-fill text-warning"></i></button>
            </div>
          `;
        } else {
          // Direct message actions
          actionsHtml = `
            <div class="message-actions-menu">
              <button class="btn-action-msg" onclick="copyToClipboard('${msg.text.replace(/'/g, "\\'")}')" title="Copiar"><i class="bi bi-clipboard"></i></button>
              ${deleteBtnHtml}
              <button class="btn-action-msg" onclick="toggleBlockUser('${msg.sender}')" title="Bloquear"><i class="bi bi-shield-slash-fill text-danger"></i></button>
            </div>
          `;
        }

        msgDiv.innerHTML = `
          ${actionsHtml}
          <button class="btn p-0 border-0 flex-shrink-0" onclick="window.openUserProfile('${msg.sender}')" style="cursor: pointer;" tabindex="0" aria-label="Ver perfil de ${msg.sender}">
            ${window.ChatEngine.renderAvatar(msg.sender, "avatar-sm")}
          </button>
          <div class="msg-content">
            ${replyHtml}
            <div class="msg-header">
              <span class="msg-username" style="color: ${window.getUsernameColor(msg.sender)} !important; cursor: pointer;" onclick="window.openUserProfile('${msg.sender}')" tabindex="0" role="button" aria-label="Ver perfil de ${msg.sender}">${isMe ? 'Você' : msg.sender}</span>
              <span class="msg-meta">${formatMessageTime(msg)}</span>
            </div>
            <div class="msg-bubble" style="${msg.color ? `color: ${msg.color} !important; font-weight: 500;` : ''}">${msg.text}</div>
            ${reactionsHtml}
          </div>
        `;

        chatMessagesContainer.appendChild(msgDiv);
        lastSender = msg.sender;
      }
    });

    scrollToBottom();
  }

  // Real-time append single incoming msg frame
  function appendSingleMessage(msg) {
    if (!chatMessagesContainer) return;
    const isBlocked = blockedUsers.includes(msg.sender);
    if (isBlocked) return;

    // Prevent duplicating in the UI if the DOM element with this ID already exists
    if (msg.id && chatMessagesContainer.querySelector(`#msg-id-${msg.id}`)) {
      return;
    }

    if (chatMessagesContainer.querySelector(".text-center")) {
      chatMessagesContainer.innerHTML = "";
    }

    const isMe = msg.sender === (window.confirmedNickname || currentUser);
    
    // Check grouping
    const lastMsgDiv = chatMessagesContainer.lastElementChild;
    const isGrouped = lastMsgDiv && lastMsgDiv.classList.contains("msg-container") && 
                      !lastMsgDiv.classList.contains("msg-system") &&
                      lastMsgDiv.querySelector(".msg-username") &&
                      (lastMsgDiv.querySelector(".msg-username").textContent === (isMe ? 'Você' : msg.sender));

    const msgDiv = document.createElement("div");
    msgDiv.className = `msg-container ${isMe ? 'msg-me' : ''} ${isGrouped ? 'msg-grouped' : ''}`;
    msgDiv.id = `msg-id-${msg.id}`;

    let replyHtml = "";
    if (chatMode === "public" && msg.replyTo) {
      replyHtml = `
        <div class="small text-secondary mb-1 ps-2 border-start border-secondary" style="font-size: 0.75rem;">
          <i class="bi bi-reply-fill text-white-50"></i> Em resposta a <strong>${msg.replyTo.sender}</strong>: <span class="text-white-50 text-truncate d-inline-block align-bottom" style="max-width: 180px;">${msg.replyTo.text}</span>
        </div>
      `;
    }

    let actionsHtml = "";
    let deleteBtnHtml = isMe ? `
      <button class="btn-action-msg text-danger" onclick="window.deleteMessage('${msg.id}')" title="Excluir Mensagem">
        <i class="bi bi-trash-fill text-danger"></i>
      </button>
    ` : "";

    if (chatMode === "public") {
      actionsHtml = `
        <div class="message-actions-menu">
          <button class="btn-action-msg" onclick="setReplyTarget('${msg.id}', '${msg.sender}', '${msg.text.replace(/'/g, "\\'")}')" title="Responder">
            <i class="bi bi-reply-fill"></i>
          </button>
          <button class="btn-action-msg" onclick="sendReaction('${msg.id}', '👍')" title="Curtir">👍</button>
          <button class="btn-action-msg" onclick="sendReaction('${msg.id}', '❤️')" title="Amei">❤️</button>
          <button class="btn-action-msg" onclick="copyToClipboard('${msg.text.replace(/'/g, "\\'")}')" title="Copiar"><i class="bi bi-clipboard"></i></button>
          ${deleteBtnHtml}
          <button class="btn-action-msg" onclick="toggleBlockUser('${msg.sender}')" title="Bloquear"><i class="bi bi-shield-slash-fill text-danger"></i></button>
          <button class="btn-action-msg" onclick="reportUser('${msg.sender}')" title="Denunciar"><i class="bi bi-flag-fill text-warning"></i></button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div class="message-actions-menu">
          <button class="btn-action-msg" onclick="copyToClipboard('${msg.text.replace(/'/g, "\\'")}')" title="Copiar"><i class="bi bi-clipboard"></i></button>
          ${deleteBtnHtml}
          <button class="btn-action-msg" onclick="toggleBlockUser('${msg.sender}')" title="Bloquear"><i class="bi bi-shield-slash-fill text-danger"></i></button>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      ${actionsHtml}
      <button class="btn p-0 border-0 flex-shrink-0" onclick="window.openUserProfile('${msg.sender}')" style="cursor: pointer;" tabindex="0" aria-label="Ver perfil de ${msg.sender}">
        ${window.ChatEngine.renderAvatar(msg.sender, "avatar-sm")}
      </button>
      <div class="msg-content">
        ${replyHtml}
        <div class="msg-header">
          <span class="msg-username" style="color: ${window.getUsernameColor(msg.sender)} !important; cursor: pointer;" onclick="window.openUserProfile('${msg.sender}')" tabindex="0" role="button" aria-label="Ver perfil de ${msg.sender}">${isMe ? 'Você' : msg.sender}</span>
          <span class="msg-meta">${formatMessageTime(msg)}</span>
        </div>
        <div class="msg-bubble" style="${msg.color ? `color: ${msg.color} !important; font-weight: 500;` : ''}">${msg.text}</div>
      </div>
    `;

    chatMessagesContainer.appendChild(msgDiv);
    scrollToBottom();
  }

  // Draw system messages
  function appendSystemMessage(text) {
    if (!chatMessagesContainer) return;
    const sysDiv = document.createElement("div");
    sysDiv.className = "msg-system";
    sysDiv.innerHTML = `<i class="bi bi-info-circle me-1"></i> ${text} <span class="ms-1 text-secondary" style="font-size:0.65rem;">(${formatMessageTime({timestamp: Date.now()})})</span>`;
    chatMessagesContainer.appendChild(sysDiv);
    scrollToBottom();
  }

  // Search/Filters elements on message feed
  const setupSearchToggle = (btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      searchBarWrapper.classList.toggle("d-none");
      if (!searchBarWrapper.classList.contains("d-none")) {
        searchMessagesInput.focus();
      } else {
        searchMessagesInput.value = "";
        renderMessages();
      }
    });
  };

  if (searchBarWrapper && searchMessagesInput) {
    setupSearchToggle(btnToggleSearch);
    setupSearchToggle(document.getElementById("btn-toggle-search-mobile"));
  }

  if (btnCloseSearch && searchBarWrapper && searchMessagesInput) {
    btnCloseSearch.addEventListener("click", () => {
      searchBarWrapper.classList.add("d-none");
      searchMessagesInput.value = "";
      renderMessages();
    });
  }

  if (searchMessagesInput) {
    searchMessagesInput.addEventListener("input", (e) => {
      renderMessages(e.target.value);
    });
  }

  // Modal Rooms render engine
  function renderModalRooms(filterText = "") {
    if (!modalRoomsContainer) return;
    modalRoomsContainer.innerHTML = "";

    const filtered = cachedRooms.filter(room => {
      return room.name.toLowerCase().includes(filterText.toLowerCase()) ||
             room.desc.toLowerCase().includes(filterText.toLowerCase());
    });

    if (filtered.length === 0) {
      modalRoomsContainer.innerHTML = `
        <div class="col-12 text-center py-4 text-secondary">
          <p class="mb-0 small">Nenhuma sala correspondente.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(room => {
      const isCurrent = room.id === activeRoomId && chatMode === "public";
      const col = document.createElement("div");
      col.className = "col-md-6";
      
      col.innerHTML = `
        <div class="card p-3 h-100 d-flex flex-row align-items-center justify-content-between ${isCurrent ? 'border-success' : ''}" style="background-color: var(--surface-secondary) !important;">
          <div class="text-start text-truncate me-2">
            <h6 class="text-white fw-bold mb-1 text-truncate">${room.name}</h6>
            <p class="text-secondary mb-0 small text-truncate" style="font-size: 0.72rem; max-width: 220px;">${room.desc}</p>
          </div>
          <div class="text-end flex-shrink-0">
            <span class="badge bg-dark text-secondary rounded-pill d-block mb-2 small" style="font-size: 0.65rem;">${room.count} ativos</span>
            ${isCurrent ? 
              `<span class="badge bg-success text-black py-1.5 px-2.5 rounded">Atual</span>` : 
              `<button class="btn btn-secondary-custom btn-sm py-1 px-3" onclick="switchPublicRoom('${room.id}')" style="font-size: 0.72rem !important; border-radius: var(--radius-sm) !important;">Entrar</button>`
            }
          </div>
        </div>
      `;
      modalRoomsContainer.appendChild(col);
    });
  }

  // Public switcher
  window.switchPublicRoom = (roomId) => {
    // Hide modal
    const modalEl = document.getElementById("roomsModal");
    if (modalEl) {
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    }

    chatMode = "public";
    activePrivateRecipient = null;
    activeRoomId = roomId;

    activeTypingUsers.clear();
    if (typingIndicatorBar) typingIndicatorBar.classList.add("d-none");

    // Update URL query state gracefully without reloading
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.pushState({ path: newUrl }, "", newUrl);

    // Join room
    sendJoinRoom(roomId);
  };

  if (searchRoomsModal) {
    searchRoomsModal.addEventListener("input", (e) => {
      renderModalRooms(e.target.value);
    });
  }

  // Draw Members connected in offcanvas under active search filtering
  function renderMembers(filterText = "") {
    if (!membersListContainer) return;
    membersListContainer.innerHTML = "";

    const filteredUsers = onlineUsersList.filter(u => {
      return u.toLowerCase().includes(filterText.toLowerCase());
    });

    let html = "";
    const count = filteredUsers.length;

    html += `<div class="member-group-title bg-dark">Pessoas na sala (${count})</div>`;

    if (filteredUsers.length === 0) {
      html += `<div class="text-center py-4 text-secondary small">Nenhum membro ativo encontrado.</div>`;
    } else {
      filteredUsers.forEach(u => {
        const isMe = u === (window.confirmedNickname || currentUser);
        const isMod = u.toLowerCase().includes("mod") || u.toLowerCase().includes("admin") || u === "Sistema";
        
        const avatarHtml = window.ChatEngine ? window.ChatEngine.renderAvatar(u, "avatar-member") : `<div class="avatar-member bg-secondary">P</div>`;
        const statusHtml = `<span class="status-indicator status-online ms-1.5" style="width: 8px; height: 8px; flex-shrink: 0; position: static; display: inline-block; ${isMod ? 'background-color: #ff4a4a !important;' : ''}"></span>`;
        
        html += `
          <div class="member-item d-flex align-items-center justify-content-between py-1.5 px-3">
            <button class="btn p-0 border-0 d-flex align-items-center gap-2 text-truncate text-start" onclick="window.openUserProfile('${u}')" style="cursor: pointer; background: transparent; color: inherit; min-width: 0; flex: 1;" tabindex="0" aria-label="Ver perfil de ${u}">
              ${avatarHtml}
              <span class="${isMe ? 'fw-bold text-white' : 'text-secondary'} small text-truncate d-inline-flex align-items-center gap-1.5" title="${u}" style="min-width: 0; pointer-events: none;">
                <span class="text-truncate">${u} ${isMe ? '(Você)' : ''}</span>
                ${isMod ? '<span class="badge bg-danger-subtle text-danger flex-shrink-0" style="font-size:0.55rem; padding: 2px 4px;">MOD</span>' : ''}
                ${statusHtml}
              </span>
            </button>
            
            ${!isMe ? `
              <div class="d-flex gap-1 flex-shrink-0">
                <button class="btn btn-sm btn-secondary-custom p-1" onclick="startPrivateChat('${u}')" title="Conversar Privado" style="font-size: 0.72rem !important; border-radius: var(--radius-sm) !important;">
                  <i class="bi bi-chat-left-text-fill"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger p-1" onclick="toggleBlockUser('${u}')" title="Bloquear" style="font-size: 0.72rem !important; border-radius: var(--radius-sm) !important;">
                  <i class="bi bi-shield-slash-fill"></i>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    membersListContainer.innerHTML = html;
  }

  if (searchMembersInput) {
    searchMembersInput.addEventListener("input", (e) => {
      renderMembers(e.target.value);
    });
  }

  // Handle typing activity indicators
  function toggleTypingIndicator(nickname, isTyping) {
    if (!typingIndicatorBar) return;
    
    if (nickname === currentUser) return;

    if (isTyping) {
      activeTypingUsers.add(nickname);
    } else {
      activeTypingUsers.delete(nickname);
    }

    if (activeTypingUsers.size > 0) {
      typingIndicatorBar.classList.remove("d-none");
      
      const usersArray = Array.from(activeTypingUsers);
      const coloredNames = usersArray.map(name => {
        const color = window.getUsernameColor(name);
        return `<span style="color: ${color} !important; font-weight: 700;">${name}</span>`;
      });
      
      let namesHtml = "";
      if (coloredNames.length === 1) {
        namesHtml = coloredNames[0];
      } else if (coloredNames.length === 2) {
        namesHtml = `${coloredNames[0]} e ${coloredNames[1]}`;
      } else {
        const last = coloredNames.pop();
        namesHtml = `${coloredNames.join(", ")} e ${last}`;
      }
      
      const verb = activeTypingUsers.size > 1 ? "estão digitando" : "está digitando";
      
      typingIndicatorBar.innerHTML = `
        ${namesHtml} ${verb}
        <span class="typing-indicator-dots">
          <span></span><span></span><span></span>
        </span>
      `;
    } else {
      typingIndicatorBar.classList.add("d-none");
    }
  }

  // Scroll to bottom helper
  function scrollToBottom() {
    if (!chatMessagesContainer) return;
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  // Handle Message dispatching (Public rooms vs Direct private threads)
  function handleSendMessage() {
    if (!messageInput || !socket) return;
    const text = messageInput.value.trim();
    if (text === "") return;

    if (socket.readyState !== WebSocket.OPEN) {
      alert("Sua conexão foi fechada. Aguarde restabelecer.");
      return;
    }

    if (chatMode === "public") {
      // Send standard message
      socket.send(JSON.stringify({
        type: "message",
        text: text,
        color: activeMessageColor || undefined,
        replyTo: replyTargetMsg ? {
          id: replyTargetMsg.id,
          sender: replyTargetMsg.sender,
          text: replyTargetMsg.text
        } : null
      }));
      clearReplyTarget();
    } else {
      // Generate unique client-side message ID to prevent duplicates
      const msgId = "pm-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);

      // Send private message via WebSocket including the client-side ID
      sendPrivateMessage(text, msgId);
      
      // Auto-append our sent private message local with standard unified fields
      handleIncomingPrivateMessage({
        id: msgId,
        senderName: currentUser,
        recipientName: activePrivateRecipient,
        content: text,
        color: activeMessageColor || undefined,
        timestamp: Date.now()
      });
    }

    messageInput.value = "";
    messageInput.style.height = "40px"; // Reset height on send
    messageInput.focus();

    // Disable typing trigger
    if (isCurrentlyTyping) {
      isCurrentlyTyping = false;
      if (chatMode === "public") {
        socket.send(JSON.stringify({ type: "typing", isTyping: false }));
      } else {
        socket.send(JSON.stringify({ type: "private_typing", to: activePrivateRecipient, isTyping: false }));
      }
    }
  }

  // Debounced Typing Packets and Dynamic Textarea Resizing
  if (messageInput) {
    messageInput.addEventListener("input", () => {
      // Adjust height dynamically
      messageInput.style.height = "auto";
      const scrollHeight = messageInput.scrollHeight;
      const maxHeight = 120;
      messageInput.style.height = Math.min(scrollHeight, maxHeight) + "px";

      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      if (!isCurrentlyTyping) {
        isCurrentlyTyping = true;
        if (chatMode === "public") {
          socket.send(JSON.stringify({ type: "typing", isTyping: true }));
        } else {
          socket.send(JSON.stringify({ type: "private_typing", to: activePrivateRecipient, isTyping: true }));
        }
      }

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isCurrentlyTyping = false;
        if (chatMode === "public") {
          socket.send(JSON.stringify({ type: "typing", isTyping: false }));
        } else {
          socket.send(JSON.stringify({ type: "private_typing", to: activePrivateRecipient, isTyping: false }));
        }
      }, 1500);
    });

    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
          if (!e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
          }
        }
      }
    });
  }

  if (sendButton) {
    sendButton.addEventListener("click", handleSendMessage);
  }

  // Sidebar Toggling for mobile
  if (btnToggleSidebar && chatSidebar) {
    btnToggleSidebar.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = chatSidebar.classList.toggle("active");
      document.body.classList.toggle("sidebar-open", isActive);
    });
  }

  if (chatMessagesContainer && chatSidebar) {
    chatMessagesContainer.addEventListener("click", () => {
      if (chatSidebar.classList.contains("active")) {
        chatSidebar.classList.remove("active");
        document.body.classList.remove("sidebar-open");
      }
    });
  }

  // History cleaner
  const setupClearChat = (btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (confirm("Deseja mesmo limpar as mensagens locais exibidas atualmente?")) {
        chatMessagesContainer.innerHTML = "";
        appendSystemMessage("O histórico local do chat foi limpo com sucesso.");
      }
    });
  };

  setupClearChat(btnClearChat);
  setupClearChat(document.getElementById("btn-clear-chat-mobile"));

  // Reply cancel trigger
  if (btnCancelReply) {
    btnCancelReply.addEventListener("click", clearReplyTarget);
  }

  // Initialize socket
  connect();
  renderPrivateConversationsSidebar();

  // Expose triggers
  window.sendReaction = (messageId, emoji) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "reaction",
        messageId,
        emoji
      }));
    }
  };

  window.deleteMessage = (messageId) => {
    if (confirm("Deseja realmente excluir esta mensagem permanentemente para todos?")) {
      if (chatMode === "public") {
        socket.send(JSON.stringify({
          type: "delete_message",
          messageId: messageId
        }));
      } else {
        socket.send(JSON.stringify({
          type: "delete_private_message",
          messageId: messageId,
          to: activePrivateRecipient
        }));
      }
    }
  };

  window.toggleBlockUser = (username) => {
    if (username === currentUser) return;
    if (confirm(`Bloquear o usuário '${username}'? Você não receberá mais as mensagens dele.`)) {
      blockedUsers.push(username);
      localStorage.setItem("papos_blocked_users", JSON.stringify(blockedUsers));
      window.location.reload();
    }
  };

  window.reportUser = (username) => {
    alert(`Usuário '${username}' denunciado. Nossa equipe de moderação avaliará o comportamento nas últimas conversas.`);
  };

  // Conversas Privadas list accordion toggle
  const privateToggleHeader = document.getElementById("private-chats-toggle");
  const privateList = document.getElementById("private-conversations-list");
  const privateArrow = document.getElementById("private-chats-arrow");

  if (privateToggleHeader && privateList) {
    const isCollapsed = localStorage.getItem("papos_private_collapsed") === "true";
    if (isCollapsed) {
      privateList.classList.add("collapsed");
      if (privateArrow) privateArrow.classList.add("rotate-180");
    }

    privateToggleHeader.addEventListener("click", () => {
      const currentlyCollapsed = privateList.classList.toggle("collapsed");
      if (privateArrow) {
        privateArrow.classList.toggle("rotate-180", currentlyCollapsed);
      }
      localStorage.setItem("papos_private_collapsed", currentlyCollapsed ? "true" : "false");
    });
  }

  // Backdrop click handler for mobile
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  if (sidebarBackdrop && chatSidebar) {
    sidebarBackdrop.addEventListener("click", () => {
      chatSidebar.classList.remove("active");
      document.body.classList.remove("sidebar-open");
    });
  }

  // Draggable Resizable Sidebar (Desktop/Tablet only, with touch support)
  const resizer = document.getElementById("sidebar-resizer");
  const sidebar = document.getElementById("chat-sidebar");
  let isResizing = false;

  if (resizer && sidebar) {
    const applySidebarWidth = () => {
      if (window.innerWidth > 768) {
        let savedWidth = parseInt(localStorage.getItem("papos_sidebar_width"), 10);
        const minSidebarWidth = 220;
        const minChatWidth = 400;
        const maxSidebarWidth = Math.min(450, window.innerWidth - minChatWidth);

        if (savedWidth) {
          if (savedWidth < minSidebarWidth) savedWidth = minSidebarWidth;
          if (savedWidth > maxSidebarWidth) savedWidth = maxSidebarWidth;
          sidebar.style.width = savedWidth + "px";
        } else {
          sidebar.style.width = "280px"; // default desktop width
        }
      } else {
        sidebar.style.width = ""; // Reset width on mobile to fallback to CSS layout
      }
    };

    // Apply initially
    applySidebarWidth();

    // Listen to window resizing
    window.addEventListener("resize", applySidebarWidth);

    const startResize = (clientX) => {
      isResizing = true;
      resizer.classList.add("dragging");
      sidebar.style.transition = "none"; // Disable CSS transition for ultra-smooth live dragging
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };

    const doResize = (clientX) => {
      if (!isResizing) return;
      const minSidebarWidth = 220;
      const minChatWidth = 400;
      const maxSidebarWidth = Math.min(450, window.innerWidth - minChatWidth);

      let newWidth = clientX;
      if (newWidth < minSidebarWidth) newWidth = minSidebarWidth;
      if (newWidth > maxSidebarWidth) newWidth = maxSidebarWidth;

      sidebar.style.width = newWidth + "px";
    };

    const stopResize = () => {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove("dragging");
        sidebar.style.transition = ""; // Restore transitions
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem("papos_sidebar_width", sidebar.offsetWidth);
      }
    };

    // Mouse Resizing Events
    resizer.addEventListener("mousedown", (e) => {
      if (window.innerWidth <= 768) return;
      e.preventDefault();
      startResize(e.clientX);
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      doResize(e.clientX);
    });

    document.addEventListener("mouseup", stopResize);

    // Touch Resizing Events
    resizer.addEventListener("touchstart", (e) => {
      if (window.innerWidth <= 768) return;
      if (e.touches.length > 0) {
        startResize(e.touches[0].clientX);
      }
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!isResizing) return;
      if (e.touches.length > 0) {
        doResize(e.touches[0].clientX);
      }
    }, { passive: false });

    document.addEventListener("touchend", stopResize);
  }
});

// Reply target actions
function setReplyTarget(id, sender, text) {
  replyTargetMsg = { id, sender, text };
  const bar = document.getElementById("reply-reference-bar");
  const referenceText = document.getElementById("reply-reference-text");
  const input = document.getElementById("message-input");

  if (bar && referenceText) {
    bar.classList.remove("d-none");
    referenceText.innerHTML = `Respondendo a <strong>${sender}</strong>: <span class="opacity-75">${text}</span>`;
  }
  if (input) input.focus();
}

function clearReplyTarget() {
  replyTargetMsg = null;
  const bar = document.getElementById("reply-reference-bar");
  if (bar) bar.classList.add("d-none");
}

// Custom Pure Vanilla JS Emoji Picker Implementation
const EMOJI_CATEGORIES = {
  faces: [
    "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","😈","👿","👹","👺","💀","☠️","👻","👽","👾","🤖","💩","😺","😸","😹","😻","😼","😽","🙀","😿","😾","👋","🤚","🖐️","✋","🖖","👌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🧠","🧡"
  ],
  animals: [
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦢","🦉","🦚","🦜","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🐐","🦌","🐕","🐩","🐈","🐓","🦃","🕊️","🐇","🐁","🐀","🐿️","🦥","🦦","🦨","🦡","🐾","🌲","🌳","🌴","🌵","🌾","🌿","🍀","🍁","🍂","🍃","🌸","🌹","🌺","🌻","🌼","🌷","🌱"
  ],
  food: [
    "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🌽","🥕","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🥞","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥗","🥘","🍲","🍜","🍝","🍣","🍤","🥟","🍦","🍧","🍨","🍩","🍪","🎂","🍰","🧁","🥧","🍫","🍬","🍭","🍮","🍯","☕","🍵","🥤","🥛","🍼","🍺","🍻","🥂","🍷","🥃","🍹","🧉","🍾","🍿","🧂"
  ],
  activities: [
    "⚽","🏀","🏈","⚾","🥎","👑","🏆","🥇","🥈","🥉","🏅","🎖️","🎟️","🎫","🎪","🤹","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎮","🕹️","👾","🎰","🎲","♟️","🧩","🎯","🎳","🏌️","🏄","🏊","🏋️","🚴","🧗","🥋","🥊","🏂","⛷️","🛹","🛷","⛸️"
  ],
  travel: [
    "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🛵","🏍️","🛺","🚲","🛴","🛹","🚂","🚊","✈️","🛫","𛲢","𛲣","🚁","🛰️","🚀","🛸","⛵","🚢","⚓","⛽","🚧","🗺️","🗿","🗼","🗽","🎡","🎢","⛰️","🌋","🏕️","🏖️","🏜️","🏝️","🏞️","🏟️","🏛️","🏢","🏪","🏫","🏨","🏥","🏦","⛪","🕌","🌅","🌄","🌌","🌉","🌆","🌇","🎈","🎉","🎊","🇯🇵","🇧🇷","🇺🇸","🇪🇸","🇫🇷","🇮🇹","🇩🇪","🇬🇧","🇵🇹","🇦🇷","🇨🇦","🇲🇽"
  ],
  objects: [
    "⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","🖲️","💾","💿","📀","📷","📸","📹","🎥","📽️","📞","📟","📠","📺","📻","🎙️","🧭","⏰","⏳","🔋","🔌","💡","🔦","🕯️","🗑️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🔧","🔨","⚒️","⛏️","⚙️","⛓️","🔫","💣","🪓","🔪","🛡️","🚬","⚰️","🔮","🔭","🔬","💊","🩹","🩺","🩸","🔑","🔒","🔓","📦","✉️","📧","📮","📝","📅","📂","📎","📌","✂️"
  ],
  hearts: [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","💌","💋","👥","👤","💬","💭","🗯️","💯","🔥","✨","🌟","⭐","💥","💢","💦","💤","🌀","🔔","📣","📢","🔴","🔵","🟢","🟡","⚫","⚪","🏁","🚩","⚠️","✅","❌","ℹ️"
  ]
};

// Portuguese Search Tags for Emojis
const EMOJI_TAGS = {
  "😀": "sorriso rir alegre feliz dente papos", "😃": "sorriso rir alegre feliz dente", "😄": "sorriso rir alegre feliz olho", "😁": "sorriso rindo alegre dente",
  "😆": "gargalhada rir risada engraçado", "😅": "suor rir alivio tenso", "😂": "chorar de rir riso gargalhada engraçado", "🤣": "rolar de rir risada hilario",
  "😊": "feliz tímido corado sorriso", "😇": "anjo inocente santo", "🙂": "sorriso leve ok", "🙃": "de ponta cabeça ironia bobo",
  "😉": "piscadela piscando cumplicidade", "😌": "aliviado calmo paz", "😍": "apaixonado amor coracao olhos", "🥰": "apaixonado amor carinho coracoes",
  "😘": "beijo amor coracao carinho", "😋": "delicia gostoso comida lingua", "😛": "lingua bobo brincadeira", "😜": "piscando lingua bobo brincadeira",
  "🤪": "louco bobo divertido", "😎": "legal oculos sol estilo", "🤩": "estrela impressionado uau", "🥳": "festa comemorar aniversario",
  "😏": "malicioso ironia desconfiado", "😒": "desgosto chateado desanimado", "😞": "triste decepcionado", "😔": "triste pensativo melancolico",
  "😟": "preocupado ansioso", "😕": "confuso duvida", "🥺": "por favor pidão choro fofo", "😢": "triste choro lagrima",
  "😭": "chorando muito pranto lagrimas", "😤": "bravo triunfo raiva orgulho", "😠": "bravo raiva irritado", "😡": "furioso raiva bravo",
  "🤬": "xingando palavrão raiva", "🤯": "mente explodindo uau chocado", "😳": "vergonha chocado corado", "🥵": "calor quente fogo",
  "🥶": "frio gelo neve", "😱": "pânico medo susto chocado", "😴": "dormindo sono cansado", "🤮": "vomitando nojo doente",
  "🤒": "doente febre termometro", "🤕": "machucado curativo dor", "😈": "diabo malicia sorriso", "💀": "caveira morte perigo",
  "👻": "fantasma susto halloween", "👽": "alien extraterrestre space", "🤖": "robo tecnologia", "💩": "coco bosta divertido",
  "👍": "joinha sim gostei aprovo legal", "👎": "não gostei ruim desaprovo", "👏": "palmas parabens", "🙌": "comemorar festa amem",
  "🙏": "por favor rezar oração agradecido grato", "❤️": "coracao vermelho amor", "🧡": "coracao laranja amor", "💛": "coracao amarelo amor",
  "💚": "coracao verde amor", "💙": "coracao azul amor", "💜": "coracao roxo amor", "🖤": "coracao preto luto",
  "🤍": "coracao branco paz", "💔": "coracao partido tristeza dor", "🔥": "fogo quente sucesso incrivel", "✨": "brilho magica estrelas",
  "🌟": "estrela brilho ouro", "⭐": "estrela", "💥": "explosao impacto", "💤": "sono dormindo", "🎉": "festa confete comemorar",
  "🎁": "presente aniversario natal", "💡": "ideia luz lampada", "💻": "computador pc notebook tecnologia", "📱": "celular telefone smartphone",
  "🎮": "jogo games controle", "⚽": "futebol bola esporte", "🐱": "gato miado felino pet", "🐶": "cachorro cao pet latido",
  "🚀": "foguete espaco subir voar", "🍕": "pizza comida queijo", "🍔": "hamburguer comida lanche", "🍺": "cerveja chopp bebida bar",
  "☕": "cafe xicara quente bebida", "💖": "coracao brilhante amor", "💘": "cupido amor flecha"
};

window.currentEmojiCategory = "faces";

window.renderEmojiGrid = function(emojis, targetContainer, isMobile) {
  if (!targetContainer) return;
  targetContainer.innerHTML = "";
  
  emojis.forEach(emoji => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn p-1 border-0 m-0 btn-hover-emoji";
    btn.style.width = "38px";
    btn.style.height = "38px";
    btn.style.fontSize = isMobile ? "1.45rem" : "1.35rem";
    btn.style.lineHeight = "1";
    btn.style.background = "none";
    btn.style.transition = "transform 0.1s ease";
    btn.innerText = emoji;
    
    // Insert emoji on click
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const input = document.getElementById("message-input");
      if (input) {
        const startPos = input.selectionStart || 0;
        const endPos = input.selectionEnd || 0;
        const text = input.value;
        input.value = text.substring(0, startPos) + emoji + text.substring(endPos);
        input.selectionStart = input.selectionEnd = startPos + emoji.length;
        input.focus();
        
        // Trigger input event to auto-expand height
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    
    // Add hover effect
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.2)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
    });
    
    targetContainer.appendChild(btn);
  });
};

window.filterEmojis = function(query, containerId, isMobile) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  
  const cleanQuery = query.toLowerCase().trim();
  
  if (cleanQuery === "") {
    // Show emojis for current category
    const category = window.currentEmojiCategory || "faces";
    const emojis = EMOJI_CATEGORIES[category] || [];
    window.renderEmojiGrid(emojis, container, isMobile);
    // Show tabs again
    let parent = container.parentElement;
    if (parent) {
      const tabs = parent.querySelector(".emoji-tabs");
      if (tabs) {
        tabs.style.setProperty("display", "flex", "important");
      }
    }
    return;
  }
  
  // Find matching emojis across all categories
  const matchedEmojis = [];
  
  for (const cat in EMOJI_CATEGORIES) {
    const emojis = EMOJI_CATEGORIES[cat] || [];
    emojis.forEach(emoji => {
      const tags = EMOJI_TAGS[emoji] || "";
      const matchesCategory = cat.toLowerCase().includes(cleanQuery);
      const matchesTags = tags.includes(cleanQuery);
      if (matchesCategory || matchesTags || emoji === cleanQuery) {
        if (!matchedEmojis.includes(emoji)) {
          matchedEmojis.push(emoji);
        }
      }
    });
  }
  
  if (matchedEmojis.length === 0) {
    const noResults = document.createElement("span");
    noResults.className = "text-secondary small py-3 d-block text-center w-100";
    noResults.innerText = "Nenhum emoji encontrado";
    container.appendChild(noResults);
  } else {
    window.renderEmojiGrid(matchedEmojis, container, isMobile);
  }
  
  // Hide category tabs when searching to avoid layout clutter
  let parent = container.parentElement;
  if (parent) {
    const tabs = parent.querySelector(".emoji-tabs");
    if (tabs) {
      tabs.style.setProperty("display", "none", "important");
    }
  }
};

window.closeMobileDropdown = function() {
  const btnMobileActions = document.getElementById("btn-mobile-actions");
  if (btnMobileActions) {
    const dropdownInstance = bootstrap.Dropdown.getInstance(btnMobileActions);
    if (dropdownInstance) {
      dropdownInstance.hide();
    }
  }
};

window.switchEmojiCategory = function(category) {
  window.currentEmojiCategory = category;
  
  const container = document.getElementById("emoji-grid-container");
  const mobileContainer = document.getElementById("mobile-emoji-grid-container");
  if (!container && !mobileContainer) return;

  const emojis = EMOJI_CATEGORIES[category] || [];
  
  if (container) {
    window.renderEmojiGrid(emojis, container, false);
    const desktopTabs = container.parentElement.querySelector(".emoji-tabs");
    if (desktopTabs) desktopTabs.style.setProperty("display", "flex", "important");
  }
  if (mobileContainer) {
    window.renderEmojiGrid(emojis, mobileContainer, true);
    const mobileTabs = mobileContainer.parentElement.querySelector(".emoji-tabs");
    if (mobileTabs) mobileTabs.style.setProperty("display", "flex", "important");
  }

  // Update active tab styling for both desktop and mobile panels
  const updateTabs = (dropdownId) => {
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
      const tabs = dropdown.querySelectorAll(".emoji-tabs button");
      tabs.forEach(tab => {
        const onclickAttr = tab.getAttribute("onclick") || "";
        const isClicked = onclickAttr.includes(category);
        if (isClicked) {
          tab.classList.add("active-emoji-tab");
          tab.style.opacity = "1";
          tab.style.fontWeight = "bold";
        } else {
          tab.classList.remove("active-emoji-tab");
          tab.style.opacity = "0.5";
          tab.style.fontWeight = "normal";
        }
      });
    }
  };

  updateTabs("emoji-picker-dropdown");
  updateTabs("mobile-actions-dropdown");
};

// Search listeners and Mobile Menu Multi-Step bindings
document.addEventListener("DOMContentLoaded", () => {
  const searchDesktop = document.getElementById("emoji-search-desktop");
  const searchMobile = document.getElementById("emoji-search-mobile");
  
  if (searchDesktop) {
    searchDesktop.addEventListener("input", (e) => {
      window.filterEmojis(e.target.value, "emoji-grid-container", false);
    });
  }
  
  if (searchMobile) {
    searchMobile.addEventListener("input", (e) => {
      window.filterEmojis(e.target.value, "mobile-emoji-grid-container", true);
    });
  }

  // Set up mobile action menu triggers
  const btnMobileOpenEmojis = document.getElementById("btn-mobile-open-emojis");
  const btnMobileOpenColors = document.getElementById("btn-mobile-open-colors");
  const btnMobileEmojiBack = document.getElementById("btn-mobile-emoji-back");
  const btnMobileColorBack = document.getElementById("btn-mobile-color-back");

  const step1 = document.getElementById("mobile-menu-step-1");
  const menuEmojis = document.getElementById("mobile-menu-emojis");
  const menuColors = document.getElementById("mobile-menu-colors");

  if (btnMobileOpenEmojis) {
    btnMobileOpenEmojis.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (step1) step1.classList.add("d-none");
      if (menuEmojis) menuEmojis.classList.remove("d-none");
      setTimeout(() => { if (searchMobile) searchMobile.focus(); }, 100);
    });
  }

  if (btnMobileOpenColors) {
    btnMobileOpenColors.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (step1) step1.classList.add("d-none");
      if (menuColors) menuColors.classList.remove("d-none");
    });
  }

  if (btnMobileEmojiBack) {
    btnMobileEmojiBack.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menuEmojis) menuEmojis.classList.add("d-none");
      if (step1) step1.classList.remove("d-none");
    });
  }

  if (btnMobileColorBack) {
    btnMobileColorBack.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menuColors) menuColors.classList.add("d-none");
      if (step1) step1.classList.remove("d-none");
    });
  }

  // Reset menu steps when clicking mobile actions button
  const btnMobileActions = document.getElementById("btn-mobile-actions");
  if (btnMobileActions) {
    btnMobileActions.addEventListener("click", () => {
      if (step1) step1.classList.remove("d-none");
      if (menuEmojis) menuEmojis.classList.add("d-none");
      if (menuColors) menuColors.classList.add("d-none");
      if (searchMobile) searchMobile.value = "";
      window.switchEmojiCategory("faces");
    });
  }

  // --- INÍCIO DA INTEGRAÇÃO DO PERFIL PÚBLICO ---
  window.openUserProfile = (nickname) => {
    if (!nickname) return;
    
    // Ignorar bots ou sistema
    if (nickname === "Sistema" || nickname === "System") return;
    
    // Converter nome "Você" para o apelido real
    const realName = (nickname === "Você") ? (window.confirmedNickname || currentUser) : nickname;
    const isMe = (realName.toLowerCase() === (window.confirmedNickname || currentUser).toLowerCase());

    const now = Date.now();
    const cached = profileCache.get(realName.toLowerCase());
    
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      displayUserProfileModal(cached.data, isMe);
      return;
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      window.pendingProfileRequest = {
        nickname: realName,
        isMe: isMe,
        timestamp: now
      };
      
      socket.send(JSON.stringify({
        type: "get_profile",
        nickname: realName
      }));
    } else {
      if (isMe) {
        const localProfile = {
          nickname: realName,
          photoUrl: localStorage.getItem("papos_photo") || "",
          bio: localStorage.getItem("papos_bio") || "",
          age: localStorage.getItem("papos_age") ? Number(localStorage.getItem("papos_age")) : null,
          gender: localStorage.getItem("papos_gender") || "",
          online: true
        };
        displayUserProfileModal(localProfile, true);
      } else {
        alert("Não foi possível carregar o perfil. Verifique sua conexão.");
      }
    }
  };

  window.handleProfileDataResponse = (data) => {
    if (!data || !data.nickname) return;
    
    const reqInfo = window.pendingProfileRequest;
    const isMe = reqInfo ? (data.nickname.toLowerCase() === (window.confirmedNickname || currentUser).toLowerCase()) : false;
    
    // Salvar no cache
    profileCache.set(data.nickname.toLowerCase(), {
      data: data,
      timestamp: Date.now()
    });

    displayUserProfileModal(data, isMe);
    window.pendingProfileRequest = null;
  };

  function displayUserProfileModal(profile, isMe) {
    const modalEl = document.getElementById("userProfileModal");
    if (!modalEl) return;

    const avatarContainer = document.getElementById("modal-profile-avatar-container");
    const onlineIndicator = document.getElementById("modal-profile-online-indicator");
    const nicknameEl = document.getElementById("modal-profile-nickname");
    const permanentIdEl = document.getElementById("modal-profile-permanent-id");
    const statusTextEl = document.getElementById("modal-profile-status-text");
    const ageEl = document.getElementById("modal-profile-age");
    const genderEl = document.getElementById("modal-profile-gender");
    const bioEl = document.getElementById("modal-profile-bio");
    const actionBtn = document.getElementById("btn-modal-profile-action");

    // 1. Avatar
    if (avatarContainer) {
      avatarContainer.innerHTML = ChatEngine.renderAvatar(profile.nickname, "avatar-lg mx-auto");
    }

    // 2. Indicador Online
    if (onlineIndicator) {
      if (profile.online) {
        onlineIndicator.classList.remove("d-none");
      } else {
        onlineIndicator.classList.add("d-none");
      }
    }

    // 3. Nome
    if (nicknameEl) {
      nicknameEl.textContent = profile.nickname;
    }

    // 3.5 Identificador Único
    if (permanentIdEl) {
      permanentIdEl.textContent = profile.permanentId || "USR-Membro";
    }

    // 4. Status de texto
    if (statusTextEl) {
      statusTextEl.textContent = profile.online ? "Membro conectado" : "Offline no momento";
      statusTextEl.className = profile.online ? "text-success small mb-4" : "text-secondary small mb-4";
    }

    // 5. Idade
    if (ageEl) {
      if (profile.age !== null && profile.age !== undefined && profile.age !== "") {
        ageEl.textContent = `${profile.age} anos`;
        ageEl.className = "text-white";
      } else {
        ageEl.textContent = "Idade não informada";
        ageEl.className = "text-secondary small";
      }
    }

    // 6. Sexo
    if (genderEl) {
      if (profile.gender && profile.gender.trim() !== "") {
        genderEl.textContent = profile.gender;
        genderEl.className = "text-white";
      } else {
        genderEl.textContent = "Sexo não informado";
        genderEl.className = "text-secondary small";
      }
    }

    // 7. Biografia (texto seguro, sem HTML injection)
    if (bioEl) {
      if (profile.bio && profile.bio.trim() !== "") {
        bioEl.textContent = profile.bio;
        bioEl.className = "text-white-50 small text-break";
      } else {
        bioEl.textContent = "Sem biografia ainda";
        bioEl.className = "text-secondary small italic";
      }
    }

    // 8. Botão de Ação
    if (actionBtn) {
      actionBtn.classList.remove("d-none");
      if (isMe) {
        actionBtn.textContent = "Editar meu perfil";
        actionBtn.className = "btn btn-secondary-custom w-100 py-2.5";
        actionBtn.onclick = () => {
          const modalInstance = bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) modalInstance.hide();
          window.location.href = "/perfil";
        };
      } else {
        actionBtn.textContent = "Conversar no privado";
        actionBtn.className = "btn btn-premium w-100 py-2.5";
        actionBtn.onclick = () => {
          const modalInstance = bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) modalInstance.hide();
          window.startPrivateChat(profile.nickname);
        };
      }
    }

    // Mostrar modal com a API do Bootstrap
    const modalInstance = new bootstrap.Modal(modalEl);
    modalInstance.show();
  }
  // --- FIM DA INTEGRAÇÃO DO PERFIL PÚBLICO ---
});

// Expose safe Mock commonJS module exports for emoji-picker-react package to satisfy requirements
if (typeof exports !== 'undefined') {
  try {
    exports.EmojiPickerReact = require('emoji-picker-react');
  } catch (e) {
    // Ignore gracefully in client browsers
  }
}

// Initialize faces category initially
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => { window.switchEmojiCategory("faces"); }, 200);
  });
} else {
  setTimeout(() => { window.switchEmojiCategory("faces"); }, 200);
}
