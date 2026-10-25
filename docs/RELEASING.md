# Releasing ChestDrop

ChestDrop's **official user downloads** are distributed through [Mozilla Firefox Add-ons (AMO)](https://addons.mozilla.org/en-US/firefox/addon/chestdrop-for-imgchest/). GitHub Releases are source-code snapshots and matching change notes; they should never be presented as a signed alternative to the AMO listing.

## Before submitting a new version to Mozilla

1. Update `manifest.json` with the next version number. Keep the established Firefox extension ID unchanged, so updates can retain the user's local preferences.
2. Add a new release section at the top of `CHANGELOG.md`, using `## [X.Y.Z] — YYYY-MM-DD` and clear user-facing notes. Mark unapproved versions as forthcoming instead of claiming they're published.
3. Run the JavaScript checks, offline tests and `node scripts/check_manifest.js`, or check for a successful [CI workflow run](../.github/workflows/check.yml).
4. Use an unsigned developer build for testing only. Submit the actual release to Mozilla for validation/signing.
5. Wait until the new version is **publicly listed** on [the AMO page](https://addons.mozilla.org/en-US/firefox/addon/chestdrop-for-imgchest/), and verify that its displayed version matches `manifest.json`.

## Publish the matching GitHub release

Open [Publish GitHub Release](https://github.com/BlackShuck89/ChestDrop/actions/workflows/release.yml), choose **Run workflow** from the `main` branch and enter the version number (without the `v`, for example `0.1.4`).

The workflow:

- Ensures the requested version matches `manifest.json` and has notes in `CHANGELOG.md`.
- Confirms that Mozilla's public API lists the **same version** before publishing anything.
- Runs the offline tests and manifest check.
- Creates `vX.Y.Z` and a GitHub release with the matching changelog section, linking users to the official AMO download.
- Avoids duplicate releases if the tag already has a release.

**Do not upload unsigned CI-built XPIs as public GitHub release downloads.** The signing and updates channel for ordinary users is Mozilla Add-ons. Anyone needing an unsigned test build can use the CI artifacts separately.

The workflow may also run when `CHANGELOG.md` changes on `main`. If the new version is not yet listed publicly on AMO, it safely skips release creation. Once AMO approval arrives, run the manual workflow above.

## Project listing metadata

The repository's public **About → Website** should be:

`https://addons.mozilla.org/en-US/firefox/addon/chestdrop-for-imgchest/`

Suggested description: `A Firefox extension for right-click image uploads to ImgChest, with customizable privacy, ratings, and Discord CDN support.`

Suggested topics: `firefox`, `firefox-extension`, `imgchest`, `image-uploader`, `browser-extension`, `webextension`.

Update About via the GitHub website's About settings if the connected GitHub integration cannot edit repository metadata.
