"use client";
import { Bookmark, Calendar, ChartNoAxesColumnIncreasing, MapPinned } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";
import JobStatus from "./JobStatus";
import { Job } from "@prisma/client";

const AdminJobTile: FC<{ jobDetail: Job }> = ({ jobDetail }) => {
  return (
    <div className="flex p-4 mb-5 rounded-xl gap-2 md:gap-3 shadow-sm transition-all bg-white">
      {/* logo
    main info */}
      <div className="flex flex-col md:flex-row flex-1 gap-2 md:gap-3">
        <div className="flex justify-between w-full md:w-fit items-center md:items-start">
          <div className="border-2 rounded-full p-1 w-fit h-fit  ">
            <Image src="/images/telegram.png" alt="logo" width={40} height={40} className="rounded-full" />
          </div>
          <div className="flex-0 flex-shrink-0 md:hidden flex h-8 w-fit rounded-md items-center justify-center">
            <JobStatus currentStatus={jobDetail.isActive ? "active" : "inactive"} />
          </div>
        </div>
        <div className="flex-1">
          <p className="w-full text-gray-500 font-medium text-base">Telegram</p>
          <Link href={`/heroshima/jobs/${jobDetail.slug}`}>
            <p className="w-full text-xl font-bold mb-2 hover:underline cursor-pointer">{jobDetail.title}</p>
          </Link>
          <div className="w-full flex flex-wrap gap-6">
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <MapPinned className="w-4 text-gray-400" />
              <span>Remote, {jobDetail.region}</span>
            </p>
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <Calendar className="w-4 text-gray-400" />
              <span>{jobDetail.jobType}</span>
            </p>
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <ChartNoAxesColumnIncreasing className="w-4 text-gray-400" />
              <span>{jobDetail.seniority}</span>
            </p>
          </div>
        </div>
      </div>

      {/* date */}
      <div className="flex-0 flex-shrink-0 md:flex hidden h-8 w-fit rounded-md  items-center justify-center">
        <JobStatus currentStatus={jobDetail.isActive ? "active" : "inactive"} />
      </div>
    </div>
  );
};

export default AdminJobTile;
