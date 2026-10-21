/*
 * This function is serialized and executed in the selected page/frame on demand.
 * It has no external references, and does not install a persistent content script.
 */
async function chestReadDisplayedImage(args) {
  "use strict";
  const maxBytes = 32 * 1024 * 1024;
  const result = { ok: false, reason: "No image was found in this document." };
  const isImageDocument = /^image\//i.test(document.contentType || "");
  const wantedUrl = typeof args.sourceUrl === "string" ? args.sourceUrl : "";
  let img = null;

  if (typeof args.targetElementId === "number") {
    try {
      const target = browser.menus.getTargetElement(args.targetElementId);
      if (target && target.localName === "img") img = target;
    } catch (_) { /* Firefox may invalidate a target when the page navigates */ }
  }
  if (!img && isImageDocument) img = document.images[0] || null;
  if (!img && wantedUrl) {
    img = Array.from(document.images).find(candidate =>
      candidate.currentSrc === wantedUrl || candidate.src === wantedUrl) || null;
  }
  if (!img) return result;

  const rect = img.getBoundingClientRect();
  const width = img.naturalWidth || 0;
  const height = img.naturalHeight || 0;
  const source = img.currentSrc || img.src || "";
  const metadata = {
    source,
    imageDocument: isImageDocument,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    natural: { width, height }
  };
  Object.assign(result, metadata);

  if (!img.complete || !width || !height) {
    result.reason = "The selected image has not finished loading.";
    return result;
  }

  const bytesAsDataUrl = blob => new Promise((resolve, reject) => {
    if (!blob.size || blob.size > maxBytes) {
      reject(new Error("Image was empty or exceeded the 32 MiB extension safety limit."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the displayed image."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  // On direct image documents the image URL is same-origin with the document.
  // This may retrieve the original GIF/WebP frames and metadata without rasterizing.
  // For embedded images, only try direct reads of blob:/data: URLs here;
  // normal cross-origin HTTP images are downloaded by the background page.
  try {
    const protocol = new URL(source, document.baseURI).protocol;
    const sameOriginHttp = isImageDocument &&
      ["https:", "http:"].includes(protocol) &&
      new URL(source, document.baseURI).origin === location.origin;
    if (["blob:", "data:"].includes(protocol) || sameOriginHttp) {
      const response = await fetch(source, { cache: "force-cache", credentials: "omit" });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size <= maxBytes) {
          return { ok: true, dataUrl: await bytesAsDataUrl(blob), method: "document-original", ...metadata };
        }
      }
    }
  } catch (_) { /* A cached display may still be available even when fetch fails */ }

  // The image element may still hold decoded pixels after a Discord signed URL
  // expires. Canvas can recover them when the image is origin-clean.
  // This loses animation and embedded metadata, so it is a fallback only.
  if (width * height > 45_000_000) {
    result.reason = "Displayed image is too large to safely recover through canvas.";
    return result;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Canvas wasn't available.");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("Couldn't encode image.")), "image/png")
    );
    if (blob.size > maxBytes) throw new Error("The recovered image exceeds 32 MiB.");
    return { ok: true, dataUrl: await bytesAsDataUrl(blob), method: "canvas-pixels", ...metadata };
  } catch (_) {
    result.reason = "The browser cannot read the displayed image pixels (possibly cross-origin).";
    return result;
  }
}
