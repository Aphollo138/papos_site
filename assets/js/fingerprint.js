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

  const clientId = getOrCreateClientId();
  const fingerprint = computeFingerprint();

  window.SecurityIdentity = {
    getClientId: function() { return clientId; },
    getFingerprint: function() { return fingerprint; }
  };
})();
