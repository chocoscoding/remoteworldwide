import type { FC } from "react";
import { cn } from "@/lib/utils";

/** Stands in for an image that hasn't been uploaded yet: a solid block, same footprint, saying so. */
const NoImage: FC<{ className?: string }> = ({ className }) => (
  <div role="img" aria-label="No image uploaded" className={cn("flex items-center justify-center bg-[#e7e7e4] text-center text-sm font-semibold text-[#222325]/55", className)}>
    No image uploaded
  </div>
);

export default NoImage;
