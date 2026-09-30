import { toast } from "sonner";
import { statusMeta } from "@/app/components/dashboard/tracker/tracker-meta";
import type { PrepTrackerChange } from "@/app/lib/prep/types";

interface Added {
  company: string;
  role: string;
  alreadyTracked: boolean;
  tracker: PrepTrackerChange;
}

/**
 * What adding a prep track did on the tracker, said the way the tracker's own
 * moves say it. One place, because two screens add tracks — the prep index's
 * add dialog and Ask about a job's "Open interview prep" — and they must not
 * describe the same server outcome differently. It confirms what the server
 * actually did, which a board changed in another tab can make different from
 * any preview. Nothing when nothing moved.
 *
 * `quietWhenTracked`: a caller whose button said "open" skips the
 * already-have-a-track note — opening the existing track is exactly what was
 * asked for, so saying so is noise.
 */
export function announceTrackerChange(
  { company, role, alreadyTracked, tracker }: Added,
  openTracker: () => void,
  { quietWhenTracked = false }: { quietWhenTracked?: boolean } = {},
): void {
  const job = `${company} — ${role}`;
  const viewTracker = { label: "View tracker", onClick: openTracker };
  if (alreadyTracked) {
    if (!quietWhenTracked) toast("You already have a prep track for this job", { description: `Opened it: ${job}` });
    return;
  }
  if (tracker.kind === "created") {
    toast.success("Added to your tracker", { description: `${job} is under Interviewing.`, action: viewTracker });
  } else if (tracker.kind === "moved") {
    toast.success(`${company} moved to Interviewing`, { description: `It was in ${statusMeta(tracker.from).label} on your tracker.`, action: viewTracker });
  } else if (tracker.kind === "unchanged" && tracker.reason === "closed") {
    toast(`${company} is still marked ${statusMeta(tracker.status).label.toLowerCase()}`, {
      description: "Your tracker keeps it closed. Move it back there if they're interviewing you after all.",
      action: viewTracker,
    });
  }
}
