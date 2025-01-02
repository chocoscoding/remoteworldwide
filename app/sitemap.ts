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
      priority: 1,
    },
    {
      url: "/jobs",
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "/companies",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  const blogs = await fetchJobMetaData_Blogs();
  const jobs = await fetchJobMetaData_Jobs();

  blogs.forEach((thook) => {
    routes.push({
      url: "/blog/" + thook.slug,
      changeFrequency: "daily",
      priority: 0.3,
    });
  });
  jobs.forEach((thook) => {
    routes.push({
      url: "/jobs/" + thook.slug,
      changeFrequency: "daily",
      priority: 1,
    });
  });

  return routes.map(({ url, ...rest }) => ({
    ...rest,
    url: `https://remoteworldwide.net${url}`,
    lastModified: new Date(),
  }));
}
