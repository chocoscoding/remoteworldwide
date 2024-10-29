import { Bookmark } from "lucide-react";
import React from "react";

const BookmarkStatus = () => {
  return (
    <div className="flex-0 flex-shrink-0 flex border h-8 w-8 rounded-md  items-center justify-center">
      <Bookmark className="w-[1.2rem] text-gray-500" />
    </div>
  );
};

export default BookmarkStatus;
