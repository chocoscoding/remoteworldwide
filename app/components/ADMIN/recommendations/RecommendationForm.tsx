"use client";

import { useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import type { PlatformJobSearchItem } from "@/app/lib/jobs/types";
import {
  RECOMMENDATION_DEFAULT_EXPIRY_DAYS,
  RECOMMENDATION_NOTE_MAX_CHARS,
  RECOMMENDATION_OUTCOMES,
  RECOMMENDATION_QUESTIONS_MAX,
  RECOMMENDATION_QUESTION_MAX_CHARS,
  RECOMMENDATION_STAGES,
  RECOMMENDATION_STAGE_LABELS,
  type AdminRecommendationItem,
  type RecommendationCandidate,
  type RecommendationCandidateMatch,
  type RecommendationOutcome,
  type RecommendationStage,
} from "@/app/lib/recommendations/types";
import {
  candidateResumeLink,
  createRecommendation,
  deleteRecommendation,
  searchRecommendationCandidates,
  searchRecommendationListings,
  updateRecommendation,
} from "@/libs/recommendations-admin";
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "../blog/OfferTargeting";
import SearchPicker from "./SearchPicker";

/**
 * Create or edit a recommendation — the reviewer's whole tool. The blog-admin
 * shape: a client form over server actions (libs/recommendations-admin.ts)
 * that forward the admin session; the backend's isAdmin is the boundary.
 *
 * Create: pick the candidate by email, optionally a Remote Worldwide listing
 * (fills company, role and the posting link), write the company's questions,
 * the note the candidate sees, and the answer-by date. Edit adds the stage and
 * the outcome, and locks the questions once the candidate has answered.
 */

const BTN_DARK = "drop-shadow-primary2-hover transition-all bg-black text-white border-2 border-primary font-bold rounded-sm px-4 h-10 disabled:opacity-50";
const DAY_MS = 86_400_000;

const OUTCOME_LABELS: Record<RecommendationOutcome, string> = {
  connected: "Connected — they talked",
  passed: "Passed — the company went another direction",
  expired: "Expired — no answer in time",
};

/** `YYYY-MM-DD` for a date input, in the admin's own timezone. */
const dateInput = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The date input's value `days` from now. Only ever called from a click or a submit, never while rendering. */
const daysFromNow = (days: number): string => dateInput(new Date(Date.now() + days * DAY_MS));

/** A date input's day as the END of that day locally — "answer by the 30th" includes the 30th. */
const endOfDayIso = (day: string): string | null => {
  if (!day) return null;
  const d = new Date(`${day}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

type QuestionDraft = { key: string; id: string | null; question: string };

/** A picked candidate carries its eligibility; one loaded with an existing recommendation does not. */
const isMatch = (c: RecommendationCandidate | RecommendationCandidateMatch | null): c is RecommendationCandidateMatch =>
  Boolean(c && "eligible" in c);

let draftSeq = 0;
const newKey = () => `q-${(draftSeq += 1)}`;

const RecommendationForm: FC<{ initial?: AdminRecommendationItem }> = ({ initial }) => {
  const router = useRouter();
  const editing = Boolean(initial);
  const locked = Boolean(initial?.answeredAt);

  const [candidate, setCandidate] = useState<RecommendationCandidate | RecommendationCandidateMatch | null>(initial?.candidate ?? null);
  const [platformJobId, setPlatformJobId] = useState<string | null>(initial?.platformJobId ?? null);
  const [listingLabel, setListingLabel] = useState<string | null>(initial?.platformJobId ? `${initial.company} — ${initial.role}` : null);
  const [company, setCompany] = useState(initial?.company ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [jobUrl, setJobUrl] = useState(initial?.jobUrl ?? "");
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    // Existing questions key on their own ids; new rows get one in the click handler.
    (initial?.questions ?? []).map((q) => ({ key: q.id, id: q.id, question: q.question })),
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [reviewerName, setReviewerName] = useState(initial?.reviewer.name ?? "");
  const [expiry, setExpiry] = useState(dateInput(initial?.expiresAt));
  // Untouched on create, a form with questions gets the default window on save.
  const [expiryTouched, setExpiryTouched] = useState(editing);
  const [stage, setStage] = useState<RecommendationStage>(initial?.stage ?? "reviewed");
  const [outcome, setOutcome] = useState<RecommendationOutcome | "">(initial?.outcome ?? "");
  const [busy, setBusy] = useState(false);

  const setExpiryIn = (days: number | null) => {
    setExpiryTouched(true);
    setExpiry(days === null ? "" : daysFromNow(days));
  };

  const pickListing = (job: PlatformJobSearchItem) => {
    setPlatformJobId(job.id);
    setListingLabel(`${job.company} — ${job.role}`);
    setCompany(job.company);
    setRole(job.role);
    // The backend links our own listing page when the posting link is left empty.
    if (!editing) setJobUrl("");
  };

  /**
   * Opens the candidate's master resume. The tab opens before the await, since
   * a popup blocker only trusts a window opened straight out of the click; the
   * signed link is minted per click and never kept.
   */
  const readResume = async () => {
    if (!candidate) return;
    const tab = window.open("", "_blank");
    try {
      const link = await candidateResumeLink(candidate.id);
      if (!link) {
        tab?.close();
        toast.error("They have no master resume yet.");
        return;
      }
      if (tab) tab.location.href = link.url;
      else window.open(link.url, "_blank", "noopener,noreferrer");
    } catch {
      tab?.close();
      toast.error("That resume could not be opened. Try again.");
    }
  };

  const cleanQuestions = () => questions.map((q) => ({ ...q, question: q.question.trim() })).filter((q) => q.question);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const asked = cleanQuestions();
    if (!editing && !candidate) {
      toast.error("Pick the candidate first.");
      return;
    }
    // The backend refuses this too; saying so here saves filling in the rest first.
    if (!editing && isMatch(candidate) && !candidate.eligible) {
      toast.error(`They can't be put forward yet. Still missing: ${candidate.missing.join(", ")}.`);
      return;
    }
    if (!company.trim() || !role.trim()) {
      toast.error("Say which company and role — or pick a listing.");
      return;
    }
    if (jobUrl.trim() && !/^https?:\/\//i.test(jobUrl.trim())) {
      toast.error("The posting link must start with https://");
      return;
    }
    const day = !expiryTouched && asked.length > 0 && !expiry ? daysFromNow(RECOMMENDATION_DEFAULT_EXPIRY_DAYS) : expiry;
    const expiresAt = endOfDayIso(day);

    setBusy(true);
    try {
      const result =
        initial === undefined
          ? await createRecommendation({
              candidateId: candidate!.id,
              company: company.trim(),
              role: role.trim(),
              platformJobId,
              jobUrl: jobUrl.trim() || null,
              questions: asked.map((q) => q.question),
              note: note.trim() || null,
              expiresAt,
              reviewerName: reviewerName.trim() || null,
            })
          : await updateRecommendation(initial.id, {
              company: company.trim(),
              role: role.trim(),
              platformJobId,
              jobUrl: jobUrl.trim() || null,
              ...(locked ? {} : { questions: asked.map((q) => ({ id: q.id, question: q.question })) }),
              note: note.trim() || null,
              reviewerName: reviewerName.trim() || null,
              // Only what moved. Resending an unchanged outcome would re-stamp
              // when it closed; an unchanged stage would stop the server moving
              // Reviewed to Their questions when questions are added; and a
              // date the admin never touched would round its time to the day.
              ...(expiry !== dateInput(initial.expiresAt) ? { expiresAt } : {}),
              ...(stage !== initial.stage ? { stage } : {}),
              ...((outcome || null) !== initial.outcome ? { outcome: outcome || null } : {}),
            });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Recommendation saved" : `${candidate?.name ?? candidate?.email ?? "The candidate"} is in front of ${company.trim()}`);
      router.push("/heroshima/recommendations");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial || !window.confirm(`Delete this recommendation to ${initial.company}? The candidate stops seeing it. Credits already paid stay paid.`)) return;
    setBusy(true);
    try {
      const result = await deleteRecommendation(initial.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        setBusy(false);
        return;
      }
      toast.success("Deleted");
      router.push("/heroshima/recommendations");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      {/* Who */}
      <section className="rounded-md border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-primary">Candidate</p>
        {candidate ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary">{candidate.name ?? "No name on the account"}</p>
                <p className="truncate text-xs text-gray-500">{candidate.email}</p>
              </div>
              <div className="flex items-center gap-3">
                {(!isMatch(candidate) || candidate.masterResume) && (
                  <button type="button" onClick={() => void readResume()} className="text-xs font-semibold text-gray-600 underline">
                    Read master resume
                  </button>
                )}
                {!editing && (
                  <button type="button" onClick={() => setCandidate(null)} className="text-xs font-semibold text-gray-600 underline">
                    Change
                  </button>
                )}
              </div>
            </div>
            {!editing && isMatch(candidate) && !candidate.eligible && (
              <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">
                Not eligible yet — reviewers only put forward complete profiles with a master resume. Still missing: {candidate.missing.join(", ")}.
              </p>
            )}
          </div>
        ) : editing ? (
          <p className="text-sm text-gray-500">This account no longer exists.</p>
        ) : (
          <SearchPicker<RecommendationCandidateMatch>
            label="Find by email"
            placeholder="name@example.com"
            hint="Type two or more characters of their email or name. Only complete profiles with a master resume can be put forward."
            search={searchRecommendationCandidates}
            keyOf={(u) => u.id}
            render={(u) => (
              <>
                <span className="font-semibold">{u.email ?? u.id}</span>
                {u.name && <span className="ml-2 text-gray-500">{u.name}</span>}
                <span className={`mt-0.5 block text-xs ${u.eligible ? "text-green-700" : "text-red-600"}`}>
                  {u.eligible ? "Eligible" : `Missing: ${u.missing.join(", ")}`}
                </span>
              </>
            )}
            onPick={setCandidate}
          />
        )}
      </section>

      {/* Where */}
      <section className="space-y-4 rounded-md border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-primary">Company and role</p>
        {listingLabel ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 p-3">
            <p className="min-w-0 truncate text-sm">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Listing</span> {listingLabel}
            </p>
            <button
              type="button"
              onClick={() => {
                setPlatformJobId(null);
                setListingLabel(null);
              }}
              className="text-xs font-semibold text-gray-600 underline">
              Unlink listing
            </button>
          </div>
        ) : (
          <SearchPicker<PlatformJobSearchItem>
            label="Remote Worldwide listing (optional)"
            placeholder="Search our live listings by title or company"
            hint="Picking one fills the company and role, and links the candidate to our listing page."
            search={searchRecommendationListings}
            keyOf={(j) => j.id}
            render={(j) => (
              <>
                <span className="font-semibold">{j.role}</span>
                <span className="ml-2 text-gray-500">{j.company}</span>
              </>
            )}
            onPick={pickListing}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL}>Company</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className={ADMIN_INPUT} placeholder="Linear" />
          </div>
          <div>
            <label className={ADMIN_LABEL}>Role</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} className={ADMIN_INPUT} placeholder="Senior Product Designer" />
          </div>
        </div>
        <div>
          <label className={ADMIN_LABEL}>Posting link (optional)</label>
          <input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} className={ADMIN_INPUT} placeholder="https://linear.app/careers/…" />
          <p className={ADMIN_HINT}>Leave empty with a listing picked and it links our own listing page.</p>
        </div>
      </section>

      {/* What the company asked */}
      <section className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-primary">The company&apos;s questions</p>
          <p className={ADMIN_HINT}>
            {locked
              ? "The candidate has answered, so these are locked — the answers are to exactly these questions."
              : "A question or two. Leave empty until the company asks — adding them later moves it to “Their questions” and tells the candidate."}
          </p>
        </div>
        {questions.map((q, i) => (
          <div key={q.key} className="flex items-start gap-2">
            <span className="mt-3 w-5 flex-none text-right text-xs font-bold text-gray-400 tabular-nums">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <textarea
                value={q.question}
                disabled={locked}
                maxLength={RECOMMENDATION_QUESTION_MAX_CHARS}
                onChange={(e) => setQuestions((prev) => prev.map((row) => (row.key === q.key ? { ...row, question: e.target.value } : row)))}
                className={`${ADMIN_INPUT} disabled:bg-gray-50`}
                rows={2}
                placeholder="Walk us through a system you owned end to end — what broke, and what did you change?"
              />
              {locked && initial?.questions.find((row) => row.id === q.id)?.answer && (
                <p className="mt-1 whitespace-pre-line rounded-md bg-[#fbfbf7] p-2 text-sm text-gray-700">
                  {initial.questions.find((row) => row.id === q.id)?.answer}
                </p>
              )}
            </div>
            {!locked && (
              <button
                type="button"
                onClick={() => setQuestions((prev) => prev.filter((row) => row.key !== q.key))}
                className="mt-2 text-xs text-red-600 underline">
                Remove
              </button>
            )}
          </div>
        ))}
        {!locked && questions.length < RECOMMENDATION_QUESTIONS_MAX && (
          <button
            type="button"
            onClick={() => setQuestions((prev) => [...prev, { key: newKey(), id: null, question: "" }])}
            className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-black">
            + Add a question
          </button>
        )}
      </section>

      {/* The reviewer's side */}
      <section className="space-y-4 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <label className={ADMIN_LABEL}>Note to the candidate (optional)</label>
          <textarea
            value={note}
            maxLength={RECOMMENDATION_NOTE_MAX_CHARS}
            onChange={(e) => setNote(e.target.value)}
            className={ADMIN_INPUT}
            rows={3}
            placeholder="Why we put you forward: your design-systems depth is the hook — they're rebuilding their component library."
          />
          <p className={ADMIN_HINT}>Shown on their recommendation, signed with the reviewer name below.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL}>Reviewer name they see</label>
            <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} className={ADMIN_INPUT} placeholder="Your account name" />
          </div>
          <div>
            <label className={ADMIN_LABEL}>Answer by</label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => {
                setExpiryTouched(true);
                setExpiry(e.target.value);
              }}
              className={ADMIN_INPUT}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[3, RECOMMENDATION_DEFAULT_EXPIRY_DAYS, 14].map((days) => (
                <button key={days} type="button" onClick={() => setExpiryIn(days)} className="rounded border border-gray-300 px-2 py-0.5 text-[11px] font-semibold hover:border-black">
                  {days} days
                </button>
              ))}
              <button type="button" onClick={() => setExpiryIn(null)} className="rounded border border-gray-300 px-2 py-0.5 text-[11px] font-semibold hover:border-black">
                No deadline
              </button>
            </div>
            <p className={ADMIN_HINT}>
              {!expiryTouched && !expiry
                ? `Defaults to ${RECOMMENDATION_DEFAULT_EXPIRY_DAYS} days when there are questions. Unanswered by then, it closes as expired.`
                : "Unanswered by the end of this day, it closes as expired."}
            </p>
          </div>
        </div>
      </section>

      {editing && (
        <section className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL}>Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value as RecommendationStage)} className={ADMIN_INPUT}>
              {RECOMMENDATION_STAGES.map((s, i) => (
                <option key={s} value={s}>
                  {RECOMMENDATION_STAGE_LABELS[i]}
                </option>
              ))}
            </select>
            <p className={ADMIN_HINT}>Answering moves it to Interview on its own.</p>
          </div>
          <div>
            <label className={ADMIN_LABEL}>Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as RecommendationOutcome | "")} className={ADMIN_INPUT}>
              <option value="">Open — still live</option>
              {RECOMMENDATION_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABELS[o]}
                </option>
              ))}
            </select>
            <p className={ADMIN_HINT}>The candidate never sees the word “rejected”. Reopening an expired one needs a future answer-by date.</p>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" disabled={busy} className={BTN_DARK}>
          {busy ? "Saving…" : editing ? "Save changes" : "Put them forward"}
        </button>
        {editing && (
          <button type="button" onClick={remove} disabled={busy} className="text-sm text-red-600 underline disabled:opacity-50">
            Delete
          </button>
        )}
      </div>
    </form>
  );
};

export default RecommendationForm;
