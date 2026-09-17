"use client";

// The user's plan for one period as a checklist: in the coach's dark rail, or
// as a card on Home.
//
// Both looks share one behaviour. Ticking is optimistic, and rows never move
// when ticked (see `comparePlanRows`). A task a service added carries a "New"
// marker and is marked seen once it has been on screen. Removing offers an
// Undo, because the control sits one hover away from the row and a task the
// user wrote is deleted outright.
//
// The data is `useTasks(period)`, the unfiltered list, so the header can count
// done against everything on the plan; every write goes through
// hooks/mutations/useTaskMutations.ts.

import { FC, KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Plus, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import NeoCheckbox from "@/app/components/dashboard/ui/NeoCheckbox";
import { stickerButtonVariants } from "@/app/components/dashboard/ui/StickerButton";
import { apiMessage } from "@/app/lib/api/core";
import { comparePlanRows, isOnPlan, planProgress, taskHref } from "@/app/lib/tasks/api";
import { TASK_LIMITS, type TaskItem } from "@/app/lib/tasks/types";
import { useTasks } from "@/hooks/queries/useTasksQuery";
import { useCreateTasks, useDeleteTask, useMarkTasksSeen, useRestoreTask, useToggleTask } from "@/hooks/mutations/useTaskMutations";

export type PlanPanelVariant = "dark-rail" | "card";

export interface PlanPanelProps {
  /** `YYYY-MM`, usually `periodOf(new Date())`. */
  period: string;
  variant: PlanPanelVariant;
  /** Defaults to "This month's plan". */
  title?: string;
  /**
   * At most this many rows, chosen from open tasks. Without it every task on
   * the plan is listed, done ones included.
   */
  limit?: number;
  /** The inline "Add a task" input. On by default. */
  allowAdd?: boolean;
  className?: string;
}

/** Where the whole plan lives, for the card's overflow and empty-state links. */
const FULL_PLAN_HREF = "/dashboard/coach";

// ---------------------------------------------------------------------------
// Behaviour, shared by both looks
// ---------------------------------------------------------------------------

function usePlanPanel(period: string, limit: number | undefined) {
  const query = useTasks(period);
  const toggle = useToggleTask();
  const restore = useRestoreTask();
  const remove = useDeleteTask({
    onRemoved: (task) =>
      toast("Removed from your plan", {
        description: task.title,
        action: { label: "Undo", onClick: () => restore.mutate(task) },
      }),
  });
  const create = useCreateTasks({ toastErrors: false });
  const markSeen = useMarkTasksSeen();

  // Tasks ticked while this panel is up. With a `limit` the panel shows open
  // tasks, and a row that vanished the moment it was ticked could not be
  // unticked, so a ticked row keeps its place until the panel remounts.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());

  const tasks = query.data;
  const progress = useMemo(() => planProgress(tasks ?? []), [tasks]);
  const { rows, hidden } = useMemo(() => {
    const onPlan = (tasks ?? []).filter(isOnPlan).sort(comparePlanRows);
    if (limit === undefined) return { rows: onPlan, hidden: 0 };
    const candidates = onPlan.filter((task) => task.status === "open" || ticked.has(task.id));
    return { rows: candidates.slice(0, limit), hidden: Math.max(0, candidates.length - limit) };
  }, [tasks, limit, ticked]);

  // Only rows on screen are marked, so a new task hidden past `limit` keeps its
  // marker for when it is actually shown. Keyed on the ids, so an unrelated
  // re-render does not queue the same marks again.
  const unseenKey = rows
    .filter((task) => task.seenAt === null)
    .map((task) => task.id)
    .join(",");
  useEffect(() => {
    if (unseenKey) markSeen(unseenKey.split(","));
  }, [unseenKey, markSeen]);

  const onToggle = (task: TaskItem) => {
    setTicked((current) => (current.has(task.id) ? current : new Set(current).add(task.id)));
    toggle.mutate(task);
  };

  const onRemove = (task: TaskItem) => remove.mutate(task.id);

  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const onDraftChange = (value: string) => {
    setDraft(value);
    setAddError(null);
  };

  const submit = () => {
    const title = draft.trim();
    if (!title || create.isPending) return;
    setAddError(null);
    create.mutate(
      { task: { title, period }, source: { kind: "user", ref: null } },
      {
        onSuccess: (result) => {
          const rejection = result.rejected[0];
          if (rejection) {
            // A full plan, most often. The text stays so nothing typed is lost.
            setAddError(rejection.message);
            return;
          }
          // Clear only what was sent: anything typed while it was sending is the next task.
          setDraft((current) => (current.trim() === title ? "" : current));
        },
        onError: (error) => setAddError(apiMessage(error)),
      },
    );
  };

  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter while an IME is composing picks a candidate; it is not a submit.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return {
    query,
    rows,
    hidden,
    progress,
    onToggle,
    onRemove,
    draft,
    addError,
    adding: create.isPending,
    onDraftChange,
    onDraftKeyDown,
  };
}

type PlanState = ReturnType<typeof usePlanPanel>;

interface ViewProps {
  plan: PlanState;
  title: string;
  headingId: string;
  allowAdd: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// The add input
// ---------------------------------------------------------------------------

const AddTaskInput: FC<{ plan: PlanState; dark: boolean }> = ({ plan, dark }) => {
  const errorId = useId();
  const Icon = plan.adding ? Loader2 : Plus;

  return (
    <div className={dark ? "mt-1 flex-none" : "mt-4"}>
      <label
        className={
          dark
            ? "flex h-7 cursor-text items-center gap-2 rounded-md px-2 text-white/40 transition-colors hover:bg-white/5 focus-within:bg-white/10 focus-within:text-white/70"
            : "flex h-10 cursor-text items-center gap-3 rounded-lg border-[1.5px] border-dashed border-black/15 px-3 text-black/35 transition-colors hover:border-black/30 focus-within:border-solid focus-within:border-[#222325] focus-within:text-primary"
        }>
        {/* Same box as the checkboxes above it, so the input lines up as the next row. */}
        <Icon aria-hidden className={cn("flex-none", dark ? "h-4 w-4" : "h-5 w-5", plan.adding && "animate-spin")} />
        <span className="sr-only">Add a task</span>
        <input
          type="text"
          value={plan.draft}
          onChange={(event) => plan.onDraftChange(event.target.value)}
          onKeyDown={plan.onDraftKeyDown}
          maxLength={TASK_LIMITS.titleMax}
          placeholder="Add a task"
          enterKeyHint="done"
          autoComplete="off"
          aria-invalid={plan.addError ? true : undefined}
          aria-describedby={plan.addError ? errorId : undefined}
          className={
            dark
              ? "h-full min-w-0 flex-1 bg-transparent text-xs font-medium text-white placeholder:text-white/40 focus:outline-none"
              : "h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-primary placeholder:text-black/40 focus:outline-none"
          }
        />
      </label>
      {plan.addError && (
        <p
          id={errorId}
          role="alert"
          className={dark ? "px-2 pt-1 text-[11px] leading-snug text-red-300" : "pt-1.5 text-xs leading-snug text-red-700"}>
          {plan.addError}
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dark rail — the coach screen's "This month's plan" block
// ---------------------------------------------------------------------------

const RAIL_SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3"] as const;

const RailPlan: FC<ViewProps> = ({ plan, title, headingId, allowAdd, className }) => {
  const { query, rows, hidden, progress } = plan;
  const allDone = rows.length === 0 && progress.total > 0;

  return (
    <section aria-labelledby={headingId} className={cn("flex min-h-0 flex-[1_1_37%] flex-col px-3 pb-3.5 pt-3", className)}>
      <div className="mb-1.5 flex flex-none items-center justify-between gap-2 px-2">
        <p id={headingId} className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-white/45">
          {title}
        </p>
        {query.data && (
          <span className="text-[11px] font-medium text-white/40 tabular-nums">
            <span aria-hidden>
              {progress.done}/{progress.total}
            </span>
            <span className="sr-only">
              {progress.done} of {progress.total} done
            </span>
          </span>
        )}
      </div>

      <p role="status" className="sr-only">
        {query.isPending ? "Loading your plan" : ""}
      </p>

      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {query.isPending &&
          RAIL_SKELETON_WIDTHS.map((width) => (
            <li key={width} aria-hidden className="flex h-7 w-full flex-none items-center gap-2 px-2">
              <span className="h-4 w-4 flex-none animate-pulse rounded-[3px] bg-white/10" />
              <span className={cn("h-2.5 animate-pulse rounded bg-white/10", width)} />
            </li>
          ))}

        {query.isError && !query.data && (
          <li role="alert" className="flex h-7 w-full flex-none items-center gap-2 px-2 text-xs text-white/55">
            <span className="min-w-0 flex-1 truncate">Couldn&apos;t load your plan</span>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="inline-flex flex-none cursor-pointer items-center gap-1 rounded font-bold text-[#e1f073] hover:underline disabled:cursor-default disabled:opacity-60">
              {query.isFetching ? <Loader2 aria-hidden className="h-3 w-3 animate-spin" /> : <RotateCw aria-hidden className="h-3 w-3" />}
              Retry
            </button>
          </li>
        )}

        {query.data && rows.length === 0 && (
          <li className="flex-none px-2 py-1.5 text-xs leading-relaxed text-white/45">
            {allDone ? "Everything on your plan is done." : allowAdd ? "Nothing planned yet. Add a task below." : "Nothing planned yet."}
          </li>
        )}

        {rows.map((task) => {
          const done = task.status === "done";
          const href = taskHref(task);
          return (
            <li
              key={task.id}
              // `group/row`, not `group`: NeoCheckbox's press and lift styles
              // answer to any plain `group` above it, which must be the toggle
              // alone, or pressing the remove button would press the box too.
              className="group/row flex h-7 w-full flex-none items-center gap-0.5 rounded-md pr-1 transition-colors hover:bg-white/10 focus-within:bg-white/10">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                onClick={() => plan.onToggle(task)}
                title={task.title}
                // Same fixed height as a session row: a wrapped task would be
                // twice the height of a short one and read as ragged.
                className="group flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md pl-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e1f073]/70">
                <span className="flex-none">
                  <NeoCheckbox checked={done} size="sm" dark />
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-xs", done ? "text-white/35 line-through" : "font-medium text-white/85")}>
                  {task.title}
                </span>
                {task.seenAt === null && (
                  <>
                    <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-[#e1f073]" />
                    <span className="sr-only">(new)</span>
                  </>
                )}
              </button>
              {href && (
                <Link
                  href={href}
                  aria-label={`Open: ${task.title}`}
                  title="Open"
                  className="grid h-5 w-5 flex-none place-content-center rounded text-white/35 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]/70">
                  <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
                </Link>
              )}
              {/* Hidden until the row is hovered or focused, and always shown
                  where nothing can hover. */}
              <button
                type="button"
                onClick={() => plan.onRemove(task)}
                aria-label={`Remove from plan: ${task.title}`}
                title="Remove from plan"
                className="grid h-5 w-5 flex-none cursor-pointer place-content-center rounded text-white/45 opacity-0 transition-[opacity,color,background-color] hover:bg-white/10 hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]/70 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100">
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}

        {hidden > 0 && <li className="flex-none px-2 pt-1 text-[11px] font-medium text-white/40">+{hidden} more</li>}
      </ul>

      {allowAdd && <AddTaskInput plan={plan} dark />}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Card — Home
// ---------------------------------------------------------------------------

const CARD_SKELETON_WIDTHS = ["w-2/3", "w-1/2", "w-3/5"] as const;

const outlineLink = cn(stickerButtonVariants({ variant: "outline", size: "sm" }), "flex-none hover:shadow-[3px_3px_0_0_#e1f073]");

const CardPlan: FC<ViewProps> = ({ plan, title, headingId, allowAdd, className }) => {
  const { query, rows, hidden, progress } = plan;
  const allDone = rows.length === 0 && progress.total > 0;

  return (
    <DashCard role="region" aria-labelledby={headingId} className={cn("p-6", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p id={headingId} className="text-[15px] font-bold text-primary">
          {title}
        </p>
        {query.data && progress.total > 0 && (
          <span className="flex-none text-xs text-black/45 tabular-nums">
            {progress.done} of {progress.total} done
          </span>
        )}
      </div>

      <p role="status" className="sr-only">
        {query.isPending ? "Loading your plan" : ""}
      </p>

      <ul className="flex flex-col divide-y divide-black/8">
        {query.isPending &&
          CARD_SKELETON_WIDTHS.map((width) => (
            <li key={width} aria-hidden className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="h-5 w-5 flex-none animate-pulse rounded-[3px] bg-[#f0f0ea]" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className={cn("h-3 animate-pulse rounded bg-[#f0f0ea]", width)} />
                <span className="h-2.5 w-1/3 animate-pulse rounded bg-[#f0f0ea]" />
              </span>
            </li>
          ))}

        {query.isError && !query.data && (
          <li role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-[#f0f0ea]/70 px-4 py-3">
            <span className="text-sm text-black/60">Couldn&apos;t load your plan.</span>
            <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className={outlineLink}>
              {query.isFetching ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <RotateCw aria-hidden className="h-3.5 w-3.5" />}
              Retry
            </button>
          </li>
        )}

        {query.data && rows.length === 0 && (
          <li className="flex flex-col items-start gap-3 rounded-xl bg-[#f0f0ea]/70 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-primary">{allDone ? "Everything on your plan is done" : "Nothing on your plan yet"}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-black/50">
                {allowAdd ? "Add a task below, or ask your coach what to focus on next." : "Ask your coach what to focus on next."}
              </p>
            </div>
            <Link href={FULL_PLAN_HREF} className={outlineLink}>
              Plan with your coach
            </Link>
          </li>
        )}

        {rows.map((task) => {
          const done = task.status === "done";
          const href = taskHref(task);
          return (
            <li key={task.id} className="group/row flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                onClick={() => plan.onToggle(task)}
                title={task.title}
                className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325]/30 focus-visible:ring-offset-2">
                <NeoCheckbox checked={done} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate text-sm font-semibold", done ? "text-black/40 line-through" : "text-primary")}>{task.title}</span>
                    {task.seenAt === null && (
                      <span className="flex-none rounded bg-[#e1f073] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-[#222325]">
                        New
                      </span>
                    )}
                  </span>
                  {task.detail && <span className="block truncate text-xs text-black/45">{task.detail}</span>}
                </span>
              </button>
              <button
                type="button"
                onClick={() => plan.onRemove(task)}
                aria-label={`Remove from plan: ${task.title}`}
                title="Remove from plan"
                className="grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-md text-black/35 opacity-0 transition-[opacity,color,background-color] hover:bg-black/5 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325]/30 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100">
                <X aria-hidden className="h-4 w-4" />
              </button>
              {href && (
                <Link href={href} aria-label={`Open: ${task.title}`} className={outlineLink}>
                  Open
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <Link
          href={FULL_PLAN_HREF}
          className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-black/50 transition-colors hover:text-primary">
          +{hidden} more on your plan
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      )}

      {allowAdd && <AddTaskInput plan={plan} dark={false} />}
    </DashCard>
  );
};

// ---------------------------------------------------------------------------

const PlanPanel: FC<PlanPanelProps> = ({ period, variant, title = "This month's plan", limit, allowAdd = true, className }) => {
  const plan = usePlanPanel(period, limit);
  const headingId = useId();
  return variant === "dark-rail" ? (
    <RailPlan plan={plan} title={title} headingId={headingId} allowAdd={allowAdd} className={className} />
  ) : (
    <CardPlan plan={plan} title={title} headingId={headingId} allowAdd={allowAdd} className={className} />
  );
};

export default PlanPanel;
