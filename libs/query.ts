"use server";

import { prisma } from "@/prisma";
import { Author, Job } from "@prisma/client";
import { hexoid } from "hexoid";

function createSlugStatic(input: string) {
  return input
    .replace(/[*+~%.()'"!:@]/g, "") // Remove specified special characters
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}
function createSlug(input: string) {
  const timestamp = Date.now();
  return (
    input
      .replace(/[*+%~.()'"!:@]/g, "") // Remove specified special characters
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") +
    "-" +
    `${hexoid(36)()}` +
    `${timestamp}`
  );
}

export const deleteOneJob = async (id: string) => {
  try {
    await prisma.job.delete({
      where: {
        id,
      },
    });
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
    return { status: "updated job successfully" };
  } catch (error: any) {
    if (error.message.includes("Record to update does not exist")) {
      throw new Error("Record to update does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};

export const updateOneJob = async (id: string, jobDetails: Omit<Job, "createdAt" | "updatedAt" | "isActive" | "id">) => {
  try {
    const data = await prisma.job.update({
      where: {
        id,
      },
      data: jobDetails,
    });
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
          },
        },
        isActive: true,
        slug: true,
        category: true,
        region: true,
        jobType: true,
        seniority: true,
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

export const findCompany = async (name: string) => {
  try {
    const company = await prisma.company.findUnique({
      where: {
        name,
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
          },
        },
        category: true,
        region: true,
        jobType: true,
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
      prisma.job.findFirst({
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
              logo: true,
              name: true,
            },
          },
          isActive: true,
          slug: true,
          category: true,
          region: true,
          jobType: true,
          seniority: true,
        },
        take: 1,
      }),
      prisma.job.count(),
      prisma.company.count(),
      prisma.blog.count(),
    ]);

    return { latestJob, jobsCount, companiesCount, blogsCount };
  } catch (error) {
    throw new Error("something went wrong");
  }
};

//create an author

export const createAuthor = async (body: Omit<Author, "id" | "createdAt" | "updatedAt" | "slug">) => {
  try {
    const requiredValues = { name: body.name, about: body.about, profileImage: body.profileImage };
    const missingValue = Object.entries(requiredValues).filter(([key, value]) => !value);

    const errorMessage = missingValue.length ? `Required values: ${missingValue.map(([key]) => key).join(", ")}` : null;
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    const author = prisma.author.create({
      data: { ...body, slug: createSlugStatic(body.name) },
    });

    return { data: author };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

//update an author

export const updateAuthor = async (id: string, body: Omit<Author, "id" | "createdAt" | "updatedAt" | "slug">) => {
  try {
    const requiredValues = { id };
    const missingValue = Object.entries(requiredValues).filter(([key, value]) => !value);

    const errorMessage = missingValue.length ? `Required values: ${missingValue.map(([key]) => key).join(", ")}` : null;
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    const author = prisma.author.update({
      where: {
        id,
      },
      data: { ...body, slug: createSlugStatic(body.name) },
    });

    return { data: author };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

//delete an author
export const deleteAuthor = async (id: string) => {
  try {
    await prisma.author.delete({
      where: {
        id,
      },
    });
    return { status: "deleted author successfully" };
  } catch (error: any) {
    if (error.message.includes("Record to delete does not exist")) {
      throw new Error("Record to delete does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};

export const findAuthorBySlug = async (slug: string) => {
  try {
    const author = await prisma.author.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
        website: true,
        twitter: true,
        linkedin: true,
        instagram: true,
        name: true,
        about: true,
        profileImage: true,
      },
    });
    return { data: author };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

export const allAuthorsSelect = async () => {
  try {
    const authors = await prisma.author.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    return authors.map((author) => ({
      label: author.name,
      value: author.id,
    }));
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

// Create Blog
export const createBlog = async (data: {
  title: string;
  content: string;
  description: string;
  authorId: string;
  tags: string[];
  coverImage: string;
}) => {
  try {
    const slug = createSlug(data.title);
    const blog = await prisma.blog.create({
      data: { ...data, slug },
    });
    return { data: blog };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

// Get Blog by Slug
export const getBlogBySlug = async (slug: string) => {
  try {
    const blog = await prisma.blog.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        content: true,
        description: true,
        tags: true,
        coverImage: true,
        authorId: true,
        slug: true,
        author: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
    return { data: blog };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};

// Edit Blog
export const editBlog = async (
  id: string,
  data: {
    title?: string;
    content?: string;
    description?: string;
    tags?: string[];
    authorId?: string;
    coverImage?: string;
  }
) => {
  try {
    const blog = await prisma.blog.update({
      where: { id },
      data,
    });
    return { data: blog };
  } catch (error: any) {
    if (error.message.includes("Record to update does not exist")) {
      throw new Error("Record to update does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};

// Delete Blog
export const deleteBlog = async (id: string) => {
  try {
    await prisma.blog.delete({
      where: { id },
    });
    return { status: "deleted blog successfully" };
  } catch (error: any) {
    if (error.message.includes("Record to delete does not exist")) {
      throw new Error("Record to delete does not exist");
    }
    throw new Error(error.message ?? "something went wrong");
  }
};

//get all bookmarks
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
            jobType: true,
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
  try {
    const count = await prisma.job.count({
      where: {
        isActive: true,
      },
    });
    return { count };
  } catch (error: any) {
    // throw new Error(error.message ?? "something went wrong");
    return { count: null };
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
          },
        },
        slug: true,
        category: true,
        region: true,
        jobType: true,
        seniority: true,
        createdAt: true,
      },
    });
    return { data: jobs };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};
