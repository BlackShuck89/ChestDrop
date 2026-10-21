/* ChestDrop: Firefox Manifest V3 background event page. */
(() => {
  "use strict";

  const U = globalThis.ChestUtils;
  const UPLOAD_MENU = "chestdrop-upload-image";
  const TAB_MENU = "chestdrop-upload-tab-image";
  const SETTINGS_MENU = "chestdrop-settings";
  const activeUploads = new Set();

  function installMenus() {
    // For Firefox MV3 event pages, menu definitions persist across wakeups.
    // Register only in onInstalled; repeated top-level creation is incorrect.
    browser.menus.create({
      id: UPLOAD_MENU,
      title: "Upload image to ImgChest",
      contexts: ["image"]
    });
    browser.menus.create({
      id: TAB_MENU,
      title: "Upload image displayed in this tab to ImgChest",
      contexts: ["page"]
    });
    browser.menus.create({
      id: SETTINGS_MENU,
      title: "ChestDrop settings",
      contexts: ["action"]
    });
  }

  function notify(title, message) {
    browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon-96.png"),
      title,
      message: String(message).slice(0, 320)
    }).catch(() => {});
  }

  async function readSettings() {
    return U.getSettings(await browser.storage.local.get([
      "apiToken", "openBehavior", "privacy", "nsfw", "screenshotFallback", "useFilenameAsTitle"
    ]));
  }

  async function fetchImage(url) {
    if (!U.supportsFetchUrl(url)) throw new Error("This URL isn't available to the extension.");
    // Never send the personal API token to the image's source website.
    const response = await fetch(url, {
      method: "GET",
      cache: "force-cache",
      credentials: "omit",
      redirect: "follow"
    });
    if (!response.ok) throw new Error(`Image server returned HTTP ${response.status}.`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > U.MAX_IMAGE_BYTES) throw new Error("Source image exceeds 32 MiB.");
    return U.normalizeImageBlob(await response.blob(), U.filenameFromUrl(url));
  }

  async function readFromDocument(tabId, frameId, sourceUrl, targetElementId) {
    if (!Number.isInteger(tabId)) return { ok: false, reason: "Tab is unavailable." };
    try {
      const target = { tabId };
      if (Number.isInteger(frameId)) target.frameIds = [frameId];
      const results = await browser.scripting.executeScript({
        target,
        func: chestReadDisplayedImage,
        args: [{ sourceUrl: sourceUrl || "", targetElementId }]
      });
      if (results[0] && results[0].error) throw new Error(String(results[0].error));
      return (results[0] && results[0].result) || { ok: false };
    } catch (_) {
      return { ok: false, reason: "Could not access the displayed image in this tab." };
    }
  }

  function blobFromDataUrl(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      throw new Error("The recovered image wasn't an image data URL.");
    }
    if (dataUrl.length > U.MAX_IMAGE_BYTES * 1.5) {
      throw new Error("The recovered image exceeds the extension's safety limit.");
    }
    return fetch(dataUrl).then(response => response.blob());
  }

  async function captureVisibleImage(tab, info) {
    // A last-resort visible-pixel fallback for Discord images whose signed URL
    // has expired and whose embedded image element is cross-origin tainted.
    // Only crop a fully visible image in the foreground; never capture a whole
    // unrelated webpage or a partial image and silently treat it as the original.
    const rect = info && info.rect;
    const viewport = info && info.viewport;
    if (!rect || !viewport || !tab.active ||
      !(rect.width >= 1 && rect.height >= 1) ||
      rect.x < 0 || rect.y < 0 ||
      rect.x + rect.width > viewport.width + 0.5 ||
      rect.y + rect.height > viewport.height + 0.5) {
      throw new Error("Image isn't completely visible for the final screenshot fallback.");
    }
    const tabs = await browser.tabs.query({ active: true, windowId: tab.windowId });
    if (!tabs.some(open => open.id === tab.id)) throw new Error("Source tab is no longer foreground.");
    const screenshot = await browser.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const bitmap = await createImageBitmap(await blobFromDataUrl(screenshot));
    try {
      const ratioX = bitmap.width / viewport.width;
      const ratioY = bitmap.height / viewport.height;
      const cropX = Math.max(0, Math.round(rect.x * ratioX));
      const cropY = Math.max(0, Math.round(rect.y * ratioY));
      const cropW = Math.min(bitmap.width - cropX, Math.round(rect.width * ratioX));
      const cropH = Math.min(bitmap.height - cropY, Math.round(rect.height * ratioY));
      if (cropW < 1 || cropH < 1 || cropW * cropH > 45_000_000) {
        throw new Error("Image viewport is too small or too large to capture.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(result => result ? resolve(result) : reject(new Error("Screenshot encoding failed.")), "image/png")
      );
      return U.normalizeImageBlob(blob, "displayed-discord-image.png");
    } finally {
      bitmap.close();
    }
  }

  async function collectImage(tab, context, settings) {
    let sourceUrl = context.sourceUrl || "";
    const frameId = Number.isInteger(context.frameId) ? context.frameId : 0;
    const imageTabCandidate = !sourceUrl && typeof tab.url === "string" &&
      /^https?:/i.test(tab.url);

    // Right-clicking the image itself has an explicit source URL. In a direct
    // image tab there may instead be a page-context click with no srcUrl.
    if (!sourceUrl && imageTabCandidate) sourceUrl = tab.url;
    const isDirectImageRequest = context.fromTab === true;

    if (!sourceUrl) throw new Error("Right-click an image or open an image in its own tab first.");
    let networkError = null;
    if (U.supportsFetchUrl(sourceUrl)) {
      try {
        const original = await fetchImage(sourceUrl);
        return { ...original, method: "original" };
      } catch (error) { networkError = error; }
    }

    // For a "page" context, verify this is actually an image document, not
    // HTML whose content happens to have an image-like URL.
    const fromPage = await readFromDocument(
      tab.id, frameId, sourceUrl,
      Number.isInteger(context.targetElementId) ? context.targetElementId : undefined
    );
    if (fromPage.ok && typeof fromPage.dataUrl === "string") {
      const blob = await blobFromDataUrl(fromPage.dataUrl);
      const name = U.filenameFromUrl(sourceUrl);
      return { ...await U.normalizeImageBlob(blob, name), method: fromPage.method };
    }

    const isDiscord = U.isDiscordCdn(sourceUrl) || U.isDiscordCdn(fromPage.source);
    if (settings.screenshotFallback && isDiscord && fromPage.rect && fromPage.natural &&
      fromPage.natural.width && fromPage.natural.height && !isDirectImageRequest) {
      // Only for an image identified by the image context, not arbitrary pages.
      return { ...await captureVisibleImage(tab, fromPage), method: "visible-screenshot" };
    }

    if (settings.screenshotFallback && isDiscord && fromPage.imageDocument &&
      fromPage.rect && fromPage.natural && fromPage.natural.width) {
      return { ...await captureVisibleImage(tab, fromPage), method: "visible-screenshot" };
    }

    const reason = fromPage.reason || (networkError && networkError.message) || "Image could not be read.";
    throw new Error(`${reason} Try opening the original image in a separate tab.`);
  }

  async function sendToImgChest(image, settings) {
    const form = new FormData();
    form.append("images[]", image.blob, image.filename);
    form.append("privacy", settings.privacy);
    // ImgChest accepts a boolean nsfw field independently of visibility.
    form.append("nsfw", settings.nsfw ? "true" : "false");
    if (settings.useFilenameAsTitle) {
      const title = image.filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      if (title && title !== "image") form.append("title", title.slice(0, 120));
    }
    const response = await fetch("https://api.imgchest.com/v1/post", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiToken}`,
        "Accept": "application/json"
      },
      body: form,
      credentials: "omit",
      redirect: "error",
      cache: "no-store"
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(U.apiError(json, response.status, response.headers.get("retry-after")));
    }
    return U.postUrlFromResponse(json);
  }

  async function upload(tab, context) {
    if (!tab || !Number.isInteger(tab.id)) throw new Error("No browser tab was selected.");
    const dedupe = String(tab.id) + ":" + (context.sourceUrl || tab.url || "");
    if (activeUploads.has(dedupe)) throw new Error("This image is already uploading.");
    activeUploads.add(dedupe);
    try {
      const settings = await readSettings();
      if (!settings.apiToken) {
        await browser.runtime.openOptionsPage();
        throw new Error("Enter your ImgChest API token in ChestDrop settings first.");
      }
      const image = await collectImage(tab, context, settings);
      const postUrl = await sendToImgChest(image, settings);
      const lastUpload = {
        url: postUrl, filename: image.filename, createdAt: new Date().toISOString(),
        method: image.method
      };
      // ImgChest has already created the post. Failure to open a browser tab
      // must never be reported as an upload failure (which could cause a user
      // to retry and accidentally post a duplicate).
      let warning = "";
      try {
        await browser.storage.local.set({ lastUpload });
      } catch (_) {
        warning = " The recent-post link could not be saved locally.";
      }
      if (settings.openBehavior !== "none") {
        const options = { url: postUrl, active: settings.openBehavior === "foreground" };
        if (Number.isInteger(tab.windowId)) options.windowId = tab.windowId;
        if (Number.isInteger(tab.index)) options.index = tab.index + 1;
        try { await browser.tabs.create(options); }
        catch (_) { warning += " The post tab could not be opened."; }
      }
      const caveat = image.method === "visible-screenshot"
        ? " Uploaded a cropped view, not the original file."
        : image.method === "canvas-pixels" ? " Recovered visible pixels as a static PNG." : "";
      notify("ImgChest upload complete", `Post created: ${postUrl}.${caveat}${warning}`);
      return { ok: true, postUrl, method: image.method, warning: warning.trim() };
    } finally {
      activeUploads.delete(dedupe);
    }
  }

  // Read-only API key test. Do not use an upload as an authentication probe:
  // an unexpected server response could otherwise create an unwanted post.
  async function testToken(apiToken, username) {
    const token = String(apiToken || "").trim();
    const accountName = String(username || "").trim().replace(/^@/, "");
    if (!token) return { ok: false, status: "error", message: "Enter an API token first." };
    if (/\s/.test(token)) return { ok: false, status: "error", message: "API tokens cannot contain whitespace." };
    if (accountName && !/^[A-Za-z0-9_.-]{1,80}$/.test(accountName)) {
      return { ok: false, status: "error", message: "Enter your ImgChest username, not a profile URL." };
    }

    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const get = async url => {
      const response = await fetch(url, {
        method: "GET", headers, redirect: "error", credentials: "omit", cache: "no-store"
      });
      const json = await response.json().catch(() => null);
      return { response, json };
    };
    try {
      const primary = await get("https://api.imgchest.com/v1/users/me");
      if (primary.response.ok) {
        const data = primary.json && primary.json.data;
        if (!data || typeof data !== "object" || typeof data.name !== "string") {
          return { ok: false, status: "warning", message: "ImgChest responded, but the account-check result was unrecognized. Token validity is unconfirmed." };
        }
        return { ok: true, status: "success", message: `API key verified for ${data.name}.` };
      }

      // Some deployments respond 404 even though this route is in the docs.
      // Do not confuse a missing route with an invalid access token.
      if (primary.response.status === 404 || primary.response.status === 405) {
        if (!accountName) {
          return {
            ok: false, status: "warning",
            message: `ImgChest returned HTTP ${primary.response.status} from its documented account-check endpoint. This does NOT mean the token is invalid. Enter your ImgChest username above and test again to use the alternate profile lookup, or try a normal upload.`
          };
        }
        const fallback = await get(`https://api.imgchest.com/v1/user/${encodeURIComponent(accountName)}`);
        if (!fallback.response.ok) {
          if (fallback.response.status === 401 || fallback.response.status === 403) {
            return { ok: false, status: "error", message: `ImgChest rejected the token during the alternate check (HTTP ${fallback.response.status}).` };
          }
          return {
            ok: false, status: "warning",
            message: `Current-user check returned HTTP ${primary.response.status}; profile lookup returned HTTP ${fallback.response.status}. Token validity remains unknown. Check your ImgChest username or try uploading an image.`
          };
        }
        const profile = fallback.json && fallback.json.data;
        if (!profile || typeof profile.name !== "string" || profile.name.toLowerCase() !== accountName.toLowerCase()) {
          return { ok: false, status: "warning", message: "Profile lookup returned unexpected account information. Token validity remains unconfirmed." };
        }
        // A public profile can be read without proving authentication. The
        // documented account-private fields are evidence of authenticated access.
        const privateFields = ["email", "email_verified", "allow_nsfw", "show_nsfw_media", "email_notifications", "email_promotions"];
        const privateResult = privateFields.some(field => Object.prototype.hasOwnProperty.call(profile, field));
        if (privateResult) {
          return { ok: true, status: "success", message: `API key verified for ${profile.name} via your private profile details (fallback check).` };
        }
        return { ok: false, status: "warning", message: `The profile for ${profile.name} is accessible, but ImgChest returned only public information. The API key has not been verified.` };
      }
      if (primary.response.status === 401 || primary.response.status === 403) {
        return { ok: false, status: "error", message: `ImgChest rejected the API key (HTTP ${primary.response.status}). Check that it hasn't been revoked.` };
      }
      return {
        ok: false,
        status: primary.response.status === 429 ? "warning" : "error",
        message: U.apiError(primary.json, primary.response.status, primary.response.headers.get("retry-after"))
      };
    } catch (_) {
      return { ok: false, status: "error", message: "Couldn't reach ImgChest to test your API key. Check your connection and try again." };
    }
  }

  browser.menus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === SETTINGS_MENU) {
      browser.runtime.openOptionsPage();
      return;
    }
    if (![UPLOAD_MENU, TAB_MENU].includes(info.menuItemId)) return;
    upload(tab, {
      sourceUrl: info.menuItemId === UPLOAD_MENU ? (info.srcUrl || "") : "",
      fromTab: info.menuItemId === TAB_MENU,
      targetElementId: info.menuItemId === UPLOAD_MENU ? info.targetElementId : undefined,
      frameId: info.frameId
    }).catch(error => notify("ChestDrop upload failed", error.message));
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (!message || typeof message !== "object") return undefined;
    if (message.kind === "test-token") return testToken(message.token, message.username);
    if (message.kind === "upload-tab") {
      // Restrict message to an extension page; a content script cannot start
      // uploads through this entry point.
      if (sender.url && !sender.url.startsWith(browser.runtime.getURL(""))) {
        return Promise.resolve({ ok: false, message: "Unauthorized sender." });
      }
      return (async () => {
        const tab = await browser.tabs.get(message.tabId);
        try { return await upload(tab, { fromTab: true, frameId: 0 }); }
        catch (error) { notify("ChestDrop upload failed", error.message); return { ok: false, message: error.message }; }
      })();
    }
    return undefined;
  });

  browser.runtime.onInstalled.addListener(installMenus);
})();
