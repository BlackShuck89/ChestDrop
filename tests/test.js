/* Offline tests. Run: node tests/test.js */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAJ+XlXcAAAAASUVORK5CYII=", "base64");

function setup({ settings = {}, sourceStatus = 200, sourceResponseType = "image/png", injectionResult = null,
  apiStatus = 200, currentUserStatus = 200, currentUserMalformed = false,
  profileStatus = 200, profilePrivate = true, profileName = "SampleAccount" } = {}) {
  const ctx = vm.createContext({
    Blob, URL, Uint8Array, ArrayBuffer, FormData, Response, Headers, console,
    Date, Promise, Set, String, Object, Number, Error, RegExp,
  });
  const calls = { fetches: [], tabsCreated: [], notifications: [], menus: [] };
  const store = { apiToken: "sample-key", ...settings };
  const listeners = {};
  const browser = {
    menus: {
      removeAll: async () => {}, create: menu => calls.menus.push(menu),
      onClicked: { addListener: cb => { listeners.menuClick = cb; } }
    },
    runtime: {
      getURL: str => `moz-extension://test-extension/${str}`,
      onMessage: { addListener: cb => { listeners.message = cb; } },
      onInstalled: { addListener: cb => { listeners.installed = cb; } },
      openOptionsPage: async () => { calls.optionsOpened = true; }
    },
    storage: { local: {
      get: async keys => {
        if (keys === null) return { ...store };
        if (typeof keys === "string") return { [keys]: store[keys] };
        return Object.fromEntries(keys.map(key => [key, store[key]]));
      },
      set: async patch => { Object.assign(store, patch); }
    } },
    tabs: {
      get: async id => ({ id, url: "https://images.example/photo.png", active: true, windowId: 1, index: 4 }),
      create: async tab => { calls.tabsCreated.push(tab); return tab; },
      query: async () => [{ id: 123, active: true }]
    },
    notifications: { create: async note => { calls.notifications.push(note); } },
    scripting: { executeScript: async () => [{ result: injectionResult || { ok: false, reason: "No accessible image." } }] }
  };
  ctx.browser = browser;
  ctx.fetch = async (url, init) => {
    calls.fetches.push({ url, init });
    if (url === "https://api.imgchest.com/v1/post") {
      if (apiStatus !== 200) return new Response(JSON.stringify({ message: "Rate limit exceeded" }), { status: apiStatus, headers: { "content-type": "application/json", "retry-after": "10" } });
      return new Response(JSON.stringify({ data: { id: "3qe4gdvj4j2" } }), { status: 201, headers: { "content-type": "application/json" } });
    }
    if (url === "https://api.imgchest.com/v1/users/me") {
      const data = currentUserMalformed ? { username: "SampleAccount" } : { name: "SampleAccount" };
      return new Response(JSON.stringify({ data }), { status: currentUserStatus, headers: { "content-type": "application/json" } });
    }
    if (typeof url === "string" && url.startsWith("https://api.imgchest.com/v1/user/")) {
      const data = { name: profileName };
      if (profilePrivate) { data.email_verified = true; data.allow_nsfw = false; }
      return new Response(JSON.stringify({ data }), { status: profileStatus, headers: { "content-type": "application/json" } });
    }
    if (typeof url === "string" && url.startsWith("data:")) return fetch(url);
    if (sourceStatus !== 200) return new Response("Access denied", { status: sourceStatus });
    return new Response(new Blob([png], { type: sourceResponseType }), { status: 200, headers: { "content-type": sourceResponseType } });
  };
  for (const file of ["shared.js", "image-reader.js", "background.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx, { filename: file });
  }
  listeners.installed({ reason: "install" });
  return { ctx, browser, listeners, calls, store };
}

async function main() {
  const { ctx } = setup();
  const U = ctx.ChestUtils;
  assert.equal(U.sniffMime(png), "image/png");
  assert.equal(U.sniffMime(Buffer.from("<html>Error</html>")), null);
  assert.equal(U.safeFilename("photo.jpg", "image/png"), "photo.png");
  assert.equal(U.safeFilename("../../photo.png", "image/png"), "photo.png");
  assert.equal(U.filenameFromUrl("https://cdn.discordapp.com/attachments/1/sunset.webp?ex=123&hm=token"), "sunset.webp");
  assert.equal(U.isDiscordCdn("https://cdn.discordapp.com/attachments/1/x.png"), true);
  assert.equal(U.isDiscordCdn("https://cdn.discordapp.com.attacker.com/evil.png"), false);
  assert.equal(U.getSettings({}).privacy, "hidden");
  assert.equal(U.getSettings({}).nsfw, false);
  assert.equal(U.getSettings({nsfw:true}).nsfw, true);
  assert.equal(U.getSettings({nsfw:"true"}).nsfw, false);
  assert.equal(U.getSettings({}).openBehavior, "foreground");

  // Settings export/import should be lossless, local, and only include
  // preferences rather than upload history or arbitrary storage fields.
  const backup = U.makeSettingsBackup({
    apiToken: "keep-my-secret", apiUsername: "User_Name",
    privacy: "public", nsfw: true, openBehavior: "background",
    screenshotFallback: false, useFilenameAsTitle: true,
    lastUpload: { url: "https://imgchest.com/p/unrelated" }, unrelatedField: "do not export"
  }, true);
  assert.equal(backup.format, "chestdrop-settings");
  assert.equal(backup.version, 1);
  assert.equal(backup.settings.apiToken, "keep-my-secret");
  assert.equal(backup.settings.nsfw, true);
  assert.equal(Object.hasOwn(backup.settings, "lastUpload"), false);
  assert.equal(Object.hasOwn(backup.settings, "unrelatedField"), false);
  const imported = U.parseSettingsBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(imported.apiToken, "keep-my-secret");
  assert.equal(imported.privacy, "public");
  assert.equal(imported.nsfw, true);
  assert.equal(imported.openBehavior, "background");
  assert.equal(imported.screenshotFallback, false);
  const withoutToken = U.makeSettingsBackup({apiToken: "dont-export", nsfw: true}, false);
  assert.equal(Object.hasOwn(withoutToken.settings, "apiToken"), false);
  assert.equal(Object.hasOwn(U.parseSettingsBackup(withoutToken), "apiToken"), false);
  assert.throws(() => U.parseSettingsBackup({format:"not-chestdrop",version:1,settings:{}}), /not a ChestDrop/i);
  assert.throws(() => U.parseSettingsBackup({...backup,version:3}), /unsupported/i);
  assert.throws(() => U.parseSettingsBackup({...backup,settings:{...backup.settings,nsfw:"true"}}), /invalid nsfw/i);
  assert.throws(() => U.parseSettingsBackup({...backup,settings:{...backup.settings,apiToken:{bad:true}}}), /invalid API token/i);
  assert.throws(() => U.parseSettingsBackup({...backup,settings:{...backup.settings,privacy:"nonsense"}}), /invalid post visibility/i);
  assert.equal(U.postUrlFromResponse({data:{id:"3qe4gdvj4j2"}}), "https://imgchest.com/p/3qe4gdvj4j2");
  assert.throws(() => U.postUrlFromResponse({data:{id:"https://bad.host/path"}}), /valid post ID/);
  await assert.rejects(() => U.normalizeImageBlob(new Blob(["<html>hi</html>"]), "image.png"), /Unsupported image data/);

  // Upload one image directly from its own tab; verify token, multipart, and foreground behavior.
  const a = setup();
  assert.deepEqual(a.calls.menus.map(menu => menu.id), [
    "chestdrop-upload-image", "chestdrop-upload-tab-image", "chestdrop-settings"
  ]);
  const result = await a.listeners.message({kind: "upload-tab", tabId: 123}, {url:"moz-extension://test-extension/popup.html"});
  assert.equal(result.ok, true);
  assert.equal(result.postUrl, "https://imgchest.com/p/3qe4gdvj4j2");
  const uploadFetch = a.calls.fetches.find(row => row.url === "https://api.imgchest.com/v1/post");
  assert.ok(uploadFetch, "API POST called");
  assert.equal(uploadFetch.init.headers.Authorization, "Bearer sample-key");
  assert.equal(uploadFetch.init.body.get("privacy"), "hidden");
  assert.equal(uploadFetch.init.body.get("nsfw"), "false");
  assert.equal(uploadFetch.init.body.get("images[]").name, "photo.png");
  assert.equal(uploadFetch.init.body.get("images[]").type, "image/png");
  assert.equal(a.calls.tabsCreated.length, 1);
  assert.equal(a.calls.tabsCreated[0].active, true);
  assert.equal(a.store.lastUpload.url, result.postUrl);
  assert.ok(!a.calls.fetches.find(row => row.url === "https://images.example/photo.png").init.headers, "token not sent to image host");

  // The actual right-click image context-menu path also reaches the API.
  const menuRun = setup();
  menuRun.listeners.menuClick({
    menuItemId: "chestdrop-upload-image",
    srcUrl: "https://images.example/selected.png",
    targetElementId: 37,
    frameId: 0
  }, { id: 12, url: "https://example.com/gallery", active: true, index: 2, windowId: 1 });
  for (let attempt = 0; attempt < 30 && !menuRun.calls.tabsCreated.length; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(menuRun.calls.tabsCreated.length, 1);
  assert.ok(menuRun.calls.fetches.some(row => row.url === "https://images.example/selected.png"));

  // Background tabs preserve the current selected tab.
  const b = setup({ settings: { openBehavior: "background", privacy: "secret", nsfw: true, useFilenameAsTitle: true } });
  assert.equal((await b.listeners.message({kind:"upload-tab",tabId:123},{url:"moz-extension://test-extension/popup.html"})).ok, true);
  assert.equal(b.calls.tabsCreated[0].active, false);
  const bgBody = b.calls.fetches.find(row => row.url === "https://api.imgchest.com/v1/post").init.body;
  assert.equal(bgBody.get("privacy"), "secret");
  assert.equal(bgBody.get("nsfw"), "true");
  assert.equal(bgBody.get("title"), "photo");

  // No-tab mode stores the link without opening a tab.
  const c = setup({ settings: { openBehavior: "none" } });
  assert.equal((await c.listeners.message({kind:"upload-tab",tabId:123},{url:"moz-extension://test-extension/popup.html"})).ok, true);
  assert.equal(c.calls.tabsCreated.length, 0);
  assert.equal(c.calls.fetches.find(row => row.url === "https://api.imgchest.com/v1/post").init.body.get("nsfw"), "false");

  // Expired Discord source, image already rendered and returned from a page extraction.
  const dataUrl = "data:image/png;base64," + png.toString("base64");
  const d = setup({ sourceStatus: 403, injectionResult: { ok: true, dataUrl, method: "canvas-pixels" } });
  const restored = await d.listeners.message({kind:"upload-tab",tabId:123},{url:"moz-extension://test-extension/popup.html"});
  assert.equal(restored.ok, true);
  assert.equal(restored.method, "canvas-pixels");

  // ImgChest-side API errors are surfaced; no tab opened.
  const e = setup({ apiStatus: 429 });
  const failed = await e.listeners.message({kind:"upload-tab",tabId:123},{url:"moz-extension://test-extension/popup.html"});
  assert.equal(failed.ok, false);
  assert.match(failed.message, /rate limit/i);
  assert.equal(e.calls.tabsCreated.length, 0);

  // Token check has no upload and reports account name.
  const f = setup();
  const checked = await f.listeners.message({kind:"test-token",token:"sample-key"},{url:"moz-extension://test-extension/options.html"});
  assert.equal(checked.ok, true);
  assert.match(checked.message, /SampleAccount/);
  assert.equal(f.calls.fetches.length, 1);

  // Regression: a 404 on the documented current-user endpoint is NOT an invalid-token result.
  const h = setup({ currentUserStatus: 404 });
  const inconclusive = await h.listeners.message({kind:"test-token", token:"sample-key"}, {url:"moz-extension://test-extension/options.html"});
  assert.equal(inconclusive.ok, false);
  assert.equal(inconclusive.status, "warning");
  assert.match(inconclusive.message, /does NOT mean the token is invalid/);
  assert.equal(h.calls.fetches.length, 1);
  assert.ok(!h.calls.fetches.some(row => row.init.method === "POST"), "Token test is read-only");

  // On 404, username fallback validates by the presence of private fields.
  const i = setup({ currentUserStatus: 404 });
  const verified = await i.listeners.message({kind:"test-token", token:"sample-key", username:"@SampleAccount"}, {url:"moz-extension://test-extension/options.html"});
  assert.equal(verified.ok, true);
  assert.equal(verified.status, "success");
  assert.match(verified.message, /private profile details/);
  assert.equal(i.calls.fetches[1].url, "https://api.imgchest.com/v1/user/SampleAccount");
  assert.equal(i.calls.fetches[1].init.headers.Authorization, "Bearer sample-key");
  assert.ok(i.calls.fetches.every(row => row.init.method === "GET"));

  // An openly readable profile does not prove the bearer token works.
  const j = setup({ currentUserStatus: 404, profilePrivate: false });
  const publicProfile = await j.listeners.message({kind:"test-token", token:"sample-key", username:"SampleAccount"}, {url:"moz-extension://test-extension/options.html"});
  assert.equal(publicProfile.ok, false);
  assert.equal(publicProfile.status, "warning");
  assert.match(publicProfile.message, /only public information/);

  // A missing profile, unlike a 401, is not evidence that a token is invalid.
  const k = setup({ currentUserStatus: 404, profileStatus: 404 });
  const noProfile = await k.listeners.message({kind:"test-token", token:"sample-key", username:"SampleAccount"}, {url:"moz-extension://test-extension/options.html"});
  assert.equal(noProfile.status, "warning");
  assert.match(noProfile.message, /validity remains unknown/);

  // 401 is a confirmed rejection and should not fall back to public profiles.
  const l = setup({ currentUserStatus: 401 });
  const rejected = await l.listeners.message({kind:"test-token", token:"bad-key", username:"SampleAccount"}, {url:"moz-extension://test-extension/options.html"});
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status, "error");
  assert.match(rejected.message, /rejected/);
  assert.equal(l.calls.fetches.length, 1);

  // A fallback 401 is also a clear rejection; a malformed success isn't.
  const m = setup({ currentUserStatus: 404, profileStatus: 401 });
  const rejectedFallback = await m.listeners.message({kind:"test-token", token:"bad-key", username:"SampleAccount"}, {url:"moz-extension://test-extension/options.html"});
  assert.equal(rejectedFallback.status, "error");
  const n = setup({ currentUserMalformed: true });
  const weirdProfile = await n.listeners.message({kind:"test-token", token:"sample-key"}, {url:"moz-extension://test-extension/options.html"});
  assert.equal(weirdProfile.status, "warning");

  // Missing token opens settings, avoids uploading and reports error.
  const g = setup({ settings: { apiToken: "" } });
  const missing = await g.listeners.message({kind:"upload-tab",tabId:123},{url:"moz-extension://test-extension/popup.html"});
  assert.equal(missing.ok, false);
  assert.equal(g.calls.optionsOpened, true);
  assert.equal(g.calls.fetches.length, 0);

  console.log("PASS: source, settings backup/restore, uploads (SFW + NSFW), API token, 404 recovery, fallback, behavior, and permission tests");
}

main().catch(err => { console.error(err); process.exitCode = 1; });
