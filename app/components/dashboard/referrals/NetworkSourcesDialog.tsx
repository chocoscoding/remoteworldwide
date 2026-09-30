"use client";

import { FC, useRef, useState, type FormEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUpRight, BookmarkPlus, Linkedin, Loader2, Trash2, Upload, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import { apiMessage } from "@/app/lib/api/core";
import type { ContactCounts, ContactImportResult } from "@/app/lib/contacts/types";
import { useDeleteContacts, useImportLinkedInContacts, useSaveContact } from "@/hooks/mutations/useContactMutations";

/**
 * Where contacts come from, and the one place to bring them in. Says exactly
 * what exists: a LinkedIn Connections.csv import, saving people a referral
 * search found, and adding someone by hand. Nothing syncs on its own — there is
 * no LinkedIn or Gmail connection, and the dialog does not pretend otherwise.
 */
export interface NetworkSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whole-list counts, for the remove action's label. */
  counts?: ContactCounts;
}

/** LinkedIn's own "Get a copy of your data" page. */
const LINKEDIN_EXPORT_URL = "https://www.linkedin.com/mypreferences/d/download-my-data";

const INPUT =
  "h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const SectionIcon: FC<{ icon: typeof Linkedin }> = ({ icon: Icon }) => (
  <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#f0f0ea]">
    <Icon className="h-4 w-4 text-black/55" />
  </span>
);

const NetworkSourcesDialog: FC<NetworkSourcesDialogProps> = ({ open, onOpenChange, counts }) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
          <div>
            <DialogPrimitive.Title className="text-lg font-bold text-primary">Where your contacts come from</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-black/55">
              Only what you bring in. Nothing syncs on its own, and your contacts are visible to you alone.
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <X className="h-3.5 w-3.5" strokeWidth={3} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>

        <div className="overflow-y-auto border-t border-black/10">
          <LinkedInImport />
          <div className="flex items-start gap-3 border-b border-black/8 px-6 py-4">
            <SectionIcon icon={BookmarkPlus} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">People a referral search found</p>
              <p className="mt-0.5 text-xs leading-relaxed text-black/55">
                On the For a job tab, press Save on anyone the search turns up. They&apos;re kept with their profile link and title, and
                an email stays labelled found or likely (unverified), just as the search said.
              </p>
            </div>
          </div>
          <AddByHand />
          <RemoveImported count={counts?.["linkedin-csv"] ?? 0} />
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);

const LinkedInImport: FC = () => {
  const input = useRef<HTMLInputElement | null>(null);
  const importCsv = useImportLinkedInContacts();
  const [result, setResult] = useState<ContactImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setError(null);
    importCsv.mutate(file, {
      onSuccess: setResult,
      onError: (e) => setError(apiMessage(e)),
    });
  }

  return (
    <div className="flex items-start gap-3 border-b border-black/8 px-6 py-4">
      <SectionIcon icon={Linkedin} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">Your LinkedIn connections</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-black/60">
          <li>
            On LinkedIn, go to Settings → Data privacy → Get a copy of your data (
            <a href={LINKEDIN_EXPORT_URL} target="_blank" rel="noreferrer noopener" className="font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
              open it
              <ArrowUpRight className="ml-0.5 inline h-3 w-3" aria-hidden />
            </a>
            ).
          </li>
          <li>Choose the data you want, tick Connections, and request the archive. LinkedIn emails you when it&apos;s ready.</li>
          <li>Download it, unzip it if it&apos;s a ZIP, and upload Connections.csv here.</li>
        </ol>
        <p className="mt-2 text-xs leading-relaxed text-black/50">
          LinkedIn only includes an email for connections who allow it, so most people arrive without one. Importing a newer export
          later updates anyone who changed jobs and adds new connections; nobody is added twice.
        </p>

        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            // Picking the same file again (after fixing it) must still fire a change.
            e.target.value = "";
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StickerButton variant="primary" size="sm" disabled={importCsv.isPending} onClick={() => input.current?.click()}>
            {importCsv.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {importCsv.isPending ? "Importing…" : "Upload Connections.csv"}
          </StickerButton>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-[#b23c26]/20 bg-[#fdf4f2] px-3 py-2 text-xs leading-relaxed text-[#b23c26]" role="alert">
            {error}
          </p>
        )}
        {result && <ImportSummary result={result} />}
      </div>
    </div>
  );
};

const ImportSummary: FC<{ result: ContactImportResult }> = ({ result }) => {
  const parts = [
    `${result.added.toLocaleString()} added`,
    result.updated > 0 && `${result.updated.toLocaleString()} updated`,
    result.unchanged > 0 && `${result.unchanged.toLocaleString()} already up to date`,
    result.skipped > 0 && `${result.skipped.toLocaleString()} skipped`,
  ].filter(Boolean);
  return (
    <div className="mt-3 rounded-lg bg-[#f0f0ea] px-3 py-2 text-xs leading-relaxed text-black/65" role="status">
      {result.rows === 0 ? (
        "That file has LinkedIn's columns but no connections in it."
      ) : (
        <>
          <span className="font-semibold text-primary">{parts.join(" · ")}.</span>
          {result.skipped > 0 && !result.limitReached && " Skipped rows had no name or repeated an earlier row."}
          {result.limitReached && " You've reached the 30,000-contact limit, so some rows were left out — remove people you don't need and import again."}
        </>
      )}
    </div>
  );
};

const AddByHand: FC = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const save = useSaveContact();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    save.mutate(
      {
        source: "manual",
        name: name.trim(),
        company: company.trim() || null,
        position: position.trim() || null,
        email: email.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
      },
      {
        onSuccess: () => {
          setName("");
          setCompany("");
          setPosition("");
          setEmail("");
          setLinkedinUrl("");
        },
      },
    );
  }

  return (
    <div className="flex items-start gap-3 border-b border-black/8 px-6 py-4">
      <SectionIcon icon={UserPlus} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">Someone you know</p>
        <p className="mt-0.5 text-xs leading-relaxed text-black/55">Add a person by hand — a former colleague, a friend at a company you&apos;re eyeing.</p>
        {open ? (
          <form onSubmit={submit} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className={cn(INPUT, "sm:col-span-2")} placeholder="Name (required)" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required aria-label="Name" />
            <input className={INPUT} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} aria-label="Company" />
            <input className={INPUT} placeholder="Title" value={position} onChange={(e) => setPosition(e.target.value)} maxLength={300} aria-label="Title" />
            <input className={INPUT} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} aria-label="Email" />
            <input className={INPUT} type="url" placeholder="LinkedIn profile link" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} maxLength={500} aria-label="LinkedIn profile link" />
            <div className="flex items-center gap-2 sm:col-span-2">
              <StickerButton type="submit" variant="outline" size="sm" disabled={save.isPending || !name.trim()}>
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Add contact
              </StickerButton>
              <button type="button" onClick={() => setOpen(false)} className="cursor-pointer px-2 text-xs font-semibold text-black/55 hover:text-primary">
                Done
              </button>
            </div>
          </form>
        ) : (
          <StickerButton variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Add someone
          </StickerButton>
        )}
      </div>
    </div>
  );
};

/** Two steps, because it cannot be undone: re-importing brings people back, but notes on them are gone. */
const RemoveImported: FC<{ count: number }> = ({ count }) => {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteContacts();
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <p className="text-xs text-black/55">
        {count.toLocaleString()} {count === 1 ? "contact" : "contacts"} from LinkedIn
      </p>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#b23c26]">Remove all of them?</span>
          <StickerButton
            variant="outline"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate("linkedin-csv", { onSettled: () => setConfirming(false) })}>
            {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </StickerButton>
          <button type="button" onClick={() => setConfirming(false)} className="cursor-pointer px-1 text-xs font-semibold text-black/55 hover:text-primary">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/55 transition-colors hover:bg-black/[0.05] hover:text-[#b23c26]">
          <Trash2 className="h-3.5 w-3.5" />
          Remove imported contacts
        </button>
      )}
    </div>
  );
};

export default NetworkSourcesDialog;
