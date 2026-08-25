"use client";

// Outcomes, not effort.
//
// Job seekers quit from despair, not laziness. A streak counter and a habits
// list both measure how hard you're trying, which is exactly the wrong thing
// to show someone in week six of silence — it tells them they're doing
// everything right and getting nothing, without ever showing the "getting".
//
// So this panel reports what actually came back: replies, interviews,
// referrals, response time. It sits next to the coach line rather than under
// it, because the number and the interpretation only mean something together.

import { type FC } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare, Send, Sparkles, Timer, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import { HOME_STATS } from "@/app/lib/dashboard/mock-data";

interface Outcome {
  id: string;
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
}

const ProofOfProgress: FC = () => {
  const { current, longest, applications } = useActivity();

  // The window is "since this streak began" — that's the span the user is
  // being asked to believe in, so it's the span the outcomes should cover.
  const windowDays = Math.max(current, 1);
  const sent = Number(HOME_STATS.find((s) => s.id === "stat-applications")?.value ?? 0) + applications.length;
  const replyRate = HOME_STATS.find((s) => s.id === "stat-reply-rate")?.value ?? "—";
  const interviews = HOME_STATS.find((s) => s.id === "stat-interviews")?.value ?? "0";

  const outcomes: Outcome[] = [
    { id: "sent", label: "Applications", value: String(sent), caption: `over ${windowDays} days`, icon: Send },
    { id: "replies", label: "Reply rate", value: replyRate, caption: "of everything sent", icon: MessageSquare },
    { id: "interviews", label: "Interviews", value: interviews, caption: "1 still upcoming", icon: Sparkles },
    { id: "referrals", label: "Referrals", value: "6", caption: "warm paths opened", icon: Users },
    { id: "response", label: "Median reply", value: "9d", caption: "when they do reply", icon: Timer },
  ];

  return (
    <DashCard className="p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="text-[15px] font-bold text-primary">What&apos;s come back</p>
        <span className="text-xs text-black/45">
          {current > 0 ? `last ${windowDays} days` : `best run: ${longest} days`}
        </span>
      </div>
      <p className="text-xs text-black/45 mb-4">Effort is only half the picture. This is the other half.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {outcomes.map((o) => (
          <div key={o.id} className="rounded-md border-[1.5px] border-black/15 bg-[#fbfbf7] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-black/40">
              <o.icon className="h-3 w-3" />
              {o.label}
            </span>
            <span className="mt-1 block text-xl font-bold text-primary tabular-nums">{o.value}</span>
            <span className="block text-[11px] text-black/40">{o.caption}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href="/dashboard/coach"
          className="inline-flex items-center gap-2 rounded-md border-[1.5px] border-[#222325] bg-white px-3.5 py-2 text-sm font-semibold text-primary shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          Ask your coach what this means
          <ArrowRight className="h-3.5 w-3.5 flex-none" />
        </Link>
      </div>
    </DashCard>
  );
};

export default ProofOfProgress;
