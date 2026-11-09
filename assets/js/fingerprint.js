(function() {
  function getOrCreateClientId() {
    let clientId = localStorage.getItem("papo_client_id");
    if (!clientId) {
      try {
        const randBytes = Array.from(crypto.getRandomValues(new Uint8Array(6)));
        const randHex = randBytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        clientId = "PAPO-" + randHex;
      } catch (e) {
        clientId = "PAPO-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      }
      localStorage.setItem("papo_client_id", clientId);
    }
    return clientId;
  }

  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem("papo_device_id");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId || "")) {
      try {
        deviceId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "";
      } catch {
        deviceId = "";
      }
      if (!deviceId) {
        const bytes = new Uint8Array(16);
        if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
          crypto.getRandomValues(bytes);
        } else {
          for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
        deviceId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
      localStorage.setItem("papo_device_id", deviceId);
    }
    return deviceId;
  }

  function computeFingerprint() {
    try {
      const parts = [];
      parts.push((window.screen ? window.screen.width : 0) + "x" + (window.screen ? window.screen.height : 0) + "x" + (window.screen ? window.screen.colorDepth : 0));
      parts.push(window.devicePixelRatio || 1);
      try {
        parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
      } catch (e) {
        parts.push(new Date().getTimezoneOffset());
      }
      parts.push(navigator.language || navigator.userLanguage || "");
      parts.push(navigator.platform || "");
      parts.push(navigator.hardwareConcurrency || 1);

      // Canvas fingerprint
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.textBaseline = "top";
          ctx.font = "14px 'Arial'";
          ctx.textBaseline = "alphabetic";
          ctx.fillStyle = "#f60";
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = "#069";
          ctx.fillText("PapoNetBR,123", 2, 15);
          ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
          ctx.fillText("PapoNetBR,123", 4, 17);
          parts.push(canvas.toDataURL().slice(-100));
        }
      } catch (e) {}

      // WebGL fingerprint
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
          const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
          if (debugInfo) {
            parts.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "");
            parts.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "");
          }
        }
      } catch (e) {}

      const str = parts.join("|||");

      // Double FNV-1a 32-bit hash
      let h1 = 0x811c9dc5;
      let h2 = 0x01000193;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        h1 ^= code;
        h1 = Math.imul(h1, 16777619);
        h2 ^= code;
        h2 = Math.imul(h2, 314159265);
      }
      const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
      const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
      return (hex1 + hex2).toLowerCase();
    } catch (e) {
      return "fp_" + getOrCreateClientId();
    }
  }

  function getOrCreateGuestId() {
    let guestId = localStorage.getItem("papo_guest_id") || localStorage.getItem("papos_permanent_id");
    if (!guestId) {
      try {
        const randBytes = Array.from(crypto.getRandomValues(new Uint8Array(4)));
        const randHex = randBytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        guestId = "GST-" + randHex;
      } catch (e) {
        guestId = "GST-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      }
      localStorage.setItem("papo_guest_id", guestId);
    }
    if (!localStorage.getItem("papos_permanent_id")) {
      localStorage.setItem("papos_permanent_id", guestId);
    }
    return guestId;
  }

  function getGuestToken() {
    return sessionStorage.getItem("papo_guest_token") || localStorage.getItem("papo_guest_token") || "";
  }

  function setGuestToken(token, id) {
    if (token) {
      sessionStorage.setItem("papo_guest_token", token);
      localStorage.setItem("papo_guest_token", token);
    }
    if (id) {
      localStorage.setItem("papo_guest_id", id);
      localStorage.setItem("papos_permanent_id", id);
    }
  }

  async function initGuestToken() {
    const existing = getGuestToken();
    try {
      const url = existing ? `/api/session/guest-token?token=${encodeURIComponent(existing)}` : "/api/session/guest-token";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.guestToken) {
          setGuestToken(data.guestToken, data.guestId);
          return data;
        }
      }
    } catch (e) {}
    return { guestToken: existing, guestId: getOrCreateGuestId() };
  }

  const clientId = getOrCreateClientId();
  const deviceId = getOrCreateDeviceId();
  const guestId = getOrCreateGuestId();
  let fingerprint;
  try {
    fingerprint = localStorage.getItem("papo_fingerprint_id");
    if (!fingerprint) {
      fingerprint = computeFingerprint();
      localStorage.setItem("papo_fingerprint_id", fingerprint);
    }
  } catch (e) {
    fingerprint = computeFingerprint();
  }
  const photoOwnerId = `device:${deviceId}`;
  let photoDatabasePromise;

  function openPhotoDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("O navegador não oferece armazenamento local para fotos."));
    }
    if (!photoDatabasePromise) {
      photoDatabasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open("papos-profile-storage", 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("photos")) {
            database.createObjectStore("photos");
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento local de fotos."));
        request.onblocked = () => reject(new Error("O armazenamento local de fotos está bloqueado por outra aba."));
      });
    }
    return photoDatabasePromise;
  }

  async function savePhoto(ownerId, file) {
    if (!ownerId || !(file instanceof Blob)) {
      throw new Error("A foto ou o identificador do proprietário é inválido.");
    }
    const database = await openPhotoDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("photos", "readwrite");
      transaction.objectStore("photos").put({
        blob: file,
        type: file.type || "image/jpeg",
        savedAt: Date.now()
      }, ownerId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Não foi possível salvar a foto neste navegador."));
      transaction.onabort = () => reject(transaction.error || new Error("O armazenamento local da foto foi cancelado."));
    });
  }

  async function getSavedPhoto(ownerId) {
    if (!ownerId) return null;
    const database = await openPhotoDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("photos", "readonly");
      const request = transaction.objectStore("photos").get(ownerId);
      request.onsuccess = () => resolve(request.result?.blob instanceof Blob ? request.result.blob : null);
      request.onerror = () => reject(request.error || new Error("Não foi possível ler a foto salva neste navegador."));
    });
  }

  async function removeSavedPhoto(ownerId) {
    if (!ownerId) return;
    const database = await openPhotoDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("photos", "readwrite");
      transaction.objectStore("photos").delete(ownerId);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Não foi possível remover a foto deste navegador."));
      transaction.onabort = () => reject(transaction.error || new Error("A remoção da foto local foi cancelada."));
    });
  }

  async function restoreAvatarImage(image) {
    const ownerId = image && image.dataset ? image.dataset.photoOwnerId : "";
    if (!ownerId) throw new Error("A imagem não possui proprietário local.");
    const blob = await getSavedPhoto(ownerId);
    if (!blob) throw new Error("Não há uma cópia local desta foto.");
    image.onerror = null;
    image.src = URL.createObjectURL(blob);
  }

  // Iniciar obtenção do token assinado do servidor em segundo plano
  if (!getGuestToken()) {
    initGuestToken().catch(() => {});
  }

  window.SecurityIdentity = {
    getClientId: function() { return clientId; },
    getDeviceId: function() { return deviceId; },
    getGuestId: function() { return localStorage.getItem("papo_guest_id") || guestId; },
    getGuestToken: function() { return getGuestToken(); },
    setGuestToken: setGuestToken,
    initGuestToken: initGuestToken,
    getFingerprint: function() { return fingerprint; },
    getPhotoOwnerId: function() { return photoOwnerId; },
    savePhoto: savePhoto,
    getSavedPhoto: getSavedPhoto,
    removeSavedPhoto: removeSavedPhoto,
    restoreAvatarImage: restoreAvatarImage
  };
})();
