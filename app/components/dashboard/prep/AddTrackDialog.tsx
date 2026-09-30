"use client";

import { useMemo, useState, type FC, type FormEvent } from "react";
import { ArrowLeft, Briefcase, Import, Kanban, Loader2, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useJobPicker } from "@/app/components/dashboard/jobs/JobPickerProvider";
import { isClosedStatus, statusMeta } from "@/app/components/dashboard/tracker/tracker-meta";
import { apiMessage } from "@/app/lib/api/core";
import type { ApplicationItem, ApplicationStatus, ClosedReason } from "@/app/lib/applications/types";
import { normalizeKey } from "@/app/lib/dashboard/activity";
import type { PrepTrack } from "@/app/lib/dashboard/prep-data";
import { ROUND_TYPE_LABELS, companyMark } from "@/app/lib/prep/tracks";
import {
  PREP_ROUND_TYPES,
  PREP_TRACKER_EARLIER_STAGES,
  PREP_TRACK_LIMITS,
  type CreatePrepTrackInput,
  type PrepRoundType,
  type PrepTrackerEarlierStage,
} from "@/app/lib/prep/types";
import { useApplications } from "@/hooks/queries/useApplicationsQuery";
import { useDebouncedValue, useSavedJobsQuery } from "@/hooks/queries/useJobQueries";
import { BUTTON_OUTLINE, BUTTON_SOLID, FIELD_SHELL, SEGMENT_OFF, SEGMENT_ON, SEGMENT_SHELL } from "./prep-styles";
import TrackMark from "./TrackMark";

export interface AddTrackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Creates the track; rejects with the server's refusal, which the dialog shows in place. */
  onAdd: (input: CreatePrepTrackInput) => Promise<void>;
  /** Opens a track the user already has — where a picked job that already has one goes instead. */
  onOpenTrack: (trackId: string) => void;
  existingTracks: PrepTrack[];
}

type Source = "tracker" | "saved" | "import";

/** What the details step starts from: a picked application or saved job. */
interface Seed {
  company: string;
  role: string;
  location: string;
  applicationId: string | null;
  savedJobId: string | null;
  /** Shown above the form, so it is clear what the track will be linked to. */
  from: string | null;
}

/**
 * What an import asks the picker for. The posting is required because the
 * likely questions are written from it: a link the picker cannot read asks for
 * the posting pasted, rather than making a track with nothing to ground it.
 */
const PREP_JOB_SPEC = "company, role, description, location?";

/** A saved job as the details step starts from it. A pick from "Your jobs" and an import land the same way: every import is saved there. */
const savedJobSeed = (job: { id: string; company: string | null; role: string | null; location: string | null }): Seed => ({
  company: job.company ?? "",
  role: job.role ?? "",
  location: job.location ?? "",
  applicationId: null,
  savedJobId: job.id,
  from: "Questions will be written from this saved job's posting.",
});

/** Where a live loop most likely is, first: interviewing, then talking, then applied. */
const STATUS_ORDER: Partial<Record<ApplicationStatus, number>> = { interviewing: 0, conversation: 1, applied: 2, offer: 3, saved: 4 };

const STATUS_LABEL: Partial<Record<ApplicationStatus, string>> = {
  interviewing: "Interviewing",
  conversation: "In conversation",
  applied: "Applied",
  offer: "Offer",
  saved: "Saved",
};

const LABEL = "block text-[11px] font-bold uppercase tracking-[0.07em] text-black/45 mb-1.5";
const CONTROL = "w-full min-w-0 bg-transparent outline-none text-sm font-semibold text-primary placeholder:text-black/35 placeholder:font-medium";
const INLINE_LINK = "font-bold text-primary underline underline-offset-2 cursor-pointer";

/**
 * The on-ramp for a new prep track, saved to the user's account. Always picked
 * from something real: an application on the tracker (its outcome then moves
 * with the track's rounds), a saved job (its posting grounds the likely
 * questions), or a job imported through the shared job picker — which saves it
 * to "Your jobs", so it carries on exactly as a saved-job pick does. The
 * details step adds the first round, says what adding the track will do on the
 * tracker, and takes the posting for a tracker application that has none.
 */
const AddTrackDialog: FC<AddTrackDialogProps> = ({ open, onOpenChange, onAdd, onOpenTrack, existingTracks }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 gap-0 max-w-[520px] overflow-hidden">
      {/* Mounted only while open, so every opening starts from the picker. */}
      {open && <AddTrackFlow onAdd={onAdd} onOpenTrack={onOpenTrack} existingTracks={existingTracks} onClose={() => onOpenChange(false)} />}
    </DialogContent>
  </Dialog>
);

const AddTrackFlow: FC<Pick<AddTrackDialogProps, "onAdd" | "onOpenTrack" | "existingTracks"> & { onClose: () => void }> = ({
  onAdd,
  onOpenTrack,
  existingTracks,
  onClose,
}) => {
  // Held here rather than in the pick step, so "Pick something else" goes back to the tab the pick came from.
  const [source, setSource] = useState<Source>("tracker");
  const [seed, setSeed] = useState<Seed | null>(null);
  return seed ? (
    <DetailsStep seed={seed} existingTracks={existingTracks} onBack={() => setSeed(null)} onAdd={onAdd} onOpenTrack={onOpenTrack} onClose={onClose} />
  ) : (
    <PickStep source={source} onSource={setSource} existingTracks={existingTracks} onPick={setSeed} />
  );
};

// ---------------------------------------------------------------------------
// Step 1 — where the track comes from
// ---------------------------------------------------------------------------

const PickStep: FC<{ source: Source; onSource: (source: Source) => void; existingTracks: PrepTrack[]; onPick: (seed: Seed) => void }> = ({
  source,
  onSource,
  existingTracks,
  onPick,
}) => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const applications = useApplications({ enabled: source === "tracker" });
  const tracked = useMemo(() => new Set(existingTracks.map((t) => t.saved?.applicationId).filter(Boolean)), [existingTracks]);
  const candidates = useMemo(() => {
    const rows = (applications.data ?? []).filter((row) => STATUS_ORDER[row.status] !== undefined && !tracked.has(row.id));
    return rows
      .filter((row) => !q || `${row.company} ${row.role}`.toLowerCase().includes(q))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
  }, [applications.data, tracked, q]);

  const debounced = useDebouncedValue(query);
  const savedJobs = useSavedJobsQuery(debounced, { enabled: source === "saved" });

  function pickApplication(row: ApplicationItem) {
    onPick({
      company: row.company,
      role: row.role,
      location: row.location ?? "",
      applicationId: row.id,
      savedJobId: row.savedJobId,
      from: `Linked to your tracker: ${row.company} — ${row.role}`,
    });
  }

  const importInstead = (label: string) => (
    <button type="button" onClick={() => onSource("import")} className={INLINE_LINK}>
      {label}
    </button>
  );

  const list = (() => {
    if (source === "import") return null;
    if (source === "tracker") {
      if (applications.isPending) return <ListSkeleton />;
      if (applications.isError) return <ListNote>{apiMessage(applications.error)}</ListNote>;
      if (candidates.length === 0) {
        return (
          <ListNote>
            {q ? (
              "No applications match that search."
            ) : (applications.data ?? []).some((row) => STATUS_ORDER[row.status] !== undefined) ? (
              "Every open application already has a prep track."
            ) : (
              <>No open applications on your tracker. Pick a saved job, or {importInstead("import the job")}.</>
            )}
          </ListNote>
        );
      }
      return candidates.map((row) => (
        <PickRow
          key={row.id}
          mark={companyMark(row.company)}
          logo={row.companyLogo}
          title={`${row.company} — ${row.role}`}
          sub={STATUS_LABEL[row.status] ?? ""}
          onClick={() => pickApplication(row)}
        />
      ));
    }
    if (savedJobs.isPending) return <ListSkeleton />;
    if (savedJobs.isError) return <ListNote>{apiMessage(savedJobs.error)}</ListNote>;
    const jobs = (savedJobs.data ?? []).filter((job) => job.company || job.role);
    if (jobs.length === 0) {
      return <ListNote>{q ? "No saved jobs match that search." : <>No saved jobs yet. {importInstead("Import the job")} instead.</>}</ListNote>;
    }
    return jobs.map((job) => (
      <PickRow
        key={job.id}
        mark={companyMark(job.company ?? "?")}
        logo={job.companyLogo}
        title={[job.company, job.role].filter(Boolean).join(" — ")}
        sub={job.location ?? (job.description ? "Posting saved" : "")}
        onClick={() => onPick(savedJobSeed(job))}
      />
    ));
  })();

  return (
    <>
      <div className="p-6 pb-4">
        <DialogTitle className="text-lg font-bold text-primary">Prep for a new job</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-black/50">
          Pick it from your tracker or your saved jobs, or import it, so its posting and outcome stay connected.
        </DialogDescription>
        <div className={cn(SEGMENT_SHELL, "mt-4")}>
          {(
            [
              ["tracker", "Tracker"],
              ["saved", "Saved jobs"],
              ["import", "Import a job"],
            ] as [Source, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => onSource(id)} className={source === id ? SEGMENT_ON : SEGMENT_OFF}>
              {label}
            </button>
          ))}
        </div>
        {source !== "import" && (
          <div className={cn(FIELD_SHELL, "mt-3")}>
            <Search className="h-3.5 w-3.5 text-black/40 flex-none" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Role or company" className={CONTROL} />
          </div>
        )}
      </div>

      {source === "import" ? <ImportPanel onPick={onPick} /> : <div className="max-h-[320px] overflow-y-auto border-t border-black/8">{list}</div>}
    </>
  );
};

/**
 * A job from anywhere, through the app's one job picker: the Remote Worldwide
 * board, or a pasted link or posting. The picker saves it to "Your jobs" and
 * hands back that saved job, so from here it is a saved-job pick like any other.
 *
 * The picker opens ON TOP of this dialog, as it does over the win log, rather
 * than this dialog closing while it is open. It is built for that: it sits at
 * z-[60] over this z-50, Escape and outside clicks reach only the top dialog
 * (so a click inside it never dismisses this one), and it hands focus back
 * itself — to this button when the pick is cancelled, and, when a pick has
 * replaced this panel with the details step, to this dialog, whose focus trap
 * then holds it. Closing and reopening instead would throw away the open tab,
 * send focus to the page behind, and need a second copy of this flow's state
 * outside the dialog to come back to.
 */
const ImportPanel: FC<{ onPick: (seed: Seed) => void }> = ({ onPick }) => {
  const { pickJob } = useJobPicker();
  const [error, setError] = useState<string | null>(null);

  async function importJob() {
    setError(null);
    try {
      const result = await pickJob(PREP_JOB_SPEC, { title: "Import a job to prep for" });
      if (result.status === "picked") onPick(savedJobSeed(result.job));
    } catch (reason) {
      // A pick rejects only on a picker bug (see JobPickerProvider). Said here
      // rather than in a toast: clicking a toast is an outside click, which
      // would close this dialog.
      setError(apiMessage(reason));
    }
  }

  return (
    <div className="px-6 pb-6 flex flex-col items-start gap-3 border-t border-black/8 pt-5">
      <p className="text-sm text-black/55 leading-relaxed">
        Find it on the Remote Worldwide board, or paste its link or the posting. It&apos;s saved to your jobs, and its likely questions are
        written from the posting.
      </p>
      <button type="button" onClick={importJob} className={BUTTON_SOLID}>
        <Import className="h-3.5 w-3.5" />
        Import a job
      </button>
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};

const PickRow: FC<{ mark: string; logo: string | null; title: string; sub: string; onClick: () => void }> = ({ mark, logo, title, sub, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-6 py-3.5 border-b border-black/6 last:border-b-0 text-left cursor-pointer hover:bg-[#fbfbf7] transition-colors">
    {/* The same mark the track will wear once added, so the pick and the result look alike. */}
    <TrackMark mark={mark} logo={logo} surface="row" />
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold text-primary truncate">{title}</span>
      {sub && <span className="block text-xs text-black/45 truncate">{sub}</span>}
    </span>
  </button>
);

const ListSkeleton: FC = () => (
  <div className="flex flex-col gap-2 p-6" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-10 rounded-lg bg-[#f0f0ea] animate-pulse" />
    ))}
  </div>
);

const ListNote: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
    <span className="h-11 w-11 rounded-full bg-[#f0f0ea] flex items-center justify-center">
      <SearchX className="h-4.5 w-4.5 text-black/35" />
    </span>
    <p className="text-sm text-black/50 leading-relaxed max-w-[300px]">{children}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Step 2 — the details
// ---------------------------------------------------------------------------

/** A `datetime-local` value (local time, no zone) as an ISO timestamp. */
const fromLocalInput = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * What adding the track will do on the tracker, worked out before the user
 * confirms. The server decides for real (prepTrackService `placeOnTracker`)
 * and the page says what it did; this is the same rule over the cached board.
 */
type TrackerPreview =
  | { kind: "checking" }
  /** The board could not be read; said in general terms rather than guessed. */
  | { kind: "unknown" }
  | { kind: "create" }
  | { kind: "move"; from: PrepTrackerEarlierStage }
  /** Interviewing or offer already: nothing to say. */
  | { kind: "stays" }
  | { kind: "closed"; status: ClosedReason }
  | { kind: "tracked"; trackId: string };

const isEarlier = (status: ApplicationStatus): status is PrepTrackerEarlierStage => (PREP_TRACKER_EARLIER_STAGES as readonly string[]).includes(status);

/**
 * A saved job's application, found the way the server finds it
 * (prepTrackService `applicationForSavedJob`): an open one for this saved job;
 * else an open, hand-logged one with the same company and role — the card the
 * tracker's own add answers "Already on your board" with; else a closed one
 * for this saved job. Newest first within each.
 */
function trackerApplicationFor(seed: Seed, rows: readonly ApplicationItem[]): ApplicationItem | null {
  const newestFirst = [...rows].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt) || b.id.localeCompare(a.id));
  const open = (row: ApplicationItem) => !isClosedStatus(row.status);
  const linked = newestFirst.filter((row) => row.savedJobId === seed.savedJobId);
  const key = seed.company.trim() && seed.role.trim() ? normalizeKey(seed.company, seed.role) : null;
  const handLogged = key ? newestFirst.find((row) => !row.savedJobId && open(row) && normalizeKey(row.company, row.role) === key) : undefined;
  return linked.find(open) ?? handLogged ?? linked[0] ?? null;
}

function trackerPreview(seed: Seed, rows: readonly ApplicationItem[], existingTracks: readonly PrepTrack[]): TrackerPreview {
  const application = seed.applicationId ? (rows.find((row) => row.id === seed.applicationId) ?? null) : trackerApplicationFor(seed, rows);
  // A tracker pick the cached board no longer holds: the server knows better.
  if (!application) return seed.applicationId ? { kind: "unknown" } : { kind: "create" };
  const tracked = existingTracks.find((track) => track.saved?.applicationId === application.id);
  if (tracked) return { kind: "tracked", trackId: tracked.id };
  if (isClosedStatus(application.status)) return { kind: "closed", status: application.status };
  if (isEarlier(application.status)) return { kind: "move", from: application.status };
  return { kind: "stays" };
}

/** The preview as one line under the heading. Nothing when nothing on the tracker changes. */
const TrackerNote: FC<{ preview: TrackerPreview }> = ({ preview }) => {
  const text = (() => {
    switch (preview.kind) {
      case "checking":
        return "Checking your tracker…";
      case "create":
        return "Also adds it to your tracker under Interviewing.";
      case "move":
        return `Moves it from ${statusMeta(preview.from).label} to Interviewing on your tracker.`;
      case "closed":
        return `It's marked ${statusMeta(preview.status).label} on your tracker, and stays that way — move it back there if they're interviewing you after all.`;
      case "unknown":
        return "Moves it to Interviewing on your tracker, unless it's already there, further along or closed.";
      default:
        return null;
    }
  })();
  if (!text) return null;
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-black/55">
      {preview.kind === "checking" ? <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" /> : <Kanban className="h-3.5 w-3.5 flex-none" />}
      {text}
    </p>
  );
};

const BackLink: FC<{ onBack: () => void }> = ({ onBack }) => (
  <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-black/50 hover:text-primary cursor-pointer mb-2">
    <ArrowLeft className="h-3.5 w-3.5" />
    Pick something else
  </button>
);

const DetailsStep: FC<{
  seed: Seed;
  existingTracks: PrepTrack[];
  onBack: () => void;
  onAdd: AddTrackDialogProps["onAdd"];
  onOpenTrack: AddTrackDialogProps["onOpenTrack"];
  onClose: () => void;
}> = ({ seed, existingTracks, onBack, onAdd, onOpenTrack, onClose }) => {
  const [company, setCompany] = useState(seed.company);
  const [role, setRole] = useState(seed.role);
  const [location, setLocation] = useState(seed.location);
  const [roundType, setRoundType] = useState<PrepRoundType | "">("");
  const [roundAt, setRoundAt] = useState("");
  const [posting, setPosting] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The preview as it stood when the add was sent. The add's own answer lands
  // in the caches read below — the new track links the application — so a
  // live preview would turn into "You already prep for this job" in the moment
  // before this dialog closes.
  const [sentWith, setSentWith] = useState<TrackerPreview | null>(null);

  // The board PrepProvider already reads, so this is normally a cache hit. A
  // stale copy only makes the note wrong, never the add: the server re-reads.
  const applications = useApplications();
  const preview: TrackerPreview =
    sentWith ??
    (applications.data ? trackerPreview(seed, applications.data, existingTracks) : applications.isError ? { kind: "unknown" } : { kind: "checking" });

  // The job already has a track, so there is nothing to add: open that one. The
  // server would answer an add with it too, but this says so before the user
  // fills in a form it would ignore.
  if (preview.kind === "tracked") {
    return (
      <div>
        <div className="p-6 pb-5">
          <BackLink onBack={onBack} />
          <DialogTitle className="text-lg font-bold text-primary">You already prep for this job</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-black/55">
            {[seed.company, seed.role].filter(Boolean).join(" — ")} has a prep track. Its rounds, questions and sessions are there.
          </DialogDescription>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-black/8 px-6 py-4">
          <button type="button" onClick={onClose} className={BUTTON_OUTLINE}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenTrack(preview.trackId);
              onClose();
            }}
            className={BUTTON_SOLID}>
            Open its track
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!company.trim() || !role.trim()) {
      setError("A track needs a company and a role.");
      return;
    }
    setBusy(true);
    setSentWith(preview);
    setError(null);
    try {
      await onAdd({
        company: company.trim(),
        role: role.trim(),
        location: location.trim() || null,
        applicationId: seed.applicationId,
        savedJobId: seed.savedJobId,
        jobDescription: seed.savedJobId ? null : posting.trim() || null,
        rounds: roundType ? [{ type: roundType, scheduledAt: fromLocalInput(roundAt) }] : [],
      });
      onClose();
    } catch (reason) {
      setError(apiMessage(reason));
      setBusy(false);
      // A failed add may still have moved the card (the server places it before
      // writing the track), so the note goes back to reading the board.
      setSentWith(null);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-6 pb-5 flex flex-col gap-4 max-h-[72vh] overflow-y-auto">
        <div>
          <BackLink onBack={onBack} />
          <DialogTitle className="text-lg font-bold text-primary">The job you&apos;re prepping for</DialogTitle>
          {seed.from && (
            <DialogDescription className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-black/55">
              <Briefcase className="h-3.5 w-3.5 flex-none" />
              {seed.from}
            </DialogDescription>
          )}
          {/* Polite: the line settles from "Checking…" once the board is read. */}
          <div aria-live="polite">
            <TrackerNote preview={preview} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={LABEL}>Company</span>
            <span className={FIELD_SHELL}>
              <input autoFocus={!seed.company} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={PREP_TRACK_LIMITS.companyMax} className={CONTROL} />
            </span>
          </label>
          <label className="block">
            <span className={LABEL}>Role</span>
            <span className={FIELD_SHELL}>
              <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={PREP_TRACK_LIMITS.roleMax} className={CONTROL} />
            </span>
          </label>
        </div>

        <label className="block">
          <span className={LABEL}>Location</span>
          <span className={FIELD_SHELL}>
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={PREP_TRACK_LIMITS.locationMax} placeholder="Remote" className={CONTROL} />
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={LABEL}>First round</span>
            <span className={FIELD_SHELL}>
              <select value={roundType} onChange={(e) => setRoundType(e.target.value as PrepRoundType | "")} className={cn(CONTROL, "cursor-pointer")}>
                <option value="">Nothing booked yet</option>
                {PREP_ROUND_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {ROUND_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className={cn("block", !roundType && "opacity-50")}>
            <span className={LABEL}>When</span>
            <span className={FIELD_SHELL}>
              <input type="datetime-local" disabled={!roundType} value={roundAt} onChange={(e) => setRoundAt(e.target.value)} className={CONTROL} />
            </span>
          </label>
        </div>

        {!seed.savedJobId && (
          <label className="block">
            <span className={LABEL}>Job description (optional)</span>
            <textarea
              value={posting}
              onChange={(e) => setPosting(e.target.value)}
              maxLength={PREP_TRACK_LIMITS.jobDescriptionMax}
              rows={5}
              placeholder="Paste the posting. Likely questions are written from it and your resume — you can add it later too."
              className="w-full resize-y rounded-lg border border-black/15 bg-[#fbfbf7] px-3 py-2 text-sm text-primary outline-none transition-colors focus:border-[#222325] placeholder:text-black/35"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="text-xs font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-black/8 px-6 py-4">
        <button type="button" onClick={onClose} disabled={busy} className={BUTTON_OUTLINE}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={cn(BUTTON_SOLID, "disabled:opacity-50 disabled:pointer-events-none")}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create track
        </button>
      </div>
    </form>
  );
};

export default AddTrackDialog;
