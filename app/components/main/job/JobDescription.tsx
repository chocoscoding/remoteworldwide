"use client";
import React, { FC } from "react";
import { Calendar, ChartNoAxesColumnIncreasing, Link as LinkIcon, MapPinned, Zap } from "lucide-react";
import Link from "next/link";
import BookmarkStatus from "../BookmarkStatus";
import { Job } from "@prisma/client";

const JobDescription: FC<{ data: Job; showBookmark?: boolean }> = ({ data, showBookmark = true }) => {
  const { title, description, region, createdAt, jobType, seniority, applicationUrl } = data;
  return (
    <div className="bg-white w-full min-h-screen rounded-lg drop-shadow-primary outline outline-2 outline-black p-3 sm:p-5 md:p-10 overflow-hidden">
      <p className="text-gray-500 text-sm">Job Description</p>

      <section className="mt-5 flex w-full flex-wrap xs:flex-row flex-col">
        <div className="w-full flex-1">
          <p className="font-semibold text-2xl md:text-3xl mb-1 sm:mb-3 w-full break-words text-pretty">{title}</p>
          <p className="text-gray-500 mb-1.5">Posted: {new Date(createdAt).toLocaleDateString("en-GB")}</p>
          <div className="w-full flex flex-wrap gap-3 md:gap-5 mb-3">
            <p className="text-gray-500 text-sm md:text-lg flex flex-shrink-0 items-center gap-1 md:gap-1.5">
              <MapPinned className="w-3 md:w-4 text-gray-400" />
              <span>Remote, {region}</span>
            </p>
            <p className="text-gray-500 text-sm md:text-lg flex flex-shrink-0 items-center gap-1 md:gap-1.5">
              <Calendar className="w-3 md:w-4 text-gray-400" />
              <span>{jobType}</span>
            </p>
            <p className="text-gray-500 text-sm md:text-lg flex flex-shrink-0 items-center gap-1 md:gap-1.5">
              <ChartNoAxesColumnIncreasing className="w-3 md:w-4 text-gray-400" />
              <span>{seniority}</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 flex-shrink-0 w-fit ">
          <button className="h-8 w-8 rounded-lg hover:bg-gray-50 flex items-center justify-center">
            <LinkIcon className="text-gray-500 w-[1.2rem]" />
          </button>
          {showBookmark && <BookmarkStatus />}
        </div>
      </section>
      <hr className="bg-gray-500 my-6" />
      <section className="middle min-h-[50vh]">
        <div dangerouslySetInnerHTML={{ __html: description }}></div>
      </section>
      <Link
        href={applicationUrl}
        target="_blank"
        className="bg-primary text-white w-full h-12 text-lg flex justify-center gap-3 items-center hover:rounded-lg transition-all mt-5">
        <Zap />
        <span className="font-bold">Apply Now</span>
      </Link>
    </div>
  );
};

export default JobDescription;
