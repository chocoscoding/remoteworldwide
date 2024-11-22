import { LoaderCircle } from "lucide-react";
import React from "react";

const Loading = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <LoaderCircle className="w-[40vw] h-[40vh] animate-spin mt-3" />
      <p>Loading...</p>
    </div>
  );
};

export default Loading;
