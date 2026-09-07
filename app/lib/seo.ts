export const PRODUCTION_ORIGIN = "https://www.remoteworldwide.net";

function isLocal(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(origin);
}

function normalize(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return isLocal(url.origin) ? null : url.origin;
  } catch {
    return null;
  }
}

export const SITE_URL: string =
  normalize(process.env.NEXT_PUBLIC_CANONICAL_URL) ??
  normalize(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  normalize(process.env.NEXT_PUBLIC_SITE_URL) ??
  PRODUCTION_ORIGIN;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "Remote Worldwide";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const LOGO_URL = absoluteUrl("/android-chrome-512x512.png");

export function blogOgImage(input: { title: string; author: string; description: string; image: string }): string {
  const params = new URLSearchParams({
    title: input.title,
    author: input.author,
    description: input.description,
    image: input.image,
  });
  return absoluteUrl(`/api/og/blog?${params.toString()}`);
}

export const publisherNode = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: LOGO_URL },
};
