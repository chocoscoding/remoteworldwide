"use client";

// The front door's "pick up where you left off": every unfinished application
// that can be continued (owner, 2026-10-03), newest first. Only ones started
// from a link are here — a pasted description has nothing to recognise it by,
// which is the one compromise the owner accepted. Dismissing one deletes its
// saved progress, so it asks once more first.

import { useState, type FC } from "react";
import TimeAgo from "timeago-react";
import { ArrowRight, X } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import type { ApplySessionSummary } from "@/app/lib/apply/sessions";
import { APPLY_STEP_LABELS } from "@/app/lib/apply/state";

const ContinueList: FC<{ sessions: ApplySessionSummary[]; onOpen: (id: string) => void; onDismiss: (id: string) => void }> = ({ sessions, onOpen, onDismiss }) => {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (sessions.length === 0) return null;

  return (
    <DashCard className="mb-6 p-0">
      <p className="px-6 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-black/40">Pick up where you left off</p>
      <ul className="divide-y divide-black/8">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center gap-3 px-6 py-3">
            <button type="button" onClick={() => onOpen(session.id)} className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-primary group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                  {session.role} at {session.company}
                </span>
                <span className="block truncate text-xs text-black/45">
                  Stopped at {APPLY_STEP_LABELS[session.step]} (step {session.step} of 5) · <TimeAgo datetime={session.updatedAt} opts={{ minInterval: 60 }} />
                </span>
              </span>
              <ArrowRight className="h-4 w-4 flex-none text-black/30 transition-colors group-hover:text-primary" aria-hidden />
            </button>
            {confirming === session.id ? (
              <span className="flex flex-none items-center gap-2.5 text-xs font-bold">
                <button type="button" onClick={() => onDismiss(session.id)} className="cursor-pointer text-[#b23c26] underline decoration-2 underline-offset-2">
                  Remove
                </button>
                <button type="button" onClick={() => setConfirming(null)} className="cursor-pointer text-black/50 underline decoration-2 underline-offset-2">
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Remove ${session.role} at ${session.company} from this list`}
                onClick={() => setConfirming(session.id)}
                className="grid h-7 w-7 flex-none cursor-pointer place-content-center rounded-md text-black/35 transition-colors hover:bg-[#fdeae6] hover:text-[#b23c26]">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </DashCard>
  );
};

export default ContinueList;
