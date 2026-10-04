"use client";

import { useId, useState, type FC } from "react";
import { format as formatDate } from "date-fns";
import { ChevronDown, CircleCheck, CircleDashed, CircleDot, Quote, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import type { PracticeQuestion } from "@/app/lib/prep/practice";
import {
  POSITIONING_LEVELS,
  type CompanyValuesState,
  type PositioningCriterion,
  type PositioningLevel,
  type PositioningSection,
  type PostingUsed,
} from "@/app/lib/voice/types";
import Chip, { type ChipTone } from "../Chip";
import AnswerMeta, { useAnswerIndex, type AnswerIndex } from "./AnswerMeta";
import Disclosure from "./Disclosure";
import { criteriaToPractise, criterionQuestion } from "./practiceSets";
import { listOf } from "./reportScales";
import { SectionArrival, SectionNotAnalysed, SectionPending, SectionUnavailable, type SectionsPoll } from "./SectionStates";

/**
 * The Positioning tab: how the answers position the candidate for this role,
 * criterion by criterion, and a question to practise for each.
 *
 * Nothing here is a score. Each criterion has a level and the candidate's own
 * words behind it; a claim about the role cites the posting it read. "Not
 * shown yet" is what most criteria say after a short interview, so it reads
 * as calm and useful (here is a question that would show it, practise it now),
 * never as a failure. The company's values come from the posting and nowhere
 * else: when the posting doesn't state them, the tab says they aren't known.
 */
export interface PositioningPanelProps {
  /** Absent: the session was analysed before Positioning existed. */
  section: PositioningSection | undefined;
  turns: readonly TranscriptTurn[];
  poll?: SectionsPoll;
  /** Starts a practice session on these questions; without it, no practice button shows. */
  onPractise?: (questions: PracticeQuestion[]) => void;
}

const TITLE = "Positioning";

const PositioningPanel: FC<PositioningPanelProps> = ({ section, turns, poll, onPractise }) => {
  const index = useAnswerIndex(turns);
  return (
    <>
      <SectionArrival title={TITLE} status={section?.status} />
      {!section ? (
        <SectionNotAnalysed
          title={TITLE}
          body="Not analysed. This session was analysed before Positioning existed, so it doesn't have one. Every session you run from now on includes it."
        />
      ) : section.status === "pending" ? (
        <SectionPending title={TITLE} what="Reading your answers against the role, criterion by criterion." poll={poll} />
      ) : section.status === "unavailable" ? (
        <SectionUnavailable title={TITLE} failure={section.failure} />
      ) : (
        <ReadyPositioning section={section} index={index} onPractise={onPractise} />
      )}
    </>
  );
};

export default PositioningPanel;

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/**
 * Each level's word, tone and glyph. The tones are the prep Chip's, whose
 * colour means outcome: green went well, blue is information, red went badly,
 * white implies nothing. "Not shown yet" is white on purpose. The glyphs
 * differ in shape (check, dot, triangle, dashed ring) and the word is always
 * written, so colour never carries a level alone.
 */
const LEVEL_META: Record<PositioningLevel, { label: string; tally: (n: number) => string; tone: ChipTone; icon: LucideIcon; segment: string }> = {
  strong: { label: "Strong", tally: (n) => `${n} strong`, tone: "green", icon: CircleCheck, segment: "bg-[#222325]" },
  "some-evidence": { label: "Some evidence", tally: (n) => `${n} with some evidence`, tone: "blue", icon: CircleDot, segment: "border border-[#222325] bg-[#e1f073]" },
  concern: { label: "A concern", tally: (n) => `${n} ${n === 1 ? "concern" : "concerns"}`, tone: "red", icon: TriangleAlert, segment: "bg-[#e5533d]" },
  "not-enough-evidence": { label: "Not shown yet", tally: (n) => `${n} not shown yet`, tone: "white", icon: CircleDashed, segment: "border border-dashed border-black/50" },
};

const LevelBadge: FC<{ level: PositioningLevel }> = ({ level }) => {
  const meta = LEVEL_META[level];
  const Icon = meta.icon;
  return (
    <Chip tone={meta.tone} className="px-2 py-0.5 text-[10.5px]">
      <Icon aria-hidden className="h-3 w-3" strokeWidth={2.5} />
      {meta.label}
    </Chip>
  );
};

// ---------------------------------------------------------------------------
// Ready
// ---------------------------------------------------------------------------

const LABEL = "text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/45";

const ReadyPositioning: FC<{ section: PositioningSection; index: AnswerIndex; onPractise?: (questions: PracticeQuestion[]) => void }> = ({
  section,
  index,
  onPractise,
}) => {
  const listId = useId();
  const { criteria } = section;
  return (
    <>
      {criteria.length === 0 ? (
        <p className="rounded-[14px] border border-black/[0.16] bg-white px-5 py-4 text-sm leading-relaxed text-black/55">The analysis finished without any criteria to show.</p>
      ) : (
        <>
          <Summary criteria={criteria} onPractise={onPractise} />
          <section aria-labelledby={listId} className="overflow-hidden rounded-[14px] border border-black/[0.16] bg-white">
            <h2 id={listId} className="px-[18px] py-3.5 text-[15px] font-extrabold text-[#222325]">
              A question to practise for each
            </h2>
            <ul>
              {criteria.map((criterion) => (
                <CriterionRow key={criterion.id} criterion={criterion} index={index} onPractise={onPractise} />
              ))}
            </ul>
          </section>
        </>
      )}

      <Disclosure standalone title="What your answers are read against" summary={readAgainstSummary(section)}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 pt-1 sm:grid-cols-[max-content_1fr]">
          <dt className={cn(LABEL, "sm:pt-0.5")}>Posting read</dt>
          <dd className="min-w-0">
            <PostingRead posting={section.posting} />
          </dd>
          <dt className={cn(LABEL, "sm:pt-0.5")}>Company values</dt>
          <dd className="min-w-0">
            <CompanyValues state={section.companyValues} values={section.statedValues} />
          </dd>
        </dl>
      </Disclosure>
    </>
  );
};

/**
 * The featured card: how many criteria this interview showed anything on,
 * one segment each, and one button to practise every one not yet strong.
 */
const Summary: FC<{ criteria: readonly PositioningCriterion[]; onPractise?: (questions: PracticeQuestion[]) => void }> = ({ criteria, onPractise }) => {
  const total = criteria.length;
  const shown = criteria.filter((c) => c.level !== "not-enough-evidence").length;
  const toPractise = criteriaToPractise(criteria);
  const tally = listOf(
    POSITIONING_LEVELS.filter((level) => level !== "not-enough-evidence")
      .map((level) => ({ level, n: criteria.filter((c) => c.level === level).length }))
      .filter((t) => t.n > 0)
      .map(({ level, n }) => LEVEL_META[level].tally(n))
  );
  const headline =
    shown === 0
      ? `None of the ${total} criteria came up in this interview`
      : shown === total
        ? `All ${total} criteria came up in this interview`
        : `${shown} of the ${total} criteria came up in this interview`;
  const sub =
    shown === 0
      ? "Nothing you said showed these either way. Practise a question below to fill one in. None of it is a score."
      : shown === total
        ? `${capitalise(tally)}. None of it is a score.`
        : `${capitalise(tally)}. Practise a question below to show the rest. None of it is a score.`;
  const practiseLabel = toPractise.length === 1 ? "Practise it now" : `Practise all ${toPractise.length} in one session`;

  return (
    <section aria-label="Positioning summary" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] bg-white px-5 py-4 br-bold br-lime">
      <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-0.5">
        <h2 className="text-lg font-extrabold leading-snug tracking-[-0.01em] text-[#222325]">{headline}</h2>
        <p className="text-[13px] text-[#55564f]">{sub}</p>
      </div>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <div role="img" aria-label={`${shown} of ${total} criteria shown`} className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {criteria.map((c) => (
              <span key={c.id} className={cn("h-2 rounded-[2px]", LEVEL_META[c.level].segment)} />
            ))}
          </div>
          <span aria-hidden className="flex-none text-xs font-extrabold tabular-nums text-[#222325]">
            {shown} of {total}
          </span>
        </div>
        {onPractise && toPractise.length > 0 && (
          <button
            type="button"
            onClick={() => onPractise(toPractise)}
            className="inline-flex h-9 items-center justify-center rounded-lg border-[1.5px] border-[#222325] bg-[#e1f073] px-3 text-[13px] font-extrabold text-[#222325] br-shadow-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#222325] focus-visible:ring-offset-2">
            {practiseLabel}
          </button>
        )}
      </div>
    </section>
  );
};

const capitalise = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** One criterion: its name and level, the question that would show it, and its notes and evidence a click away. */
const CriterionRow: FC<{ criterion: PositioningCriterion; index: AnswerIndex; onPractise?: (questions: PracticeQuestion[]) => void }> = ({
  criterion: c,
  index,
  onPractise,
}) => {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const question = criterionQuestion(c);
  return (
    <li className="border-t border-black/[0.12]">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1.5 px-[18px] py-2">
        <span className="flex min-w-0 flex-[0_0_220px] flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-extrabold text-[#222325]">{c.label}</span>
          <LevelBadge level={c.level} />
        </span>
        <span className="min-w-0 flex-[999_1_320px] text-[13px] text-[#44453f]">{question ? `“${question.text}”` : c.note}</span>
        <span className="flex flex-none items-center gap-1">
          {onPractise && question && (
            <button
              type="button"
              onClick={() => onPractise([question])}
              aria-label={`Practise: ${question.text}`}
              className="inline-flex h-[30px] cursor-pointer items-center rounded-lg border border-[#222325] bg-white px-3 text-xs font-extrabold text-[#222325] transition-colors hover:bg-[#f6faea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-1">
              Practise
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`${open ? "Hide" : "Show"} the notes on ${c.label}`}
            className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md text-[#5f6062] hover:bg-black/5 hover:text-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
            <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
          </button>
        </span>
      </div>
      <div id={detailId} hidden={!open} className="bg-[#fbfbf7] px-[18px] pb-4 pt-3">
        <CriterionDetail criterion={c} index={index} />
      </div>
    </li>
  );
};

/** What the evidence shows, or why there is none, in the candidate's own words and the posting's. */
const CriterionDetail: FC<{ criterion: PositioningCriterion; index: AnswerIndex }> = ({ criterion: c, index }) => (
  <div className="max-w-[760px]">
    <p className="text-sm leading-relaxed text-black/65">{c.note}</p>
    {c.probe.kind.trim() && (
      <p className="mt-1.5 text-xs leading-relaxed text-black/55">
        <span className="font-bold text-black/65">What would show it: </span>
        {c.probe.kind}
      </p>
    )}

    {c.evidence.length > 0 && (
      <div className="mt-3.5">
        <p className={LABEL}>In your words</p>
        <ul className="mt-2 flex flex-col gap-2">
          {c.evidence.map((quote, i) => (
            <li key={`${quote.turnId}-${i}`} className="rounded-xl border border-black/10 bg-white p-3.5">
              <AnswerMeta index={index} turnId={quote.turnId} question={quote.question} atMs={quote.atMs} endMs={quote.endMs} />
              <blockquote className="mt-2 flex gap-2 text-sm leading-relaxed text-black/75">
                <Quote aria-hidden className="mt-1 h-3.5 w-3.5 flex-none text-black/25" />
                <span className="italic">{quote.quote}</span>
              </blockquote>
            </li>
          ))}
        </ul>
      </div>
    )}

    {c.posting.length > 0 && (
      <div className="mt-3.5">
        <p className={LABEL}>From the posting</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {c.posting.map((cite, i) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-black/60">
              {cite.requirement !== null ? (
                <RequirementTag n={cite.requirement} />
              ) : (
                <span className="flex-none rounded-md border border-black/15 bg-white px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-black/55">
                  <span aria-hidden>Line</span>
                  <span className="sr-only">A line of the posting:</span>
                </span>
              )}
              <span className="min-w-0">{cite.requirement === null ? `“${cite.text}”` : cite.text}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// What the answers are read against
// ---------------------------------------------------------------------------

/** When the posting was read, if the service recorded a real time (a missing one arrives as the epoch). */
function readAt(readAtIso: string, pattern: string): string | null {
  const ms = Date.parse(readAtIso);
  return Number.isFinite(ms) && ms > 0 ? formatDate(new Date(ms), pattern) : null;
}

/** "The posting as of 4 Oct 2026 · 15 requirements · company values": the closed row's summary. */
function readAgainstSummary(section: PositioningSection): string {
  const posting = section.posting;
  const parts: string[] = [];
  if (!posting) parts.push("No posting was read");
  else if (posting.source === "none") parts.push("No posting on this track");
  else if (posting.source === "unavailable") parts.push("The posting couldn't be read");
  else {
    const when = readAt(posting.readAt, "d MMM yyyy");
    parts.push(when ? `The posting as of ${when}` : "The posting");
    if (posting.requirements.length > 0) parts.push(`${posting.requirements.length} ${posting.requirements.length === 1 ? "requirement" : "requirements"}`);
  }
  if (section.companyValues === "stated") parts.push("company values");
  else if (section.companyValues === "not-stated") parts.push("values not stated");
  return parts.join(" · ");
}

/**
 * Which posting the criteria were read against, and when: postings change
 * after a session, so this is the version behind the citations. The numbered
 * requirements are listed so a "#3" above can be looked up.
 */
const PostingRead: FC<{ posting: PostingUsed | null }> = ({ posting }) => {
  const text = "text-sm leading-relaxed text-black/65";
  if (!posting) return <p className={text}>Not read. Too little was said in this interview to compare with it.</p>;
  const when = readAt(posting.readAt, "d MMM yyyy 'at' HH:mm");
  switch (posting.source) {
    case "none":
      return <p className={text}>None. This track has no job posting, so the criteria that need one say so.</p>;
    case "unavailable":
      return <p className={text}>It couldn&apos;t be read when this session was analysed, so the criteria that need it say so.</p>;
    default:
      return (
        <>
          <p className={text}>
            {posting.source === "saved-job" ? "The job saved on this track" : "The posting text saved on this track"}
            {when && <>, as it read on {when}</>}. If the posting has changed since, this is the version behind the citations.
          </p>
          {posting.requirements.length > 0 && (
            <details className="mt-2">
              <summary className="w-fit cursor-pointer rounded text-xs font-bold text-[#222325] hover:text-[#55591f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2">
                The {posting.requirements.length === 1 ? "requirement" : `${posting.requirements.length} requirements`} it was read against
              </summary>
              <ol className="mt-2 flex flex-col gap-1.5">
                {posting.requirements.map((requirement, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-black/60">
                    <RequirementTag n={i + 1} />
                    <span className="min-w-0">{requirement}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      );
  }
};

/**
 * What the posting says the company values. Only the posting is a source, so
 * when it states none (or there was no posting) the values are not known, and
 * the tab says exactly that rather than guessing.
 */
const CompanyValues: FC<{ state: CompanyValuesState | null; values: readonly string[] }> = ({ state, values }) => {
  const text = "text-sm leading-relaxed text-black/65";
  switch (state) {
    case "stated":
      return (
        <>
          <p className={text}>The posting states these. Core Values Match is judged against them and nothing else.</p>
          {values.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {values.map((value, i) => (
                <li key={i} className="rounded-md border border-black/12 bg-[#fbfbf7] px-2 py-1 text-xs text-[#222325]">
                  {value}
                </li>
              ))}
            </ul>
          )}
        </>
      );
    case "not-stated":
      return <p className={text}>Not known. The posting doesn&apos;t state the company&apos;s values, so nothing here assumes what they are.</p>;
    case "no-posting":
      return <p className={text}>Not known. There was no posting to read them from, so nothing here assumes what they are.</p>;
    default:
      return <p className={text}>Not checked. Too little was said in this interview to compare with the posting.</p>;
  }
};

/** "#3" on screen; "Requirement 3" to a screen reader, which reads "#" as "number sign". */
const RequirementTag: FC<{ n: number }> = ({ n }) => (
  <span className="flex-none rounded-md border border-black/15 bg-white px-1.5 py-0.5 text-[10.5px] font-bold leading-none tabular-nums text-[#222325]">
    <span aria-hidden>#{n}</span>
    <span className="sr-only">Requirement {n}:</span>
  </span>
);
