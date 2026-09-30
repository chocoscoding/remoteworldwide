"use client";

import { FC } from "react";
import { Briefcase, Copy, Globe, Link2, Linkedin, Mail, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Avatar from "@/app/components/dashboard/ui/Avatar";
import Pill from "@/app/components/dashboard/ui/Pill";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { TIE_META } from "@/app/lib/contacts/ties";
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
  /** Offered for saved contacts: they are the user's data to delete. */
  onRemove?: () => void;
  removing?: boolean;
}

/**
 * A row, not a card. A contact list is something you scan down for the right
 * person — three-across tiles made every entry the same visual weight and
 * pushed the reach channels (email, LinkedIn) below the fold.
 *
 * Every channel is shown only when there is one: most LinkedIn connections
 * share no email, and someone typed in by hand may have no profile link.
 */
const ContactRow: FC<ContactRowProps> = ({ contact, jobRole, asked, selected, quiet, onDraft, onRemove, removing }) => {
  const tie = TIE_META[contact.tie];
  const likely = contact.emailStatus === "likely";
  const profileLink = contact.linkedinUrl || contact.profileUrl || "";
  const detail = [contact.role, contact.company, contact.location].filter(Boolean).join(" · ");

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contact.email);
      toast.success("Email address copied", { description: likely ? `${contact.email} (likely, unverified)` : contact.email });
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
          {contact.hiring && (
            <Pill variant="positive" title={`${contact.company} has a live job on Remote Worldwide`}>
              <Briefcase className="mr-1 h-3 w-3" aria-hidden />
              Hiring
            </Pill>
          )}
          {asked && <Pill variant="neutral">Asked</Pill>}
        </div>
        {detail && <p className="mt-0.5 truncate text-xs text-black/55">{detail}</p>}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-black/55">
          <Link2 className="h-3.5 w-3.5 flex-none text-black/40" aria-hidden />
          <span className="truncate">{contact.status}</span>
        </p>
        {contact.email && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5 flex-none text-black/40" aria-hidden />
            <span className="truncate font-medium text-primary">{contact.email}</span>
            {likely && (
              <span
                title="Built from the company's email format, not verified"
                className="flex-none rounded-full bg-[#f0f0ea] px-2 py-0.5 text-[10.5px] font-semibold text-black/60">
                Likely · unverified
              </span>
            )}
          </p>
        )}
        {jobRole && <p className="mt-1 truncate text-xs text-black/55">Could refer you for {jobRole}</p>}
      </div>

      {/* The reach channels this page exists to hand over — whichever exist. */}
      <div className="flex flex-none items-center gap-0.5">
        {contact.email && (
          <>
            <a href={`mailto:${contact.email}`} className={GHOST_BTN} title={contact.email}>
              <Mail className="h-3.5 w-3.5" />
              Email
            </a>
            <button type="button" onClick={copyEmail} className={GHOST_BTN} aria-label={`Copy ${contact.name}'s email address`}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </>
        )}
        {profileLink && (
          <a href={profileLink} target="_blank" rel="noreferrer noopener" className={GHOST_BTN}>
            {contact.linkedinUrl ? <Linkedin className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
            {contact.linkedinUrl ? "LinkedIn" : "Profile"}
          </a>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className={cn(GHOST_BTN, "disabled:cursor-default disabled:opacity-50")}
            aria-label={`Remove ${contact.name} from your contacts`}
            title="Remove from your contacts">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
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
