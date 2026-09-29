import { FC } from "react";
import { cn } from "@/lib/utils";

// Placeholder for a side ad: a solid red block until an ad network fills it.
// Sticks under the navbar while the job list scrolls past.
const AdSlot: FC<{ slot: string; className?: string }> = ({ slot, className }) => (
  <aside
    aria-label="Advertisement"
    data-ad-slot={slot}
    className={cn("sticky top-[85px] h-[600px] max-h-[calc(100vh-105px)] w-full self-start rounded-md bg-red-600", className)}
  />
);

export default AdSlot;
