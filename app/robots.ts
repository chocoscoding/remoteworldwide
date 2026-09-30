import { MetadataRoute } from "next";
import { SITE_URL } from "@/app/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
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
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
