/* ChestDrop common functions. No remote code or external dependencies. */
(() => {
  "use strict";

  const MAX_IMAGE_BYTES = 32 * 1024 * 1024; // Extension's conservative safety cap, not an ImgChest API limit.
  const DEFAULTS = Object.freeze({
    openBehavior: "foreground",
    privacy: "hidden",
    nsfw: false,
    screenshotFallback: true,
    useFilenameAsTitle: false
  });
  const EXTENSIONS = {
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
    "image/webp": "webp", "image/bmp": "bmp", "image/avif": "avif"
  };

  function getSettings(value) {
    const obj = value || {};
    return {
      apiToken: typeof obj.apiToken === "string" ? obj.apiToken.trim() : "",
      apiUsername: typeof obj.apiUsername === "string" ? obj.apiUsername.trim().replace(/^@/, "") : "",
      openBehavior: ["foreground", "background", "none"].includes(obj.openBehavior)
        ? obj.openBehavior : DEFAULTS.openBehavior,
      privacy: ["hidden", "public", "secret"].includes(obj.privacy)
        ? obj.privacy : DEFAULTS.privacy,
      nsfw: obj.nsfw === true,
      screenshotFallback: obj.screenshotFallback !== false,
      useFilenameAsTitle: obj.useFilenameAsTitle === true
    };
  }

  // User-controlled portable backups. Only save known settings: never export
  // upload history or arbitrary extension storage fields to a backup file.
  const BACKUP_FORMAT = "chestdrop-settings";
  const BACKUP_VERSION = 1;
  const BACKUP_FIELDS = Object.freeze([
    "apiUsername", "openBehavior", "privacy", "nsfw", "screenshotFallback", "useFilenameAsTitle"
  ]);

  function makeSettingsBackup(stored, includeToken = true) {
    const normalized = getSettings(stored);
    const settings = {};
    for (const field of BACKUP_FIELDS) settings[field] = normalized[field];
    if (includeToken) settings.apiToken = normalized.apiToken;
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      settings
    };
  }

  function parseSettingsBackup(backup) {
    if (!backup || typeof backup !== "object" || Array.isArray(backup) ||
        backup.format !== BACKUP_FORMAT) {
      throw new Error("This is not a ChestDrop settings backup.");
    }
    if (backup.version !== BACKUP_VERSION) {
      throw new Error("This backup uses an unsupported settings format version.");
    }
    const settings = backup.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      throw new Error("The backup has no valid settings object.");
    }
    for (const field of BACKUP_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(settings, field)) {
        throw new Error(\`The backup is missing \${field}.\`);
      }
    }
    if (typeof settings.apiUsername !== "string" ||
        !/^[A-Za-z0-9_.-]{0,80}$/.test(settings.apiUsername.replace(/^@/, ""))) {
      throw new Error("The backup contains an invalid ImgChest username.");
    }
    if (!["foreground", "background", "none"].includes(settings.openBehavior)) {
      throw new Error("The backup contains an invalid tab preference.");
    }
    if (!["hidden", "public", "secret"].includes(settings.privacy)) {
      throw new Error("The backup contains an invalid post visibility value.");
    }
    for (const field of ["nsfw", "screenshotFallback", "useFilenameAsTitle"]) {
      if (typeof settings[field] !== "boolean") {
        throw new Error(\`The backup contains an invalid \${field} setting.\`);
      }
    }
    const restored = {
      apiUsername: settings.apiUsername.trim().replace(/^@/, ""),
      openBehavior: settings.openBehavior,
      privacy: settings.privacy,
      nsfw: settings.nsfw,
      screenshotFallback: settings.screenshotFallback,
      useFilenameAsTitle: settings.useFilenameAsTitle
    };
    // A backup made without a token must not erase the currently saved token.
    if (Object.prototype.hasOwnProperty.call(settings, "apiToken")) {
      if (typeof settings.apiToken !== "string" || /\s/.test(settings.apiToken) ||
          settings.apiToken.length > 4096) {
        throw new Error("The backup contains an invalid API token.");
      }
      restored.apiToken = settings.apiToken;
    }
    return restored;
  }

  function safeFilename(input, mime = "image/png") {
    let name = String(input || "").replace(/\\/g, "/").split("/").pop() || "image";
    try { name = decodeURIComponent(name); } catch (_) { /* invalid percent escape */ }
    name = name.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/^\.+/, "").trim();
    name = name.slice(0, 110) || "image";
    const ext = EXTENSIONS[mime] || "png";
    if (!/\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(name)) {
      name = name.replace(/\.[^.]{1,8}$/, "") + "." + ext;
    } else {
      // Match filename suffix to actual bytes rather than source URL's misleading suffix.
      const current = name.split(".").pop().toLowerCase().replace("jpeg", "jpg");
      if (current !== ext) name = name.replace(/\.[^.]+$/, "." + ext);
    }
    return name;
  }

  function filenameFromUrl(url) {
    if (typeof url !== "string") return "image";
    try {
      const parsed = new URL(url);
      if (["http:", "https:", "file:"].includes(parsed.protocol)) {
        return parsed.pathname.split("/").filter(Boolean).pop() || "image";
      }
    } catch (_) { /* valid data/blob sources may not have path */ }
    return "image";
  }

  function isDiscordCdn(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === "cdn.discordapp.com" || host === "media.discordapp.net" ||
        host.endsWith(".discordapp.net");
    } catch (_) { return false; }
  }

  function sniffMime(bytes) {
    if (!bytes || bytes.length < 12) return null;
    const eq = (offset, ...check) => check.every((n, i) => bytes[offset + i] === n);
    if (eq(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
    if (eq(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
    if (eq(0, 0x47, 0x49, 0x46, 0x38) && [0x37, 0x39].includes(bytes[4]) && bytes[5] === 0x61) return "image/gif";
    if (eq(0, 0x52, 0x49, 0x46, 0x46) && eq(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
    if (eq(0, 0x42, 0x4d)) return "image/bmp";
    if (eq(4, 0x66, 0x74, 0x79, 0x70) &&
        (eq(8, 0x61, 0x76, 0x69, 0x66) || eq(8, 0x61, 0x76, 0x69, 0x73))) return "image/avif";
    return null;
  }

  async function normalizeImageBlob(blob, filename) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error("No image data was available.");
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error("Image exceeds ChestDrop's 32 MiB safety limit.");
    }
    const first = new Uint8Array(await blob.slice(0, 20).arrayBuffer());
    const mime = sniffMime(first);
    if (!mime) throw new Error("Unsupported image data. Supported: JPEG, PNG, GIF, WebP, BMP, AVIF.");
    const typedBlob = new Blob([blob], { type: mime });
    return { blob: typedBlob, mime, filename: safeFilename(filename, mime) };
  }

  function postUrlFromResponse(json) {
    const id = json && json.data && json.data.id;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
      throw new Error("ImgChest did not return a valid post ID.");
    }
    return \`https://imgchest.com/p/\${id}\`;
  }

  function apiError(json, status, retryAfter) {
    let message = json && typeof json.message === "string" ? json.message : "";
    if (json && json.errors && typeof json.errors === "object") {
      const first = Object.values(json.errors).flat().find(value => typeof value === "string");
      if (first) message = first;
    }
    if (status === 401 || status === 403) return "API token rejected. Check or replace it in Settings.";
    if (status === 429) return \`ImgChest rate limit reached.\${retryAfter ? \` Retry after \${retryAfter} seconds.\` : " Try again shortly."}\`;
    if (status === 413) return "ImgChest rejected the upload because it is too large.";
    if (!message) message = \`ImgChest API returned HTTP \${status}.\`;
    return message.slice(0, 250);
  }

  function supportsFetchUrl(url) {
    try { return ["https:", "http:", "data:"].includes(new URL(url).protocol); }
    catch (_) { return false; }
  }

  globalThis.ChestUtils = Object.freeze({
    MAX_IMAGE_BYTES, DEFAULTS, getSettings, makeSettingsBackup, parseSettingsBackup,
    safeFilename, filenameFromUrl,
    isDiscordCdn, sniffMime, normalizeImageBlob, postUrlFromResponse,
    apiError, supportsFetchUrl
  });
})();
