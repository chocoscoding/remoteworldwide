"use client";

// Outcomes, not effort.
//
// Job seekers quit from despair, not laziness. A streak counter and a habits
// list both measure how hard you're trying, which is exactly the wrong thing
// to show someone in week six of silence — it tells them they're doing
// everything right and getting nothing, without ever showing the "getting".
//
// So this panel reports what actually came back: replies, interviews, offers,
// and how well the applications scored. It sits next to the coach line rather
// than under it, because the number and the interpretation only mean something
// together.
//
// Every figure is counted from the user's real applications. The reply rate,
// interviews and offers are the server's funnel (`GET /api/applications/summary`
// — the same numbers the coach reads, so the two can never disagree); the ATS
// average is the mean of the scores real scans stamped on applications. A
// number with nothing behind it yet reads "—", never a stand-in.

import { type FC } from "react";
import Link from "next/link";
import { ArrowRight, Gauge, MessageSquare, Send, Sparkles, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import { useActivity } from "@/app/components/dashboard/activity/ActivityProvider";
import type { ApplicationStage } from "@/app/lib/applications/types";
import { useApplicationSummary, useApplications } from "@/hooks/queries/useApplicationsQuery";

interface Outcome {
  id: string;
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
}

const ProofOfProgress: FC = () => {
  const { current, longest, applications } = useActivity();
  const summary = useApplicationSummary();
  // The rows themselves, for what sits in a stage right now — the funnel counts
  // how far applications ever got, closed ones included.
  const rows = useApplications();

  const stage = (id: ApplicationStage) => summary.data?.funnel.stages.find((s) => s.id === id);
  // Sent applications only: a saved job was never sent.
  const sent = applications.length;
  // The share of sent applications that reached a conversation — the funnel's
  // own conversion into that stage, null until anything was sent.
  const replyConversion = stage("conversation")?.conversion ?? null;
  const interviews = stage("interviewing")?.reached;
  const offers = stage("offer")?.reached;
  const interviewingNow = rows.data?.filter((row) => row.status === "interviewing").length ?? 0;
  // Only real scans' scores: an application logged without one carries none.
  const scores = applications.map((a) => a.atsScore).filter((score): score is number => typeof score === "number");
  const averageAts = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const known = summary.data !== undefined;

  const outcomes: Outcome[] = [
    { id: "sent", label: "Applications", value: String(sent), caption: "sent so far", icon: Send },
    {
      id: "replies",
      label: "Reply rate",
      value: replyConversion === null ? "—" : `${Math.round(replyConversion * 100)}%`,
      caption: "of everything sent",
      icon: MessageSquare,
    },
    {
      id: "interviews",
      label: "Interviews",
      value: known ? String(interviews ?? 0) : "—",
      caption: interviewingNow > 0 ? `${interviewingNow} in progress now` : "reached so far",
      icon: Sparkles,
    },
    { id: "offers", label: "Offers", value: known ? String(offers ?? 0) : "—", caption: "reached so far", icon: Trophy },
    {
      id: "ats",
      label: "Avg ATS score",
      value: averageAts === null ? "—" : String(averageAts),
      caption: scores.length > 0 ? `across ${scores.length} scanned` : "no scans yet",
      icon: Gauge,
    },
  ];

  return (
    <DashCard className="p-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p className="text-[15px] font-bold text-primary">What&apos;s come back</p>
        <span className="text-xs text-black/45">
          {current > 0 ? `${current}-day streak · best ${longest}` : `best run: ${longest} ${longest === 1 ? "day" : "days"}`}
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

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {/* These five numbers say what came back; the funnel says where it
            stopped. The funnel lives on the tracker, next to the board it reads. */}
        <Link
          href="/dashboard/tracker"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-black/55 transition-colors hover:text-primary">
          See the full funnel
          <ArrowRight className="h-3.5 w-3.5 flex-none" />
        </Link>
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
