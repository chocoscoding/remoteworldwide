"use client";

import { FC, useEffect, useRef, useState } from "react";
import { Briefcase, Check, Copy, Globe, Linkedin, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { useNetwork, type AskJob } from "@/app/components/dashboard/network/NetworkProvider";
import { draftIntro, greetingName, introSubject, type DraftLength, type IntroSender } from "@/app/lib/dashboard/intro-drafts";
import { TIE_META } from "@/app/lib/contacts/ties";
import type { ReferralContact } from "@/app/lib/dashboard/types";
import type { ReferralChannel } from "@/app/lib/contacts/types";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";

const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

export interface DraftPanelProps {
  contact: ReferralContact;
  /** Who is hiring, and for what — plus the saved job, so the ask is recorded against it. */
  job: AskJob | undefined;
}

/**
 * Keyed by contact+job at the call site, so switching either remounts this and
 * regenerates the draft. Until you edit it the draft is derived on every render
 * — so the length toggle rewrites it, and so does your profile arriving (your
 * name and headline are what it signs and introduces you with). Once you edit,
 * your text is yours and neither can eat it.
 */
const DraftPanel: FC<DraftPanelProps> = ({ contact, job }) => {
  const { askReferral, isAsked, askingId } = useNetwork();
  const profile = useProfileSettings().data?.profile;
  const [length, setLength] = useState<DraftLength>("long");
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // How it went out, as far as we can tell: the last way out you clicked here.
  const [channel, setChannel] = useState<ReferralChannel>("other");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sender: IntroSender = { name: profile?.fullName ?? "", headline: profile?.headline ?? "", summary: profile?.summary ?? "" };
  const text = edited ?? draftIntro(contact, job, length, sender);

  const asked = isAsked(contact);
  const asking = askingId === contact.id;
  const tie = TIE_META[contact.tie];
  const first = greetingName(contact);
  const subject = introSubject(contact, job);
  const likelyEmail = contact.emailStatus === "likely";

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

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

  const mailto = contact.email ? `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` : null;
  const profileLink = contact.linkedinUrl || contact.profileUrl || null;
  const where = [contact.role && contact.company ? `${contact.role} at ${contact.company}` : contact.role || contact.company, contact.location]
    .filter(Boolean)
    .join(" · ");

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
            {where && <p className="mt-0.5 truncate text-xs text-black/55">{where}</p>}
          </div>
        </div>

        <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f0f0ea] p-1">
          {(["long", "short"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={length === l}
              onClick={() => setLength(l)}
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
            Written for <span className="font-bold text-primary">{job.role || "a role"}</span> at{" "}
            <span className="font-bold text-primary">{job.company}</span>
            {contact.company.trim().toLowerCase() !== job.company.trim().toLowerCase() && (
              <>
                {" "}— {contact.company ? `${first} isn't at ${job.company}` : `we don't know where ${first} works`}, so this asks who they know rather than for a referral.
              </>
            )}
          </p>
        </div>
      )}

      {!profile?.fullName?.trim() && (
        <p className="mt-3 text-xs text-black/55">
          Add your name and headline in Settings → Profile and every draft will sign off and introduce you with them.
        </p>
      )}

      <p className="mt-4 mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Subject</p>
      <p className="rounded-lg border border-black/10 bg-white px-3.5 py-2.5 text-sm font-semibold text-primary">{subject}</p>

      <p className="mt-3.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/45">Message</p>
      <AutoGrowTextarea
        value={text}
        onChange={(e) => setEdited(e.target.value)}
        minRows={4}
        aria-label={`Intro message to ${contact.name}`}
        className="w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-primary outline-none transition-colors focus:border-[#222325]"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StickerButton
          variant="primary"
          size="md"
          disabled={asked || asking}
          onClick={() => void askReferral(contact, text, { job, channel })}>
          {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : asked ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {asked ? `Asked ${first}` : "Mark as asked"}
        </StickerButton>
        {mailto && (
          <a
            href={mailto}
            onClick={() => setChannel("email")}
            className={GHOST_BTN}
            title={likelyEmail ? `${contact.email} is built from the company's email format and isn't verified` : contact.email}>
            <Mail className="h-3.5 w-3.5" />
            Email {first}
            {likelyEmail && <span className="font-normal text-black/45">(likely address)</span>}
          </a>
        )}
        <button type="button" onClick={copyDraft} className={GHOST_BTN}>
          {copied ? <Check className="h-3.5 w-3.5 text-[#6c7a1e]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy message"}
        </button>
        {profileLink && (
          <a
            href={profileLink}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => setChannel(contact.linkedinUrl ? "linkedin" : "other")}
            className={GHOST_BTN}>
            {contact.linkedinUrl ? <Linkedin className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
            {contact.linkedinUrl ? "Open LinkedIn" : "Open profile"}
          </a>
        )}
      </div>

      <p className="mt-3 text-xs text-black/55">
        {asked
          ? "Logged to your activity. Give it a few days before a nudge."
          : "Send it however you like — marking it asked keeps a record of who you asked, for which job, and what you said."}
      </p>
    </DashCard>
  );
};

export default DraftPanel;
