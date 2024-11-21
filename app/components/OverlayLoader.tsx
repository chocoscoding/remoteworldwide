import { LoaderCircle } from "lucide-react";
import React from "react";

const OverlayLoader = () => {
  return (
    <div className="fixed w-full h-full backdrop-blur bg-black/40 flex items-center justify-center flex-col text-white z-10">
      <LoaderCircle className="w-[20vw] h-[20vh] animate-spin" />
      <p className="text-xl">Processing...</p>
    </div>
  );
};

export default OverlayLoader;
