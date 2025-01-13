import { OneBookmarkType } from "@/types/main";
import { Bookmark, Calendar, ChartNoAxesColumnIncreasing, MapPinned } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";

const BookmarkTile: FC<{ job: OneBookmarkType["job"]; removeBookmark: (id: string) => Promise<void> }> = ({ removeBookmark, job }) => {
  return (
    <div className="flex p-4 mb-5 rounded-xl gap-2 md:gap-3 shadow-sm transition-all bg-white">
      {/* logo
    main info */}
      <div className="flex flex-col md:flex-row flex-1 gap-2 md:gap-3">
        <div className="flex justify-between w-full md:w-fit items-center md:items-start">
          <div className="border-2 rounded-full p-1 w-fit h-fit  ">
            <Image loading="eager" src={job.company.logo} alt="logo" width={40} height={40} className="rounded-full" />
          </div>
          <div
            onClick={() => removeBookmark(job.id)}
            className="flex-0 flex-shrink-0 md:hidden flex border h-8 w-8 rounded-md items-center justify-center">
            <Bookmark fill="text-black" className="w-[1.2rem] text-black" />
          </div>
        </div>
        <div className="flex-1">
          <p className="w-full text-gray-500 font-medium text-base">{job.company.name}</p>
          <Link href={`/jobs/${job.slug}`}>
            <p className="w-full text-xl font-bold mb-2 hover:underline cursor-pointer">{job.title}</p>
          </Link>
          <div className="w-full flex flex-wrap gap-6">
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <MapPinned className="w-4 text-gray-400" />
              <span>Remote, {job.region}</span>
            </p>
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <Calendar className="w-4 text-gray-400" />
              <span>{job.jobType}</span>
            </p>
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-2">
              <ChartNoAxesColumnIncreasing className="w-4 text-gray-400" />
              <span>{job.seniority}</span>
            </p>
          </div>
        </div>
      </div>

      {/* date */}
      <div
        onClick={() => removeBookmark(job.id)}
        className="flex-0 flex-shrink-0 md:flex hidden border h-8 w-8 rounded-md  items-center justify-center">
        <Bookmark className="w-[1.2rem] text-black" fill="text-black" />
      </div>
    </div>
  );
};

export default BookmarkTile;
