import { SITEMAP_SECTIONS, sitemapSection } from "@/app/lib/sitemapData";
import { sitemapChunks, sitemapIndexXml } from "@/app/lib/sitemapXml";
import { SITE_URL } from "@/app/lib/seo";
export const dynamic = "force-dynamic";
// The index reads every section to count its parts. A cold start right after a deploy took past
// Vercel's default 15 s and answered 504 (2026-11-05), so it may take a minute; and the CDN keeps
// it an hour, then serves the last copy for up to a day while it rebuilds in the background, so
// crawlers never wait on a rebuild. New jobs still appear within the hour.
export const maxDuration = 60;
export async function GET() {
  try {
    const sections = await Promise.all(
      SITEMAP_SECTIONS.map(async (section) => ({
        section,
        chunks: sitemapChunks(await sitemapSection(section)),
      })),
    );
    return new Response(
      sitemapIndexXml(
        sections.flatMap(({ section, chunks }) =>
          chunks.map(
            (_, index) => `${SITE_URL}/sitemaps/${section}-${index}.xml`,
          ),
        ),
      ),
      {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Retry-After": "300", "Cache-Control": "no-store" },
    });
  }
}
