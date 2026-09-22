"use client";

// Step 1 — the role, as it was actually read: the saved job's own fields, the
// posting's description, and the two things worth knowing before any time or
// credit goes into it. Whether it is already on the tracker (the server's
// duplicate check over every row, not just the ones loaded), and whether
// anything is missing that the later steps lean on.
//
// The "honest odds", "closes in" and "someone you know" tiles that used to sit
// here are gone: nothing measures odds, no posting carries a closing date or an
// applicant count, and a contact list is not the same thing as a warm path in.

import { useState, type FC, type ReactNode } from "react";
import { AlertCircle, ArrowUpRight, Check, CopyCheck, MapPin } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import type { ApplicationItem } from "@/app/lib/applications/types";
import { applicationUrl, wasApplied } from "@/app/lib/applications/api";
import { SOURCE_LABELS, hostOf, type StartedJob } from "../job";

export interface RoleStepProps {
  job: StartedJob;
  /** Undefined while the check runs or when it could not be made; null when nothing matches. */
  duplicate: ApplicationItem | null | undefined;
}

/** Past this the description folds, so the step still reads as a summary. */
const DESCRIPTION_PREVIEW_CHARS = 900;

const STATUS_WORDS: Record<ApplicationItem["status"], string> = {
  saved: "saved",
  applied: "applied",
  conversation: "in conversation",
  interviewing: "interviewing",
  offer: "at offer",
  rejected: "rejected",
  ghosted: "ghosted",
  withdrawn: "withdrawn",
  declined: "declined",
};

const REMOTE_WORDS: Record<NonNullable<StartedJob["remoteType"]>, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

const loggedOn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const RoleStep: FC<RoleStepProps> = ({ job, duplicate }) => {
  const [expanded, setExpanded] = useState(false);
  const posting = applicationUrl(job.url);
  const body = job.description ?? job.summary ?? "";
  const folded = !expanded && body.length > DESCRIPTION_PREVIEW_CHARS;
  const facts = [job.location, job.remoteType ? REMOTE_WORDS[job.remoteType] : null, job.employmentType].filter(
    (fact): fact is string => Boolean(fact),
  );

  return (
    <div className="flex flex-col gap-5">
      <DashCard className="p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold text-black/45">{job.company}</p>
            <h2 className="text-xl font-bold text-primary">{job.role}</h2>
            {facts.length > 0 && (
              <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-xs capitalize text-black/50">
                <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden />
                {facts.join(" · ")}
              </p>
            )}
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <Pill variant="outline-dashed">{SOURCE_LABELS[job.source]}</Pill>
            {job.salary && <Pill variant="neutral">{job.salary}</Pill>}
          </div>
        </div>

        {body ? (
          <>
            <p className="whitespace-pre-line text-sm leading-relaxed text-black/65">
              {folded ? `${body.slice(0, DESCRIPTION_PREVIEW_CHARS).trimEnd()}…` : body}
            </p>
            {body.length > DESCRIPTION_PREVIEW_CHARS && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 cursor-pointer text-xs font-semibold text-black/50 underline decoration-dotted underline-offset-2 hover:text-primary">
                {expanded ? "Show less" : "Show the whole description"}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-black/50">No description on file for this job.</p>
        )}

        {job.requirements.length > 0 && (
          <div className="mt-5 border-t border-black/8 pt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-black/40">What they ask for</p>
            <ul className="flex flex-col gap-1.5">
              {job.requirements.slice(0, 8).map((req, i) => (
                <li key={`${i}:${req}`} className="flex items-start gap-2 text-xs leading-relaxed text-black/65">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-black/30" aria-hidden />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {posting && (
          <a
            href={posting}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-black/55 transition-colors hover:text-primary">
            View the posting on {hostOf(posting)}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </DashCard>

      {duplicate && <DuplicateNote duplicate={duplicate} />}

      {job.unsavedReason && <Notice>{job.unsavedReason}</Notice>}

      {!job.description && (
        <Notice>
          Without the description, the ATS score and the cover letter have only the title to go on. For a sharper result, start again from
          the posting&apos;s link or paste its text in.
        </Notice>
      )}
    </div>
  );
};

const DuplicateNote: FC<{ duplicate: ApplicationItem }> = ({ duplicate }) => {
  const saved = duplicate.status === "saved";
  return (
    <div className="flex items-start gap-3 rounded-2xl border-[1.5px] border-[#222325] bg-white p-5 shadow-[4px_4px_0_0_#e1f073]">
      <CopyCheck className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-bold text-primary">{saved ? "This job is already on your tracker" : "You've tracked this one before"}</p>
        <p className="mt-1 text-xs leading-relaxed text-black/60">
          {saved
            ? `${duplicate.company} — ${duplicate.role} is in your Saved column. Tracking this application moves that card to Applied rather than adding a second one.`
            : `${duplicate.company} — ${duplicate.role} was logged on ${loggedOn(duplicate.loggedAt)} and is ${STATUS_WORDS[duplicate.status]}. ${
                wasApplied(duplicate) ? "You can still go ahead — it's tracked as a repeat, so it won't count twice." : "Going ahead tracks it fresh."
              }`}
        </p>
      </div>
    </div>
  );
};

const Notice: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="flex items-start gap-2.5 rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-3 text-xs leading-relaxed text-black/60">
    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-black/40" aria-hidden />
    <span>{children}</span>
  </p>
);

export default RoleStep;
