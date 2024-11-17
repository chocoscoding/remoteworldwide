"use client";

import { useState } from "react";
import { PencilIcon, Trash } from "lucide-react";
import AdminJobTile from "@/app/components/ADMIN/AdminJobTile";
import CompanySection from "@/app/components/main/job/CompanySection";
import Link from "next/link";

export default function Home() {
  return (
    <main className="px-10 pt-10">
      <h1 className="text-2xl font-bold mb-6">Company Information</h1>

      <div className="w-[550px] gap-6 flex">
        <CompanySection showFullDetails />
        <div className="w-[6rem]">
          <Link
            href={`/heroshima/companies/123/edit`}
            className="drop-shadow-secondary2-hover transition-all rounded-md w-full aspect-square border border-primary mb-3 grid place-items-center">
            <PencilIcon />
          </Link>
          <button className="drop-shadow-secondary2-hover transition-all rounded-md w-full aspect-square border border-primary mb-3 bg-red-500 text-white grid place-items-center ">
            <Trash />
          </button>
        </div>
      </div>
      <br />

      <h2 className="font-bold text-xl my-2">Jobs</h2>
      <div className="grid grid-cols-1">
        {/* main */}
        {Array(20)
          .fill(0)
          .map((_, index) => (
            <AdminJobTile key={index} />
          ))}
      </div>
    </main>
  );
}
