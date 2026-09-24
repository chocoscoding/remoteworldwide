"use client";

import { useId, type FC } from "react";
import { format as formatDate } from "date-fns";
import { CircleCheck, CircleDashed, CircleDot, Quote, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_META, type TranscriptTurn } from "@/app/lib/dashboard/prep-data";
import {
  POSITIONING_AREAS,
  POSITIONING_AREA_LABELS,
  POSITIONING_LEVELS,
  type CompanyValuesState,
  type PositioningArea,
  type PositioningCriterion,
  type PositioningLevel,
  type PositioningSection,
  type PostingUsed,
} from "@/app/lib/voice/types";
import Chip, { type ChipTone } from "../Chip";
import { PANEL } from "../prep-styles";
import AnswerMeta, { useAnswerIndex, type AnswerIndex } from "./AnswerMeta";
import { SectionArrival, SectionNotAnalysed, SectionPending, SectionUnavailable, type SectionsPoll } from "./SectionStates";

/**
 * The Positioning tab: how the answers position the candidate for this role,
 * in the owner's four areas of two criteria each.
 *
 * Nothing here is a score. Each criterion has a level and the candidate's own
 * words behind it; a claim about the role cites the posting it read. "Not
 * enough evidence" is what most criteria say after a short interview, so it
 * reads as calm and useful (what kind of question would show it), never as a
 * failure. The company's values come from the posting and nowhere else: when
 * the posting doesn't state them, the tab says they aren't known.
 */
export interface PositioningPanelProps {
  /** Absent: the session was analysed before Positioning existed. */
  section: PositioningSection | undefined;
  turns: readonly TranscriptTurn[];
  poll?: SectionsPoll;
}

const TITLE = "Positioning";

const PositioningPanel: FC<PositioningPanelProps> = ({ section, turns, poll }) => {
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
        <ReadyPositioning section={section} index={index} />
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
 * white implies nothing. "Not enough evidence" is white on purpose. The glyphs
 * differ in shape (check, dot, triangle, dashed ring) and the word is always
 * written, so colour never carries a level alone.
 */
const LEVEL_META: Record<PositioningLevel, { label: string; tally: (n: number) => string; tone: ChipTone; icon: LucideIcon }> = {
  strong: { label: "Strong", tally: (n) => `${n} strong`, tone: "green", icon: CircleCheck },
  "some-evidence": { label: "Some evidence", tally: (n) => `${n} with some evidence`, tone: "blue", icon: CircleDot },
  concern: { label: "A concern", tally: (n) => `${n} ${n === 1 ? "concern" : "concerns"}`, tone: "red", icon: TriangleAlert },
  "not-enough-evidence": { label: "Not enough evidence yet", tally: (n) => `${n} not enough evidence yet`, tone: "white", icon: CircleDashed },
};

const LevelChip: FC<{ level: PositioningLevel; text?: string }> = ({ level, text }) => {
  const meta = LEVEL_META[level];
  const Icon = meta.icon;
  return (
    <Chip tone={meta.tone}>
      <Icon aria-hidden className="h-3 w-3" strokeWidth={2.5} />
      {text ?? meta.label}
    </Chip>
  );
};

// ---------------------------------------------------------------------------
// Ready
// ---------------------------------------------------------------------------

const LABEL = "text-[10.5px] font-bold uppercase tracking-[0.07em] text-black/45";

const ReadyPositioning: FC<{ section: PositioningSection; index: AnswerIndex }> = ({ section, index }) => {
  const headingId = useId();
  const { criteria } = section;
  const tally = POSITIONING_LEVELS.map((level) => ({ level, n: criteria.filter((c) => c.level === level).length })).filter((t) => t.n > 0);
  const nothingJudged = criteria.length > 0 && criteria.every((c) => c.level === "not-enough-evidence");

  return (
    <>
      <section aria-labelledby={headingId} className={cn(PANEL, "p-6")}>
        <h3 id={headingId} className="text-[14.5px] font-bold text-primary">
          {TITLE}
        </h3>
        <p className="mt-1 max-w-[600px] text-sm leading-relaxed text-black/55">
          How your answers position you for this role, one criterion at a time. Each level rests on your own words, quoted below. None of it is a score.
        </p>
        {nothingJudged && (
          <p className="mt-3 max-w-[600px] text-sm leading-relaxed text-black/70">
            Nothing here could be judged yet, which is usual after a short interview. Each criterion names the kind of question that would show it.
          </p>
        )}
        {tally.length > 0 && (
          <ul aria-label="Criteria by level" className="mt-4 flex flex-wrap gap-2">
            {tally.map(({ level, n }) => (
              <li key={level}>
                <LevelChip level={level} text={LEVEL_META[level].tally(n)} />
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-black/10 pt-4 sm:grid-cols-[max-content_1fr]">
          <dt className={cn(LABEL, "sm:pt-0.5")}>Posting read</dt>
          <dd className="min-w-0">
            <PostingRead posting={section.posting} />
          </dd>
          <dt className={cn(LABEL, "sm:pt-0.5")}>Company values</dt>
          <dd className="min-w-0">
            <CompanyValues state={section.companyValues} values={section.statedValues} />
          </dd>
        </dl>
      </section>

      {criteria.length === 0 ? (
        <p className={cn(PANEL, "p-6 text-sm leading-relaxed text-black/55")}>The analysis finished without any criteria to show.</p>
      ) : (
        POSITIONING_AREAS.map((area) => <AreaSection key={area} area={area} criteria={criteria.filter((c) => c.area === area)} posting={section.posting} index={index} />)
      )}
    </>
  );
};

/** When the posting was read, if the service recorded a real time (a missing one arrives as the epoch). */
function readWhen(readAt: string): string | null {
  const ms = Date.parse(readAt);
  return Number.isFinite(ms) && ms > 0 ? formatDate(new Date(ms), "d MMM yyyy 'at' HH:mm") : null;
}

/**
 * Which posting the criteria were read against, and when: postings change
 * after a session, so this is the version behind the citations. The numbered
 * requirements are listed so a "#3" below can be looked up.
 */
const PostingRead: FC<{ posting: PostingUsed | null }> = ({ posting }) => {
  const text = "text-sm leading-relaxed text-black/65";
  if (!posting) return <p className={text}>Not read. Too little was said in this interview to compare with it.</p>;
  const when = readWhen(posting.readAt);
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
              <summary className="w-fit cursor-pointer rounded text-xs font-bold text-primary hover:text-[#55591f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2">
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
                <li key={i} className="rounded-md border border-black/12 bg-[#fbfbf7] px-2 py-1 text-xs text-primary">
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
  <span className="flex-none rounded-md border border-black/15 bg-white px-1.5 py-0.5 text-[10.5px] font-bold leading-none tabular-nums text-primary">
    <span aria-hidden>#{n}</span>
    <span className="sr-only">Requirement {n}:</span>
  </span>
);

// ---------------------------------------------------------------------------
// Areas and criteria
// ---------------------------------------------------------------------------

const AreaSection: FC<{ area: PositioningArea; criteria: readonly PositioningCriterion[]; posting: PostingUsed | null; index: AnswerIndex }> = ({
  area,
  criteria,
  posting,
  index,
}) => {
  const headingId = useId();
  if (criteria.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className={cn(PANEL, "overflow-hidden")}>
      <h4 id={headingId} className="border-b border-black/10 px-5 py-4 text-[14.5px] font-bold text-primary sm:px-6">
        {POSITIONING_AREA_LABELS[area]}
      </h4>
      <div className="divide-y divide-black/10">
        {criteria.map((criterion) => (
          <Criterion key={criterion.id} criterion={criterion} posting={posting} index={index} />
        ))}
      </div>
    </section>
  );
};

const Criterion: FC<{ criterion: PositioningCriterion; posting: PostingUsed | null; index: AnswerIndex }> = ({ criterion: c, posting, index }) => (
  <article className="px-5 py-5 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <h5 className="text-sm font-bold text-primary">{c.label}</h5>
      <LevelChip level={c.level} />
    </div>
    <p className="mt-1.5 max-w-[640px] text-sm leading-relaxed text-black/60">{c.note}</p>

    {c.evidence.length > 0 && (
      <div className="mt-3.5">
        <p className={LABEL}>In your words</p>
        <ul className="mt-2 flex flex-col gap-2">
          {c.evidence.map((quote, i) => (
            <li key={`${quote.turnId}-${i}`} className="rounded-xl border border-black/10 p-3.5">
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

    {c.level === "not-enough-evidence" && <Probe criterion={c} posting={posting} />}
  </article>
);

/**
 * For a criterion with no evidence: the kind of question that would give it
 * some. The note above already says why there is none; when that is the
 * posting rather than the answers, the question comes with what it needs
 * first, since no answer can make up for a posting that wasn't there.
 */
const Probe: FC<{ criterion: PositioningCriterion; posting: PostingUsed | null }> = ({ criterion: { gap, probe }, posting }) => {
  const lead =
    gap === "no-posting"
      ? posting?.source === "unavailable"
        ? "With the posting read, a question like this would show it:"
        : "Add the job posting to this track, and then a question like this would show it:"
      : gap === "values-not-stated"
        ? "Against a posting that states the company's values, a question like this would show it:"
        : "A question like this would show it:";
  const example = probe.example.trim();
  return (
    <div className="mt-3.5 rounded-xl border border-dashed border-black/20 bg-[#fbfbf7] p-3.5">
      <p className={LABEL}>What would show this</p>
      {example && (
        <p className="mt-1.5 text-sm leading-relaxed text-black/70">
          {lead} <span className="text-primary">“{example}”</span>
        </p>
      )}
      <p className="mt-1.5 text-[11.5px] text-black/50">
        {probe.kind.trim() && <>{probe.kind.trim()} · </>}
        {FORMAT_META[probe.format].label} question
      </p>
    </div>
  );
};
