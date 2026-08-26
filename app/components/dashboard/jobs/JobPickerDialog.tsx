"use client";

import { useMemo, useState, type FC, type FormEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, ClipboardPaste, Loader2, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import LogoMini from "@/app/components/svg/LogoMini";
import { looksLikeUrl, parseFreeText, parseJobUrl } from "@/app/lib/dashboard/parse-jd";
import type { JobOption } from "@/app/lib/dashboard/job-options";

/**
 * The one way into this screen: pick a job, or put one in.
 *
 * Built on the Radix primitives directly rather than `components/ui/dialog`
 * so the overlay can carry a blur — the shared DialogContent hardcodes a flat
 * `bg-black/80`, and changing it there would repaint every other modal in the
 * dashboard.
 */
type Mode = "platform" | "paste";

export interface JobPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Jobs already in the system — platform listings plus anything pasted before. */
  jobs: JobOption[];
  onPick: (job: JobOption) => void;
  /** Adds a newly pasted job to the system and selects it. */
  onCreate: (input: { company: string; role: string; jdText?: string; url?: string }) => void;
  /** Hides the close affordance when there's no job to fall back to. */
  dismissable?: boolean;
}

const FIELD =
  "w-full rounded-xl border-[1.5px] border-black/14 bg-white px-3.5 py-3 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const JobPickerDialog: FC<JobPickerDialogProps> = ({ open, onOpenChange, jobs, onPick, onCreate, dismissable = true }) => {
  const [mode, setMode] = useState<Mode>("platform");
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => `${j.company} ${j.role}`.toLowerCase().includes(q));
  }, [jobs, query]);

  async function handlePaste(e: FormEvent) {
    e.preventDefault();
    const input = raw.trim();
    if (!input) return;

    if (!looksLikeUrl(input)) {
      // Free text: first line is usually "Company — Role", the rest is the body.
      const [firstLine, ...rest] = input.split("\n");
      const parsed = parseFreeText(firstLine);
      onCreate({
        company: parsed.company || "Untitled company",
        role: parsed.role || "Untitled role",
        jdText: rest.join("\n").trim() || input,
      });
      reset();
      return;
    }

    setBusy(true);
    const res = await parseJobUrl(input);
    setBusy(false);
    if (res.ok) {
      onCreate({ ...res.parsed, url: input });
      reset();
    } else {
      // Never a dead end — keep the text and say why.
      setNote(res.reason);
    }
  }

  function reset() {
    setRaw("");
    setQuery("");
    setNote(null);
    setMode("platform");
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => (dismissable || v) && onOpenChange(v)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => !dismissable && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissable && e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogPrimitive.Title className="text-lg font-bold text-primary">Which job?</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-black/50">
                  Pick one from Remote Worldwide, or put a new one in.
                </DialogPrimitive.Description>
              </div>
              {dismissable && (
                <DialogPrimitive.Close className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer">
                  <X className="h-3.5 w-3.5" strokeWidth={3} />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </div>

            <SlidingTabs
              className="mt-4"
              value={mode}
              onChange={setMode}
              options={[
                { id: "platform", label: "From Remote Worldwide" },
                { id: "paste", label: "Paste a job" },
              ]}
            />
          </div>

          {mode === "platform" ? (
            <>
              <div className="px-6 pb-4">
                <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-black/14 bg-[#fbfbf7] px-3.5 py-2.5">
                  <Search className="h-3.5 w-3.5 flex-none text-black/40" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Role or company"
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-primary outline-none placeholder:font-medium placeholder:text-black/35"
                  />
                </div>
              </div>

              <div className="max-h-[320px] overflow-y-auto border-t border-black/10">
                {filtered.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-black/50 leading-relaxed max-w-[300px] mx-auto">
                      Nothing matches that. Try the <b className="font-bold text-primary">Paste a job</b> tab to add it yourself.
                    </p>
                  </div>
                ) : (
                  filtered.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => {
                        onPick(j);
                        reset();
                      }}
                      className="group flex w-full items-center gap-3 border-b border-black/10 px-6 py-3.5 text-left last:border-b-0 cursor-pointer transition-colors hover:bg-[#fbfbf7]">
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f0f0ea] text-[11px] font-extrabold text-black/60">
                        {j.company.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-primary group-hover:underline underline-offset-2">
                            {j.company} — {j.role}
                          </span>
                          {j.source === "platform" && <LogoMini className="h-3 w-3 flex-none" />}
                        </span>
                        <span className="block truncate text-xs text-black/45">
                          {j.source === "pasted" ? "Added by you" : "On Remote Worldwide"}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 flex-none text-black/25 group-hover:text-black/60 transition-colors" />
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handlePaste} className="border-t border-black/10 px-6 py-5">
              {note && <p className="mb-3 rounded-lg border border-black/12 bg-[#fbfbf7] px-3 py-2 text-xs text-black/60">{note}</p>}
              <textarea
                autoFocus
                rows={6}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={"Paste a job URL, or the full description.\n\nStripe — Support Engineer\nWe're looking for…"}
                className={cn(FIELD, "resize-y leading-relaxed")}
              />
              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <p className="inline-flex items-center gap-1.5 text-xs text-black/45">
                  <Sparkles className="h-3.5 w-3.5 flex-none text-black/30" />
                  It gets saved to your jobs, so you can come back to it.
                </p>
                <button
                  type="submit"
                  disabled={!raw.trim() || busy}
                  className="inline-flex flex-none items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-[#222325] px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="h-3.5 w-3.5" />}
                  {busy ? "Reading" : "Use this job"}
                </button>
              </div>
            </form>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default JobPickerDialog;
