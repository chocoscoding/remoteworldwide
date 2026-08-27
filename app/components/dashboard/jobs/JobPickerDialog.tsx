"use client";

import { useMemo, useState, type FC, type FormEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, Check, ChevronDown, Chrome, ClipboardPaste, Loader2, Search, Sparkles, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import AutoGrowTextarea from "@/app/components/dashboard/ui/AutoGrowTextarea";
import SlidingTabs from "@/app/components/dashboard/ui/SlidingTabs";
import LogoMini from "@/app/components/svg/LogoMini";
import { looksLikeUrl, parseFreeText, parseJobUrl } from "@/app/lib/dashboard/parse-jd";
import type { JobOption, PastedJobInput } from "@/app/lib/dashboard/job-options";

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
  onCreate: (input: PastedJobInput) => void;
  /** Hides the close affordance when there's no job to fall back to. */
  dismissable?: boolean;
}

const FIELD =
  "w-full rounded-xl border-[1.5px] border-black/14 bg-white px-3.5 py-2 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-[#222325]";

const LABEL = "mb-1 block text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/55";

/**
 * Rides under the import form the way store promos do — but in this system's
 * clothes, and pitching the honest alternative to pasting: the extension saves
 * the posting from the careers page itself.
 */
const ExtensionPromo: FC = () => (
  <div className="mt-3 flex flex-none items-center gap-4 rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] p-4 shadow-[4px_4px_0_0_#e1f073]">
    <span className="grid h-11 w-11 flex-none place-content-center rounded-xl bg-[#e1f073]">
      <Chrome className="h-5 w-5 text-[#222325]" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-white">Skip the pasting next time</p>
      <p className="mt-0.5 text-xs leading-relaxed text-white/60">
        The Chrome extension saves any posting straight to your jobs, in one click, from the careers page itself.
      </p>
      {/* Nice-to-have credentials give way before the form ever has to scroll. */}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-white/70 [@media(max-height:760px)]:hidden">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 fill-[#e1f073] text-[#e1f073]" />
          4.9 rating
        </span>
        <span className="inline-flex items-center gap-1">
          <Check className="h-3 w-3 text-[#e1f073]" />
          Featured on the Chrome Web Store
        </span>
      </p>
    </div>
    <a
      href="https://chromewebstore.google.com"
      target="_blank"
      rel="noreferrer noopener"
      className="flex-none rounded-lg border-[1.5px] border-white/30 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-white">
      Get it
    </a>
  </div>
);

const JobPickerDialog: FC<JobPickerDialogProps> = ({ open, onOpenChange, jobs, onPick, onCreate, dismissable = true }) => {
  const [mode, setMode] = useState<Mode>("platform");
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // The structured suite — the paste box above only prefills these; they stay
  // yours to edit before saving.
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [desc, setDesc] = useState("");
  const [salary, setSalary] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => `${j.company} ${j.role}`.toLowerCase().includes(q));
  }, [jobs, query]);

  /** Paste anything — a link or the whole posting — and the fields fill in. */
  async function handleSmartFill() {
    const input = raw.trim();
    if (!input) return;

    if (!looksLikeUrl(input)) {
      // Free text: first line is usually "Company — Role", the rest is the body.
      const [firstLine, ...rest] = input.split("\n");
      const parsed = parseFreeText(firstLine);
      setCompany(parsed.company);
      setRole(parsed.role);
      setDesc(rest.join("\n").trim() || (parsed.role ? "" : input));
      setRaw("");
      setNote("Filled from your paste — check the fields, then save.");
      return;
    }

    setBusy(true);
    const res = await parseJobUrl(input);
    setBusy(false);
    if (res.ok) {
      setCompany(res.parsed.company);
      setRole(res.parsed.role);
      setDesc(res.parsed.jdText ?? "");
      setSrcUrl(input);
      setRaw("");
      setNote("Read from the link — check the fields, then save.");
    } else {
      // Never a dead end — keep the text and say why.
      setNote(res.reason);
    }
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;
    onCreate({ company, role, jdText: desc, salary, url: srcUrl.trim() || undefined });
    reset();
  }

  function reset() {
    setRaw("");
    setQuery("");
    setNote(null);
    setCompany("");
    setRole("");
    setDesc("");
    setSalary("");
    setSrcUrl("");
    setMoreOpen(false);
    setMode("platform");
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => (dismissable || v) && onOpenChange(v)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => !dismissable && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissable && e.preventDefault()}
          // Transparent shell: the dialog body and the extension promo are two
          // separate cards inside it. A flex column capped to the viewport —
          // the shell itself never scrolls; if anything overflows, it scrolls
          // INSIDE the white card while the promo stays pinned below.
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-40px)] w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325]">
          <div className="flex-none px-6 pt-5 pb-3.5">
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
              className="mt-3"
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

              <div className="min-h-0 max-h-[320px] overflow-y-auto border-t border-black/10">
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
            <form onSubmit={handleSave} className="min-h-0 overflow-y-auto border-t border-black/10 px-6 py-3.5">
              {/* Smart fill — optional shortcut into the fields below. */}
              <div className="flex items-start gap-2 rounded-xl border-[1.5px] border-dashed border-black/20 bg-[#fbfbf7] p-2.5">
                <textarea
                  autoFocus
                  rows={2}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder="Paste a link or the whole posting — we'll fill the fields for you…"
                  className="min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-sm leading-relaxed text-primary outline-none placeholder:text-black/40"
                />
                <button
                  type="button"
                  onClick={handleSmartFill}
                  disabled={!raw.trim() || busy}
                  className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-white px-3 py-2 text-xs font-bold text-[#222325] transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#222325] hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:pointer-events-none disabled:opacity-40">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {busy ? "Reading" : "Fill fields"}
                </button>
              </div>
              {note && <p className="mt-2.5 rounded-lg border border-black/12 bg-[#fbfbf7] px-3 py-2 text-xs text-black/60">{note}</p>}

              <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="job-company">
                    Company
                  </label>
                  <input
                    id="job-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Stripe"
                    required
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="job-role">
                    Position
                  </label>
                  <input
                    id="job-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Senior Product Designer"
                    required
                    className={FIELD}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className={LABEL} htmlFor="job-desc">
                  Description
                </label>
                <AutoGrowTextarea
                  id="job-desc"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  minRows={2}
                  placeholder="What the posting says — requirements, responsibilities, anything worth scoring against…"
                  className={cn(FIELD, "leading-relaxed")}
                />
              </div>

              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-[#6c7a1e]">
                More details
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
              </button>

              {moreOpen && (
                <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor="job-salary">
                      Salary
                    </label>
                    <input
                      id="job-salary"
                      value={salary}
                      onChange={(e) => setSalary(e.target.value)}
                      placeholder="e.g. $120k–150k, or leave blank"
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="job-url">
                      Posting link
                    </label>
                    <input
                      id="job-url"
                      value={srcUrl}
                      onChange={(e) => setSrcUrl(e.target.value)}
                      placeholder="https://…"
                      className={FIELD}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
                <p className="text-xs text-black/55">Saved to your jobs, so every screen can use it.</p>
                <button
                  type="submit"
                  disabled={!company.trim() || !role.trim()}
                  className="inline-flex flex-none items-center gap-1.5 rounded-lg border-[1.5px] border-[#222325] bg-[#222325] px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[2px_2px_0_0_#e1f073] hover:shadow-[2.5px_2.5px_0_0_#e1f073] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:pointer-events-none">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Save &amp; use this job
                </button>
              </div>
            </form>
          )}
          </div>

          {/* The honest fix for pasting at all — only on the import path. */}
          {mode === "paste" && <ExtensionPromo />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default JobPickerDialog;
