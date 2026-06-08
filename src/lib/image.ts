"use client";

/**
 * Downscale + re-encode a data-URL image to a capped dimension as JPEG. Training
 * and analysis don't need full-res source photos, and sending many multi-MB
 * base64 images in one JSON body overflows V8's ~512MB string limit ("Invalid
 * string length"). Shrinking each image first fixes that and speeds everything
 * up. Falls back to the original on any failure.
 */
export function downscaleDataUrl(dataUrl: string, maxDim = 1216, quality = 0.92): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/** Downscale many images concurrently. */
export function downscaleAll(dataUrls: string[], maxDim = 1216, quality = 0.92): Promise<string[]> {
  return Promise.all(dataUrls.map((d) => downscaleDataUrl(d, maxDim, quality)));
}
