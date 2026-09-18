export function closeUploadWidget(widget: { close: () => void }): void {
  widget.close();
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }
}

/** Uploads an image (a File/Blob or a data: URL) with the same unsigned preset as the upload widget; returns its https URL. */
export async function uploadImage(file: Blob | string): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_PRESET ?? "");
  body.append("folder", "blogs");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !data.secure_url) throw new Error(data.error?.message ?? "Image upload failed");
  return data.secure_url;
}

const DATA_IMAGE_SRC_RE = /src="(data:image\/(?:png|jpeg|gif|webp);base64,[^"]+)"/g;

/**
 * Posts only render https images, so base64 ones (Quill's default, or pasted HTML)
 * would vanish on the page. Uploads each once (cached by data URL) and swaps in its URL.
 */
export async function hostInlineImages(html: string, cache: Map<string, string>): Promise<string> {
  const sources = [...new Set(Array.from(html.matchAll(DATA_IMAGE_SRC_RE), (m) => m[1]))];
  let out = html;
  for (const src of sources) {
    let url = cache.get(src);
    if (!url) {
      url = await uploadImage(src);
      cache.set(src, url);
    }
    // Plain split/join: data URLs contain +, / and = that a RegExp would misread.
    out = out.split(src).join(url);
  }
  return out;
}
