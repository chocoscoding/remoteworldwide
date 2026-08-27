"use client";

import { FC, useEffect, useRef, useState } from "react";
import { Briefcase, Check, Copy, Linkedin, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import { draftIntro, introSubject, type DraftLength } from "@/app/lib/dashboard/intro-drafts";
import { TIE_META } from "@/app/lib/dashboard/mock-data";
import type { JobOption } from "@/app/lib/dashboard/job-options";
import type { ReferralContact } from "@/app/lib/dashboard/types";

const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

export interface DraftPanelProps {
  contact: ReferralContact;
  job: JobOption | undefined;
}

/**
 * Keyed by contact+job at the call site, so switching either remounts this and
 * regenerates the draft. Length changes regenerate in place — but only if you
 * haven't edited, so the toggle can't silently eat your rewrite.
 */
const DraftPanel: FC<DraftPanelProps> = ({ contact, job }) => {
  const { askReferral, askedContactIds } = useNetwork();
  const [length, setLength] = useState<DraftLength>("long");
  const [text, setText] = useState(() => draftIntro(contact, job, "long"));
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const asked = askedContactIds.has(contact.id);
  const tie = TIE_META[contact.tie];
  const first = contact.name.split(" ")[0];
  const subject = introSubject(contact, job);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  function changeLength(next: DraftLength) {
    setLength(next);
    if (!edited) setText(draftIntro(contact, job, next));
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't reach the clipboard");
    }
  }

  const mailto = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

  return (
    // The tool surface — hard border + offset shadow, same tier as dialogs.
    // It carries the page's one true primary ("Mark as asked").
    <DashCard className="border-[1.5px] border-[#222325] p-6 shadow-[6px_6px_0_0_#222325]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={contact.name} tone="dark" size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-bold text-primary">Your intro to {first}</p>
              <Pill variant={tie.pillVariant}>{tie.label}</Pill>
            </div>
            <p className="mt-0.5 truncate text-xs text-black/55">
              {contact.role} at {contact.company} · {contact.timezone}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f0f0ea] p-1">
          {(["long", "short"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={length === l}
              onClick={() => changeLength(l)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors",
                length === l ? "bg-[#222325] text-white" : "text-black/55 hover:text-primary"
              )}>
              {l === "long" ? "Full" : "Short"}
            </button>
          ))}
        </div>
      </div>

      {job && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-black/10 bg-[#fbfbf7] px-4 py-3">
          <Briefcase className="mt-0.5 h-3.5 w-3.5 flex-none text-black/45" />
          <p className="text-xs leading-relaxed text-black/60">
            Written for <span className="font-bold text-primary">{job.role}</span> at{" "}
            <span className="font-bold text-primary">{job.company}</span>
            {contact.company.toLowerCase() !== job.company.toLowerCase() && (
              <>
                {" "}— {first} isn&apos;t at {job.company}, so this asks who they know rather than for a referral.
              </>
            )}
          </p>
        </div>
      )}

      <p className="mt-4 mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Subject</p>
      <p className="rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm font-semibold text-primary">{subject}</p>

      <p className="mt-3.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Message</p>
      <AutoGrowTextarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setEdited(true);
        }}
        minRows={4}
        aria-label={`Intro message to ${contact.name}`}
        className="w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-primary outline-none transition-colors focus:border-[#222325]"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StickerButton variant="primary" size="md" disabled={asked} onClick={() => askReferral(contact.id, text)}>
          {asked ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {asked ? `Asked ${first}` : "Mark as asked"}
        </StickerButton>
        <a href={mailto} className={GHOST_BTN}>
          <Mail className="h-3.5 w-3.5" />
          Email {first}
        </a>
        <button type="button" onClick={copyDraft} className={GHOST_BTN}>
          {copied ? <Check className="h-3.5 w-3.5 text-[#6c7a1e]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy message"}
        </button>
        <a href={contact.linkedinUrl} target="_blank" rel="noreferrer noopener" className={GHOST_BTN}>
          <Linkedin className="h-3.5 w-3.5" />
          Open LinkedIn
        </a>
      </div>

      <p className="mt-3 text-xs text-black/55">
        {asked
          ? "Logged to your activity. Give it a few days before a nudge."
          : "Send it however you like — marking it asked just keeps your list straight."}
      </p>
    </DashCard>
  );
};

export default DraftPanel;
