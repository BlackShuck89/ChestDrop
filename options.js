(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const token = $("api-token");
  const status = $("save-status");
  const backupStatus = $("backup-status");

  function showStatus(message, level = "success") {
    status.textContent = message;
    status.classList.toggle("error", level === "error");
    status.classList.toggle("warning", level === "warning");
  }

  function showBackupStatus(message, level = "success") {
    backupStatus.textContent = message;
    backupStatus.classList.toggle("error", level === "error");
    backupStatus.classList.toggle("warning", level === "warning");
  }

  function applySettings(settings) {
    token.value = settings.apiToken;
    $("api-username").value = settings.apiUsername;
    $("privacy").value = settings.privacy;
    $("rating").value = settings.nsfw ? "nsfw" : "sfw";
    $("use-filename").checked = settings.useFilenameAsTitle;
    $("screenshot-fallback").checked = settings.screenshotFallback;
    document.querySelector(`input[name="openBehavior"][value="${settings.openBehavior}"]`).checked = true;
  }

  async function init() {
    try {
      const settings = ChestUtils.getSettings(await browser.storage.local.get(null));
      applySettings(settings);
    } catch (_) {
      showStatus("Couldn't load settings.", "error");
    }
  }

  $("toggle-token").addEventListener("click", () => {
    const visible = token.type === "password";
    token.type = visible ? "text" : "password";
    $("toggle-token").textContent = visible ? "Hide" : "Show";
    $("toggle-token").setAttribute("aria-pressed", String(visible));
  });

  $("test-token").addEventListener("click", async () => {
    const btn = $("test-token");
    btn.disabled = true;
    showStatus("Checking ImgChest authentication…");
    try {
      const result = await browser.runtime.sendMessage({
        kind: "test-token", token: token.value.trim(), username: $("api-username").value.trim()
      });
      showStatus(result.message, result.status || (result.ok ? "success" : "error"));
    } catch (_) {
      showStatus("Couldn't contact the extension background page.", "error");
    } finally { btn.disabled = false; }
  });

  $("settings-form").addEventListener("submit", async event => {
    event.preventDefault();
    const apiToken = token.value.trim();
    if (/\s/.test(apiToken)) {
      showStatus("The token cannot contain spaces or line breaks.", "error");
      return;
    }
    const apiUsername = $("api-username").value.trim().replace(/^@/, "");
    if (apiUsername && !/^[A-Za-z0-9_.-]{1,80}$/.test(apiUsername)) {
      showStatus("Enter your ImgChest username without spaces or a profile URL.", "error");
      return;
    }
    const payload = {
      apiToken,
      apiUsername,
      openBehavior: document.querySelector('input[name="openBehavior"]:checked').value,
      privacy: $("privacy").value,
      nsfw: $("rating").value === "nsfw",
      useFilenameAsTitle: $("use-filename").checked,
      screenshotFallback: $("screenshot-fallback").checked
    };
    try {
      await browser.storage.local.set(payload);
      showStatus(apiToken ? "Settings saved." : "Settings saved; API token is empty.");
    } catch (_) { showStatus("Couldn't save settings.", "error"); }
  });

  $("export-settings").addEventListener("click", async () => {
    const button = $("export-settings");
    button.disabled = true;
    try {
      const saved = await browser.storage.local.get(null);
      const includeToken = $("backup-include-token").checked;
      const backup = ChestUtils.makeSettingsBackup(saved, includeToken);
      const json = JSON.stringify(backup, null, 2) + "\n";
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "ChestDrop-settings-backup.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        // Delay cleanup to let Firefox finish starting the download.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      showBackupStatus(includeToken
        ? "Backup download started. It includes your API token — keep the JSON file private."
        : "Backup download started. Your API token was excluded.");
    } catch (error) {
      showBackupStatus(`Could not export settings: ${error.message}`, "error");
    } finally { button.disabled = false; }
  });

  $("import-settings").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async event => {
    const picker = event.target;
    const file = picker.files && picker.files[0];
    if (!file) return;
    const button = $("import-settings");
    button.disabled = true;
    try {
      if (file.size > 65536) throw new Error("Backup exceeds 64 KiB; select a ChestDrop JSON backup.");
      const parsed = JSON.parse(await file.text());
      const patch = ChestUtils.parseSettingsBackup(parsed);
      await browser.storage.local.set(patch);
      applySettings(ChestUtils.getSettings(await browser.storage.local.get(null)));
      showBackupStatus(Object.prototype.hasOwnProperty.call(patch, "apiToken")
        ? "Settings restored and saved, including your API token."
        : "Settings restored and saved. Existing API token was left unchanged.");
      showStatus("Imported settings are saved.");
    } catch (error) {
      showBackupStatus(`Import failed: ${error.message}`, "error");
    } finally {
      picker.value = "";
      button.disabled = false;
    }
  });

  init();
})();
