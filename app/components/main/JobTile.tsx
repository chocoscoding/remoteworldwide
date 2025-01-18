import { JobTileType } from "@/types/main";
import { Calendar, ChartNoAxesColumnIncreasing, MapPinned } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";
import TimeAgo from "timeago-react";

const JobTile: FC<JobTileType> = (props) => {
  const { title, slug, company, region, createdAt } = props;
  return (
    <div className="flex p-4 mb-5 rounded-md gap-2 md:gap-3 shadow-sm transition-all bg-white">
      {/* logo
    main info */}
      <div className="flex flex-col md:flex-row flex-1 gap-2 md:gap-3">
        <div className="flex justify-between w-full md:w-fit items-center md:items-start">
          <div className="border-2 rounded-full p-1 w-fit h-fit aspect-square object-center flex-shrink-0 flex justify-center items-center">
            <Image loading="eager" src={company.logo} alt="logo" width={40} height={40} className="rounded-full flex-shrink-0" />
          </div>
          <div className="h-fit flex-0 flex-shrink-0 md:hidden block">
            <p className="text-sm font-medium text-gray-500">
              <TimeAgo datetime={createdAt} />
            </p>
          </div>
        </div>
        <div className="flex-1">
          <Link href={"/companies/" + company.name}>
            <p className="w-full text-gray-500 font-medium text-base">{company.name}</p>
          </Link>

          <Link href={"/jobs/" + slug}>
            <p className="w-full text-xl font-bold mb-2 hover:underline cursor-pointer">{title}</p>
          </Link>
          <div className="w-full flex flex-wrap gap-4">
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-1.5">
              <MapPinned className="w-4 text-gray-400" />
              <span>Remote, {region}</span>
            </p>
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-1.5">
              <Calendar className="w-4 text-gray-400" />
              <span>Full-time</span>
            </p>
            <p className="text-gray-500 text-base flex flex-shrink-0 items-center gap-1.5">
              <ChartNoAxesColumnIncreasing className="w-4 text-gray-400" />
              <span>Mid-level</span>
            </p>
          </div>
        </div>
      </div>

      {/* date */}
      <div className="h-fit flex-0 flex-shrink-0 md:block hidden">
        <p className="text-sm font-medium text-gray-500">
          <TimeAgo datetime={createdAt} />
        </p>
      </div>
    </div>
  );
};

export default JobTile;
