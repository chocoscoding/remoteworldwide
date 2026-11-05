import { SITEMAP_SECTIONS, sitemapSection } from "@/app/lib/sitemapData";
import { sitemapChunks, sitemapIndexXml } from "@/app/lib/sitemapXml";
import { SITE_URL } from "@/app/lib/seo";
export const dynamic = "force-dynamic";
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
          "Cache-Control": "public, max-age=0, s-maxage=300",
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
