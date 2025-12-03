export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;

import { prisma } from "@/prisma";
import { MetadataRoute } from "next";
const fetchJobMetaData_Jobs = async () => {
  try {
    const job = await prisma.job.findMany({
      where: {
        isActive: true,
        // slug: {
        //   not: {
        //     contains: ",",
        //   },
        // },
      },
      select: {
        slug: true,
        title: true,
      },
    });
    return job;
  } catch {
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
  } catch {
    return [];
  }
};
const fetchJobMetaData_Authors = async () => {
  try {
    const authors = await prisma.author.findMany({
      select: {
        slug: true,
        name: true,
      },
    });
    return authors;
  } catch {
    return [];
  }
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: "/",
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
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: "/companies",
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const blogs = await fetchJobMetaData_Blogs();
  const jobs = await fetchJobMetaData_Jobs();
  const authors = await fetchJobMetaData_Authors();

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
      priority: 0.6,
    });
  });
  authors.forEach((author) => {
    routes.push({
      url: "/author/" + author.slug,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  });

  return routes.map(({ url, ...rest }) => ({
    url: `https://www.remoteworldwide.net${url}`,
    ...rest,
    lastModified: new Date().toISOString(),
  }));
}
