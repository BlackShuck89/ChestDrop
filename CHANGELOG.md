# Changelog

All notable user-visible changes to ChestDrop are recorded here. Version numbers follow the Firefox extension's `manifest.json`. Published versions are distributed through [Mozilla Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/chestdrop-for-imgchest/), with corresponding [GitHub Releases](https://github.com/BlackShuck89/ChestDrop/releases) for source snapshots and change notes; earlier versions below were development builds.

## [0.1.4] — 2026-10-21

**First Mozilla-approved public release.**

- Added Firefox's required `data_collection_permissions` declaration for authenticated uploads of user-selected images.
- Added the [privacy notice](PRIVACY.md) and a manifest regression test for Mozilla's data-consent metadata.
- Raised the minimum supported Firefox version to 140.
- Retained the existing extension ID so installed settings can survive signed in-place updates.
- Published the signed add-on on [Mozilla Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/chestdrop-for-imgchest/).

### Features included in this release

- Right-click image uploads and uploads from direct-image tabs.
- Discord CDN retrieval with best-effort rendered-image and screenshot fallbacks.
- SFW / NSFW rating defaults, Hidden / Public / Secret visibility, and optional filename-based titles.
- Foreground / background / no-tab behavior after uploading.
- Locally stored API-token settings, read-only token check with fallback, and import/export of settings backups.
- ChestDrop mimic mascot, popup, settings UI, and recent-upload shortcut.

## 0.1.3 — Development release

- Added portable JSON settings export and import, including the option to exclude the API token.
- Validated imported backups before applying preferences.

## 0.1.2 — Development release

- Added saved default SFW / NSFW rating to ImgChest upload requests.
- Introduced the mimic-chest branding across extension icons, settings, and popup.

## 0.1.1 — Development release

- Improved the token test when ImgChest's current-user endpoint returns HTTP 404.
- Added an optional username-based fallback; inconclusive checks no longer incorrectly label a key invalid.

## 0.1.0 — Initial development release

- Initial Firefox image context-menu and direct-tab uploads via ImgChest's API.
- API token settings, configurable post visibility, Discord recovery attempts, and post-opening preferences.

---

## Versioning and distribution

Public releases are published and signed through **Mozilla Firefox Add-ons**. GitHub releases provide source-code snapshots and changelogs; **GitHub Actions XPI artifacts are unsigned development builds** and are not a substitute for Mozilla-signed packages.

See the [release process](docs/RELEASING.md) for how the maintainer verifies AMO publication before creating corresponding GitHub release notes.
