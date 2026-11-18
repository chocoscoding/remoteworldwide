import { backend } from "@/app/lib/backend";
import { SITE_URL } from "@/app/lib/seo";
import {
  getCategoriesWithCounts,
  getSitemapEntries,
} from "@/app/lib/blog/data";
import { LANDINGS, isLive, landingPath } from "@/app/lib/landing/catalogue";
import { landingInventory } from "@/app/lib/landing/data";
import { TOOLS, toolPath } from "@/app/lib/tools/catalogue";
import { JOB_POSTING_MARKUP_REVISED_AT } from "@/app/lib/jobs/jobPostingJsonLd";
import type { SitemapUrl } from "./sitemapXml";
export const SITEMAP_SECTIONS = [
  "pages",
  "jobs",
  "archives",
  "companies",
  "landing",
  "blog",
] as const;
export type SitemapSection = (typeof SITEMAP_SECTIONS)[number];
type Entry = { slug: string; updatedAt: string | Date };
const url = (
  path: string,
  lastModified?: string | Date | null,
): SitemapUrl => ({
  url: `${SITE_URL}${path}`,
  ...(lastModified ? { lastModified } : {}),
});
export async function sitemapSection(
  section: SitemapSection,
): Promise<SitemapUrl[]> {
  if (section === "pages")
    return [
      "/",
      "/jobs",
      "/companies",
      "/pricing",
      "/tools",
      "/terms",
      "/privacy-policy",
      ...TOOLS.map(toolPath),
    ].map((path) => url(path));
  if (section === "jobs" || section === "archives") {
    const rows = await backend<Entry[]>(
      `/jobs/sitemap${section === "archives" ? "?status=archived" : ""}`,
    );
    // A live listing's page carries JobPosting markup, so it changed when the markup did, even
    // if the listing itself did not. Archived pages have no markup and keep their own date.
    const floor = section === "jobs" ? Date.parse(JOB_POSTING_MARKUP_REVISED_AT) : 0;
    return rows.map((row) =>
      url(
        `/jobs/${encodeURIComponent(row.slug)}`,
        new Date(row.updatedAt).getTime() < floor
          ? JOB_POSTING_MARKUP_REVISED_AT
          : row.updatedAt,
      ),
    );
  }
  if (section === "companies") {
    const rows = await backend<Entry[]>("/companies/sitemap");
    return rows.map((row) =>
      url(`/companies/${encodeURIComponent(row.slug)}`, row.updatedAt),
    );
  }
  if (section === "landing") {
    const rows = await landingInventory(LANDINGS.filter(isLive));
    return rows.map((row) => url(landingPath(row.landing), row.updatedAt));
  }
  const [blog, categories] = await Promise.all([
    getSitemapEntries(),
    getCategoriesWithCounts(),
  ]);
  return [
    url("/blogs"),
    ...blog.posts.map((row) =>
      url(`/blogs/${encodeURIComponent(row.slug)}`, row.updatedAt),
    ),
    ...blog.authors.map((row) =>
      url(`/author/${encodeURIComponent(row.slug)}`),
    ),
    ...categories
      .filter((row) => row.count > 0)
      .map((row) => url(`/blogs/category/${row.slug}`)),
  ];
}
