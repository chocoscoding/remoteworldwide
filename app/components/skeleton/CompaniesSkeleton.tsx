"use client";
import { FC } from "react";

const CompaniesSkeleton: FC<{ className?: string; amount?: number }> = ({ className, amount = 10 }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4 w-full ${className}`}>
      {Array(amount)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="flex flex-col gap-3 bg-white p-2 rounded-lg animate-pulse">
            <div className="flex w-full items-center">
              <div className="border-2 rounded-full p-1 w-[40px] h-[40px] bg-gray-300 animate-pulse"></div>
              <div className="ml-2 w-[150px] h-6 bg-gray-300 rounded-md animate-pulse"></div>
            </div>
            <div className="w-full h-[60px] bg-gray-300 rounded-md animate-pulse"></div>
            <div className="flex justify-between items-center">
              <div className="bg-gray-300 p-2 rounded-md w-[120px] h-6 animate-pulse"></div>
              <div className="w-6 h-6 bg-gray-300 rounded-md animate-pulse"></div>
            </div>
          </div>
        ))}
    </div>
  );
};

export default CompaniesSkeleton;
