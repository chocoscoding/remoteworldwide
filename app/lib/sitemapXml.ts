export type SitemapUrl = { url: string; lastModified?: string | Date | null };
export const SITEMAP_CHUNK_SIZE = 10000;
export const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
export function lastmod(value: SitemapUrl["lastModified"]): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function sitemapXml(rows: SitemapUrl[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map((row) => `<url><loc>${xmlEscape(row.url)}</loc>${lastmod(row.lastModified) ? `<lastmod>${lastmod(row.lastModified)}</lastmod>` : ""}</url>`).join("")}</urlset>`;
}
export function sitemapIndexXml(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${xmlEscape(url)}</loc></sitemap>`).join("")}</sitemapindex>`;
}
export function sitemapChunks(rows: SitemapUrl[]): SitemapUrl[][] {
  const chunks: SitemapUrl[][] = [];
  let chunk: SitemapUrl[] = [],
    bytes = 0;
  for (const row of rows) {
    const size = new TextEncoder().encode(sitemapXml([row])).length;
    if (chunk.length >= SITEMAP_CHUNK_SIZE || bytes + size > 45_000_000) {
      chunks.push(chunk);
      chunk = [];
      bytes = 0;
    }
    chunk.push(row);
    bytes += size;
  }
  if (chunk.length || !chunks.length) chunks.push(chunk);
  return chunks;
}
