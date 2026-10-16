"use client";
import { JobTileType } from "@/types/main";
import Image from "next/image";
import Link from "@/app/components/navigation/HoverPrefetchLink";
import React, { FC, useId, useState } from "react";
import TimeAgo from "timeago-react";
import { cn } from "@/lib/utils";

// The /jobs board's "sticker" job tile (owner's design, trialled at /jobs_v2 and adopted 2026-10-16).
// The whole tile opens the job: the title link stretches over it, and the company link and the "+N"
// locations button sit above that stretch so they still take their own clicks.
// Pay and visa aren't in the board's list data yet, so their pills show only when a caller passes them.
type JobTileV2Props = JobTileType & { pay?: string; visa?: string };

/** Locations shown as pills before the rest fold into "+N". One extra shows whole: a "+1" pill is no shorter. */
const SHOWN_LOCATIONS = 3;

/** What the logo circle says when there's no logo: a short name whole ("OKX"), else initials. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0].length <= 3 ? words[0] : words[0][0]).toUpperCase();
}

const Pill = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("rounded-full bg-[#f0f0ea] px-[9px] py-0.5", className)}>{children}</span>
);

const MoreLocations = ({ rest }: { rest: string[] }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={cn("group/more relative z-10 hover:z-30", open && "z-30")}>
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="rounded-full bg-[#f6f6f6] px-2 py-0.5 font-semibold text-[#8a8b85] group-hover/tile:bg-[#e4e4dd] group-hover/tile:text-[#44453f]">
        +{rest.length}
      </button>
      <span
        role="tooltip"
        id={id}
        className={cn(
          "absolute left-0 top-full mt-2 w-[190px] flex-col gap-1 rounded-[10px] border-[1.5px] bg-white px-3 py-2.5 text-[13px] font-bold text-primary br-shadow",
          open ? "flex" : "hidden group-hover/more:flex",
        )}>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f6062]">Also open to</span>
        {rest.map((location) => (
          <span key={location}>{location}</span>
        ))}
      </span>
    </span>
  );
};

const JobTileV2: FC<JobTileV2Props> = (props) => {
  const { title, slug, company, region, createdAt, seniority, pay, visa } = props;
  const [logoBroken, setLogoBroken] = useState(false);
  const locations = region.length > 0 ? region : ["Anywhere in the world"];
  const shown = locations.length > SHOWN_LOCATIONS + 1 ? locations.slice(0, SHOWN_LOCATIONS) : locations;
  const rest = locations.slice(shown.length);

  return (
    <div className="group/tile relative mb-5 grid grid-cols-[32px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 sm:grid-cols-[44px_minmax(0,1fr)] sm:gap-x-3.5 rounded-[10px] border-[1.5px] bg-white px-[18px] py-4 text-[13px] leading-[1.45] text-primary br-plain-press sm:items-start">
      <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border-[1.5px] border-primary bg-primary text-[10px] font-extrabold text-white sm:row-span-3 sm:h-11 sm:w-11 sm:text-xs">
        {company.logo && !logoBroken ? (
          <Image
            loading="lazy"
            src={company.logo}
            alt=""
            width={44}
            height={44}
            className="h-full w-full bg-white object-cover"
            onError={() => setLogoBroken(true)}
          />
        ) : (
          initials(company.name)
        )}
      </span>

      <div className="flex min-w-0 justify-between gap-2">
        <Link
          href={"/companies/" + company.slug}
          className="relative z-10 min-w-0 truncate text-[13px] font-bold text-[#44453f] hover:text-black">
          {company.name}
        </Link>
        <span className="flex-none whitespace-nowrap text-xs text-[#5f6062]">
          {/* "24 seconds ago" in the browser vs "27" on the server is expected, not a bug. */}
          <TimeAgo datetime={createdAt} suppressHydrationWarning />
        </span>
      </div>

      <Link
        href={"/jobs/" + slug}
        className="col-span-2 mt-2 text-[18px] font-extrabold leading-snug after:absolute after:inset-0 after:rounded-[10px] hover:text-black sm:col-span-1 sm:col-start-2 sm:mt-0">
        {title}
      </Link>

      <div className="col-span-2 mt-1 flex flex-wrap gap-1.5 text-[12.25px] leading-4 font-bold sm:col-span-1 sm:col-start-2">
        {shown.map((location) => (
          <Pill key={location} className="outline outline-[1px] outline-[#8080805e]">
            {location}
          </Pill>
        ))}
        {rest.length > 0 ? <MoreLocations rest={rest} /> : null}
        <Pill>Full-time</Pill>
        {seniority ? <Pill>{seniority}</Pill> : null}
        {pay ? <Pill className="bg-primary text-secondary">{pay}</Pill> : null}
        {visa ? <Pill className="border-[1.5px] border-primary bg-secondary px-2 py-px">{visa}</Pill> : null}
      </div>
    </div>
  );
};

export default JobTileV2;
