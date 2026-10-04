"use client";

import { useCallback, useId, useMemo, useState, useSyncExternalStore, type FC } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { usePlanLock } from "@/app/components/dashboard/billing/PlanLock";
import { apiMessage } from "@/app/lib/api/core";
import type { ActionItem, PrepSession, PrepTrack } from "@/app/lib/dashboard/prep-data";
import { trackHref } from "@/app/lib/prep/tracks";
import { qk } from "@/app/lib/query/keys";
import { BASIC_GATES } from "@/app/lib/settings/planGates";
import { isOnPlan } from "@/app/lib/tasks/api";
import { TASK_LIMITS, periodOf, type TaskInput } from "@/app/lib/tasks/types";
import { useCreateTasks, useUpdateTask } from "@/hooks/mutations/useTaskMutations";
import { useTasks } from "@/hooks/queries/useTasksQuery";
import TimestampChip from "../delivery/TimestampChip";

/**
 * "Fix before your next round": the report's top three actions, ticked off
 * here and put on the plan with one button.
 *
 * Nothing goes on the plan by itself: the owner chose an explicit "Add all
 * to my plan" over adding on open. The ticks are the report's own, kept per
 * session in this browser; the plan is where an action persists, and the
 * track lists the plan tasks tied to it.
 */
export interface FixChecklistProps {
  session: PrepSession;
  track: PrepTrack;
}

/** How many actions the card lists. */
const SHOWN = 3;

/** Where a prep task on the plan leads back to when its track is gone. */
const PREP_TASK_HREF = "/dashboard/prep";

export interface PlannedAction {
  item: ActionItem;
  task: TaskInput;
}

/**
 * Each action item as a plan task, weakest dimension first.
 *
 * The service's report keeps one item per dimension in ascending score order,
 * so the same sort of `session.dimensions` pairs them by position; the
 * contract does not say which dimension each came from, so the pairing is a
 * stand-in. It still holds as a key: the stored report keeps its order, so
 * each item gets the same key every time it is shown. An item past the end of
 * that list keys on its own id instead.
 *
 * Keys on the session's service id (`prep:{serverId}:{dimension}`), stable
 * across reloads and devices, so the same report can never put the same action
 * on the plan twice, and the keys match every task an earlier version of the
 * report added.
 *
 * When the session's saved track is still there, each task carries its id
 * (`metadata.trackId`) and links back to it: that is what makes the task one
 * of the track's actions, on its checklist as well as on the plan.
 */
export function planActions(session: PrepSession, track: PrepTrack): PlannedAction[] {
  const weakestFirst = [...session.dimensions].sort((a, b) => a.score - b.score);
  const ref = session.serverId ?? session.id;
  const trackId = track.saved ? track.id : null;
  return session.actionItems.map((item, index) => {
    const dimension = weakestFirst[index]?.id ?? null;
    return {
      item,
      task: {
        title: item.title.slice(0, TASK_LIMITS.titleMax),
        detail: item.detail.slice(0, TASK_LIMITS.detailMax),
        href: trackId ? trackHref(trackId) : PREP_TASK_HREF,
        dedupeKey: `prep:${ref}:${dimension ?? item.id}`,
        metadata: { dimension, effortMinutes: item.effortMinutes, ...(trackId ? { trackId } : {}) },
      },
    };
  });
}

// ---------------------------------------------------------------------------
// The ticks, per session, in this browser
// ---------------------------------------------------------------------------

const TICKS_PREFIX = "rww.prep-fixes:";

/**
 * This page load's copy of every write. Storage can be missing or refuse
 * (private mode, policy, a full quota); the ticks still hold until the page
 * goes, and a write that did land is read back the same.
 */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab ticking the same session.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(TICKS_PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readRaw(key: string): string {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function parseTicks(raw: string): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const ticks: Record<string, boolean> = {};
    for (const [id, value] of Object.entries(parsed)) if (typeof value === "boolean") ticks[id] = value;
    return ticks;
  } catch {
    return {};
  }
}

/** The ticks for one session: read during render through the store, so the server's first paint (nothing ticked) hydrates cleanly. */
function useStoredTicks(key: string): [Record<string, boolean>, (next: Record<string, boolean>) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => ""
  );
  const ticks = useMemo(() => parseTicks(raw), [raw]);
  const write = useCallback(
    (next: Record<string, boolean>) => {
      const json = JSON.stringify(next);
      memory.set(key, json);
      try {
        window.localStorage.setItem(key, json);
      } catch {
        // Kept in memory for this page load; nothing else to fall back to.
      }
      for (const listener of listeners) listener();
    },
    [key]
  );
  return [ticks, write];
}

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

type Note = { kind: "added"; count: number; refused: string | null } | { kind: "refused"; message: string };

const FixChecklist: FC<FixChecklistProps> = ({ session, track }) => {
  const queryClient = useQueryClient();
  const listId = useId();
  const planRef = session.serverId ?? session.id;
  const planned = useMemo(() => planActions(session, track).slice(0, SHOWN), [session, track]);

  const [ticks, writeTicks] = useStoredTicks(`${TICKS_PREFIX}${planRef}`);
  const isTicked = (item: ActionItem) => ticks[item.id] ?? item.done;
  const toggle = (item: ActionItem) => writeTicks({ ...ticks, [item.id]: !isTicked(item) });
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggleOpen = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Fixed when the card mounts, so every task it adds lands on one month's plan.
  const [period] = useState(() => periodOf(new Date()));
  // The plan is on Basic and up. Below it the button stays and opens the
  // upgrade popup when pressed, as every "Add to plan" does.
  const lock = usePlanLock(BASIC_GATES.dailyPlan);
  const plan = useTasks(period, undefined, { enabled: !lock.locked });
  const { mutateAsync: addTasks, isPending: adding } = useCreateTasks({ toastErrors: false });
  const { mutateAsync: patchTask } = useUpdateTask({ toastErrors: false });
  const [note, setNote] = useState<Note | null>(null);

  // On the plan already, by the same dedupeKeys "Add to plan" has always used:
  // this month's list says so, which also catches a task added on another
  // device, or removed from the plan since.
  const onPlan = planned.filter(({ task }) => plan.data?.some((t) => isOnPlan(t) && t.dedupeKey === task.dedupeKey));
  const allOnPlan = planned.length > 0 && (onPlan.length === planned.length || (note?.kind === "added" && note.count >= planned.length && !plan.data));

  const addAll = () => {
    if (lock.locked) {
      lock.upgrade();
      return;
    }
    if (adding || allOnPlan || planned.length === 0) return;
    setNote(null);
    addTasks({ tasks: planned.map(({ task }) => ({ ...task, period })), source: { kind: "prep", ref: planRef } })
      .then(async (result) => {
        // One taken off the plan earlier comes back dismissed; this button is
        // an explicit ask for all of them, so it is reopened.
        const dismissed = result.existing.filter((task) => task.status === "dismissed");
        const reopened = await Promise.allSettled(dismissed.map((task) => patchTask({ id: task.id, input: { status: "open" } })));
        const landed = result.created.length + result.existing.length - reopened.filter((r) => r.status === "rejected").length;
        const refused = result.rejected[0]?.message ?? null;
        setNote(landed > 0 ? { kind: "added", count: landed, refused } : { kind: "refused", message: refused ?? "Nothing could be added to your plan." });
        // They are the track's actions now as well.
        void queryClient.invalidateQueries({ queryKey: qk.prep.tracks() });
      })
      .catch((error: unknown) => setNote({ kind: "refused", message: apiMessage(error) }));
  };

  if (planned.length === 0) return null;
  const done = planned.filter(({ item }) => isTicked(item)).length;

  return (
    <section aria-labelledby={`${listId}-title`} className="overflow-hidden rounded-[14px] bg-white br-bold br-lime">
      <div className="flex items-baseline justify-between gap-3 bg-[#222325] px-4 py-3 text-white">
        <h2 id={`${listId}-title`} className="text-sm font-extrabold">
          Fix before your next round
        </h2>
        <span className="flex-none text-xs font-bold tabular-nums text-[#e1f073]">
          {done} of {planned.length}
          <span className="sr-only"> done</span>
        </span>
      </div>

      <ul className="divide-y divide-black/[0.14]">
        {planned.map(({ item }) => {
          const ticked = isTicked(item);
          const expanded = open.has(item.id);
          const detailId = `${listId}-${item.id}`;
          return (
            <li key={item.id}>
              <div className="flex min-h-12 items-center gap-2.5 py-1.5 pl-4 pr-3">
                {/* Side by side, not nested: the tick, the chip and the chevron are all buttons. */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={ticked}
                  onClick={() => toggle(item)}
                  className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2">
                  <NeoCheckbox checked={ticked} size="sm" />
                  <span className={cn("min-w-0 text-[13px] font-bold leading-snug", ticked ? "text-black/40 line-through" : "text-[#222325]")}>{item.title}</span>
                </button>
                {item.atMs !== undefined && <TimestampChip atMs={item.atMs} endMs={item.endMs} />}
                <button
                  type="button"
                  onClick={() => toggleOpen(item.id)}
                  aria-expanded={expanded}
                  aria-controls={detailId}
                  aria-label={`${expanded ? "Hide" : "Show"} details: ${item.title}`}
                  className="inline-flex h-[26px] w-[26px] flex-none cursor-pointer items-center justify-center rounded-md text-[#5f6062] hover:bg-black/5 hover:text-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
                  <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
                </button>
              </div>
              <div id={detailId} hidden={!expanded} className="pb-3 pl-[42px] pr-4 text-xs leading-relaxed text-black/60">
                {item.detail}
                {item.effortMinutes > 0 && <span className="whitespace-nowrap font-semibold text-black/45"> · about {item.effortMinutes} min</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t-[1.5px] border-[#222325] bg-[#fbfbf7] px-4 py-3">
        <button
          type="button"
          onClick={addAll}
          aria-disabled={adding || allOnPlan || undefined}
          aria-busy={adding || undefined}
          className={cn(
            "inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-[#222325] bg-[#e1f073] text-[13px] font-extrabold text-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325] focus-visible:ring-offset-2",
            allOnPlan ? "cursor-default bg-white" : "br-shadow-press",
            adding && "opacity-70"
          )}>
          {adding ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : allOnPlan ? <Check aria-hidden className="h-3.5 w-3.5 stroke-[3]" /> : null}
          {adding ? "Adding…" : allOnPlan ? (planned.length === 1 ? "On your plan" : `All ${planned.length} on your plan`) : `Add ${planned.length === 1 ? "it" : `all ${planned.length}`} to my plan`}
        </button>
        {/* Mounted before it has anything to say, so the answer is announced. */}
        <p role="status" className={cn("text-xs leading-snug", note && "mt-2")}>
          {note?.kind === "added" && (
            <>
              <span className="font-semibold text-[#222325]">
                {note.count === 1 ? "Added to your plan." : `Added ${note.count} to your plan.`}
              </span>
              {note.refused && <span className="text-red-700"> {note.refused}</span>}
            </>
          )}
          {note?.kind === "refused" && <span className="text-red-700">{note.message}</span>}
        </p>
      </div>
    </section>
  );
};

export default FixChecklist;
