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
          "/*?*category=",
          "/*?*utm_",
        ],
      },
      // Meta's AI training crawler: 269,000 requests in five days (Oct 2-6, 2026) and no visitors
      // back. The firewall denies it too; this asks first. Facebook, Instagram and WhatsApp link
      // previews come from facebookexternalhit, which this does not touch.
      {
        userAgent: "meta-externalagent",
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
