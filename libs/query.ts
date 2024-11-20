"use server";

import { prisma } from "@/prisma";

export const deleteOneJob = async (id: string) => {
  try {
    await prisma.job.delete({
      where: {
        id,
      },
    });
    return { status: "ok" };
  } catch (error: any) {
    throw new Error(error.message ?? "something went wrong");
  }
};
