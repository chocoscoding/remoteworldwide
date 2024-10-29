const JobTileSkeleton = () => {
  return (
    <div className="flex p-4 mb-5 rounded-xl gap-2 md:gap-3 shadow-sm transition-all bg-gray-200 animate-pulse">
      <div className="flex flex-col md:flex-row flex-1 gap-2 md:gap-3">
        <div className="flex justify-between w-full md:w-fit items-center md:items-start">
          <div className="border-2 rounded-full p-1 w-10 h-10 bg-gray-300"></div>
          <div className="h-fit flex-0 flex-shrink-0 md:hidden block">
            <div className="w-12 h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
        <div className="flex-1">
          <div className="w-24 h-4 bg-gray-300 rounded mb-2"></div>
          <div className="w-full h-6 bg-gray-300 rounded mb-2"></div>
          <div className="w-full flex flex-wrap gap-4">
            <div className="w-20 h-4 bg-gray-300 rounded"></div>
            <div className="w-20 h-4 bg-gray-300 rounded"></div>
            <div className="w-20 h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
      <div className="h-fit flex-0 flex-shrink-0 md:block hidden">
        <div className="w-12 h-4 bg-gray-300 rounded"></div>
      </div>
    </div>
  );
};

export default JobTileSkeleton;
