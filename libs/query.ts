"use server";

import { prisma } from "@/prisma";
import { Job } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { backend, BackendError, backendOrNull, type BackendInit } from "@/app/lib/backend";
import type { Author, Blog, BlogStatus } from "@/app/lib/blog/types";

export const deleteOneJob = async (id: string) => {
  try {
    await prisma.job.delete({
      where: {
        id,
      },
    });
    revalidatePath("/");
    return { status: "deleted job successfully" };
  } catch (error: any) {
    if (error.message.includes("Record to delete does not exist")) {
      throw new Error("Record to delete does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};

export const toggleJobActiveState = async (id: string, state: boolean) => {
  try {
    await prisma.job.update({
      where: {
        id,
      },
      data: {
        isActive: state,
      },
    });
    revalidatePath("/");
    return { status: "updated job successfully" };
  } catch (error: any) {
    if (error.message.includes("Record to update does not exist")) {
      throw new Error("Record to update does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};

export const updateOneJob = async (id: string, jobDetails: Omit<Job, "createdAt" | "updatedAt" | "isActive" | "id" | "jobType">) => {
  try {
    const data = await prisma.job.update({
      where: {
        id,
      },
      data: jobDetails,
    });
    revalidatePath("/");
    return { data };
  } catch (error: any) {
    if (error.message.includes("Record to update does not exist")) {
      throw new Error("Record to update does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};

export const findJobsAdmin = async (page: number, active: boolean) => {
  try {
    const inactiveJobsListPromise = prisma.job.findMany({
      where: {
        isActive: active,
      },
      select: {
        id: true,
        title: true,
        company: {
          select: {
            logo: true,
            name: true,
            slug: true,
          },
        },
        isActive: true,
        slug: true,
        category: true,
        region: true,
        seniority: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * 50,
      take: 50,
    });
    const inactiveJobsCountPromise = prisma.job.count({
      where: {
        isActive: active,
      },
    });
    const [inactiveJobsList, inactiveJobsCount] = await Promise.all([inactiveJobsListPromise, inactiveJobsCountPromise]);
    return { data: inactiveJobsList, count: inactiveJobsCount };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

export const findCompany = async (slug: string) => {
  try {
    const company = await prisma.company.findUnique({
      where: {
        slug,
      },
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });
    if (!company) {
      return null;
    }
    return { data: company };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

export const findCompanyJobs = async (companyId: string, page: number) => {
  try {
    const jobsListPromise = prisma.job.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        createdAt: true,
        slug: true,
        company: {
          select: {
            name: true,
            logo: true,
            slug: true,
          },
        },
        category: true,
        region: true,
        seniority: true,
      },
      skip: (page - 1) * 50,
      take: 50,
    });
    const jobsCountPromise = prisma.job.count({
      where: {
        companyId,
      },
    });
    const [jobsList, jobsCount] = await Promise.all([jobsListPromise, jobsCountPromise]);
    return { data: jobsList, count: jobsCount };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

export const getAdminDashboardInfo = async () => {
  try {
    const [latestJob, jobsCount, companiesCount, blogsCount] = await Promise.all([
      prisma.job.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          title: true,
          company: {
            select: {
              slug: true,
              logo: true,
              name: true,
            },
          },
          createdAt: true,
          isActive: true,
          slug: true,
          category: true,
          region: true,
          seniority: true,
        },
        take: 14,
      }),
      prisma.job.count(),
      prisma.company.count(),
      admin<{ posts: number }>("/stats")
        .then((stats) => stats.posts)
        .catch((error) => {
          if (error instanceof BackendError) return 0;
          throw error;
        }),
    ]);

    return { latestJob, jobsCount, companiesCount, blogsCount };
  } catch (error) {
    throw new Error("something went wrong");
  }
};

const admin = <T,>(path: string, init: BackendInit = {}) => backend<T>(`/blog/admin${path}`, { ...init, session: true });

const surface = (error: unknown): never => {
  throw new Error(error instanceof BackendError ? error.message : "something went wrong");
};

export type AuthorInput = Omit<Author, "id" | "createdAt" | "slug">;

export const createAuthor = async (body: AuthorInput) => {
  try {
    return { data: await admin<Author>("/authors", { method: "POST", body }) };
  } catch (error) {
    return surface(error);
  }
};

export const updateAuthor = async (id: string, body: AuthorInput) => {
  try {
    return { data: await admin<Author>(`/authors/${id}`, { method: "PUT", body }) };
  } catch (error) {
    return surface(error);
  }
};

export const deleteAuthor = async (id: string) => {
  try {
    await admin(`/authors/${id}`, { method: "DELETE" });
    return { status: "deleted author successfully" };
  } catch (error) {
    return surface(error);
  }
};

export const findAuthorBySlug = async (slug: string) => ({ data: await backendOrNull<Author>(`/blog/admin/authors/${encodeURIComponent(slug)}`, { session: true }) });

export const allAuthorsSelect = async () => admin<{ label: string; value: string }[]>("/authors/options");

export interface BlogConversionFields {
  category?: string;
  status?: BlogStatus;
  featuredRank?: number | null;
  leadMagnetId?: string | null;
  ctaKey?: string | null;
  autoCtas?: boolean;
  inlineOffers?: string[];
}

export interface BlogInput extends BlogConversionFields {
  title: string;
  content: string;
  description: string;
  authorIds: string[];
  tags: string[];
  coverImage: string;
  slug?: string;
}

export const createBlog = async (data: BlogInput) => {
  try {
    const blog = await admin<Blog>("/posts", { method: "POST", body: data });
    revalidatePath("/blogs");
    return { data: blog };
  } catch (error) {
    return surface(error);
  }
};

export const getBlogBySlug = async (slug: string) => ({ data: await backendOrNull<Blog>(`/blog/admin/posts/${encodeURIComponent(slug)}`, { session: true }) });

export const editBlog = async (id: string, data: Partial<BlogInput>) => {
  try {
    const blog = await admin<Blog>(`/posts/${id}`, { method: "PUT", body: data });
    revalidatePath("/blogs");
    for (const slug of [blog.slug, ...blog.previousSlugs]) revalidatePath("/blogs/" + slug);
    return { data: blog };
  } catch (error) {
    return surface(error);
  }
};

export const deleteBlog = async (id: string) => {
  try {
    await admin(`/posts/${id}`, { method: "DELETE" });
    revalidatePath("/blogs");
    return { status: "deleted blog successfully" };
  } catch (error) {
    return surface(error);
  }
};

export const getAllBookmarksForUser = async (userId: string, page: number) => {
  try {
    const bookmarksPromise = prisma.bookmark.findMany({
      where: { userId },
      select: {
        job: {
          select: {
            title: true,
            slug: true,
            region: true,
            id: true,
            seniority: true,
            category: true,
            company: {
              select: {
                name: true,
                logo: true,
              },
            },
          },
        },
      },
      skip: (page - 1) * 30,
      take: 30,
    });

    const totalCountPromise = prisma.bookmark.count({
      where: { userId },
    });

    const [bookmarks, count] = await Promise.all([bookmarksPromise, totalCountPromise]);
    return { data: bookmarks, count };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

//delete a bookmark
export const deleteBookmarkForUser = async (userId: string, jobId: string) => {
  try {
    await prisma.bookmark.delete({
      where: {
        userId_jobId: {
          userId,
          jobId,
        },
      },
    });
    return { status: "deleted bookmark successfully" };
  } catch (error: any) {
    if (error.message.includes("Record to delete does not exist")) {
      throw new Error("Record to delete does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};
//crate a bookmark
export const createBookmarkForUser = async (userId: string, jobId: string) => {
  try {
    const bookmark = await prisma.bookmark.create({
      data: {
        userId,
        jobId,
      },
    });
    return { data: bookmark };
  } catch (error: any) {
    if (error.message.includes("Unique constraint failed")) {
      throw new Error("Bookmark already exists");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};
//check if a user has job bookmarked
export const checkBookmarkForUser = async (userId: string, jobId: string) => {
  try {
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_jobId: {
          userId,
          jobId,
        },
      },
    });
    return { data: bookmark };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

export const getAllActiveJobsCount = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const count = await prisma.job.count({
      where: {
        isActive: true,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });
    return { count };
  } catch (error: any) {
    // throw new Error(error.message ?? "something went wrong");
    return { count: null };
  }
};

export const getFilters = async () => {
  try {
    const [category, seniority, region] = await Promise.all([
      prisma.category
        .findMany({ select: { id: true, name: true } })
        .then((results) => results.map(({ id, name }) => ({ value: id, label: name }))),
      prisma.seniority
        .findMany({ select: { id: true, name: true } })
        .then((results) => results.map(({ id, name }) => ({ value: id, label: name }))),
      prisma.region
        .findMany({ select: { id: true, name: true } })
        .then((results) => results.map(({ id, name }) => ({ value: id, label: name }))),
    ]);
    return { data: { category, seniority, region } };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

export const fetchLatestJobs = async (amount: number) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: amount,
      select: {
        id: true,
        title: true,
        company: {
          select: {
            logo: true,
            name: true,
            slug: true,
          },
        },
        slug: true,
        category: true,
        region: true,
        seniority: true,
        createdAt: true,
      },
    });
    return { data: jobs };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};
