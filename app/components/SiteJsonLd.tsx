import { LOGO_URL, ORGANIZATION_ID, SITE_NAME, SITE_URL, WEBSITE_ID } from "@/app/lib/seo";

const SOCIAL_PROFILES = [
  "https://x.com/W0rldwideremote",
  "https://www.instagram.com/remoteworldwide_/",
  "https://www.tiktok.com/@worldwideremote",
  "https://t.me/worldwideremote",
];

export default function SiteJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: LOGO_URL, width: 512, height: 512 },
        description: "Vetted worldwide remote jobs, and the tools to land them.",
        sameAs: SOCIAL_PROFILES,
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { "@id": ORGANIZATION_ID },
        inLanguage: "en",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/jobs?search={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}
