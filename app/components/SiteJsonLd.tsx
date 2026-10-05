import { LOGO_URL, ORGANIZATION_ID, SITE_NAME, SITE_URL, WEBSITE_ID } from "@/app/lib/seo";

// The footer's profiles. Google ties them to the brand for its knowledge panel.
const SOCIAL_PROFILES = [
  "https://www.linkedin.com/company/remoteworldwide",
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
        alternateName: "RemoteWorldwide",
        url: SITE_URL,
        email: "contact@remoteworldwide.net",
        logo: { "@type": "ImageObject", url: LOGO_URL, width: 512, height: 512 },
        description: "Vetted worldwide remote jobs, and the tools to land them.",
        sameAs: SOCIAL_PROFILES,
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL,
        // Google's site name above each result comes from here; the alternates are how
        // people type the brand, so it keeps recognising them as us.
        name: SITE_NAME,
        alternateName: ["RemoteWorldwide", "Remote Worldwide Jobs", "remoteworldwide.net"],
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
