export const dynamic = "force-dynamic";

import { backend } from "@/app/lib/backend";
import { MetadataRoute } from "next";
import { SITE_URL } from "@/app/lib/seo";
import { BLOG_CATEGORIES } from "@/app/lib/blog/categories";
import { getCategoriesWithCounts, getSitemapEntries } from "@/app/lib/blog/data";
import { LANDINGS, isLive, landingPath } from "@/app/lib/landing/catalogue";
import { indexableLandings } from "@/app/lib/landing/data";
import { TOOLS, toolPath } from "@/app/lib/tools/catalogue";

type SitemapEntry = { slug: string; updatedAt: Date };

const fetchJobMetaData_Jobs = async () => {
  try {
    // Live jobs only (the backend applies JOB_LIFETIME_DAYS): an expired posting's page is
    // noindexed, and a sitemap that lists noindexed pages teaches Google to trust it less.
    return await backend<SitemapEntry[]>("/jobs/sitemap");
  } catch {
    return [];
  }
};


const fetchCompaniesMetaData = async () => {
  try {
    return await backend<SitemapEntry[]>("/companies/sitemap");
  } catch {
    return [];
  }
};

const fetchBlogMetaData = async () => {
  try {
    return await getSitemapEntries();
  } catch {
    return { posts: [], authors: [] };
  }
};

/** Blog categories that have a post: an empty one is noindexed (blogs/category/[slug]), so it stays out. On a failed read, all of them. */
const fetchFilledCategories = async () => {
  try {
    const counts = await getCategoriesWithCounts();
    return new Set(counts.filter((c) => c.count > 0).map((c) => c.slug));
  } catch {
    return new Set(BLOG_CATEGORIES.map((c) => c.slug));
  }
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ posts: blogs, authors }, jobs, companies, filledCategories, landings] = await Promise.all([
    fetchBlogMetaData(),
    fetchJobMetaData_Jobs(),
    fetchCompaniesMetaData(),
    fetchFilledCategories(),
    // Live landing pages whose list is long enough to index (app/lib/landing/catalogue.ts).
    indexableLandings(LANDINGS.filter(isLive)),
  ]);

  const now = new Date();
  const newestPost = blogs.reduce<Date | null>((latest, b) => (!latest || b.updatedAt > latest ? b.updatedAt : latest), null);

  const routes: MetadataRoute.Sitemap = [
    { url: "/", changeFrequency: "daily", priority: 1, lastModified: now },
    { url: "/blogs", changeFrequency: "daily", priority: 0.8, lastModified: newestPost ?? now },
    { url: "/jobs", changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: "/companies", changeFrequency: "weekly", priority: 0.6, lastModified: now },
    { url: "/pricing", changeFrequency: "monthly", priority: 0.7, lastModified: now },
    { url: "/tools", changeFrequency: "monthly", priority: 0.8, lastModified: now },
    ...TOOLS.map((tool) => ({ url: toolPath(tool), changeFrequency: "monthly" as const, priority: 0.8, lastModified: now })),
    { url: "/waitlist", changeFrequency: "monthly", priority: 0.6, lastModified: now },
    { url: "/terms", changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: "/privacy-policy", changeFrequency: "yearly", priority: 0.2, lastModified: now },
  ];

  for (const landing of landings) {
    routes.push({ url: landingPath(landing), changeFrequency: "daily", priority: landing.slug === "latest" ? 0.8 : 0.7, lastModified: now });
  }

  for (const category of BLOG_CATEGORIES) {
    if (!filledCategories.has(category.slug)) continue;
    routes.push({ url: `/blogs/category/${category.slug}`, changeFrequency: "weekly", priority: 0.7, lastModified: newestPost ?? now });
  }

  for (const blog of blogs) {
    routes.push({ url: `/blogs/${blog.slug}`, changeFrequency: "monthly", priority: 0.7, lastModified: blog.updatedAt });
  }
  for (const job of jobs) {
    routes.push({ url: `/jobs/${job.slug}`, changeFrequency: "daily", priority: 0.6, lastModified: job.updatedAt });
  }
  for (const company of companies) {
    // Its real edit date: a lastmod that is always "now" teaches Google to ignore lastmod entirely.
    routes.push({ url: `/companies/${company.slug}`, changeFrequency: "weekly", priority: 0.5, lastModified: company.updatedAt });
  }
  for (const author of authors) {
    routes.push({ url: `/author/${author.slug}`, changeFrequency: "weekly", priority: 0.4, lastModified: newestPost ?? now });
  }

  return routes.map(({ url, ...rest }) => ({ url: `${SITE_URL}${url}`, ...rest }));
}
