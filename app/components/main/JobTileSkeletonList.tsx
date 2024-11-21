import { FC } from "react";
import JobTileSkeleton from "./JobTileSkeleton";

const JobTileSkeletonList: FC<{ amount: number }> = ({ amount = 5 }) => {
  return (
    <div className="full">
      {Array(amount)
        .fill(0)
        .map((_, index) => (
          <JobTileSkeleton key={index} />
        ))}
    </div>
  );
};

export default JobTileSkeletonList;
