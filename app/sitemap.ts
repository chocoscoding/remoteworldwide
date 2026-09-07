export const dynamic = "force-dynamic";

import { prisma } from "@/prisma";
import { MetadataRoute } from "next";
import { SITE_URL } from "@/app/lib/seo";
import { BLOG_CATEGORIES } from "@/app/lib/blog/categories";
import { getSitemapEntries } from "@/app/lib/blog/data";

const fetchJobMetaData_Jobs = async () => {
  try {
    return await prisma.job.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    });
  } catch {
    return [];
  }
};


const fetchCompaniesMetaData = async () => {
  try {
    return await prisma.company.findMany({ select: { slug: true } });
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ posts: blogs, authors }, jobs, companies] = await Promise.all([fetchBlogMetaData(), fetchJobMetaData_Jobs(), fetchCompaniesMetaData()]);

  const now = new Date();
  const newestPost = blogs.reduce<Date | null>((latest, b) => (!latest || b.updatedAt > latest ? b.updatedAt : latest), null);

  const routes: MetadataRoute.Sitemap = [
    { url: "/", changeFrequency: "daily", priority: 1, lastModified: now },
    { url: "/blogs", changeFrequency: "daily", priority: 0.8, lastModified: newestPost ?? now },
    { url: "/jobs", changeFrequency: "daily", priority: 0.9, lastModified: now },
    { url: "/companies", changeFrequency: "weekly", priority: 0.6, lastModified: now },
  ];

  for (const category of BLOG_CATEGORIES) {
    routes.push({ url: `/blogs/category/${category.slug}`, changeFrequency: "weekly", priority: 0.7, lastModified: newestPost ?? now });
  }

  for (const blog of blogs) {
    routes.push({ url: `/blogs/${blog.slug}`, changeFrequency: "monthly", priority: 0.7, lastModified: blog.updatedAt });
  }
  for (const job of jobs) {
    routes.push({ url: `/jobs/${job.slug}`, changeFrequency: "daily", priority: 0.6, lastModified: job.updatedAt });
  }
  for (const company of companies) {
    routes.push({ url: `/companies/${company.slug}`, changeFrequency: "weekly", priority: 0.5, lastModified: now });
  }
  for (const author of authors) {
    routes.push({ url: `/author/${author.slug}`, changeFrequency: "weekly", priority: 0.4, lastModified: newestPost ?? now });
  }

  return routes.map(({ url, ...rest }) => ({ url: `${SITE_URL}${url}`, ...rest }));
}
