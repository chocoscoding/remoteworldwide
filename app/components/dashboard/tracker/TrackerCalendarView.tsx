"use client";

import { FC, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import LogoMini from "@/app/components/svg/LogoMini";
import StatusMenu from "@/app/components/dashboard/tracker/StatusMenu";
import type { TrackerColumn, TrackerColumnId } from "@/app/lib/dashboard/types";
import { buildTrackerEvents, EVENT_TYPE_META, type TrackerEvent, type TrackerEventType } from "../../../(pages)/(dashboard)/dashboard/tracker/types";

interface TrackerCalendarViewProps {
  columns: TrackerColumn[];
  onMove: (cardId: string, to: TrackerColumnId) => void;
  onOpen: (cardId: string) => void;
}

/**
 * Calendar view — month grid built with date-fns, plain client state only.
 * Highlighted days are derived from `buildTrackerEvents`; clicking one shows
 * its events in the side panel.
 */
export const TrackerCalendarView: FC<TrackerCalendarViewProps> = ({ columns, onMove, onOpen }) => {
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
