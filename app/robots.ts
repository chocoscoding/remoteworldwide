import { MetadataRoute } from "next";
import { SITE_URL } from "@/app/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // The share cards (/api/og/*) are images that link previews and Google fetch; the rest of /api/ is not for crawlers.
        allow: ["/", "/api/og/"],
        disallow: [
          "/go/",
          // A resume or letter's print page (token-only, 404 without one) and
          // its signed-in deep links: nothing here is for a crawler.
          "/print/",
          "/open/",
          "/heroshima/",
          "/dashboard/",
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/bookmarks",
          // Public filters must remain crawlable so their noindex metadata can be read.

        ],
      },
      // Meta's AI training crawler: 269,000 requests in five days (Oct 2-6, 2026) and no visitors
      // back. The firewall denies it too; this asks first. Facebook, Instagram and WhatsApp link
      // previews come from facebookexternalhit, which this does not touch.
      {
        userAgent: "meta-externalagent",
        disallow: "/",
      },
      // Crawlers that rebuilt the job pages and sent nobody back (Vercel logs, 2026-11-05): 42% of
      // /jobs/[id] renders in a week and about 30% of all function time, with zero visits from
      // meta.ai, Petal Search or Widesyker in 30 days. meta-webindexer feeds Meta AI search, not
      // link previews (facebookexternalhit), so shared links keep their cards.
      {
        userAgent: ["meta-webindexer", "PetalBot", "WidesykerBot"],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
