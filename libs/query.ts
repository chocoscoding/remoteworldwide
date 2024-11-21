"use server";

import { prisma } from "@/prisma";
import { Job } from "@prisma/client";

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
    const [latestJob, jobsCount, companiesCount] = await Promise.all([
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
    ]);

    return { latestJob, jobsCount, companiesCount };
  } catch (error) {
    throw new Error("something went wrong");
  }
};

//
