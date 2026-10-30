import CompaniesList from "./Client";
import { CompanyList } from "@/types/main";
import { Metadata } from "next";
import { BOARD_TAGS, backendCachedWithCount } from "@/app/lib/backend";

// Cached like the board's other public reads: rebuilt every 10 minutes, or as soon as an admin
// write expires the companies or jobs tag (the list shows each company's open jobs).
export const revalidate = 600;

export const metadata: Metadata = {
  // Already carries the site name, so it skips the root template rather than doubling it.
  title: { absolute: "Companies – Remote companies hiring now | Remote Worldwide" },
  description:
    "Explore companies hiring for remote positions worldwide. Discover remote job opportunities from top companies across various industries and locations.",
  alternates: { canonical: "/companies" },
  openGraph: {
    title: "Companies – Remote companies hiring now | Remote Worldwide",
    description:
      "Explore companies hiring for remote positions worldwide. Discover remote job opportunities from top companies across various industries and locations.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/companies`,
    siteName: "Remote Worldwide",
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/company`,
        width: 1200,
        height: 630,
        alt: "Remote Companies - Remote Worldwide",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Companies – Remote companies hiring now | Remote Worldwide",
    description:
      "Explore companies hiring for remote positions worldwide. Discover remote job opportunities from top companies across various industries and locations.",
    images: [`${process.env.NEXT_PUBLIC_SITE_URL}/api/og/company`],
  },
};

// The first page from the backend directly, not out through the site's own public URL and its CDN.
const getCompanies = async (): Promise<{ data: CompanyList[]; count: number }> => {
  try {
    return await backendCachedWithCount<CompanyList[]>("/companies", { revalidate: 600, tags: [BOARD_TAGS.companies, BOARD_TAGS.jobs] });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return { data: [], count: 0 };
  }
};

export default async function Home() {
  const companies = await getCompanies();
  return (
    <>
      <CompaniesList initialData={companies.data} totalCompanies={companies.count} />
    </>
  );
}
