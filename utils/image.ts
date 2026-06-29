// Client-side image downscale + JPEG re-encode, run before upload.
//
// Two jobs:
//  1. Shrink large phone photos so they don't blow the server's ~6MB limit and
//     so the AI call is faster and cheaper (fewer image tokens).
//  2. Normalize to JPEG. Browsers that can decode HEIC (e.g. Safari) get a
//     provider-friendly format for free; OpenAI's vision API rejects HEIC.
//
// If the browser can't decode the image at all (HEIC on Chrome/Firefox), we
// resolve with the original data URL unchanged so the existing flow still runs.

export const downscaleImage = (
  dataUrl: string,
  maxDim = 1600,
  quality = 0.72,
): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        // Tainted canvas / unsupported export — keep the original.
        resolve(dataUrl);
      }
    };
    // Decode failed (e.g. HEIC where the browser has no decoder) — keep original.
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
