// Asks Cloudinary for a thumbnail that fits in a square at twice the shown size (for 2x screens),
// in WebP or AVIF where the browser takes it. Any other URL, or one that already has a transform,
// is returned as it is. c_fit, not c_fill: a company logo is often a wide wordmark, and filling the
// square cut its sides off ("process.st" showed as "oce" on the job tiles; owner, 2026-11-05). The
// caller draws it with object-contain, as the job page does.
export function cloudinaryThumb(url: string, size: number): string {
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/);
  if (!match) return url;
  const px = size * 2;
  return `${match[1]}c_fit,w_${px},h_${px},f_auto,q_auto/${match[2]}`;
}
