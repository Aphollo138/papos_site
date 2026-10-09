
document.addEventListener("DOMContentLoaded", () => {
  const ChatEngine = {
    getUser: () => (window.ChatEngine && window.ChatEngine.getUser) ? window.ChatEngine.getUser() : (localStorage.getItem("papos_nickname") || null),
    renderAvatar: (name, sizeClass = "") => {
      if (window.ChatEngine && typeof window.ChatEngine.renderAvatar === "function") {
        return window.ChatEngine.renderAvatar(name, sizeClass);
      }
      const photo = localStorage.getItem("papos_photo") || localStorage.getItem(`papos_photo_${name}`) || localStorage.getItem(`papos_photo_${(name||"").toLowerCase()}`);
      if (photo && typeof photo === "string" && photo.trim() !== "" && !photo.includes("null") && !photo.includes("undefined")) {
        const safeUrl = photo.replace(/"/g, '&quot;');
        const safeName = (name || "A").replace(/"/g, '&quot;');
        return `<img src="${safeUrl}" class="avatar-circle ${sizeClass}" alt="Avatar de ${safeName}" title="${safeName}" style="object-fit: cover; aspect-ratio: 1 / 1;" />`;
      }
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

  const roomsContainer = document.getElementById("rooms-container");
  const searchInput = document.getElementById("search-rooms");
  const createRoomForm = document.getElementById("create-room-form");
  const userHeaderContainer = document.getElementById("user-profile-header");
  const createRoomModalEl = document.getElementById("createRoomModal");

  let cachedRooms = [];

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

  const socket = ChatEngine.connectSocket();

  socket.onopen = () => {
    
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
          
          const modalInstance = bootstrap.Modal.getInstance(createRoomModalEl);
          if (modalInstance) {
            modalInstance.hide();
          }
          
          window.location.href = `/chat?room=${data.room.id}`;
          break;

        case "admin:broadcast":
        case "admin:private":
        case "admin-global-message":
        case "admin-private-message":
        case "global_warning":
        case "individual_warning":
          
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

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderRooms(e.target.value);
    });
  }

  if (createRoomForm) {
    createRoomForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const nameInput = document.getElementById("room-name");
      const descInput = document.getElementById("room-description");
      
      const name = nameInput.value.trim();
      const desc = descInput.value.trim();

      if (name === "") return;

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

  // Interceptar cliques de entrada nas salas para validação de apelido prévia
  document.addEventListener("click", async (e) => {
    const enterBtn = e.target.closest("[id^='btn-enter-']");
    if (!enterBtn) return;
    
    e.preventDefault();
    const href = enterBtn.getAttribute("href");
    const targetRoomId = (new URL(href, window.location.origin)).searchParams.get("room") || "room-1";
    const curNick = ChatEngine.getUser();

    if (!curNick) {
      window.location.href = `/?room=${encodeURIComponent(targetRoomId)}`;
      return;
    }

    const originalHtml = enterBtn.innerHTML;
    enterBtn.classList.add("disabled");
    enterBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Entrando...`;

    try {
      const guestId = window.SecurityIdentity ? window.SecurityIdentity.getGuestId() : (localStorage.getItem("papo_guest_id") || "");
      const uid = localStorage.getItem("papos_uid") || "";
      const res = await fetch(`/api/rooms/${encodeURIComponent(targetRoomId)}/check-nickname?nickname=${encodeURIComponent(curNick)}&guestId=${encodeURIComponent(guestId)}&uid=${encodeURIComponent(uid)}`);
      const data = await res.json();

      if (!res.ok || data.available === false) {
        enterBtn.classList.remove("disabled");
        enterBtn.innerHTML = originalHtml;
        showRoomNickConflictModal(targetRoomId, curNick, data.message || "Este apelido já está sendo utilizado por alguém nesta sala. Escolha outro para continuar.");
        return;
      }
    } catch (err) {
      // Em caso de falha de conexão transitória, prosseguir
    }

    window.location.href = href;
  });

  function showRoomNickConflictModal(roomId, currentNick, errorMsg) {
    let modalEl = document.getElementById("roomNickConflictModal");
    if (!modalEl) {
      modalEl = document.createElement("div");
      modalEl.className = "modal fade";
      modalEl.id = "roomNickConflictModal";
      modalEl.setAttribute("tabindex", "-1");
      modalEl.setAttribute("aria-hidden", "true");
      modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-secondary" style="background-color: var(--surface); color: var(--white); border-radius: var(--radius-md);">
            <div class="modal-header border-secondary">
              <h5 class="modal-title font-display fw-bold text-white d-flex align-items-center gap-2">
                <i class="bi bi-exclamation-triangle-fill" style="color: #ef4444;"></i>
                Apelido Indisponível nesta Sala
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
            </div>
            <div class="modal-body">
              <div id="room-conflict-alert" class="alert p-3 mb-3" style="background-color: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; font-size: 0.9rem; line-height: 1.4; border-radius: var(--radius-sm);">
                ${errorMsg}
              </div>
              <form id="form-room-conflict-nick">
                <div class="mb-3">
                  <label for="input-room-conflict-nick" class="form-label small fw-semibold text-secondary">Escolha outro apelido para esta sala:</label>
                  <input type="text" class="form-control bg-dark border-secondary text-white" id="input-room-conflict-nick" minlength="2" maxlength="15" placeholder="Ex: visitante_${Math.floor(Math.random()*900+100)}" required autocomplete="off">
                  <div id="room-conflict-err-msg" class="d-none mt-2 small fw-semibold" style="color: #ef4444 !important; font-size: 0.82rem;">
                    Este apelido já está sendo utilizado por alguém nesta sala. Escolha outro para continuar.
                  </div>
                </div>
                <div class="d-flex flex-column gap-2 mt-4">
                  <button type="submit" class="btn btn-premium w-100 py-2.5 font-display fw-bold" id="btn-confirm-room-nick">
                    Confirmar e Entrar na Sala
                  </button>
                  <button type="button" class="btn btn-secondary-custom w-100 py-2 small" data-bs-dismiss="modal">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);

      const rForm = document.getElementById("form-room-conflict-nick");
      const rInput = document.getElementById("input-room-conflict-nick");
      const rErr = document.getElementById("room-conflict-err-msg");
      const rSub = document.getElementById("btn-confirm-room-nick");
      let rDebounce = null;

      function clearRoomConflict() {
        if (rInput) {
          rInput.style.borderColor = "";
          rInput.style.boxShadow = "";
        }
        if (rErr) rErr.classList.add("d-none");
        if (rSub) rSub.disabled = false;
      }

      function showRoomInputConflict(m) {
        if (rInput) {
          rInput.style.borderColor = "#ef4444";
          rInput.style.boxShadow = "0 0 0 1px #ef4444";
        }
        if (rErr) {
          rErr.textContent = m || "Este apelido já está sendo utilizado por alguém nesta sala. Escolha outro para continuar.";
          rErr.classList.remove("d-none");
        }
        if (rSub) rSub.disabled = true;
      }

      if (rInput) {
        rInput.addEventListener("input", (e) => {
          clearTimeout(rDebounce);
          const val = e.target.value.trim();
          if (val.length < 2) {
            clearRoomConflict();
            return;
          }
          rDebounce = setTimeout(async () => {
            const guestId = window.SecurityIdentity ? window.SecurityIdentity.getGuestId() : (localStorage.getItem("papo_guest_id") || "");
            const uid = localStorage.getItem("papos_uid") || "";
            try {
              const res = await fetch(`/api/rooms/${encodeURIComponent(modalEl.dataset.roomId || "room-1")}/check-nickname?nickname=${encodeURIComponent(val)}&guestId=${encodeURIComponent(guestId)}&uid=${encodeURIComponent(uid)}`);
              const data = await res.json();
              if (!res.ok || data.available === false) {
                showRoomInputConflict(data.message || "Este apelido já está sendo utilizado por alguém nesta sala. Escolha outro para continuar.");
              } else {
                clearRoomConflict();
              }
            } catch (err) {}
          }, 400);
        });
      }

      if (rForm) {
        rForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const newN = rInput ? rInput.value.trim() : "";
          if (!newN || newN.length < 2) return;

          if (rSub) rSub.disabled = true;
          const targetR = modalEl.dataset.roomId || "room-1";
          const guestId = window.SecurityIdentity ? window.SecurityIdentity.getGuestId() : (localStorage.getItem("papo_guest_id") || "");
          const uid = localStorage.getItem("papos_uid") || "";

          try {
            const res = await fetch(`/api/rooms/${encodeURIComponent(targetR)}/reserve-nickname`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomId: targetR, nickname: newN, guestId, uid })
            });
            const data = await res.json();
            if (!res.ok || data.available === false) {
              showRoomInputConflict(data.message || "Este apelido já está sendo utilizado por alguém nesta sala. Escolha outro para continuar.");
              if (rSub) rSub.disabled = false;
              return;
            }
          } catch (err) {}

          localStorage.setItem("papos_nickname", newN);
          window.location.href = `/chat?room=${encodeURIComponent(targetR)}`;
        });
      }
    } else {
      const alertEl = document.getElementById("room-conflict-alert");
      if (alertEl) {
        alertEl.textContent = errorMsg || "Este apelido já está sendo utilizado por alguém nesta sala. Escolha outro para continuar.";
      }
    }

    modalEl.dataset.roomId = roomId;
    const rInput = document.getElementById("input-room-conflict-nick");
    if (rInput) rInput.value = "";
    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
      const bsM = bootstrap.Modal.getOrCreateInstance(modalEl);
      bsM.show();
    }
  }
});