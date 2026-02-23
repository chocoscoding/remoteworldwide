"use client";
import { ChartNoAxesColumnIncreasing, MapPinned } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";
import JobStatus from "./JobStatus";
import { OneJobListType } from "@/types/main";
import TimeAgo from "timeago-react";

const AdminJobTile: FC<{ jobDetail: OneJobListType }> = ({ jobDetail }) => {
  const regionLabel = jobDetail.region.length > 0 ? jobDetail.region.join(", ") : "Anywhere in the world";
  return (
    <div className="flex p-4 mb-5 rounded-xl gap-2 md:gap-3 shadow-sm transition-all bg-white">
      {/* logo
    main info */}
      <div className="flex flex-col md:flex-row flex-1 gap-2 md:gap-3">
        <div className="flex justify-between w-full md:w-fit items-center md:items-start">
          <div className="border-2 rounded-full p-1 w-fit h-fit aspect-square object-center flex-shrink-0 flex justify-center items-center ">
            <Image loading="eager" src={jobDetail.company.logo} alt="logo" width={40} height={40} className="rounded-full" />
          </div>
          <div className="flex-0 flex-shrink-0 md:hidden flex h-8 w-fit rounded-md items-center justify-center">
            <JobStatus currentStatus={jobDetail.isActive ? "active" : "inactive"} />
          </div>
        </div>
        <div className="flex-1">
          <Link href={`/heroshima/companies/${jobDetail.company.slug}`} className="w-full text-gray-500 font-medium text-base">
            {jobDetail.company.name}
          </Link>
          <Link href={`/heroshima/jobs/${jobDetail.slug}`}>
            <p className="w-full text-xl font-bold mb-2 hover:underline cursor-pointer">{jobDetail.title}</p>
          </Link>
          <div className="w-full flex flex-wrap gap-6">
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <MapPinned className="w-4 text-gray-400" />
              <span>{regionLabel}</span>
            </p>
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <ChartNoAxesColumnIncreasing className="w-4 text-gray-400" />
              <span>{jobDetail.seniority}</span>
            </p>
          </div>
          {jobDetail.createdAt && (
            <p className="text-gray-500 mt-2 text-sm">
              Created:
              <span className="text-gray-600 ml-1">
                <TimeAgo datetime={jobDetail.createdAt} />
              </span>
            </p>
          )}
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
