"use server";

import { prisma } from "@/prisma";
import { Job } from "@prisma/client";
import { redirect } from "next/navigation";

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

export const findInactiveJobs = async (page: number) => {
  try {
    const inactiveJobsListPromise = prisma.job.findMany({
      where: {
        isActive: false,
      },
      select: {
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
      },
      skip: (page - 1) * 50,
      take: 50,
    });
    const inactiveJobsCountPromise = prisma.job.count({
      where: {
        isActive: false,
      },
    });
    const [inactiveJobsList, inactiveJobsCount] = await Promise.all([inactiveJobsListPromise, inactiveJobsCountPromise]);
    return { data: inactiveJobsList, count: inactiveJobsCount };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};
