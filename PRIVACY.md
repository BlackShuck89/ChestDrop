# ChestDrop privacy notice

ChestDrop is an unofficial Firefox extension that uploads images to ImgChest at your request.

## Information sent to ImgChest

**When you choose to upload an image**, ChestDrop sends that selected image to `https://api.imgchest.com/v1/post` along with the post options you configured (such as visibility and SFW/NSFW rating). If enabled, it also sends a title derived from the image filename. It authenticates this request with your ImgChest personal access token in an HTTPS Bearer authorization header.

**When you press “Test API key,”** the extension sends your token to ImgChest's account-check endpoint, optionally using a profile lookup with your entered username. These checks are only made on request. Uploaded images are stored and processed by ImgChest under that service's policies.

For these reasons, ChestDrop declares Mozilla `authenticationInfo` and `websiteContent` as required data-transmission categories in `manifest.json`. This declaration does not mean ChestDrop secretly collects all page contents or monitors browsing: it only transmits the selected image for upload and the credentials necessary to use ImgChest's API.

## Locally stored information

The ImgChest token, username, upload preferences, and most recent upload link are stored in your Firefox profile using `browser.storage.local`. They are not synchronized by ChestDrop. Optional exported settings backups are saved to your computer; backups that include the token contain it as plain text, so store them securely.

## No analytics

ChestDrop has no telemetry, advertising, behavioral tracking, or developer-operated collection server. It does not collect browsing history or perform background image uploads. Network traffic to the original image host can occur when you explicitly ask the extension to retrieve and upload a selected image. The ImgChest service will receive uploads and authenticated API requests as described above.

## Controls

You choose which images to upload. You can edit the token and preferences in ChestDrop Settings, export a backup, or remove the extension. You can revoke your token from your ImgChest account. Deleted/removed local extension data cannot retract images already uploaded to ImgChest: manage those posts through ImgChest.

ChestDrop is independent of ImgChest and Discord. For how ImgChest processes submitted images, please consult ImgChest's policies directly.
