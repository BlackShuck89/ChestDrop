(() => {
  "use strict";
  const $ = id => document.getElementById(id);

  async function initialize() {
    const data = await browser.storage.local.get(["apiToken", "lastUpload"]);
    const ready = Boolean(data.apiToken && data.apiToken.trim());
    $("connection-state").textContent = ready ? "● API token configured" : "○ API token not configured";
    $("connection-state").classList.toggle("ready", ready);
    if (!ready) $("upload-tab").textContent = "Configure ImgChest API token";
    if (data.lastUpload && data.lastUpload.url && /^https:\/\/imgchest\.com\/p\/[a-z0-9_-]+$/i.test(data.lastUpload.url)) {
      $("last-upload-empty").hidden = true;
      $("last-upload-link").hidden = false;
      $("last-upload-link").href = data.lastUpload.url;
      $("last-upload-link").textContent = data.lastUpload.filename || "Open last ImgChest post ↗";
      $("last-upload-link").title = data.lastUpload.url;
    }
  }

  $("upload-tab").addEventListener("click", async () => {
    const settings = await browser.storage.local.get("apiToken");
    if (!settings.apiToken) { await browser.runtime.openOptionsPage(); return; }
    const button = $("upload-tab");
    button.disabled = true;
    $("upload-state").textContent = "Reading and uploading image…";
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("No active tab.");
      const response = await browser.runtime.sendMessage({ kind: "upload-tab", tabId: tab.id });
      if (!response || !response.ok) throw new Error(response?.message || "Upload failed.");
      $("upload-state").textContent = "Uploaded successfully.";
      await initialize();
    } catch (error) {
      $("upload-state").textContent = error.message;
    } finally { button.disabled = false; }
  });
  $("settings").addEventListener("click", () => browser.runtime.openOptionsPage());
  initialize().catch(() => { $("connection-state").textContent = "Couldn't read settings."; });
})();
