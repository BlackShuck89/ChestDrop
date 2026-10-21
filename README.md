# ChestDrop for ImgChest — v0.1.4

An unofficial, Firefox-first, Manifest V3 right-click image uploader using the **official ImgChest API**. No build tools, bundled trackers, advertising, remote JavaScript, analytics, or external dependencies.

## Features

- Right-click an image on a web page → **Upload image to ImgChest**.
- Right-click an image shown alone in Firefox and upload it.
- Choose the default SFW or NSFW label for each newly created post; stored locally and sent to ImgChest as the `nsfw` flag.
- Original ChestDrop mimic-chest branding across the toolbar icons, popup and Settings.
- Use the toolbar popup → **Upload image in current tab** for direct image tabs.
- Support Discord CDN attachment image URLs when their original bytes can still be retrieved.
- If a Discord URL has expired, try reading the already-displayed image's decoded pixels from a canvas; as a final option, crop the fully visible image from Firefox's screen capture. See limitations below.
- Portable local settings **Export / Import JSON** backup (optional API token inclusion) for switching temporary builds.
- Token settings, **Test API key** with a read-only username fallback for a 404 response, post visibility (hidden/public/secret), default content rating (SFW/NSFW), title option.
- Upload result opens in a **foreground tab by default**, optionally in a **background tab** or no new tab.
- Last uploaded post link in the toolbar popup.
- Notifications on success and error.

## Getting started (Firefox desktop)

1. In ImgChest, log in and go to your profile **Security → Personal Access Tokens → New Token**. Save your token when it is shown; ImgChest won't display it again. See [ImgChest's token instructions](https://imgchest.com/docs/api/1.0/general/authorization).
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on**, choose the included `.xpi` file or this folder's `manifest.json`. The unsigned `.xpi` is **for temporary developer testing**, not regular permanent installation.
4. Open ChestDrop Settings from the extension toolbar popup or **about:addons → ChestDrop → Preferences**.
5. Paste your token, optionally enter your ImgChest username, click **Test API key**, choose your **Default content rating (SFW/NSFW)** and post behavior, and **Save settings**. If the documented current-user API returns HTTP 404, ChestDrop uses the username to check your own profile instead. A 404 is **not** treated as proof of an invalid key.
6. Right-click an image → **Upload image to ImgChest**. A completed upload should open its post in a new active tab by default. The upload always uses your saved SFW/NSFW rating; SFW is the default unless you change it.

**For permanent use:** Package/sign the extension through [addons.mozilla.org developer tools](https://addons.mozilla.org/developers/), or use a trusted self-distribution signing workflow. A normal Firefox release build generally will not permanently install an unsigned XPI. Temporary addons are removed on browser restart. You can also use Mozilla's `web-ext run` for development.

## Keeping settings when updating ChestDrop

ChestDrop already uses `browser.storage.local` for API token, username, post visibility, SFW/NSFW, upload tab behavior, screenshot recovery preference, and filename titles. The extension ID (`chestdrop-imgchest@extensions.local`) is kept unchanged in every update. **Signed updates installed in place keep these preferences automatically** without requiring any additional setup.

**Temporary installations:** Uninstalling/removing a temporary build through `about:debugging` can clear Firefox extension data. Since a temporary build is removed at browser restart, use the backup to protect the settings.

1. In ChestDrop v0.1.3 or newer, open Settings → **Local settings backup**, then click **Export saved settings (.json)** **before** removing that build. Choose whether to include the API token. Use **Save settings** first if you have made unsaved changes in the form.
2. Remove the old temporary extension and install the new build. Go to Settings → **Import settings (.json)**, select the downloaded file. Preferences are stored immediately and the settings page updates. There is no need to press Save again.
3. Backups including the token are **plain-text JSON** and should be protected like passwords. Backup files are never automatically uploaded or synced. Backups omit the recent-upload history.
4. You may exclude the token when exporting. On import, a missing token does *not* overwrite the currently configured API token.

**Migrating from v0.1.2 before it has an Export button:** Firefox has developer-only preferences that can preserve extension storage between temporary installations: in `about:config`, set both `extensions.webextensions.keepStorageOnUninstall` and `extensions.webextensions.keepUuidOnUninstall` to `true` **before removing v0.1.2**. Then load the v0.1.3 build with the *same extension ID* in the same Firefox profile, verify its settings, and export a backup immediately. These preferences apply to extension uninstalls across that Firefox profile, not just ChestDrop; restore their prior values once migration is finished to avoid retaining other uninstalled extensions' private data unnecessarily. This is a testing workaround, not necessary for signed in-place updates. If settings were already erased, the extension cannot recover them automatically.

The downloaded ZIP/XPI file is not a settings file. Don't store your API token inside extension source code or its XPI archive.

## Discord CDN / image cache notes

Discord signs many attachment URLs (`?ex=...&is=...&hm=...`). They eventually expire, but the browser may continue displaying the already-loaded image. ChestDrop tries three methods **in order**:

1. Fetch original bytes directly with Firefox extension host access, keeping the original file and animation when possible.
2. When the image element is available, attempt same-origin file reads or canvas pixel recovery of the rendered image. Canvas recovery creates a static PNG; it **does not** preserve animations, EXIF, or original compression.
3. For a Discord CDN image that cannot be recovered from the page, optionally crop an **entirely visible** image from Firefox's foreground tab screenshot. This is only a last resort and may be reduced resolution, may include visual overlays, and does not retain animation. Enabled by default; disable this in Settings for original-only / pixel recovery.

**Important:** The extension does **not** directly read Firefox's disk or memory cache via a special API. A decoded image that is still displayed can sometimes be recovered, but not always. If the image is neither recoverable from the rendered page nor from its still-valid URL, there is no guaranteed way to obtain the original bytes. Opening an image in its own tab often makes canvas recovery more likely to work. Some webpages prevent access to image contents; this tool does not bypass authentication or authorization.

## Mozilla data-collection declaration

From v0.1.4, `manifest.json` declares `authenticationInfo` and `websiteContent` in `browser_specific_settings.gecko.data_collection_permissions.required`. These categories cover the ImgChest API token and the specific image that you choose to upload. This does **not** mean background browsing surveillance or telemetry; ChestDrop transmits images only when you explicitly invoke an upload. See [Privacy notice](PRIVACY.md) for the complete disclosure.

Firefox 140 or newer is required, so Mozilla can show its built-in consent prompts for data transmission. The Firefox extension ID remains unchanged to preserve user settings across in-place updates.

## Privacy, permissions, and security

- `menus`: Adds context-menu upload commands.
- `storage`: Stores your token and preferences using **`browser.storage.local`**, not Sync; keeps the last post URL. Settings backups are explicit user-requested downloads, not automatically synced.
- `tabs`, `activeTab`, `scripting`: Detects the image and tries to read a user-selected image only when asked.
- `notifications`: Reports upload results and errors.
- `<all_urls>` host access: Lets an extension background script download a user-selected image from arbitrary websites, including CDN domains, and allows on-demand same-tab image extraction. This is a broad Firefox permission, but the code does not collect browsing history, scrape websites in the background, or download anything without a user-initiated upload action.
- `https://api.imgchest.com/*`: Lets the extension authenticate and upload.
- The token is only sent to `https://api.imgchest.com/v1/post`, `https://api.imgchest.com/v1/users/me`, and (when using username fallback) `https://api.imgchest.com/v1/user/{username}` in a Bearer header, with HTTP redirects disallowed for authenticated calls.
- The source image is sent to ImgChest, so do not upload material you lack the right to share. Token storage is not encryption at rest: someone with full access to your Firefox profile could potentially read it. Revoke tokens from ImgChest if compromised.
- Individual files over **32 MiB** are blocked by ChestDrop's own defensive memory limit; this is NOT a statement of the website's maximum upload size. Uploads may be subject to additional ImgChest constraints.

## API interface

- Verify token: `GET https://api.imgchest.com/v1/users/me` with `Authorization: Bearer TOKEN`. If this returns 404/405, optionally use `GET https://api.imgchest.com/v1/user/{your-username}`. For a successful fallback, the extension requires profile fields documented as *private to the account owner*; a generic public profile response is **not** considered verification. Neither test creates a post.
- A 404/405 or a public-only profile returns **inconclusive**, never **token invalid**. A clear 401/403 indicates rejection. If both lookups are unavailable, try a normal image upload to see whether the upload API accepts the token.
- Create post: `POST https://api.imgchest.com/v1/post` as multipart form data with `images[]` and `privacy`, optionally `title`, and `nsfw` (`true` or `false`), which is independent of visibility.
- Open post: `https://imgchest.com/p/<id>` from returned JSON `data.id`.

Official documentation: [Authorization](https://imgchest.com/docs/api/1.0/general/authorization), [Post endpoint](https://imgchest.com/docs/api/1.0/endpoints/post), [Current User endpoint](https://imgchest.com/docs/api/1.0/endpoints/user).

## File layout

```
manifest.json      Firefox MV3 metadata and permissions
background.js      Context menu, download, upload, tab/notification handling
image-reader.js    On-demand image/document extraction, including canvas recovery
shared.js          Safety checks, filenames, image MIME sniffing, API helpers
popup.*            Toolbar popup and recent-post link
options.*          Token and post behavior settings; JSON backup export/import
style.css          Local popup/settings styles
icons/             Bundled PNG extension icons
tests/             Offline Node.js tests, no token required
```

## Testing / development

Run `node tests/test.js` with Node.js 18+ to exercise image helpers and mocked API upload/tab behavior. This does **not** send requests to ImgChest.

For browser integration, load temporarily and test a direct PNG, embedded JPG, animated GIF, valid Discord URL, and an expired Discord URL that's still displayed. Actual API testing requires your personal token; none is included with this release.

## Known limitations in this first build

- Only **one selected image per new post**; no batch queue or gallery management yet.
- Direct image downloads may fail for logged-in images requiring cookies (the extension deliberately sends `credentials: omit`).
- Private/blob and cross-origin images cannot always be extracted by content scripts.
- Expired Discord CDN signed URLs are not recoverable if Firefox no longer has accessible decoded pixels or if the image is partly offscreen and requires screenshot fallback.
- JPEG/PNG/GIF/WebP/BMP/AVIF are detected via file signatures. SVG and video files are not part of this image uploader.
- The screenshot fallback is intentionally limited to Discord CDN images and may not be faithful to the original.
- ImgChest endpoint behavior and size restrictions can change; a real-token test is required before claiming confirmed live upload success. Specifically, a user reported HTTP 404 on the documented current-user verification route in v0.1.0; this build adds a documented read-only profile fallback and never calls an upload endpoint during the token test.

MIT license; see `LICENSE`. Not affiliated with ImgChest or Discord.