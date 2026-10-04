// Placeholders for content on its way: the dashboard's skeletons, in place of
// spinners and "Loading…" text (owner, 2026-10-03). The shapes stand in for
// what is coming, in the job picker's tone (`animate-pulse` on #f0f0ea); a
// screen reader hears the label instead.

import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";
import DashCard from "./DashCard";

/** One placeholder block. `dark` for a dark surface. */
export const Bone: FC<{ className?: string; dark?: boolean }> = ({ className, dark = false }) => (
  <span aria-hidden className={cn("block animate-pulse rounded", dark ? "bg-white/10" : "bg-[#f0f0ea]", className)} />
);

/**
 * One line of text on its way: a bone centred on the text's own line height
 * (`line`, e.g. "h-5" for text-sm), so a skeleton built from these is exactly
 * as tall as the rows it stands in for and nothing moves when they arrive.
 * `className` sizes the bone itself.
 */
export const LineBone: FC<{ line: string; className?: string; dark?: boolean }> = ({ line, className, dark }) => (
  <span aria-hidden className={cn("flex items-center", line)}>
    <Bone dark={dark} className={className} />
  </span>
);

/** A region of skeletons: said once to assistive tech, drawn as shapes for everyone else. */
export const Loading: FC<{ label: string; className?: string; children: ReactNode }> = ({ label, className, children }) => (
  <div role="status" aria-busy="true" className={className}>
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

/** Lines of text on their way; the last one runs short, the way a paragraph ends. */
export const LinesSkeleton: FC<{ lines?: number; className?: string; dark?: boolean }> = ({ lines = 3, className, dark }) => (
  <div aria-hidden className={cn("flex flex-col gap-2", className)}>
    {Array.from({ length: lines }, (_, i) => (
      <Bone key={i} dark={dark} className={cn("h-3", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
    ))}
  </div>
);

/** Title, company and meta widths that vary row to row, the way real ones do. */
const JOB_ROW_WIDTHS = [
  { title: "w-48", company: "w-20", meta: "w-[22rem]" },
  { title: "w-56", company: "w-24", meta: "w-64" },
  { title: "w-36", company: "w-20", meta: "w-56" },
  { title: "w-52", company: "w-16", meta: "w-[24rem]" },
  { title: "w-44", company: "w-24", meta: "w-72" },
  { title: "w-40", company: "w-20", meta: "w-60" },
];

export interface JobRowsSkeletonProps {
  /** What is loading, for a screen reader ("Loading your saved jobs"). */
  label: string;
  /** The quiet buttons at each row's right, by width as they render (Posting and Remove; View answers and Delete). */
  actions: readonly string[];
  /** The chips under each row, by width as they render: the first is the lime one, the rest are outlined. */
  chips: readonly string[];
  /** The count line over the list, by width. */
  countWidth?: string;
  rows?: number;
}

/**
 * A list of job rows on its way, laid out as the saved jobs and application
 * drafts pages lay their rows out (owner, 2026-10-04: the skeleton must match
 * the page): the count line, then per row the logo, the title, company and
 * meta lines, the quiet buttons at the right and the chips under it, on the
 * same paddings and line heights, so nothing moves when the rows arrive.
 */
export const JobRowsSkeleton: FC<JobRowsSkeletonProps> = ({ label, actions, chips, countWidth = "w-56", rows = 5 }) => (
  <Loading label={label}>
    <LineBone line="mb-3 h-4" className={cn("h-3", countWidth)} />
    <DashCard className="overflow-hidden p-0">
      <div className="flex flex-col divide-y divide-black/8">
        {Array.from({ length: rows }, (_, i) => {
          const widths = JOB_ROW_WIDTHS[i % JOB_ROW_WIDTHS.length];
          return (
            <div key={i} className="flex flex-col gap-3 px-6 py-4">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <Bone className="h-11 w-11 flex-none rounded-full" />
                  <div className="min-w-0 flex-1">
                    <LineBone line="h-5" className={cn("h-3.5", widths.title)} />
                    <LineBone line="mt-0.5 h-4" className={cn("h-3", widths.company)} />
                    <LineBone line="mt-0.5 h-4" className={cn("h-3 max-w-full", widths.meta)} />
                  </div>
                </div>
                <div className="flex flex-none items-center gap-0.5">
                  {actions.map((width, index) => (
                    <Bone key={index} className={cn("h-7 rounded-lg", width)} />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:pl-[60px]">
                {chips.map((width, index) => (
                  <Bone
                    key={index}
                    className={cn("rounded-full", index === 0 ? "h-7 bg-[#e1f073]/45" : "h-[29px] border border-black/10 bg-[#fbfbf7]", width)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DashCard>
  </Loading>
);

/** List rows on their way: an icon tile and two lines each. `bordered` for rows that sit in their own boxes. */
export const RowsSkeleton: FC<{ rows?: number; bordered?: boolean; className?: string }> = ({ rows = 3, bordered = true, className }) => (
  <div aria-hidden className={cn("flex flex-col gap-2", className)}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className={cn("flex items-center gap-3 px-3.5 py-3", bordered && "rounded-md border border-black/8")}>
        <Bone className="h-8 w-8 flex-none rounded-lg" />
        <span className="flex-1 space-y-1.5">
          <Bone className="h-3 w-2/3" />
          <Bone className="h-2.5 w-1/3" />
        </span>
      </div>
    ))}
  </div>
);
