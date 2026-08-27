"use client";

import { FC } from "react";
import { Check, Clock, Copy, Linkedin, Mail, PenLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import Pill from "@/app/components/dashboard/ui/Pill";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { TIE_META } from "@/app/lib/dashboard/mock-data";
import type { ReferralContact } from "@/app/lib/dashboard/types";

const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

export interface ContactRowProps {
  contact: ReferralContact;
  /** Set when a job is in play, so the row can say what the ask is about. */
  jobRole?: string;
  asked: boolean;
  selected: boolean;
  /** Quiet rows (adjacent paths) get a text action — weight stays rationed. */
  quiet?: boolean;
  onDraft: () => void;
}

/**
 * A row, not a card. A contact list is something you scan down for the right
 * person — three-across tiles made every entry the same visual weight and
 * pushed the reach channels (email, LinkedIn) below the fold.
 */
const ContactRow: FC<ContactRowProps> = ({ contact, jobRole, asked, selected, quiet, onDraft }) => {
  const tie = TIE_META[contact.tie];
  const available = contact.status.toLowerCase().includes("available");

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contact.email);
      toast.success("Email address copied", { description: contact.email });
    } catch {
      toast.error("Couldn't reach the clipboard");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors",
        // Selection = lime edge, not another loud fill.
        selected && "bg-[#fbfbf7] shadow-[inset_3px_0_0_0_#e1f073]"
      )}>
      <Avatar name={contact.name} size={quiet ? "sm" : "md"} />

      <div className="min-w-0 flex-1 basis-[260px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-bold text-primary">{contact.name}</p>
          <Pill variant={tie.pillVariant}>{tie.label}</Pill>
          {asked && <Pill variant="neutral">Asked</Pill>}
        </div>
        <p className="mt-0.5 truncate text-xs text-black/55">
          {contact.role} · {contact.company} · {contact.timezone}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs">
          {available ? (
            <Check className="h-3.5 w-3.5 flex-none text-[#6c7a1e]" />
          ) : (
            <Clock className="h-3.5 w-3.5 flex-none text-black/40" />
          )}
          <span className={cn("truncate", available ? "font-semibold text-[#6c7a1e]" : "text-black/55")}>
            {contact.status}
          </span>
        </p>
        {jobRole && <p className="mt-1 truncate text-xs text-black/55">Could refer you for {jobRole}</p>}
      </div>

      {/* The two reach channels this page exists to hand over. */}
      <div className="flex flex-none items-center gap-0.5">
        <a href={`mailto:${contact.email}`} className={GHOST_BTN} title={contact.email}>
          <Mail className="h-3.5 w-3.5" />
          Email
        </a>
        <button type="button" onClick={copyEmail} className={GHOST_BTN} aria-label={`Copy ${contact.name}'s email address`}>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
        <a href={contact.linkedinUrl} target="_blank" rel="noreferrer noopener" className={GHOST_BTN}>
          <Linkedin className="h-3.5 w-3.5" />
          LinkedIn
        </a>
      </div>

      {/* Never a solid-ink primary here — a list of primaries is a list of
          nothing. The page's one primary lives on the draft panel. */}
      {selected ? (
        <StickerButton variant="secondary" size="sm" className="flex-none" onClick={onDraft}>
          <PenLine className="h-3.5 w-3.5" />
          Editing
        </StickerButton>
      ) : quiet ? (
        <button type="button" onClick={onDraft} className={cn(GHOST_BTN, "flex-none")}>
          <PenLine className="h-3.5 w-3.5" />
          Write the intro
        </button>
      ) : (
        <StickerButton variant="outline" size="sm" className="flex-none" onClick={onDraft}>
          <PenLine className="h-3.5 w-3.5" />
          Write the intro
        </StickerButton>
      )}
    </div>
  );
};

export default ContactRow;
