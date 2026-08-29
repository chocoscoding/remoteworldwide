"use client";

import { FC, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Award,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Clock,
  Eye,
  Kanban as KanbanIcon,
  Mic,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Table as TableIcon,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  set,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useSidebarCollapse } from "@/app/components/dashboard/SidebarCollapseContext";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import ProgressBar from "@/app/components/dashboard/ui/ProgressBar";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { PillProps } from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import DashPagination, { PAGE_SIZE_OPTIONS, type PageSize } from "@/app/components/dashboard/ui/DashPagination";
import JobPickerDialog from "@/app/components/dashboard/jobs/JobPickerDialog";
import { PLATFORM_JOBS, createPastedJob, type JobOption } from "@/app/lib/dashboard/job-options";
import { TRACKER_COLUMNS } from "@/app/lib/dashboard/mock-data";
import type { TrackerCard as TrackerCardData, TrackerColumn, TrackerColumnId } from "@/app/lib/dashboard/types";
import JobTimelineDialog from "@/app/components/dashboard/tracker/JobTimelineDialog";
import StatusMenu from "@/app/components/dashboard/tracker/StatusMenu";
import { COLUMN_LABELS, COLUMN_META, STATUS_ORDER } from "@/app/components/dashboard/tracker/tracker-meta";

// ---------------------------------------------------------------------------
// Local screen state types + config — not shared with any other screen.
// ---------------------------------------------------------------------------

type TrackerView = "board" | "table" | "calendar";

const VIEWS: { id: TrackerView; label: string; icon: LucideIcon }[] = [
  { id: "board", label: "Board", icon: KanbanIcon },
  { id: "table", label: "Table", icon: TableIcon },
  { id: "calendar", label: "Calendar", icon: CalendarIcon },
];

function daysAgoLabel(n?: number): string | null {
  if (n === undefined) return null;
  if (n === 0) return "Today";
  return `${n} day${n === 1 ? "" : "s"} ago`;
}

/** Maps a card's free-text status chip to a Pill variant + small leading icon. */
function chipMeta(chip: string): { variant: NonNullable<PillProps["variant"]>; icon: LucideIcon } {
  if (chip.startsWith("Closes in")) return { variant: "urgent", icon: Clock };
  if (chip === "Referral available") return { variant: "positive", icon: Users };
  if (chip === "Follow up") return { variant: "neutral", icon: MessageSquare };
  if (chip.includes("Recruiter opened")) return { variant: "positive", icon: Eye };
  return { variant: "neutral", icon: Clock };
}

// ---------------------------------------------------------------------------
// Calendar event derivation — the mock cards only carry relative "days ago"
// and occasional free-text status chips ("Closes in N days", "Round 2 of 4 ·
// Thu 14:00 GMT+1"), not real dates. These helpers turn that into concrete
// `Date`s (relative to "today") purely for the Calendar view — nothing here
// is persisted or sent anywhere.
// ---------------------------------------------------------------------------

type TrackerEventType = "saved" | "applied" | "interview" | "deadline";

interface TrackerEvent {
  id: string;
  date: Date;
  cardId: string;
  company: string;
  title: string;
  type: TrackerEventType;
  columnId: TrackerColumnId;
  rww?: boolean;
  /** Extra caption text for interview/deadline events, e.g. the full status chip. */
  detail?: string;
}

const EVENT_TYPE_META: Record<TrackerEventType, { label: string; dot: string }> = {
  saved: { label: "Saved", dot: COLUMN_META.saved.dot },
  applied: { label: "Applied", dot: COLUMN_META.applied.dot },
  interview: { label: "Interview", dot: COLUMN_META.interviewing.dot },
  deadline: { label: "Deadline", dot: "bg-orange-500" },
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Parses a "... Thu 14:00 GMT+1" style chip into the next occurrence of that
 * weekday (today counts as a match) at that time, relative to `today`. */
function parseInterviewDate(chip: string, today: Date): Date | null {
  const match = chip.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const targetDow = WEEKDAY_INDEX[match[1]];
  const diff = (targetDow - today.getDay() + 7) % 7;
  const day = addDays(today, diff);
  return set(day, { hours: Number(match[2]), minutes: Number(match[3]), seconds: 0, milliseconds: 0 });
}

/** Parses a "Closes in N days" chip into a deadline date, relative to `today`. */
function parseDeadlineDate(chip: string, today: Date): Date | null {
  const match = chip.match(/^Closes in (\d+) day/);
  return match ? addDays(today, Number(match[1])) : null;
}

/** Flattens every card across every column into calendar events: one
 * saved/applied "activity" event from `daysAgo`, plus a deadline and/or
 * interview event when the status chip carries that info. */
function buildTrackerEvents(cols: TrackerColumn[], today: Date): TrackerEvent[] {
  const events: TrackerEvent[] = [];
  for (const col of cols) {
    for (const card of col.cards) {
      if (card.daysAgo !== undefined) {
        events.push({
          id: `${card.id}-activity`,
          date: subDays(today, card.daysAgo),
          cardId: card.id,
          company: card.company,
          title: card.title,
          type: col.id === "saved" ? "saved" : "applied",
          columnId: col.id,
          rww: card.rww,
        });
      }
      if (card.statusChip) {
        const deadlineDate = parseDeadlineDate(card.statusChip, today);
        if (deadlineDate) {
          events.push({
            id: `${card.id}-deadline`,
            date: deadlineDate,
            cardId: card.id,
            company: card.company,
            title: card.title,
            type: "deadline",
            columnId: col.id,
            rww: card.rww,
            detail: card.statusChip,
          });
        }

        const interviewDate = parseInterviewDate(card.statusChip, today);
        if (interviewDate) {
          events.push({
            id: `${card.id}-interview`,
            date: interviewDate,
            cardId: card.id,
            company: card.company,
            title: card.title,
            type: "interview",
            columnId: col.id,
            rww: card.rww,
            detail: card.statusChip,
          });
        }
      }
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// One Kanban card
// ---------------------------------------------------------------------------

const TrackerCardItem: FC<{ card: TrackerCardData; columnId?: TrackerColumnId; onOptions?: () => void }> = ({
  card,
  columnId,
  onOptions,
}) => {
  const daysLabel = daysAgoLabel(card.daysAgo);

  /**
   * The explicit way into a card's details. It sits inside the drag listeners,
   * so pointerdown must be stopped or dnd-kit claims the gesture and the menu
   * never opens. Omitted on the DragOverlay clone, which takes no input.
   */
  const optionsButton = onOptions ? (
    <button
      type="button"
      aria-label={`Options for ${card.title} at ${card.company}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOptions();
      }}
      className="grid h-6 w-6 flex-none cursor-pointer place-content-center rounded-md text-black/35 transition-colors hover:bg-black/[0.06] hover:text-primary">
      <MoreHorizontal className="h-4 w-4" />
    </button>
  ) : null;

  if (card.highlighted) {
    const [roundLabel, timeLabel] = (card.statusChip ?? "").split(" · ");
    return (
      <div className="rounded-sm border-[1.5px] border-primary bg-white p-3.5 shadow-[4px_4px_0_0_#e1f073]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {card.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
            <span className="text-xs font-semibold text-black/60 truncate">{card.company}</span>
          </div>
          <div className="flex flex-none items-center gap-0.5">
            {daysLabel && <span className="text-[11px] font-medium text-black/35 whitespace-nowrap">{daysLabel}</span>}
            {optionsButton}
          </div>
        </div>

        <p className="text-sm font-bold text-primary leading-snug mb-2.5">{card.title}</p>

        {roundLabel && (
          <Pill variant="dark" className="max-w-full min-w-0 mb-2">
            <span className="truncate min-w-0">{roundLabel}</span>
          </Pill>
        )}

        {timeLabel && (
          <div className="flex items-center gap-1.5 text-xs text-black/55 mb-3 min-w-0">
            <Clock className="h-3.5 w-3.5 flex-none" />
            <span className="truncate min-w-0">{timeLabel}</span>
          </div>
        )}

        {/* Routes to prep, never into the timeline dialog behind it. */}
        <Link href="/dashboard/prep" className="block" onClick={(e) => e.stopPropagation()}>
          <StickerButton variant="primary" size="sm" className="w-full">
            <Mic className="h-3.5 w-3.5" />
            Prep for this
          </StickerButton>
        </Link>
      </div>
    );
  }

  const chip = card.statusChip ? chipMeta(card.statusChip) : null;
  const ChipIcon = chip?.icon;
  const showEngagementBar = card.statusChip?.includes("Recruiter opened") ?? false;
  // Long chips (e.g. "Recruiter opened your resume · 2h ago") are split into a
  // primary label rendered inside the pill (truncated as a safety net so it
  // can never spill past the card edge) and a trailing timestamp rendered
  // underneath as its own small caption, matching the highlighted-card treatment.
  const [chipLabel, chipTime] = (card.statusChip ?? "").split(" · ");

  return (
    // Border carries the column's color, so a card says its stage at a glance.
    <div
      className={cn(
        "rounded-sm border bg-white p-3.5 transition-all hover:outline hover:outline-[#222325] hover:outline-2 ",
        columnId ? COLUMN_META[columnId].cardBorder : "border-black/25",
      )}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {card.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
          <span className="text-xs font-semibold text-black/60 truncate">{card.company}</span>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          {daysLabel && <span className="text-[11px] font-medium text-black/35 whitespace-nowrap">{daysLabel}</span>}
          {optionsButton}
        </div>
      </div>

      <p className="text-sm font-semibold text-primary leading-snug">{card.title}</p>

      {card.statusChip && chip && ChipIcon && (
        <div className="mt-2.5">
          <Pill variant={chip.variant} className="max-w-full min-w-0 gap-1">
            <ChipIcon className="h-3 w-3 flex-none" />
            <span className="truncate min-w-0">{chipLabel}</span>
          </Pill>
          {chipTime && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-black/40 min-w-0">
              <Clock className="h-3 w-3 flex-none" />
              <span className="truncate min-w-0">{chipTime}</span>
            </div>
          )}
          {showEngagementBar && <ProgressBar value={65} height="h-1" className="mt-2" />}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Drag-and-drop wiring (dnd-kit) — mock-only, moves cards between the local
// `columns` state arrays. No persistence, no backend calls.
// ---------------------------------------------------------------------------

/** Draggable/sortable wrapper around a card — adds the grab affordance and
 * the dnd-kit transform/transition needed to animate it while dragging.
 * `transform`/`transition` are the one place this file uses an inline
 * `style` — dnd-kit computes a per-pixel drag offset at runtime, which has
 * no static Tailwind-class equivalent. Every other style here is a Tailwind
 * utility class. */
const SortableTrackerCard: FC<{ card: TrackerCardData; columnId: TrackerColumnId; onOpen: (cardId: string) => void }> = ({
  card,
  columnId,
  onOpen,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      className={cn("touch-none cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}>
      <TrackerCardItem card={card} columnId={columnId} onOptions={() => onOpen(card.id)} />
    </div>
  );
};

/** One Kanban column — a dnd-kit droppable region wrapping a `SortableContext`
 * of its cards. The column grows with its cards and the page scrolls — no
 * per-column scroll track. */
const KanbanColumn: FC<{ column: TrackerColumn; onOpen: (cardId: string) => void }> = ({ column, onOpen }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const extra = column.count - column.cards.length;

  return (
    <div className="min-w-[240px] flex-1 flex flex-col min-h-0 px-0.5">
      <div className="flex flex-none items-center gap-2 mb-3 px-0.5">
        <span className={cn("h-2 w-2 rounded-full flex-none", COLUMN_META[column.id].dot)} aria-hidden />
        <span className="text-sm font-bold text-primary whitespace-nowrap">{column.label}</span>
        <span className="text-xs font-semibold text-black/40 ml-auto flex-none">{column.count}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn("flex flex-1 min-h-0 flex-col rounded-sm transition-colors", isOver && "border-[#222325] bg-[#e5e5d8]")}>
        {/* The cards scroll, the column doesn't grow. No visible track here —
            one horizontal bar on the board is enough chrome. */}
        <div className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
          <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {column.cards.map((card) => (
              <SortableTrackerCard key={card.id} card={card} columnId={column.id} onOpen={onOpen} />
            ))}
          </SortableContext>

          {column.cards.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center gap-2 rounded-xl border border-dashed border-black/15 py-8 px-3">
              <Award className="h-5 w-5 text-black/25" />
              <p className="text-[11px] font-medium text-black/40 leading-relaxed">
                {column.id === "offer" ? "No offers yet — this is where they'll land." : "Nothing here yet."}
              </p>
            </div>
          )}
        </div>

        {extra > 0 && (
          <>
            <div
              className="pointer-events-none -mt-6 h-6 flex-none bg-gradient-to-t from-[#f0f0ea]/90 via-[#f0f0ea]/60 to-transparent"
              aria-hidden
            />
            <p className="text-center text-[11px] font-medium text-black/40 pt-0.5">+{extra} more</p>
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Table view — every application flattened into one sortable table. Reads
// straight off the live `columns` state so it always matches whatever the
// board currently shows (including cards dragged between columns).
// ---------------------------------------------------------------------------

type TableSortKey = "company" | "role" | "status" | "daysAgo";
type SortDirection = "asc" | "desc";
interface TableSort {
  key: TableSortKey;
  direction: SortDirection;
}

/** Small badge reusing the board's chip icon/variant mapping — shown in the
 * table's Detail column so status-chip context (closes-in, referral, etc.)
 * still reads at a glance. */
const StatusChipBadge: FC<{ chip: string }> = ({ chip }) => {
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

const SortableHeader: FC<{
  label: string;
  sortKey: TableSortKey;
  sort: TableSort | null;
  onSort: (key: TableSortKey) => void;
  className?: string;
}> = ({ label, sortKey, sort, onSort, className }) => {
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

const TrackerTableView: FC<{
  columns: TrackerColumn[];
  onMove: (cardId: string, to: TrackerColumnId) => void;
  onOpen: (cardId: string) => void;
}> = ({ columns, onMove, onOpen }) => {
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

// ---------------------------------------------------------------------------
// Calendar view — month grid built with date-fns, plain client state only.
// Highlighted days are derived from `buildTrackerEvents`; clicking one shows
// its events in the side panel.
// ---------------------------------------------------------------------------

const TrackerCalendarView: FC<{
  columns: TrackerColumn[];
  onMove: (cardId: string, to: TrackerColumnId) => void;
  onOpen: (cardId: string) => void;
}> = ({ columns, onMove, onOpen }) => {
  const today = useMemo(() => new Date(), []);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const trackerEvents = useMemo(() => buildTrackerEvents(columns, today), [columns, today]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, TrackerEvent[]>();
    for (const ev of trackerEvents) {
      const key = format(ev.date, "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    return map;
  }, [trackerEvents]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [calendarMonth]);

  const selectedDayEvents = selectedDate ? (eventsByDate.get(format(selectedDate, "yyyy-MM-dd")) ?? []) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
      <DashCard className="border-2 border-[#222325] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-black/50 hover:bg-[#f0f0ea] hover:text-primary transition-colors cursor-pointer"
              aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-bold text-primary w-36 text-center whitespace-nowrap">{format(calendarMonth, "MMMM yyyy")}</h2>
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-black/50 hover:bg-[#f0f0ea] hover:text-primary transition-colors cursor-pointer"
              aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <StickerButton
            variant="outline"
            size="sm"
            onClick={() => {
              setCalendarMonth(startOfMonth(today));
              setSelectedDate(today);
            }}>
            Today
          </StickerButton>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-black/40 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, calendarMonth);
            const todayFlag = isToday(day);
            const selected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <button
                key={key}
                type="button"
                disabled={dayEvents.length === 0}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "aspect-square rounded-xl border text-left p-1.5 flex flex-col gap-1 transition-colors",
                  inMonth ? "bg-white" : "bg-[#f6f6f6]",
                  dayEvents.length > 0 ? "border-black/15 cursor-pointer hover:border-primary/50" : "border-black/5 cursor-default",
                  selected && "ring-2 ring-primary border-primary",
                  todayFlag && !selected && "border-[1.5px] border-primary",
                )}>
                <span className={cn("text-xs font-semibold", inMonth ? "text-primary" : "text-black/30")}>{format(day, "d")}</span>
                {dayEvents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-0.5 mt-auto">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span key={ev.id} className={cn("h-1.5 w-1.5 rounded-full flex-none", EVENT_TYPE_META[ev.type].dot)} aria-hidden />
                    ))}
                    {dayEvents.length > 3 && <span className="text-[9px] font-semibold text-black/40">+{dayEvents.length - 3}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-black/8">
          {(Object.entries(EVENT_TYPE_META) as [TrackerEventType, (typeof EVENT_TYPE_META)[TrackerEventType]][]).map(([type, meta]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full flex-none", meta.dot)} aria-hidden />
              <span className="text-[11px] font-medium text-black/50">{meta.label}</span>
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard className="border-2 border-[#222325] p-5 lg:sticky lg:top-24">
        <h3 className="text-sm font-bold text-primary mb-3">{selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a day"}</h3>

        {selectedDayEvents.length === 0 ? (
          <p className="text-xs text-black/45 leading-relaxed">
            {selectedDate ? "Nothing on this day." : "Click a highlighted day on the calendar to see what's happening."}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {selectedDayEvents.map((ev) => (
              // A door into the job, not a read-only note: the row opens the
              // timeline, the pill changes the status right here.
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(ev.cardId)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(ev.cardId)}
                className="cursor-pointer rounded-xl border border-black/10 p-3 transition-colors hover:border-[#222325]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {ev.rww && <LogoMini className="h-3.5 w-3.5 flex-none" />}
                    <span className="text-xs font-semibold text-black/60 truncate">{ev.company}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-primary leading-snug mb-1.5">{ev.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusMenu value={ev.columnId} onChange={(to) => onMove(ev.cardId, to)} />
                  <span className="min-w-0 truncate text-[11px] font-medium text-black/55">
                    {EVENT_TYPE_META[ev.type].label}
                    {ev.detail ? ` · ${ev.detail}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashCard>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const TrackerClient: FC = () => {
  const { collapsed: sidebarCollapsed } = useSidebarCollapse();
  const [view, setView] = useState<TrackerView>("board");
  const [columns, setColumns] = useState<TrackerColumn[]>(() => TRACKER_COLUMNS.map((col) => ({ ...col, cards: [...col.cards] })));
  const [activeCard, setActiveCard] = useState<TrackerCardData | null>(null);

  // Applications logged anywhere in the app land here. Columns stay in local
  // state so drag-and-drop keeps working, and newly logged applications are
  // folded in during render using React's "adjust state when input changes"
  // pattern — an effect would paint the stale board first, then correct it.
  const { applications, recordAction } = useActivity();
  const [mergedIds, setMergedIds] = useState<string[]>([]);
  const pending = applications.filter((a) => !mergedIds.includes(a.id));
  if (pending.length > 0) {
    setMergedIds(applications.map((a) => a.id));
    setColumns((prev) =>
      prev.map((col) =>
        col.id === "applied"
          ? {
              ...col,
              // `count` is the real total and is independent of `cards.length`,
              // which is only a representative sample — so both have to move.
              count: col.count + pending.length,
              cards: [
                ...pending.map((a) => ({
                  id: a.id,
                  title: a.role,
                  company: a.company,
                  daysAgo: 0,
                  statusChip: "Follow up",
                  rww: a.source === "internal",
                })),
                ...col.cards,
              ],
            }
          : col,
      ),
    );
  }

  // Timeline dialog target — an id, resolved against live columns each render
  // so a status change made inside the dialog is reflected immediately.
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [jobs, setJobs] = useState<JobOption[]>(PLATFORM_JOBS);
  const addSeq = useRef(0);
  // A completed drag fires a click on the source card as the pointer lifts —
  // this latch swallows exactly that one click so a drop never opens the
  // timeline dialog. Plain clicks (< the 6px activation distance) never start
  // a drag, so the latch stays untouched for them.
  const dragHappened = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findColumnIdForCard(cardId: string, cols: TrackerColumn[]): TrackerColumnId | null {
    return cols.find((c) => c.cards.some((card) => card.id === cardId))?.id ?? null;
  }

  const openEntry = (() => {
    if (!openCardId) return null;
    for (const col of columns) {
      const card = col.cards.find((c) => c.id === openCardId);
      if (card) return { card, columnId: col.id };
    }
    return null;
  })();

  function openTimeline(cardId: string) {
    if (dragHappened.current) {
      dragHappened.current = false;
      return;
    }
    setOpenCardId(cardId);
  }

  /** The one mover — drag-drop, the status pills and the timeline dialog all
   *  land here, so every view agrees. Both `count` and `cards` shift, per the
   *  count-is-the-real-total contract. */
  function moveCard(cardId: string, to: TrackerColumnId) {
    const from = findColumnIdForCard(cardId, columns);
    if (!from || from === to) return;
    const card = columns.find((c) => c.id === from)!.cards.find((c) => c.id === cardId);
    if (!card) return;

    setColumns((prev) =>
      prev.map((c) => {
        if (c.id === from) return { ...c, cards: c.cards.filter((x) => x.id !== cardId), count: Math.max(0, c.count - 1) };
        if (c.id === to) return { ...c, cards: [card, ...c.cards], count: c.count + 1 };
        return c;
      }),
    );
    // Keeping the board honest is a qualifying action — the "status-change"
    // kind existed for exactly this and had no caller until now.
    recordAction("status-change", cardId, `${card.company} → ${COLUMN_LABELS[to]}`);
  }

  /** "Add job" — dedupe against the board; new jobs land in Saved. */
  function addJob(job: JobOption) {
    setAddOpen(false);
    const existing = columns
      .flatMap((c) => c.cards)
      .find(
        (c) =>
          c.company.trim().toLowerCase() === job.company.trim().toLowerCase() &&
          c.title.trim().toLowerCase() === job.role.trim().toLowerCase(),
      );
    if (existing) {
      toast("Already on your board", { description: `${job.company} — ${job.role}` });
      setOpenCardId(existing.id);
      return;
    }

    const card: TrackerCardData = {
      id: `trk-added-${++addSeq.current}`,
      title: job.role,
      company: job.company,
      daysAgo: 0,
      rww: job.source === "platform",
    };
    setColumns((prev) => prev.map((c) => (c.id === "saved" ? { ...c, cards: [card, ...c.cards], count: c.count + 1 } : c)));
    toast.success("Added to Saved", { description: `${job.company} — ${job.role}` });
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    dragHappened.current = true;
    setActiveCard(columns.flatMap((c) => c.cards).find((c) => c.id === id) ?? null);
  }

  /**
   * Both same-column reordering and cross-column moves are committed here, on
   * drop, and deliberately NOT in an `onDragOver` handler.
   *
   * Moving a card between columns while the drag is still live is the obvious
   * implementation, and it is a genuine infinite-loop hazard: the move mutates
   * the layout (columns grow and shrink, a column's empty-state placeholder
   * appears or disappears), dnd-kit re-measures its droppable rects against
   * the new geometry, and `over` can resolve back to the column the card just
   * left. That fires the move again in the opposite direction — and because
   * source and target have genuinely swapped by then, neither the
   * `activeId === overId` nor the `sourceColId === targetColId` guard stops
   * the return trip. The result is an unbounded setState ping-pong that
   * surfaces as React's "Maximum update depth exceeded".
   *
   * Committing on drop removes the feedback loop entirely rather than trying
   * to damp it. Live feedback is unaffected: `DragOverlay` still renders the
   * floating card and each column's `isOver` still highlights the drop target,
   * so the only behavioural change is that the card lands on release instead
   * of pre-flighting into the column under the cursor.
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Record the status change outside the updater (state updaters must stay
    // pure). Computed against the pre-drop state, which the drop hasn't
    // changed yet — commits happen only here, on drop.
    const preSource = findColumnIdForCard(activeId, columns);
    const preTarget = columns.some((c) => c.id === overId) ? (overId as TrackerColumnId) : findColumnIdForCard(overId, columns);
    if (preSource && preTarget && preSource !== preTarget) {
      const moved = columns.find((c) => c.id === preSource)?.cards.find((c) => c.id === activeId);
      if (moved) recordAction("status-change", activeId, `${moved.company} → ${COLUMN_LABELS[preTarget]}`);
    }

    setColumns((prev) => {
      const sourceColId = findColumnIdForCard(activeId, prev);
      if (!sourceColId) return prev;

      // `overId` is either a column's own droppable id (dropped on empty
      // space) or another card's id (dropped onto a specific position).
      const isOverColumn = prev.some((c) => c.id === overId);
      const targetColId = isOverColumn ? (overId as TrackerColumnId) : findColumnIdForCard(overId, prev);
      if (!targetColId) return prev;

      // Same column — pure reorder.
      if (sourceColId === targetColId) {
        const col = prev.find((c) => c.id === sourceColId)!;
        const oldIndex = col.cards.findIndex((c) => c.id === activeId);
        const newIndex = isOverColumn ? col.cards.length - 1 : col.cards.findIndex((c) => c.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        return prev.map((c) => (c.id === sourceColId ? { ...c, cards: arrayMove(c.cards, oldIndex, newIndex) } : c));
      }

      // Different column — move the card and shift both counts.
      const sourceCol = prev.find((c) => c.id === sourceColId)!;
      const movedCard = sourceCol.cards.find((c) => c.id === activeId);
      if (!movedCard) return prev;

      return prev.map((c) => {
        if (c.id === sourceColId) {
          return { ...c, cards: c.cards.filter((card) => card.id !== activeId), count: Math.max(0, c.count - 1) };
        }
        if (c.id === targetColId) {
          const overIndex = isOverColumn ? c.cards.length : c.cards.findIndex((card) => card.id === overId);
          const insertAt = overIndex === -1 ? c.cards.length : overIndex;
          const newCards = [...c.cards];
          newCards.splice(insertAt, 0, movedCard);
          return { ...c, cards: newCards, count: c.count + 1 };
        }
        return c;
      });
    });
  }

  return (
    // The board is a fixed-height surface: the columns scroll, the page
    // doesn't. Table and Calendar keep normal page flow.
    <div className={cn("bg-[#f6f6f6]", view === "board" ? "h-screen flex flex-col overflow-hidden" : "min-h-screen")}>
      {/* Header */}
      <header className="sticky top-0 z-10 h-16 flex-none flex items-center justify-between gap-4 px-8 bg-white/85 backdrop-blur-sm border-b border-black/10">
        <h1 className="text-[17px] font-bold text-primary whitespace-nowrap">Application tracker</h1>

        <div className="flex items-center gap-3 flex-none">
          <div className="inline-flex items-center gap-1 rounded-lg border border-black/15 bg-[#f0f0ea] p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded font-semibold whitespace-nowrap transition-all cursor-pointer px-3.5 py-1.5 text-xs",
                  view === v.id
                    ? "bg-[#222325] text-white shadow-[2px_2px_0_0_#e1f073]"
                    : "text-black/55 hover:bg-black/[0.04] hover:text-primary",
                )}>
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>

          {/* sm to sit level with the view switcher; opens the shared
              structured Add-job dialog, not the one-field log flow. */}
          <StickerButton variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add job
          </StickerButton>
        </div>
      </header>

      <main
        className={cn(
          "px-8 py-7 mx-auto w-full transition-[max-width] duration-200",
          sidebarCollapsed ? "max-w-[1520px]" : "max-w-[1320px]",
          view === "board" ? "flex flex-1 min-h-0 flex-col pb-6" : "pb-14",
        )}>
        {view === "board" ? (
          <>
            {/* RWW-badge note */}
            <div className="mb-5 flex flex-none items-center gap-2.5 rounded-sm border border-black/20 bg-[#fbfbf7] px-4 py-3">
              <LogoMini className="h-4 w-4 flex-none" />
              <p className="text-xs font-medium text-black/60">
                <span className="font-bold text-primary">Applied through Remote Worldwide</span> — status updates itself.
              </p>
            </div>

            {/* Kanban board — columns are `flex-1 min-w-[200px]` (see
                `KanbanColumn`), not fixed-width, so they share whatever width
                is actually available and only fall back to the outer
                `overflow-x-auto` scroll when the viewport is genuinely too
                narrow for that 200px floor, instead of scrolling at every
                ordinary desktop width the way 5 rigid 240px columns used to.
                Deliberately flexbox, not a CSS Grid `minmax(200px,1fr)` track
                set — that combination produced a real "Maximum update depth
                exceeded" loop, almost certainly dnd-kit's own ResizeObserver-
                based rect measurement fighting with grid's subpixel track
                resolution on every layout pass. Flexbox's `flex-basis`/
                `flex-grow` sizing gives the same "share available space, floor
                at 200px" result without that failure mode. */}
            <DndContext
              id="tracker-board"
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              // Escape mid-drag never reaches onDragEnd — without this the
              // overlay card sticks around after a cancelled drag.
              onDragCancel={() => setActiveCard(null)}>
              {/* items-stretch so every column is the full height of the
                  row and its own card list is what scrolls. The horizontal
                  bar is the system's slim black one. */}
              <div className="flex flex-1 min-h-0 gap-6 items-stretch overflow-x-auto overflow-y-hidden pb-2 scrollbar-neo">
                {columns.map((col) => (
                  <KanbanColumn key={col.id} column={col} onOpen={openTimeline} />
                ))}
              </div>

              <DragOverlay>
                {activeCard ? (
                  <div className="w-[240px] rotate-2 cursor-grabbing">
                    <TrackerCardItem card={activeCard} columnId={findColumnIdForCard(activeCard.id, columns) ?? undefined} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        ) : view === "table" ? (
          <TrackerTableView columns={columns} onMove={moveCard} onOpen={openTimeline} />
        ) : (
          <TrackerCalendarView columns={columns} onMove={moveCard} onOpen={openTimeline} />
        )}
      </main>

      <JobTimelineDialog
        card={openEntry?.card ?? null}
        columnId={openEntry?.columnId ?? null}
        onOpenChange={(v) => !v && setOpenCardId(null)}
        onMove={moveCard}
      />
      <JobPickerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        jobs={jobs}
        onPick={addJob}
        onCreate={(input) => {
          const created = createPastedJob(input);
          setJobs((prev) => [created, ...prev]);
          addJob(created);
        }}
      />
    </div>
  );
};

export default TrackerClient;
