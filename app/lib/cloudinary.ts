// Asks Cloudinary for a square thumbnail at twice the shown size (for 2x screens), in WebP or
// AVIF where the browser takes it. Any other URL, or one that already has a transform, is
// returned as it is.
export function cloudinaryThumb(url: string, size: number): string {
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/);
  if (!match) return url;
  const px = size * 2;
  return `${match[1]}c_fill,w_${px},h_${px},f_auto,q_auto/${match[2]}`;
}
