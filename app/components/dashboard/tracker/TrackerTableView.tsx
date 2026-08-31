"use client";

import { FC, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import StatusMenu from "@/app/components/dashboard/tracker/StatusMenu";
import { STATUS_ORDER } from "@/app/components/dashboard/tracker/tracker-meta";
import type { TrackerColumn, TrackerColumnId } from "@/app/lib/dashboard/types";
import { daysAgoLabel, chipMeta, type TableSort, type TableSortKey } from "../../../(pages)/(dashboard)/dashboard/tracker/types";

interface StatusChipBadgeProps {
  chip: string;
}

/**
 * Small badge reusing the board's chip icon/variant mapping — shown in the
 * table's Detail column so status-chip context (closes-in, referral, etc.)
 * still reads at a glance.
 */
const StatusChipBadge: FC<StatusChipBadgeProps> = ({ chip }) => {
  const meta = chipMeta(chip);
  const Icon = meta.icon;
  const [label] = chip.split(" · ");
  return (
    <Pill variant={meta.variant} className="max-w-full min-w-0 gap-1">
      <Icon className="h-3 w-3 flex-none" />
      <span className="truncate min-w-0">{label}</span>
    </Pill>
  );
};

interface SortableHeaderProps {
  label: string;
  sortKey: TableSortKey;
  sort: TableSort | null;
  onSort: (key: TableSortKey) => void;
  className?: string;
}

const SortableHeader: FC<SortableHeaderProps> = ({ label, sortKey, sort, onSort, className }) => {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort!.direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className={cn("px-4 py-3 text-left", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer",
          active ? "text-primary" : "text-black/40 hover:text-primary",
        )}>
        {label}
        <Icon className={cn("h-3 w-3 flex-none", active ? "text-primary" : "text-black/30")} />
      </button>
    </th>
  );
};

interface TrackerTableViewProps {
  columns: TrackerColumn[];
  onMove: (cardId: string, to: TrackerColumnId) => void;
  onOpen: (cardId: string) => void;
}

/**
 * Table view — every application flattened into one sortable table.
 * Reads straight off the live `columns` state so it always matches whatever
 * the board currently shows (including cards dragged between columns).
 */
export const TrackerTableView: FC<TrackerTableViewProps> = ({ columns, onMove, onOpen }) => {
  const [sort, setSort] = useState<TableSort | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);

  const rows = useMemo(() => {
    const flat = columns.flatMap((col) => col.cards.map((card) => ({ card, columnId: col.id })));
    if (!sort) return flat;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...flat].sort((a, b) => {
      switch (sort.key) {
        case "company":
          return a.card.company.localeCompare(b.card.company) * dir;
        case "role":
          return a.card.title.localeCompare(b.card.title) * dir;
        case "status":
          return (STATUS_ORDER.indexOf(a.columnId) - STATUS_ORDER.indexOf(b.columnId)) * dir;
        case "daysAgo":
          return ((a.card.daysAgo ?? 0) - (b.card.daysAgo ?? 0)) * dir;
        default:
          return 0;
      }
    });
  }, [columns, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: TableSortKey) {
    setSort((prev) =>
      !prev || prev.key !== key ? { key, direction: "asc" } : { key, direction: prev.direction === "asc" ? "desc" : "asc" },
    );
    setPage(1);
  }

  return (
    <>
      <DashCard className="border-2 border-[#222325] p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 bg-[#fbfbf7]">
                <SortableHeader label="Company" sortKey="company" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Role" sortKey="role" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Days ago" sortKey="daysAgo" sort={sort} onSort={toggleSort} />
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-black/40">Detail</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map(({ card, columnId }) => (
                <tr
                  key={card.id}
                  onClick={() => onOpen(card.id)}
                  className="border-b border-black/6 last:border-b-0 hover:bg-[#f6f6f6]/70 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {card.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
                      <span className="text-xs font-semibold text-black/70 truncate">{card.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-primary">{card.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    {/* The pill is the control — StatusMenu stops propagation
                      itself so the row click never fires underneath it. */}
                    <StatusMenu value={columnId} onChange={(to) => onMove(card.id, to)} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-black/55 whitespace-nowrap">{daysAgoLabel(card.daysAgo) ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[240px]">
                    {card.statusChip ? <StatusChipBadge chip={card.statusChip} /> : <span className="text-xs text-black/30">—</span>}
                  </td>
                </tr>
              ))}

              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs font-medium text-black/40">
                    No applications yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DashCard>

      <DashPagination
        page={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={rows.length}
        itemNoun="applications"
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          const firstVisible = (currentPage - 1) * pageSize;
          setPageSize(next);
          setPage(Math.floor(firstVisible / next) + 1);
        }}
      />
    </>
  );
};
