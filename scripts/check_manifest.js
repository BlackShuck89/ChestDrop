// Fail CI if Firefox's required consent metadata is removed or misdeclared.
// This checks manifest invariants; AMO runs its own authoritative validation.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const gecko = manifest.browser_specific_settings?.gecko;
assert.equal(manifest.manifest_version, 3, "Expected Firefox MV3");
assert.equal(gecko?.id, "chestdrop-imgchest@extensions.local", "Keep the extension ID stable");
assert.ok(parseInt(gecko?.strict_min_version ?? "0", 10) >= 140,
  "Firefox 140+ supports built-in data consent; older versions need custom consent");
const dcp = gecko?.data_collection_permissions;
assert.ok(dcp && Array.isArray(dcp.required),
  "Missing browser_specific_settings.gecko.data_collection_permissions.required");
for (const category of ["authenticationInfo", "websiteContent"]) {
  assert.ok(dcp.required.includes(category), "Missing required data-transmission disclosure: " + category);
}
assert.ok(!dcp.required.includes("none"), "Do not claim no data transmission when uploading to ImgChest");
assert.equal(new Set(dcp.required).size, dcp.required.length, "Duplicate required data categories");
console.log("Firefox data-collection manifest declaration validated.");
