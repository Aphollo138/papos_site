/**
 * rooms.js - Real-time rooms view syncing over WebSockets for Papos
 */

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

  const user = ChatEngine.getUser();
  if (!user) {
    window.location.href = "/?error=name_required";
    return;
  }

  // DOM Elements
  const roomsContainer = document.getElementById("rooms-container");
  const searchInput = document.getElementById("search-rooms");
  const createRoomForm = document.getElementById("create-room-form");
  const userHeaderContainer = document.getElementById("user-profile-header");
  const createRoomModalEl = document.getElementById("createRoomModal");

  // In-memory rooms cache for local filtering
  let cachedRooms = [];

  // Render User Header Profile
  if (userHeaderContainer) {
    userHeaderContainer.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        ${ChatEngine.renderAvatar(user, "avatar-sm")}
        <div class="d-none d-sm-block text-start">
          <p class="mb-0 fw-semibold lh-1 text-white">${user}</p>
          <small class="text-success"><span class="status-indicator status-online position-static d-inline-block me-1" style="width:6px; height:6px;"></span>Conectado</small>
        </div>
      </div>
    `;
  }

  // Connect to the real-time WebSocket server
  const socket = ChatEngine.connectSocket();

  socket.onopen = () => {
    console.log("[Rooms] Connected to WebSocket server.");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "room_list":
          cachedRooms = data.rooms;
          renderRooms(searchInput ? searchInput.value : "");
          break;

        case "room_created":
          // Close modal
          const modalInstance = bootstrap.Modal.getInstance(createRoomModalEl);
          if (modalInstance) {
            modalInstance.hide();
          }
          // Redirect straight to new room clean route
          window.location.href = `/chat?room=${data.room.id}`;
          break;

        case "admin:broadcast":
        case "admin:private":
        case "admin-global-message":
        case "admin-private-message":
        case "global_warning":
        case "individual_warning":
          console.log("Mensagem administrativa recebida.");
          console.log("Exibindo popup.");
          if (typeof window.showIncomingAdminWarningModal === "function") {
            window.showIncomingAdminWarningModal(
              data.message || data.text,
              data.title || "Mensagem da Administração"
            );
          } else if (typeof window.showAdminWarningModal === "function") {
            window.showAdminWarningModal(
              data.message || data.text,
              data.title || "Mensagem da Administração"
            );
          }
          break;

        case "error":
          alert("Erro: " + data.message);
          break;
      }
    } catch (err) {
      console.error("[Rooms] Error handling socket message:", err);
    }
  };

  socket.onerror = (err) => {
    console.error("[Rooms] Socket error:", err);
  };

  // Render rooms cards based on current query
  function renderRooms(filterText = "") {
    if (!roomsContainer) return;
    roomsContainer.innerHTML = "";

    const filtered = cachedRooms.filter(room => {
      const matchName = room.name.toLowerCase().includes(filterText.toLowerCase());
      const matchDesc = room.desc.toLowerCase().includes(filterText.toLowerCase());
      return matchName || matchDesc;
    });

    if (filtered.length === 0) {
      roomsContainer.innerHTML = `
        <div class="col-12 text-center py-5">
          <div class="display-3 text-secondary mb-3"><i class="bi bi-search"></i></div>
          <h3 class="fw-bold text-white">Nenhuma sala encontrada</h3>
          <p class="text-secondary small">Nenhuma sala corresponde à pesquisa "${filterText}".</p>
        </div>
      `;
      return;
    }

    filtered.forEach((room) => {
      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4";
      
      // Determine initials for clean editorial avatar
      const initials = room.name.split(" ").map(w => w.charAt(0)).join("").substring(0, 2).toUpperCase();
      const countLabel = room.count === 1 ? "1 pessoa ativa" : `${room.count} pessoas ativas`;

      col.innerHTML = `
        <article class="card h-100 card-room" id="card-${room.id}">
          <div class="card-body d-flex flex-column p-4">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <div class="avatar-circle" style="background-color: var(--border); color: var(--white); font-weight: bold; width: 44px; height: 44px; font-size: 0.95rem;">
                ${initials}
              </div>
              <span class="badge bg-dark border text-secondary rounded-pill px-2 py-1 small">
                ${countLabel}
              </span>
            </div>
            
            <h3 class="h5 card-title fw-bold mb-2 text-white">${room.name}</h3>
            <p class="card-text text-secondary flex-grow-1 small">${room.desc}</p>
            
            <div class="mt-4 pt-3 border-top border-secondary d-flex align-items-center justify-content-between">
              <span class="text-success small fw-medium d-flex align-items-center gap-1">
                <span class="status-indicator status-online position-static d-inline-block" style="width:6px; height:6px;"></span>
                Ativa
              </span>
              <a href="/chat?room=${room.id}" class="btn btn-premium btn-sm px-4 py-2" id="btn-enter-${room.id}">
                Entrar <i class="bi bi-arrow-right-short ms-1"></i>
              </a>
            </div>
          </div>
        </article>
      `;
      roomsContainer.appendChild(col);
    });
  }

  // Handle Search Input Filter
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderRooms(e.target.value);
    });
  }

  // Handle Create Room Modal Submit
  if (createRoomForm) {
    createRoomForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const nameInput = document.getElementById("room-name");
      const descInput = document.getElementById("room-description");
      
      const name = nameInput.value.trim();
      const desc = descInput.value.trim();

      if (name === "") return;

      // Send room creation request over WS
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "create_room",
          name,
          desc
        }));
      } else {
        alert("Erro na conexão WebSocket. Aguarde restabelecer.");
      }
    });
  }
});
