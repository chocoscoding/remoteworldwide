"use server";

// Every export here is a server action: a POST endpoint anyone holding its id can
// call with any arguments, whichever page imports it — the admin route groups'
// notFound() gates the page, not the action. So each one opens with its own check
// (app/lib/auth/action-guards.ts), placed before its `try` so a refusal leaves as
// the ActionAuthError it is instead of being rewrapped by the catch or `surface`.
//   - The board (jobs, companies, the dashboard counts) is ADMIN's, the same
//     positive check as the REST routes behind requireAdmin: an AUTHOR may neither
//     write it nor list the inactive listings.
//   - Posts are the writers' (ADMIN or AUTHOR) and author profiles are ADMIN's. The
//     backend's isWriter/isAdmin already enforce that; checking here too makes an
//     anonymous call fail at the edge rather than on the backend's word alone.
//   - Bookmarks belong to the session's user. They once took a `userId` argument,
//     and their ids ship on every public job page, so any visitor could read,
//     add or delete anyone's.
//   - The public reads (latest jobs, the active count, filters) stay open and
//     return only active listings and public fields.

import { prisma } from "@/prisma";
import { Job } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { backend, BackendError, backendOrNull, idSegment, isObjectId, type BackendInit } from "@/app/lib/backend";
import type { Author, Blog, BlogStatus } from "@/app/lib/blog/types";
import { requireAdminAction, requireRoleAction, requireUserAction } from "@/app/lib/auth/action-guards";

export const deleteOneJob = async (id: string) => {
  await requireAdminAction();
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
  await requireAdminAction();
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

// The fields the edit form owns. The type alone never limited the write — it is
// erased at runtime, and `data: jobDetails` let a direct call pass anything the
// update input accepts: `isActive` (publishing is toggleJobActiveState's job) or
// `createdAt` (which orders the board). Naming each field makes the write match
// the type, as the REST twin (app/api/jobs/[id]/route.ts PUT) does.
type JobEdit = Pick<Job, "title" | "description" | "companyId" | "applicationUrl" | "category" | "region" | "seniority" | "slug">;

export const updateOneJob = async (id: string, jobDetails: JobEdit) => {
  await requireAdminAction();
  try {
    const { title, description, companyId, applicationUrl, category, region, seniority, slug } = jobDetails;
    const data = await prisma.job.update({
      where: {
        id,
      },
      data: { title, description, companyId, applicationUrl, category, region, seniority, slug },
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
  await requireAdminAction();
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

// The admin view of a company. The public /companies pages read through
// app/api/companies and app/api/jobs/company, which filter to active listings.
export const findCompany = async (slug: string) => {
  await requireAdminAction();
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
  await requireAdminAction();
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

// heroshima/page.tsx returns early for an AUTHOR, so only ADMIN renders this.
export const getAdminDashboardInfo = async () => {
  await requireAdminAction();
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

// The backend's isWriter, checked at the edge: posts are written by ADMIN or AUTHOR.
const requireWriterAction = () => requireRoleAction("ADMIN", "AUTHOR");

export type AuthorInput = Omit<Author, "id" | "createdAt" | "slug">;

export const createAuthor = async (body: AuthorInput) => {
  await requireAdminAction();
  try {
    return { data: await admin<Author>("/authors", { method: "POST", body }) };
  } catch (error) {
    return surface(error);
  }
};

// The ids below go through `idSegment` (app/lib/backend.ts): pasted raw, `../../..`
// turned "delete this post" into a request to any backend path under the caller's
// cookie. Inside the `try`, so a malformed id surfaces as the backend's own 400 text.
export const updateAuthor = async (id: string, body: AuthorInput) => {
  await requireAdminAction();
  try {
    return { data: await admin<Author>(`/authors/${idSegment(id)}`, { method: "PUT", body }) };
  } catch (error) {
    return surface(error);
  }
};

export const deleteAuthor = async (id: string) => {
  await requireAdminAction();
  try {
    await admin(`/authors/${idSegment(id)}`, { method: "DELETE" });
    return { status: "deleted author successfully" };
  } catch (error) {
    return surface(error);
  }
};

export const findAuthorBySlug = async (slug: string) => {
  await requireAdminAction();
  return { data: await backendOrNull<Author>(`/blog/admin/authors/${encodeURIComponent(slug)}`, { session: true }) };
};

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
  await requireWriterAction();
  try {
    const blog = await admin<Blog>("/posts", { method: "POST", body: data });
    revalidatePath("/blogs");
    return { data: blog };
  } catch (error) {
    return surface(error);
  }
};

export const getBlogBySlug = async (slug: string) => {
  await requireWriterAction();
  return { data: await backendOrNull<Blog>(`/blog/admin/posts/${encodeURIComponent(slug)}`, { session: true }) };
};

export const editBlog = async (id: string, data: Partial<BlogInput>) => {
  await requireWriterAction();
  try {
    const blog = await admin<Blog>(`/posts/${idSegment(id)}`, { method: "PUT", body: data });
    revalidatePath("/blogs");
    for (const slug of [blog.slug, ...blog.previousSlugs]) revalidatePath("/blogs/" + slug);
    return { data: blog };
  } catch (error) {
    return surface(error);
  }
};

export const deleteBlog = async (id: string) => {
  await requireWriterAction();
  try {
    await admin(`/posts/${idSegment(id)}`, { method: "DELETE" });
    revalidatePath("/blogs");
    return { status: "deleted blog successfully" };
  } catch (error) {
    return surface(error);
  }
};

// How a query failure reaches a caller who is not an admin. Prisma's message names
// the database host when the connection drops and echoes malformed ids back, and
// development forwards a thrown message to the browser (production already hides
// it). These callers show their own fixed copy, so the detail stays in the server
// log and the caller gets the same words in every environment.
const opaque = (action: string, error: unknown): never => {
  console.error(`[query] ${action}:`, error);
  throw new Error("something went wrong");
};

// The bookmarks below are the session user's own: the id comes from
// requireUserAction(), never from an argument.
export const getAllBookmarksForUser = async (page: number) => {
  const { id: userId } = await requireUserAction();
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
  } catch (error) {
    return opaque("getAllBookmarksForUser", error);
  }
};

//delete a bookmark
export const deleteBookmarkForUser = async (jobId: string) => {
  const { id: userId } = await requireUserAction();
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
    return opaque("deleteBookmarkForUser", error);
  }
};
//crate a bookmark
// Only a live listing can be saved. The row's jobId is a bare ObjectId — Mongo has no
// foreign keys and Prisma checks none on a scalar write — so any invented id used to
// make a row, as many as the caller liked, and an inactive listing's id read its title
// and slug back through getAllBookmarksForUser. Listing inactive jobs is ADMIN's.
const JOB_NOT_LIVE = "Job not found";
export const createBookmarkForUser = async (jobId: string) => {
  const { id: userId } = await requireUserAction();
  try {
    const live = isObjectId(jobId) && (await prisma.job.count({ where: { id: jobId, isActive: true } })) > 0;
    if (!live) throw new Error(JOB_NOT_LIVE);
    const bookmark = await prisma.bookmark.create({
      data: {
        userId,
        jobId,
      },
    });
    return { data: bookmark };
  } catch (error: any) {
    if (error.message === JOB_NOT_LIVE) throw error;
    if (error.message.includes("Unique constraint failed")) {
      throw new Error("Bookmark already exists");
    }
    return opaque("createBookmarkForUser", error);
  }
};
//check if a user has job bookmarked
export const checkBookmarkForUser = async (jobId: string) => {
  const { id: userId } = await requireUserAction();
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
  } catch (error) {
    return opaque("checkBookmarkForUser", error);
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
  } catch (error) {
    // Public, like fetchLatestJobs: a dropped connection's Prisma text names the host.
    return opaque("getFilters", error);
  }
};

// Public, like the home page that calls it with 10. `amount` comes from the caller,
// so it is capped: uncapped, one direct POST read every active job in one query.
export const fetchLatestJobs = async (amount: number) => {
  const take = Math.min(Math.max(1, amount | 0), 50);
  try {
    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
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
  } catch (error) {
    return opaque("fetchLatestJobs", error);
  }
};
