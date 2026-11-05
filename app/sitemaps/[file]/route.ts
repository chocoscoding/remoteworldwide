import {
  SITEMAP_SECTIONS,
  sitemapSection,
  type SitemapSection,
} from "@/app/lib/sitemapData";
import { sitemapChunks, sitemapXml } from "@/app/lib/sitemapXml";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const match = /^([a-z]+)-(\d{1,5})\.xml$/.exec(file);
  if (!match || !SITEMAP_SECTIONS.includes(match[1] as SitemapSection))
    return new Response("Not found", { status: 404 });
  try {
    const rows = sitemapChunks(
      await sitemapSection(match[1] as SitemapSection),
    )[Number(match[2])];
    if (!rows) return new Response("Not found", { status: 404 });
    return new Response(sitemapXml(rows), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=300",
      },
    });
  } catch {
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
}
