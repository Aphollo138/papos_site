

(function () {
  "use strict";

  // Estados internos
  let callState = "idle"; // 'idle' | 'requesting' | 'calling' | 'incoming' | 'connected' | 'ended'
  let currentPartner = null; // Nickname do usuário remoto
  let savedPrivatePartner = null; // Nickname do privado que estava aberto antes da chamada
  let activeCallPartnerPhoto = null; 
  let currentCallId = null;
  let localStream = null;
  let peerConnection = null;
  let isMicMuted = false;
  let isSoundMuted = false;
  let callStartTime = null;
  let timerInterval = null;
  let iceServersConfig = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ];
  let pendingRemoteCandidates = [];
  let pendingIncomingData = null;


  let ringAudioCtx = null;
  let ringInterval = null;

 
  async function loadWebRTCConfig() {
    try {
      const resp = await fetch("/api/webrtc-config");
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServersConfig = data.iceServers;
        }
      }
    } catch (e) {
      console.warn("[AudioCall] Usando STUN padrão fallback:", e);
    }
  }

  
  function startRingAudio(type = "incoming") {
    stopRingAudio();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ringAudioCtx = new AudioCtx();
      if (ringAudioCtx.state === "suspended") {
        ringAudioCtx.resume();
      }

      const playTone = () => {
        if (!ringAudioCtx || ringAudioCtx.state === "closed") return;
        const now = ringAudioCtx.currentTime;

        if (type === "incoming") {
         
          const osc1 = ringAudioCtx.createOscillator();
          const osc2 = ringAudioCtx.createOscillator();
          const gain = ringAudioCtx.createGain();

          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

          osc1.frequency.setValueAtTime(440, now); // A4
          osc1.frequency.setValueAtTime(554.37, now + 0.22); // C#5
          osc2.frequency.setValueAtTime(880, now + 0.22); // A5

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ringAudioCtx.destination);

          osc1.start(now);
          osc2.start(now + 0.22);
          osc1.stop(now + 0.85);
          osc2.stop(now + 0.85);
        } else {
          
          const osc = ringAudioCtx.createOscillator();
          const gain = ringAudioCtx.createGain();

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.setValueAtTime(0.12, now + 0.7);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

          osc.frequency.setValueAtTime(425, now);
          osc.connect(gain);
          gain.connect(ringAudioCtx.destination);

          osc.start(now);
          osc.stop(now + 0.75);
        }
      };

      playTone();
      ringInterval = setInterval(playTone, type === "incoming" ? 2200 : 3200);
    } catch (e) {
      console.warn("[AudioCall] Erro ao iniciar sintetizador de áudio:", e);
    }
  }

  function stopRingAudio() {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
    if (ringAudioCtx) {
      try {
        ringAudioCtx.close();
      } catch (e) {}
      ringAudioCtx = null;
    }
  }

  
  function getSocket() {
    return window.activeChatSocket || window.socket || (typeof socket !== "undefined" ? socket : null);
  }

  // Notificação toast elegante
  function showCallToast(message, type = "info") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);
    } else {
      console.log(`[AudioCall] ${type}: ${message}`);
    }
  }

  // Iniciar temporizador
  function startTimer() {
    stopTimer();
    callStartTime = Date.now();
    updateTimerDisplay(0);
    timerInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - callStartTime) / 1000);
      updateTimerDisplay(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    callStartTime = null;
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function updateTimerDisplay(seconds) {
    const formatted = formatTime(seconds);
    const fsTimer = document.getElementById("call-fullscreen-timer");
    if (fsTimer) {
      fsTimer.textContent = formatted;
      fsTimer.style.display = "inline-block";
    }
    const desktopTimer = document.getElementById("call-timer-desktop");
    const mobileTimer = document.getElementById("call-timer-mobile");
    if (desktopTimer) desktopTimer.textContent = formatted;
    if (mobileTimer) mobileTimer.textContent = formatted;
  }

  // Validação estrita de URL de foto para evitar "undefined", "null", etc.
  function isValidPhoto(url) {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined" || trimmed === "false" || trimmed === "true") return false;
    if (trimmed.startsWith("null") || trimmed.startsWith("undefined")) return false;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/") || trimmed.startsWith("/")) {
      return true;
    }
    return false;
  }

  // Obter foto de um usuário de forma segura e sincronizada com o Papos
  function resolveUserPhoto(nickname) {
    if (!nickname) return null;
    const cleanNick = nickname.trim();
    const cleanLower = cleanNick.toLowerCase();

    // 1. Foto do parceiro da chamada ativa (se informada e validada)
    if (activeCallPartnerPhoto && currentPartner && currentPartner.toLowerCase() === cleanLower) {
      if (isValidPhoto(activeCallPartnerPhoto)) {
        return activeCallPartnerPhoto.trim();
      }
    }

    // 2. Se recebemos foto nos dados de chamada pendente
    if (pendingIncomingData && pendingIncomingData.caller && pendingIncomingData.caller.toLowerCase() === cleanLower) {
      if (isValidPhoto(pendingIncomingData.callerPhotoUrl)) {
        return pendingIncomingData.callerPhotoUrl.trim();
      }
    }

    // 3. Função oficial do Papos (mesma fonte usada pelo chat e sistema)
    if (typeof window.getUserCurrentPhoto === "function") {
      const p = window.getUserCurrentPhoto(cleanNick);
      if (isValidPhoto(p)) return p.trim();
    }

    // 4. Usuário atual
    const myNick = (window.confirmedNickname || localStorage.getItem("papos_nickname") || "").trim().toLowerCase();
    if (cleanLower === myNick || cleanNick === "Você") {
      const myPhoto = localStorage.getItem("papos_photo");
      if (isValidPhoto(myPhoto)) return myPhoto.trim();
      return null;
    }

    // 5. Cache oficial de perfis do Papos
    const cache = window.profileCache;
    if (cache) {
      const cached = cache.get(cleanLower) || cache.get(cleanNick);
      if (cached && cached.data) {
        const p = cached.data.photoUrl || cached.data.photoURL || cached.data.profileImage;
        if (isValidPhoto(p)) return p.trim();
      }
    }

    // 6. LocalStorage salvo para o contato
    const stored = localStorage.getItem(`papos_photo_${cleanNick}`) || localStorage.getItem(`papos_photo_${cleanLower}`);
    if (isValidPhoto(stored)) return stored.trim();

    return null;
  }

  // Obter cor do avatar genérico usando a mesma lógica do Papos (ChatEngine)
  function getGenericAvatarColor(name) {
    if (window.ChatEngine && typeof window.ChatEngine.getAvatarColor === "function") {
      return window.ChatEngine.getAvatarColor(name);
    }
    const colors = [
      "#f43f5e", "#ec4899", "#d946ef", "#a855f7", 
      "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", 
      "#06b6d4", "#14b8a6", "#10b981", "#22c55e"
    ];
    if (!name) return colors[0];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  }

  // Criar elemento de avatar genérico fallback idêntico ao padrão do Papos
  function createGenericAvatarElement(name, sizePx = 130) {
    const cleanName = (name && name.trim()) || "A";
    const initial = cleanName.charAt(0).toUpperCase();
    const bgColor = getGenericAvatarColor(cleanName);
    const div = document.createElement("div");
    div.className = "papos-call-avatar-placeholder";
    div.style.cssText = `width: ${sizePx}px; height: ${sizePx}px; font-size: ${Math.round(sizePx * 0.4)}px; background: ${bgColor};`;
    div.setAttribute("title", cleanName);
    div.setAttribute("aria-label", `Avatar de ${cleanName}`);
    div.setAttribute("role", "img");
    div.textContent = initial;
    return div;
  }

  // Renderizar avatar formatado (Foto personalizada se existir; senão avatar genérico padrão)
  function renderCallAvatar(nickname, sizePx = 130) {
    const cleanName = (nickname && nickname.trim()) || "A";
    const photo = resolveUserPhoto(cleanName);

    if (isValidPhoto(photo)) {
      const safeUrl = photo.replace(/"/g, '&quot;');
      const safeName = cleanName.replace(/"/g, '&quot;').replace(/'/g, "\\'");
      return `<img src="${safeUrl}" alt="${safeName}" class="papos-call-avatar-img" style="width: ${sizePx}px; height: ${sizePx}px;" onerror="this.onerror=null;if(window.AudioCallManager&&window.AudioCallManager.createGenericAvatarElement){this.replaceWith(window.AudioCallManager.createGenericAvatarElement('${safeName}', ${sizePx}));}" />`;
    }

    const initial = cleanName.charAt(0).toUpperCase();
    const bgColor = getGenericAvatarColor(cleanName);
    return `
      <div class="papos-call-avatar-placeholder" style="width: ${sizePx}px; height: ${sizePx}px; font-size: ${Math.round(sizePx * 0.4)}px; background: ${bgColor};" title="${cleanName}" aria-label="Avatar de ${cleanName}" role="img">
        ${initial}
      </div>
    `;
  }

  // Atualizar visual do botão no cabeçalho do chat privado
  function updateHeaderCallButton() {
    const btn = document.getElementById("btn-start-audio-call");
    const indicator = document.getElementById("call-active-indicator");
    if (!btn) return;

    const activePrivate = (window.activePrivateRecipient || "").trim();

    if (callState === "calling" || callState === "requesting") {
      btn.classList.add("btn-warning-custom", "border-warning");
      btn.classList.remove("btn-secondary-custom", "btn-success-custom");
      btn.title = `Chamando ${currentPartner || activePrivate}...`;
      btn.setAttribute("aria-label", `Chamando ${currentPartner || activePrivate}`);
      if (indicator) indicator.classList.remove("d-none");
    } else if (callState === "connected") {
      btn.classList.add("btn-success-custom", "border-success");
      btn.classList.remove("btn-secondary-custom", "btn-warning-custom");
      btn.title = `Chamada ativa com ${currentPartner}`;
      btn.setAttribute("aria-label", `Chamada ativa com ${currentPartner}`);
      if (indicator) indicator.classList.remove("d-none");
    } else {
      btn.classList.remove("btn-warning-custom", "btn-success-custom", "border-warning", "border-success");
      btn.classList.add("btn-secondary-custom");
      btn.title = activePrivate ? `Ligar para ${activePrivate}` : "Iniciar chamada de áudio";
      btn.setAttribute("aria-label", activePrivate ? `Ligar para ${activePrivate}` : "Iniciar chamada de áudio");
      if (indicator) indicator.classList.add("d-none");
    }
  }

  // Fechar tela cheia de chamada
  function closeFullScreenCallUI() {
    document.body.classList.remove("in-call-fullscreen");
    const view = document.getElementById("full-screen-audio-call-view");
    if (view) {
      view.classList.add("d-none");
      view.innerHTML = "";
    }
  }

  // Renderizar a tela de chamada 100% tela inteira (100vw, 100vh, min-height: 100dvh)
  function renderFullScreenCallUI(statusText = "Conectando...") {
    let view = document.getElementById("full-screen-audio-call-view");
    if (!view) {
      view = document.createElement("div");
      view.id = "full-screen-audio-call-view";
      document.body.appendChild(view);
    }

    if (callState === "idle" || callState === "ended") {
      closeFullScreenCallUI();
      updateHeaderCallButton();
      return;
    }

    document.body.classList.add("in-call-fullscreen");
    view.classList.remove("d-none");
    view.className = "papos-call-fullscreen-view";

    const partner = currentPartner || (pendingIncomingData && pendingIncomingData.caller) || "Contato";
    const isConnected = (callState === "connected");
    const isIncoming = (callState === "incoming");
    const isCalling = (callState === "calling");

    const effectiveStatusText = isConnected
      ? "Em chamada"
      : (isIncoming ? "Chamada recebida..." : statusText);

    view.innerHTML = `
      <!-- Cabeçalho Superior da Chamada -->
      <div class="papos-call-header">
        <span class="badge rounded-pill bg-dark border border-secondary text-secondary d-inline-flex align-items-center gap-1.5 py-1 px-2.5" style="font-size: 0.78rem;">
          <i class="bi bi-shield-lock-fill text-success"></i>
          <span>Áudio Criptografado P2P</span>
        </span>
        <div class="text-secondary small fw-medium" style="font-size: 0.78rem;">
          Papo.net.br
        </div>
      </div>

      <!-- Corpo Central: Avatar, Nome, Status e Temporizador -->
      <div class="papos-call-body">
        <div class="papos-call-avatar-wrapper">
          ${(isCalling || isIncoming) ? '<div class="papos-call-wave"></div>' : ''}
          ${renderCallAvatar(partner, 130)}
        </div>

        <h2 class="papos-call-name">${partner}</h2>

        <div class="papos-call-status-badge ${isConnected ? 'connected' : ''}" id="call-fullscreen-status-badge">
          <span class="status-indicator ${isConnected ? 'status-online' : ''} pulse" style="width: 8px; height: 8px; background-color: ${isConnected ? '#10b981' : '#f59e0b'}; border-radius: 50%; display: inline-block;"></span>
          <span id="call-fullscreen-status-text">${effectiveStatusText}</span>
        </div>

        <div class="papos-call-timer" id="call-fullscreen-timer" style="${isConnected ? 'display: inline-block;' : 'display: none;'}">
          ${callStartTime ? formatTime(Math.floor((Date.now() - callStartTime) / 1000)) : "00:00"}
        </div>
      </div>

      <!-- Controles Inferiores da Chamada -->
      <div class="papos-call-controls">
        ${isIncoming ? `
          <!-- Ações de Chamada Recebida: Recusar e Atender -->
          <button type="button" class="papos-call-btn-action" id="call-fs-btn-reject" aria-label="Recusar chamada">
            <div class="papos-call-btn-circle btn-hangup">
              <i class="bi bi-telephone-x-fill"></i>
            </div>
            <span class="papos-call-btn-label">Recusar</span>
          </button>

          <button type="button" class="papos-call-btn-action" id="call-fs-btn-accept" aria-label="Atender chamada">
            <div class="papos-call-btn-circle btn-accept">
              <i class="bi bi-telephone-fill"></i>
            </div>
            <span class="papos-call-btn-label" style="color: #34d399;">Atender</span>
          </button>
        ` : `
          <!-- Ações de Chamada Ativa: Mutar Mic, Desligar, Mutar Som -->
          <button type="button" class="papos-call-btn-action" id="call-fs-btn-mic" aria-label="${isMicMuted ? 'Ativar microfone' : 'Mutar microfone'}">
            <div class="papos-call-btn-circle ${isMicMuted ? 'active-muted' : ''}">
              <i class="bi ${isMicMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}"></i>
            </div>
            <span class="papos-call-btn-label">${isMicMuted ? 'Mutado' : 'Mudo'}</span>
          </button>

          <button type="button" class="papos-call-btn-action" id="call-fs-btn-hangup" aria-label="Desligar chamada">
            <div class="papos-call-btn-circle btn-hangup">
              <i class="bi bi-telephone-x-fill"></i>
            </div>
            <span class="papos-call-btn-label" style="color: #f87171; font-weight: 700;">Desligar</span>
          </button>

          <button type="button" class="papos-call-btn-action" id="call-fs-btn-sound" aria-label="${isSoundMuted ? 'Ativar som' : 'Desativar som'}">
            <div class="papos-call-btn-circle ${isSoundMuted ? 'active-muted' : ''}">
              <i class="bi ${isSoundMuted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'}"></i>
            </div>
            <span class="papos-call-btn-label">${isSoundMuted ? 'Mudo' : 'Som'}</span>
          </button>
        `}
      </div>
    `;

    attachFullScreenCallEvents();
    updateHeaderCallButton();
  }

  // Vincular eventos da tela de chamada
  function attachFullScreenCallEvents() {
    const btnMic = document.getElementById("call-fs-btn-mic");
    const btnSound = document.getElementById("call-fs-btn-sound");
    const btnHangup = document.getElementById("call-fs-btn-hangup");
    const btnAccept = document.getElementById("call-fs-btn-accept");
    const btnReject = document.getElementById("call-fs-btn-reject");

    if (btnMic) btnMic.onclick = toggleMicrophone;
    if (btnSound) btnSound.onclick = toggleSound;
    if (btnHangup) btnHangup.onclick = () => endCall(true);
    if (btnAccept) btnAccept.onclick = () => acceptIncomingCall();
    if (btnReject) btnReject.onclick = () => rejectIncomingCall("declined");
  }

  // Alternar Mute do Microfone (Áudio Local)
  function toggleMicrophone() {
    isMicMuted = !isMicMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMicMuted;
      });
    }
    showCallToast(isMicMuted ? "Microfone mutado." : "Microfone ativado.", "info");
    renderFullScreenCallUI(callState === "connected" ? "Em chamada" : "Chamando...");
  }

  // Alternar Som Remoto (Alto-falante)
  function toggleSound() {
    isSoundMuted = !isSoundMuted;
    const remoteAudio = document.getElementById("remote-call-audio");
    if (remoteAudio) {
      remoteAudio.muted = isSoundMuted;
    }
    showCallToast(isSoundMuted ? "Som desativado." : "Som ativado.", "info");
    renderFullScreenCallUI(callState === "connected" ? "Em chamada" : "Chamando...");
  }

  // Exibir Chamada Recebida
  function showIncomingCallModal(callerNickname, offer, callerPhotoUrl = null) {
    savedPrivatePartner = (window.activePrivateRecipient || callerNickname || "").trim();
    pendingIncomingData = { caller: callerNickname, offer, callerPhotoUrl };
    if (callerPhotoUrl && isValidPhoto(callerPhotoUrl)) {
      activeCallPartnerPhoto = callerPhotoUrl.trim();
      if (window.profileCache) {
        const cached = window.profileCache.get(callerNickname.toLowerCase()) || { data: {} };
        cached.data = cached.data || {};
        cached.data.photoUrl = callerPhotoUrl.trim();
        cached.data.profileImage = callerPhotoUrl.trim();
        window.profileCache.set(callerNickname.toLowerCase(), cached);
      }
    }
    callState = "incoming";
    currentPartner = callerNickname;
    renderFullScreenCallUI("Chamada de áudio recebida...");
    startRingAudio("incoming");
  }

  function hideIncomingCallModal() {
    stopRingAudio();
    closeFullScreenCallUI();
  }

  // Recusar chamada recebida
  function rejectIncomingCall(reason = "declined") {
    const callerName = (pendingIncomingData && pendingIncomingData.caller) || currentPartner || savedPrivatePartner;
    const partnerToRestore = callerName || window.activePrivateRecipient;

    hideIncomingCallModal();

    if (callerName) {
      const sock = getSocket();
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "call:reject",
          to: callerName,
          reason: reason
        }));
      }
    }

    if (localStream) {
      try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      localStream = null;
    }
    if (peerConnection) {
      try {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.close();
      } catch (e) {}
      peerConnection = null;
    }

    const remoteAudio = document.getElementById("remote-call-audio");
    if (remoteAudio) {
      remoteAudio.srcObject = null;
      try { remoteAudio.pause(); } catch (e) {}
    }

    pendingIncomingData = null;
    callState = "idle";
    currentPartner = null;
    activeCallPartnerPhoto = null;
    savedPrivatePartner = null;
    isMicMuted = false;
    isSoundMuted = false;
    pendingRemoteCandidates = [];

    updateHeaderCallButton();

    // Retornar imediatamente ao chat privado sem reload nem deslogar
    if (partnerToRestore && typeof window.openPrivateChat === "function") {
      window.openPrivateChat(partnerToRestore);
    }
  }

  // Aceitar chamada recebida
  async function acceptIncomingCall() {
    if (!pendingIncomingData) return;
    const { caller, offer } = pendingIncomingData;
    stopRingAudio();

    // Se não estivermos na conversa privada do chamador, mudar a conversa ativa para ela sem recarregar!
    if (window.openPrivateChat) {
      window.openPrivateChat(caller);
    }

    try {
      // Obter permissão do microfone
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
    } catch (err) {
      console.error("[AudioCall] Falha ao acessar microfone:", err);
      showCallToast("Permissão de microfone negada. Verifique as configurações do navegador.", "error");
      rejectIncomingCall("permission_denied");
      return;
    }

    callState = "connected";
    currentPartner = caller;
    renderFullScreenCallUI("Conectando...");

    try {
      peerConnection = new RTCPeerConnection({ iceServers: iceServersConfig });

      // Adicionar faixas locais ao PeerConnection
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Tratar faixa remota de áudio
      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteAudio = document.getElementById("remote-call-audio") || new Audio();
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.play().catch(e => console.warn("[AudioCall] Autoplay bloqueado:", e));
        }
      };

      // Enviar candidatos ICE locais
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const sock = getSocket();
          if (sock && sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({
              type: "call:ice_candidate",
              to: caller,
              candidate: event.candidate
            }));
          }
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (!peerConnection) return;
        if (peerConnection.connectionState === "connected") {
          startTimer();
          renderFullScreenCallUI("Em chamada");
        } else if (peerConnection.connectionState === "disconnected" || peerConnection.connectionState === "failed") {
          setTimeout(() => {
            if (peerConnection && (peerConnection.connectionState === "disconnected" || peerConnection.connectionState === "failed")) {
              showCallToast("A chamada foi desconectada.", "warning");
              endCall(true);
            }
          }, 4000);
        }
      };

      // Configurar descrição remota com a oferta recebida
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Processar candidatos que chegaram antes da oferta
      while (pendingRemoteCandidates.length > 0) {
        const c = pendingRemoteCandidates.shift();
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {}
      }

      // Criar e enviar resposta (Answer)
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const sock = getSocket();
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "call:answer",
          to: caller,
          answer: answer
        }));
      }

      startTimer();
      renderFullScreenCallUI("Em chamada");
    } catch (err) {
      console.error("[AudioCall] Erro no handshake WebRTC:", err);
      showCallToast("Falha ao estabelecer conexão de voz.", "error");
      endCall(true);
    }
  }

  // Iniciar chamada ativa (Chamador) - Passo 1: Validação prévia
  async function initiateCall(targetNickname) {
    if (!targetNickname) {
      showCallToast("Selecione um usuário para ligar.", "warning");
      return;
    }

    if (callState !== "idle") {
      showCallToast("Você já possui uma chamada em andamento.", "warning");
      return;
    }

    const myNick = (window.confirmedNickname || localStorage.getItem("papos_nickname") || "").trim();
    if (targetNickname.toLowerCase() === myNick.toLowerCase()) {
      showCallToast("Você não pode ligar para si mesmo.", "warning");
      return;
    }

    // 1. Verificação preliminar de cache local
    if (window.profileCache) {
      const cached = window.profileCache.get(targetNickname.toLowerCase()) || window.profileCache.get(targetNickname);
      if (cached && cached.data && cached.data.blockCalls === true) {
        showCallToast("Esta pessoa não pode aceitar ligações no momento.", "warning");
        return;
      }
    }

    const sock = getSocket();
    if (!sock || sock.readyState !== WebSocket.OPEN) {
      showCallToast("Sem conexão com o servidor de mensagens.", "warning");
      return;
    }

    // 2. Consulta ao WebSocket/Backend ANTES de pedir permissão de microfone e antes de abrir a tela
    savedPrivatePartner = (window.activePrivateRecipient || targetNickname || "").trim();
    callState = "requesting";
    currentPartner = targetNickname;
    updateHeaderCallButton();

    sock.send(JSON.stringify({
      type: "call:request",
      to: targetNickname
    }));
  }

  // Passo 2: Executar a chamada quando autorizada pelo servidor
  async function startOutgoingCall(targetNickname) {
    if (!savedPrivatePartner) {
      savedPrivatePartner = (window.activePrivateRecipient || targetNickname || "").trim();
    }
    currentPartner = targetNickname;
    callState = "calling";
    pendingRemoteCandidates = [];

    // Obter permissão do microfone
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
    } catch (err) {
      console.error("[AudioCall] Permissão do microfone negada:", err);
      showCallToast("Permissão para usar o microfone foi negada. Verifique as permissões do navegador.", "error");
      callState = "idle";
      currentPartner = null;
      updateHeaderCallButton();
      return;
    }

    renderFullScreenCallUI(`Chamando ${targetNickname}...`);
    startRingAudio("calling");

    try {
      peerConnection = new RTCPeerConnection({ iceServers: iceServersConfig });

      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteAudio = document.getElementById("remote-call-audio") || new Audio();
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.play().catch(e => console.warn("[AudioCall] Autoplay bloqueado:", e));
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const sock = getSocket();
          if (sock && sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({
              type: "call:ice_candidate",
              to: targetNickname,
              candidate: event.candidate
            }));
          }
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (!peerConnection) return;
        if (peerConnection.connectionState === "connected") {
          stopRingAudio();
          startTimer();
          renderFullScreenCallUI("Em chamada");
        } else if (peerConnection.connectionState === "disconnected" || peerConnection.connectionState === "failed") {
          setTimeout(() => {
            if (peerConnection && (peerConnection.connectionState === "disconnected" || peerConnection.connectionState === "failed")) {
              showCallToast("A chamada foi desconectada.", "warning");
              endCall(true);
            }
          }, 4000);
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sock = getSocket();
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "call:offer",
          to: targetNickname,
          offer: offer
        }));
      } else {
        throw new Error("Conexão com o servidor indisponível.");
      }
    } catch (err) {
      console.error("[AudioCall] Erro ao iniciar chamada:", err);
      showCallToast("Erro ao conectar chamada: " + (err.message || "Tente novamente."), "error");
      endCall(false);
    }
  }

  // Encerrar chamada ativa
  function endCall(notifyServer = true, reason = null) {
    const partnerToRestore = currentPartner || savedPrivatePartner || (pendingIncomingData && pendingIncomingData.caller) || window.activePrivateRecipient;

    stopRingAudio();
    stopTimer();
    closeFullScreenCallUI();

    if (notifyServer && currentPartner) {
      const sock = getSocket();
      if (sock && sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({
          type: "call:end",
          to: currentPartner
        }));
      }
    }

    if (localStream) {
      try {
        localStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      localStream = null;
    }

    if (peerConnection) {
      try {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.close();
      } catch (e) {}
      peerConnection = null;
    }

    const remoteAudio = document.getElementById("remote-call-audio");
    if (remoteAudio) {
      remoteAudio.srcObject = null;
      try { remoteAudio.pause(); } catch (e) {}
    }

    const hadActiveCall = (callState !== "idle");
    callState = "idle";
    currentPartner = null;
    activeCallPartnerPhoto = null;
    savedPrivatePartner = null;
    isMicMuted = false;
    isSoundMuted = false;
    pendingRemoteCandidates = [];
    pendingIncomingData = null;

    updateHeaderCallButton();

    if (hadActiveCall && reason !== "rejected") {
      showCallToast("Chamada finalizada.", "info");
    }

    // Retornar imediatamente ao chat privado sem reload nem deslogar
    if (partnerToRestore && typeof window.openPrivateChat === "function") {
      window.openPrivateChat(partnerToRestore);
    }
  }

  // Manipular mensagens de sinalização recebidas via WebSocket
  async function handleSocketMessage(data) {
    if (!data || !data.type) return false;

    switch (data.type) {
      case "call:permitted": {
        if (data.partnerPhotoUrl && isValidPhoto(data.partnerPhotoUrl)) {
          activeCallPartnerPhoto = data.partnerPhotoUrl.trim();
        }
        startOutgoingCall(data.partner || data.to);
        return true;
      }

      case "call:blocked": {
        stopRingAudio();
        const partnerToRestore = currentPartner || savedPrivatePartner || window.activePrivateRecipient;
        endCall(false);
        showCallToast(data.message || "Esta pessoa não pode aceitar ligações no momento.", "warning");
        if (partnerToRestore && typeof window.openPrivateChat === "function") {
          window.openPrivateChat(partnerToRestore);
        }
        return true;
      }

      case "call:incoming": {
        if (callState !== "idle") {
          // Já estamos em outra chamada, rejeitar com busy
          const sock = getSocket();
          if (sock && sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({
              type: "call:reject",
              to: data.from,
              reason: "busy"
            }));
          }
          return true;
        }

        if (data.callerPhotoUrl && isValidPhoto(data.callerPhotoUrl)) {
          activeCallPartnerPhoto = data.callerPhotoUrl.trim();
        }

        // Exibir tela de chamada recebida 100% full screen
        showIncomingCallModal(data.from, data.offer, data.callerPhotoUrl);
        return true;
      }

      case "call:calling": {
        renderFullScreenCallUI(`Chamando ${currentPartner || data.to}...`);
        return true;
      }

      case "call:ringing": {
        renderFullScreenCallUI(`${currentPartner || data.from} está tocando...`);
        return true;
      }

      case "call:answer": {
        stopRingAudio();
        if (data.calleePhotoUrl && isValidPhoto(data.calleePhotoUrl)) {
          activeCallPartnerPhoto = data.calleePhotoUrl.trim();
        }
        if (peerConnection && data.answer) {
          try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            callState = "connected";
            startTimer();
            renderFullScreenCallUI("Em chamada");

            // Descarregar candidatos remotos acumulados
            while (pendingRemoteCandidates.length > 0) {
              const c = pendingRemoteCandidates.shift();
              try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(c));
              } catch (e) {}
            }
          } catch (err) {
            console.error("[AudioCall] Erro ao aplicar answer:", err);
          }
        }
        return true;
      }

      case "call:ice_candidate": {
        if (peerConnection && peerConnection.remoteDescription) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.warn("[AudioCall] Falha ao adicionar candidato ICE:", e);
          }
        } else if (data.candidate) {
          pendingRemoteCandidates.push(data.candidate);
        }
        return true;
      }

      case "call:rejected": {
        stopRingAudio();
        const decliningPartner = data.from || currentPartner || savedPrivatePartner || window.activePrivateRecipient;
        endCall(false, "rejected");

        // Log de sistema na janela do chat privado
        if (decliningPartner && typeof window.appendSystemMessage === "function") {
          if (data.reason === "busy") {
            window.appendSystemMessage(`${decliningPartner} está em outra chamada.`);
          } else {
            window.appendSystemMessage(`${decliningPartner} recusou a chamada.`);
          }
        }
        return true;
      }

      case "call:busy": {
        stopRingAudio();
        const targetNick = currentPartner || savedPrivatePartner || window.activePrivateRecipient;
        endCall(false);
        if (targetNick && typeof window.appendSystemMessage === "function") {
          window.appendSystemMessage(`${targetNick} está em outra chamada.`);
        } else {
          showCallToast(data.message || "O usuário está em outra chamada.", "warning");
        }
        return true;
      }

      case "call:unavailable": {
        stopRingAudio();
        const targetNick = currentPartner || savedPrivatePartner || window.activePrivateRecipient;
        endCall(false);
        showCallToast(data.message || "Usuário indisponível no momento.", "warning");
        if (targetNick && typeof window.openPrivateChat === "function") {
          window.openPrivateChat(targetNick);
        }
        return true;
      }

      case "call:ended": {
        stopRingAudio();
        endCall(false);
        return true;
      }

      case "call:error": {
        stopRingAudio();
        showCallToast(data.message || "Erro durante a chamada.", "error");
        endCall(false);
        return true;
      }
    }

    return false;
  }

  // Inicialização no DOM
  function init() {
    loadWebRTCConfig();

    // Limpar chamada se fechar a janela/aba
    window.addEventListener("beforeunload", () => {
      if (callState !== "idle") {
        endCall(true);
      }
    });

    // Vincular clique no botão de telefone do cabeçalho
    const btnHeaderCall = document.getElementById("btn-start-audio-call");
    if (btnHeaderCall) {
      btnHeaderCall.addEventListener("click", () => {
        const partner = (window.activePrivateRecipient || "").trim();
        if (!partner) {
          showCallToast("Abra uma conversa privada para ligar.", "warning");
          return;
        }

        if (callState === "calling" || callState === "requesting") {
          // Se já está chamando, clicar desliga
          endCall(true);
        } else if (callState === "connected") {
          showCallToast(`Chamada em andamento com ${currentPartner}.`, "info");
        } else {
          initiateCall(partner);
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exportar interface global
  window.AudioCallManager = {
    initiateCall,
    endCall,
    toggleMicrophone,
    toggleSound,
    handleSocketMessage,
    updateHeaderCallButton,
    createGenericAvatarElement,
    getCallState: () => callState,
    getCurrentPartner: () => currentPartner,
    renderActiveCallUI: renderFullScreenCallUI
  };

})();
