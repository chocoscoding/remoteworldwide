"use client";

// Picking what you're applying to.
//
// The wizard behind this was hardwired to one job, so there was no way to
// start an application for anything else. This is the front door, and it
// accepts the four shapes a job actually arrives in: a link someone sent you, a
// description pasted out of an email or a PDF, something already in your jobs,
// or a Remote Worldwide listing.
//
// Every way in ends as a SAVED JOB, the way the job picker's every pick does.
// The id is what the wizard's later steps key on — the warm-intro search needs
// it, the application row records it, and the scan and the letter share a
// requirement cache under it — and "Your jobs" is where someone finds the job
// again after closing the tab halfway. A link is read by the same import the
// picker runs and saved with that import's id, so the salary, the apply link and
// the requirements it read come across, not just a company and a role.
//
// A save that fails is not a dead end: the wizard starts on what was read, and
// step 1 says what that costs (no warm-intro search). Reading a link that fails
// falls through to the paste tab with the reason, as it always has.

import { useState, type FC, type FormEvent } from "react";
import { ArrowRight, Briefcase, Clipboard, Link2, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import Pill from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import { apiMessage } from "@/app/lib/api/core";
import { looksLikeUrl, parseFreeText, parseJobUrl } from "@/app/lib/dashboard/parse-jd";
import type { PlatformJobSearchItem, SavedJobItem } from "@/app/lib/jobs/types";
import { useDebouncedValue, usePlatformJobSearch, useSavedJobsQuery } from "@/hooks/queries/useJobQueries";
import { useSaveJob } from "@/hooks/mutations/useJobMutations";
import { fromParsed, fromSavedJob, type PickedJob } from "./job";

export interface StartApplicationProps {
  onStart: (job: PickedJob) => void;
}

type Mode = "link" | "paste" | "saved" | "board";

const MODES: { id: Mode; label: string; icon: typeof Link2; hint: string }[] = [
  { id: "link", label: "Job link", icon: Link2, hint: "Paste the URL of the posting. We read it and save it to your jobs." },
  { id: "paste", label: "Paste description", icon: Clipboard, hint: "Drop in the text of the job description." },
  { id: "saved", label: "Your jobs", icon: Search, hint: "Something you already saved here." },
  { id: "board", label: "Remote Worldwide", icon: Briefcase, hint: "Listings on our own board." },
];

const FIELD =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-black/35 focus:border-black/40";

const PASTE_FIRST_LINE = "Put the company and the role on the first line, like “Stripe — Support Engineer”, then the description below it.";

/** Why the wizard is running on an unsaved job, in step 1's words. */
const unsavedBecause = (error: unknown) => `We couldn't save this job to your jobs (${apiMessage(error)}), so the warm-intro search is off for it.`;

const withScheme = (input: string) => (/^https?:\/\//i.test(input) ? input : `https://${input}`);

const StartApplication: FC<StartApplicationProps> = ({ onStart }) => {
  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [jd, setJd] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Errors are shown inline here, never as toasts: the note sits where the user is looking.
  const saveJob = useSaveJob({ toastErrors: false });

  const debounced = useDebouncedValue(query);
  const saved = useSavedJobsQuery(debounced, { enabled: mode === "saved" });
  const board = usePlatformJobSearch(debounced, { enabled: mode === "board" });

  function switchMode(next: Mode) {
    setMode(next);
    setNote(null);
    setSelectedId(null);
    setQuery("");
  }

  async function handleLink(e: FormEvent) {
    e.preventDefault();
    const input = url.trim();
    if (!input || busy) return;

    // Free text typed into the link field is a company and a role, not a link.
    if (!looksLikeUrl(input)) {
      const parsed = parseFreeText(input);
      if (!parsed.company || !parsed.role) {
        setNote("That isn't a link. Paste the posting's URL, or type “Company — Role”.");
        return;
      }
      await startFromDraft({ company: parsed.company, role: parsed.role, description: null }, "paste");
      return;
    }

    setBusy(true);
    setNote(null);
    const res = await parseJobUrl(input);
    if (!res.ok) {
      setBusy(false);
      // Never a dead end — fall through to the paste tab with the reason shown.
      setNote(res.reason);
      setMode("paste");
      return;
    }
    try {
      // With the import's id, the saved job is seeded from everything the import read.
      const job = await saveJob.mutateAsync({ importId: res.importId, draft: { company: res.parsed.company, role: res.parsed.role } });
      onStart(fromSavedJob(job, "link"));
    } catch (error) {
      onStart(fromParsed(res.parsed, withScheme(input), "link", unsavedBecause(error)));
    } finally {
      setBusy(false);
    }
  }

  async function startFromDraft(draft: { company: string; role: string; description: string | null }, source: "paste") {
    setBusy(true);
    setNote(null);
    try {
      const job = await saveJob.mutateAsync({ draft: { company: draft.company, role: draft.role, description: draft.description, source } });
      onStart(fromSavedJob(job, source));
    } catch (error) {
      onStart(fromParsed({ company: draft.company, role: draft.role, jdText: draft.description ?? undefined }, null, source, unsavedBecause(error)));
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste(e: FormEvent) {
    e.preventDefault();
    const text = jd.trim();
    if (!text || busy) return;
    // First line is "Company — Role"; everything else is the body. A first line
    // that is not one is refused rather than guessed: an "Untitled company"
    // saved job and application help nobody.
    const [firstLine, ...rest] = text.split("\n");
    const parsed = parseFreeText(firstLine);
    if (!parsed.company || !parsed.role) {
      setNote(PASTE_FIRST_LINE);
      return;
    }
    await startFromDraft({ company: parsed.company, role: parsed.role, description: rest.join("\n").trim() || null }, "paste");
  }

  function startSaved() {
    const job = saved.data?.find((row) => row.id === selectedId);
    if (job) onStart(fromSavedJob(job, "saved"));
  }

  async function startListing() {
    const listing = board.data?.find((row) => row.id === selectedId);
    if (!listing || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const job = await saveJob.mutateAsync({ platformJobId: listing.id });
      onStart(fromSavedJob(job, "board"));
    } catch (error) {
      setNote(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <h2 className="text-2xl font-bold text-primary">What are you applying to?</h2>
      <p className="mt-1.5 text-sm text-black/50">
        Bring the job in any shape — we&apos;ll pull out the company, the role and the description, and keep it in your jobs.
      </p>

      {/* Mode picker */}
      <div className="mt-6 flex flex-wrap gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              onClick={() => switchMode(m.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-[transform,box-shadow,background-color] duration-100 ease-out cursor-pointer",
                active
                  ? "border-[#222325] bg-[#222325] text-white shadow-[2px_2px_0_0_#e1f073]"
                  : "border-black/15 bg-white text-black/60 hover:border-[#222325] hover:text-primary",
                "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
              )}>
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      <DashCard className="mt-4 p-6">
        <p className="mb-4 text-xs text-black/45">{MODES.find((m) => m.id === mode)?.hint}</p>

        {note && (
          <p role="status" className="mb-4 rounded-md border border-black/15 bg-[#fbfbf7] px-3 py-2 text-xs text-black/60">
            {note}
          </p>
        )}

        {mode === "link" && (
          <form onSubmit={handleLink}>
            <label className="sr-only" htmlFor="apply-link">
              Job link
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
                <input
                  id="apply-link"
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://jobs.lever.co/…"
                  className={cn(FIELD, "pl-9")}
                />
              </div>
              <StickerButton variant="primary" size="md" type="submit" disabled={!url.trim() || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? "Reading" : "Start"}
              </StickerButton>
            </div>
          </form>
        )}

        {mode === "paste" && (
          <form onSubmit={handlePaste}>
            <label className="sr-only" htmlFor="apply-jd">
              Job description
            </label>
            <textarea
              id="apply-jd"
              autoFocus
              rows={8}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={"Stripe — Support Engineer\n\nPaste the rest of the description here…"}
              className={cn(FIELD, "resize-y leading-relaxed")}
            />
            <div className="mt-3 flex items-center gap-3">
              <StickerButton variant="primary" size="md" type="submit" disabled={!jd.trim() || busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Start
              </StickerButton>
              <span className="text-xs text-black/40">First line is read as company and role.</span>
            </div>
          </form>
        )}

        {(mode === "saved" || mode === "board") && (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/30" />
              <label className="sr-only" htmlFor="apply-search">
                Search
              </label>
              <input
                id="apply-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedId(null);
                }}
                placeholder={mode === "saved" ? "Search your jobs by company or role…" : "Search Remote Worldwide listings…"}
                className={cn(FIELD, "pl-9")}
              />
            </div>

            {mode === "saved" ? (
              <JobList
                loading={saved.isPending}
                error={saved.isError ? apiMessage(saved.error) : null}
                empty={debounced.trim() ? `Nothing in your jobs matches “${debounced.trim()}”.` : "No saved jobs yet. Start from a link or a pasted description instead."}
                rows={(saved.data ?? []).map((job) => savedRow(job))}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <JobList
                loading={board.isPending}
                error={board.isError ? apiMessage(board.error) : null}
                empty={debounced.trim() ? `No listings match “${debounced.trim()}”.` : "No listings on the board right now."}
                rows={(board.data ?? []).map((listing) => listingRow(listing))}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            <div>
              <StickerButton
                variant="primary"
                size="md"
                disabled={!selectedId || busy}
                onClick={() => (mode === "saved" ? startSaved() : void startListing())}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Start
              </StickerButton>
            </div>
          </div>
        )}
      </DashCard>
    </div>
  );
};

interface JobRow {
  id: string;
  title: string;
  meta: string;
  rww: boolean;
}

const savedRow = (job: SavedJobItem): JobRow => ({
  id: job.id,
  title: job.role || "Role not named",
  meta: [job.company, job.location, job.salary].filter(Boolean).join(" · "),
  rww: job.source === "platform",
});

const listingRow = (listing: PlatformJobSearchItem): JobRow => ({
  id: listing.id,
  title: listing.role,
  meta: [listing.company, listing.seniority, listing.regions.slice(0, 2).join(", ")].filter(Boolean).join(" · "),
  rww: true,
});

const JobList: FC<{
  loading: boolean;
  error: string | null;
  empty: string;
  rows: JobRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}> = ({ loading, error, empty, rows, selectedId, onSelect }) => {
  if (loading) {
    return (
      <p role="status" className="inline-flex items-center gap-2 py-3 text-sm text-black/50">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading…
      </p>
    );
  }
  if (error) return <p className="py-3 text-sm text-[#b23c26]">{error}</p>;
  if (rows.length === 0) return <p className="py-3 text-sm text-black/50">{empty}</p>;
  return (
    <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
      {rows.map((row) => {
        const selected = selectedId === row.id;
        return (
          <button
            key={row.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(row.id)}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors cursor-pointer",
              selected ? "border-[#222325] bg-[#f6faea]" : "border-black/12 hover:bg-[#f6f6f6]",
            )}>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-primary">{row.title}</span>
                {row.rww && <LogoMini className="h-3 w-3 flex-none" />}
              </span>
              {row.meta && <span className="block truncate text-xs text-black/45">{row.meta}</span>}
            </span>
            {selected && <Pill variant="positive">Selected</Pill>}
          </button>
        );
      })}
    </div>
  );
};

export default StartApplication;
