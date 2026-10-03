"use client";

// The foot of a creator's "pick up where you left off" (owner, 2026-10-03):
// the front door shows the latest few, and every one lives in My documents —
// this opens it on the matching tab (`/dashboard/vault?tab=…`), where they can
// be searched, renamed, archived or removed.

import type { FC } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LibraryTab } from "@/app/lib/documents/library";

/** How many a creator's front door lists before "See all". */
export const FRONT_DOOR_RECENT = 6;

const SeeAllInDocuments: FC<{ tab: Extract<LibraryTab, "resumes" | "cover-letters">; label: string }> = ({ tab, label }) => (
  <Link
    href={`/dashboard/vault?tab=${tab}`}
    className="group mt-2.5 inline-flex items-center gap-1.5 px-1 text-xs font-bold text-primary underline decoration-black/25 decoration-2 underline-offset-4 transition-colors hover:decoration-[#222325]">
    {label}
    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
  </Link>
);

export default SeeAllInDocuments;
