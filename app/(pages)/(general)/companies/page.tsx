import CompaniesList from "./Client";
import { CompanyList } from "@/types/main";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remote Companies Hiring - Remote Worldwide",
  description:
    "Explore companies hiring for remote positions worldwide. Discover remote job opportunities from top companies across various industries and locations.",
  openGraph: {
    title: "Remote Companies Hiring - Remote Worldwide",
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
    title: "Remote Companies Hiring - Remote Worldwide",
    description:
      "Explore companies hiring for remote positions worldwide. Discover remote job opportunities from top companies across various industries and locations.",
    images: [`${process.env.NEXT_PUBLIC_SITE_URL}/api/og/company`],
  },
};

const getCompanies = async (): Promise<{ data: CompanyList[]; count: number }> => {
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_SITE_URL + "/api/companies", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Failed to fetch companies");
    }
    const companies = await response.json();
    return companies;
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
