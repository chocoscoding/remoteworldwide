"use client";

import { FC } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "./StickerButton";

/**
 * Dashboard pagination — the numbered `‹ 1 2 3 … 9 10 ›` control from the job
 * search page, plus a per-page selector.
 *
 * The windowing rule is lifted from `components/main/PaginationControlNew`
 * (first, last, and the current page ±1, with ellipsis across gaps) so both
 * surfaces skip the same way. The chrome is the dashboard's, not the marketing
 * site's: numbers use the same ink-fill-when-active idiom as the filter pills
 * they sit under, and only the arrows — the controls you press repeatedly —
 * carry the outlined sticker treatment.
 */

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type PageToken = number | "gap-start" | "gap-end";

function pageWindow(current: number, total: number): PageToken[] {
  if (total <= 1) return total === 1 ? [1] : [];

  const pages = new Set<number>([1, total]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: PageToken[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push(i === 1 ? "gap-start" : "gap-end");
    out.push(sorted[i]);
  }
  return out;
}

export interface DashPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  /** Plural noun for the range summary — "answers", "applications". */
  itemNoun?: string;
  className?: string;
}

const DashPagination: FC<DashPaginationProps> = ({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  itemNoun = "items",
  className,
}) => {
  // Below the smallest page size there is nothing to page and nothing worth
  // choosing, so the whole bar stays out of the way.
  if (totalItems <= PAGE_SIZE_OPTIONS[0]) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);
  const tokens = pageWindow(page, totalPages);

  return (
    <div className={cn("mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}>
      <p className="text-xs text-black/55 tabular-nums">
        Showing{" "}
        <span className="font-semibold text-black/70">
          {first}–{last}
        </span>{" "}
        of <span className="font-semibold text-black/70">{totalItems}</span> {itemNoun}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-black/55">Show</span>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f0f0ea] p-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onPageSizeChange(size)}
                aria-pressed={pageSize === size}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold tabular-nums transition-colors",
                  pageSize === size ? "bg-[#222325] text-white" : "text-black/55 hover:text-primary"
                )}>
                {size}
              </button>
            ))}
          </div>
        </div>

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <StickerButton
              variant="outline"
              size="sm"
              className="w-8 px-0"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </StickerButton>

            {tokens.map((token, i) =>
              typeof token === "number" ? (
                <button
                  key={token}
                  type="button"
                  onClick={() => onPageChange(token)}
                  aria-label={`Page ${token}`}
                  aria-current={token === page ? "page" : undefined}
                  className={cn(
                    "h-8 min-w-8 cursor-pointer rounded-lg px-2 text-xs font-bold tabular-nums transition-colors",
                    token === page ? "bg-[#222325] text-white" : "text-black/55 hover:bg-[#f0f0ea] hover:text-primary"
                  )}>
                  {token}
                </button>
              ) : (
                // Decorative and aria-hidden — it carries no information the
                // page numbers either side don't, so it stays quiet on purpose.
                <span key={`${token}-${i}`} aria-hidden="true" className="px-1 text-xs font-bold text-black/45">
                  …
                </span>
              )
            )}

            <StickerButton
              variant="outline"
              size="sm"
              className="w-8 px-0"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </StickerButton>
          </nav>
        )}
      </div>
    </div>
  );
};

export default DashPagination;
