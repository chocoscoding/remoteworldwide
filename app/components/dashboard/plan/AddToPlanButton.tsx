"use client";

// "Add to plan" for one suggested task: a prep action item, an ATS fix.
//
// The dedupeKey carries the idempotency. A double-click, a retry, or the same
// suggestion shown again tomorrow resolves to the task already on the plan, and
// the backend answers with it under `existing`. Created or existing, the task
// is on the plan, so both read "Added".
//
// The label follows the plan, not only this click. The button reads the same
// cached list the plan panel does, so a suggestion added last week reads
// "Added" on a fresh load, and one removed from the plan since offers itself
// again. A task removed earlier can come back from the server dismissed;
// clicking "Add to plan" is an explicit ask for it, so it is reopened.
//
// Failures show inline beside the button, never as a toast: a full plan is an
// answer the user has to read, and it belongs next to what was refused.
//
// A click's result belongs to the suggestion it was for. The same button can be
// handed another one without remounting (the ATS screen keeps its rows when the
// posting changes), and a result for the old one must not read "Added" there.
//
// A dedupeKey names a suggestion across months, so a click can land on the task
// an earlier month's plan already holds. That still reads "Added", with the
// month named beside it, because no view of this month's plan will show it.

import { FC, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { apiMessage } from "@/app/lib/api/core";
import { isOnPlan } from "@/app/lib/tasks/api";
import { periodOf, type TaskInput, type TaskItem, type UserRouteSourceKind } from "@/app/lib/tasks/types";
import { useTasks } from "@/hooks/queries/useTasksQuery";
import { useCreateTasks, useUpdateTask } from "@/hooks/mutations/useTaskMutations";

export interface AddToPlanButtonProps {
  /**
   * Give it a deterministic `dedupeKey` (`ats:{fixId}:{jobId}`) so repeats find
   * the same task, and a `period` unless the user's current month is meant.
   */
  task: TaskInput;
  /** Session routes accept only these kinds; see `UserRouteSourceKind`. */
  source: { kind: UserRouteSourceKind; ref: string | null };
  size?: "sm";
  className?: string;
}

/** What a click did, and for which suggestion: its dedupeKey and period. */
type Outcome = ({ kind: "added"; task: TaskItem } | { kind: "refused"; message: string }) & { for: string };

/** Identifies the suggestion a result belongs to. */
const suggestionOf = (dedupeKey: string | null, period: string) => `${period}|${dedupeKey ?? ""}`;

/** "September 2026", for a `YYYY-MM` period. */
function monthName(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * Whether the suggestion is on the plan. The period's cached list decides when
 * it can: that is what makes a removal elsewhere show here. This click's result
 * stands in while the list is loading or failed, and for a task that exists on
 * a different month's plan, which this period's list cannot see.
 */
function isAdded(tasks: TaskItem[] | undefined, period: string, dedupeKey: string | null, addedHere: TaskItem | null): boolean {
  if (addedHere && addedHere.period !== period) return true;
  if (!tasks) return addedHere !== null;
  return tasks.some((task) => isOnPlan(task) && ((dedupeKey !== null && task.dedupeKey === dedupeKey) || task.id === addedHere?.id));
}

const AddToPlanButton: FC<AddToPlanButtonProps> = ({ task, source, size = "sm", className }) => {
  // Fixed when the button mounts, so a render just past midnight on the 1st
  // cannot move a click onto a different month's plan.
  const [mountPeriod] = useState(() => periodOf(new Date()));
  const period = task.period ?? mountPeriod;

  const plan = useTasks(period);
  const create = useCreateTasks({ toastErrors: false });
  const reopen = useUpdateTask({ toastErrors: false });
  const [stored, setOutcome] = useState<Outcome | null>(null);
  const dedupeKey = task.dedupeKey ?? null;
  const suggestion = suggestionOf(dedupeKey, period);
  const outcome = stored?.for === suggestion ? stored : null;
  const addedHere = outcome?.kind === "added" ? outcome.task : null;

  const added = isAdded(plan.data, period, dedupeKey, addedHere);
  const pending = create.isPending || reopen.isPending;
  const refusal = !added && outcome?.kind === "refused" ? outcome.message : null;
  const elsewhere = added && addedHere && addedHere.period !== period ? addedHere.period : null;
  // Inert rather than `disabled`: a disabled button drops keyboard focus the
  // moment it is pressed, and the label change is the answer to that press.
  const inert = pending || added;
  const label = pending ? "Adding…" : added ? "Added" : "Add to plan";

  const add = () => {
    if (inert) return;
    // Fixed at the click, so an answer that arrives after the suggestion changed is filed under the one it was for.
    const target = suggestion;
    const refuse = (message: string) => setOutcome({ kind: "refused", message, for: target });
    const accept = (landed: TaskItem) => setOutcome({ kind: "added", task: landed, for: target });
    setOutcome(null);
    create.mutate(
      { task: { ...task, period }, source },
      {
        onSuccess: (result) => {
          const landed = result.created[0] ?? result.existing[0];
          if (!landed) {
            refuse(result.rejected[0]?.message ?? "That couldn't be added to your plan.");
            return;
          }
          if (landed.status !== "dismissed") {
            accept(landed);
            return;
          }
          reopen.mutate(
            { id: landed.id, input: { status: "open" } },
            {
              onSuccess: accept,
              onError: (error) => refuse(apiMessage(error)),
            },
          );
        },
        onError: (error) => refuse(apiMessage(error)),
      },
    );
  };

  const Icon = pending ? Loader2 : added ? Check : Plus;

  return (
    <span className={cn("inline-flex flex-none flex-col items-end gap-1", className)}>
      <StickerButton
        variant={added ? "secondary" : "outline"}
        size={size}
        onClick={add}
        aria-disabled={inert || undefined}
        aria-busy={pending || undefined}
        // Every row has one of these, so the name says which suggestion it adds; the visible label starts it.
        aria-label={`${label}: ${task.title}`}
        className={cn(inert && "cursor-default hover:translate-x-0 hover:translate-y-0 hover:shadow-none", pending && "opacity-60")}>
        <Icon aria-hidden className={cn("h-3.5 w-3.5", pending && "animate-spin", added && "stroke-[3]")} />
        {label}
      </StickerButton>
      {elsewhere && <span className="max-w-[240px] text-right text-[11px] leading-snug text-black/50">On your {monthName(elsewhere)} plan</span>}
      {refusal && (
        <span role="alert" className="max-w-[240px] text-right text-[11px] leading-snug text-red-700">
          {refusal}
        </span>
      )}
    </span>
  );
};

export default AddToPlanButton;
