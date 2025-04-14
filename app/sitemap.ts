import { prisma } from "@/prisma";
import { MetadataRoute } from "next";

const fetchJobMetaData_Jobs = async () => {
  try {
    const job = await prisma.job.findMany({
      select: {
        slug: true,
        title: true,
      },
    });
    return job;
  } catch (error) {
    return [];
  }
};
const fetchJobMetaData_Blogs = async () => {
  try {
    const job = await prisma.blog.findMany({
      select: {
        slug: true,
        title: true,
      },
    });
    return job;
  } catch (error) {
    return [];
  }
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: "",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "/blogs",
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: "/jobs",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: "/companies",
      changeFrequency: "weekly",
      priority: 0.2,
    },
  ];

  const blogs = await fetchJobMetaData_Blogs();
  const jobs = await fetchJobMetaData_Jobs();

  blogs.forEach((blog) => {
    routes.push({
      url: "/blogs/" + blog.slug,
      changeFrequency: "daily",
      priority: 0.5,
    });
  });
  jobs.forEach((job) => {
    routes.push({
      url: "/jobs/" + job.slug,
      changeFrequency: "daily",
      priority: 0.8,
    });
  });

  return routes.map(({ url, ...rest }) => ({
    ...rest,
    url: `https://www.remoteworldwide.net${url}`,
    lastModified: new Date().toISOString(),
  }));
}

export const dynamic = "force-dynamic";
