"use client";

import { FC, FormEvent, useId, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { apiMessage } from "@/app/lib/api/core";
import { APPLICATION_LIMITS } from "@/app/lib/applications/types";
import { draftApplicationAnswers, draftCoverLetter } from "@/app/lib/drafts/api";
import type { ApplicationDraftItem } from "@/app/lib/drafts/types";
import { useMarkDraftApplied } from "@/hooks/mutations/useDraftMutations";

/**
 * "Mark as applied" for one draft: confirm the company and the role — both
 * required, prefilled from what the extension read off the page, which can be
 * missing or wrong — and the draft becomes a tracked application
 * (`useMarkDraftApplied`). A failure is said here, inline, with what was typed
 * kept, rather than in a toast that would leave the dialog looking done.
 *
 * Radix primitives directly, in the extension dialog's house style, so the
 * overlay can blur. The form lives inside Content, which unmounts on close, so
 * every opening starts from the draft again with no stale error.
 */
export interface MarkAppliedDialogProps {
  draft: ApplicationDraftItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LABEL = "mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40";
const FIELD =
  "h-10 w-full rounded-lg border border-black/15 bg-white px-3.5 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const MarkAppliedForm: FC<{ draft: ApplicationDraftItem; onDone: () => void }> = ({ draft, onDone }) => {
  const id = useId();
  const mark = useMarkDraftApplied();
  const [company, setCompany] = useState(draft.company ?? "");
  const [role, setRole] = useState(draft.role ?? "");

  // What the tracker row will carry, said up front.
  const questions = draftApplicationAnswers(draft).length;
  const carried = [questions > 0 ? `${questions} answer${questions === 1 ? "" : "s"}` : null, draftCoverLetter(draft) ? "cover letter" : null]
    .filter(Boolean)
    .join(" and ");
  const ready = company.trim() !== "" && role.trim() !== "";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || mark.isPending) return;
    mark.mutate({ draft, company: company.trim(), role: role.trim() }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <DialogPrimitive.Title className="text-lg font-bold text-primary">Mark as applied</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-black/50">
            It goes on your tracker as Applied{carried ? `, carrying this draft's ${carried}` : ""}. A saved card for the same job moves to Applied
            instead of gaining a twin.
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          <X className="h-3.5 w-3.5" strokeWidth={3} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <label className={LABEL} htmlFor={`${id}-company`}>
            Company
          </label>
          <input
            id={`${id}-company`}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Northwind"
            required
            maxLength={APPLICATION_LIMITS.companyMax}
            autoComplete="off"
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor={`${id}-role`}>
            Role
          </label>
          <input
            id={`${id}-role`}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Staff Engineer"
            required
            maxLength={APPLICATION_LIMITS.roleMax}
            autoComplete="off"
            className={FIELD}
          />
        </div>
      </div>

      {mark.isError && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fdeae6] px-3 py-2 text-xs font-semibold text-[#b23c26]">
          It wasn&apos;t tracked. {apiMessage(mark.error)}
        </p>
      )}

      <div className="mt-6 flex items-center gap-2.5">
        <StickerButton type="submit" variant="primary" size="md" disabled={!ready || mark.isPending}>
          {mark.isPending ? "Tracking…" : "Mark as applied"}
        </StickerButton>
        <DialogPrimitive.Close
          type="button"
          className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-black/50 transition-colors hover:bg-[#fdeae6] hover:text-[#b23c26]">
          Cancel
        </DialogPrimitive.Close>
      </div>
    </form>
  );
};

const MarkAppliedDialog: FC<MarkAppliedDialogProps> = ({ draft, open, onOpenChange }) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <MarkAppliedForm draft={draft} onDone={() => onOpenChange(false)} />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

export default MarkAppliedDialog;
