// Interview Prep — types + mock seed data.
//
// Mirrors the mock-data.ts / ats-stub.ts split: this file is pure data (types
// + seed constants), app/lib/dashboard/prep-engine.ts is the pure logic that
// operates on it. Nothing here is shared with any other screen — matches the
// precedent the original prep stub set for itself.
//
// Round dates are computed relative to module-load time (same pattern as
// mock-data.ts's POD_GOALS.proposedAt) rather than hardcoded, so the "in 2
// days" framing never goes stale no matter when the app is opened.

export type SessionFormat = "behavioural" | "portfolio" | "salary";
export type Difficulty = "warm-up" | "standard" | "tough";
export type TrackStatus = "not-started" | "in-progress" | "awaiting-outcome" | "closed";
export type RoundOutcome = "offer" | "rejected" | "waiting" | null;
export type ReadinessStatus = "ready" | "needs-work" | "new";

export const SESSION_LENGTHS = [6, 15, 25] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

export const QUESTIONS_FOR_LENGTH: Record<SessionLength, number> = { 6: 4, 15: 7, 25: 10 };

export const FORMAT_META: Record<SessionFormat, { label: string; sub: string }> = {
  behavioural: { label: "Behavioural", sub: "How you work, told through past projects" },
  portfolio: { label: "Portfolio walkthrough", sub: "One project taken apart in detail" },
  salary: { label: "Salary conversation", sub: "Anchoring and handling pushback" },
};

export interface PanelMember {
  id: string;
  name: string;
  role: string;
  note: string;
  inferred: boolean;
}

export interface LikelyQuestion {
  id: string;
  text: string;
  sub: string;
  status: ReadinessStatus;
  format: SessionFormat;
}

/**
 * One piece of concrete backing for a score or a stat — the user's own words,
 * what to notice about them, and where possible a rewrite of that specific
 * line. This is what turns "Specifics 6.1" from a verdict into something
 * actionable.
 */
export interface EvidenceItem {
  id: string;
  /** The user's own words, verbatim. */
  quote: string;
  /** What to notice about this specific line. */
  note: string;
  /** A concrete rewrite of just this line, where one is worth giving. */
  fix?: string;
  /** The question it answered, for context. */
  question?: string;
}

export interface DimensionScore {
  id: string;
  label: string;
  /** 0-10 */
  score: number;
  note: string;
  /** What to show when this dimension is opened up. */
  evidence: EvidenceItem[];
  /** One line on how to move this specific score. */
  howToImprove: string;
}

export interface LanguageStat {
  id: string;
  label: string;
  value: string;
  good: boolean;
  evidence: EvidenceItem[];
  howToImprove: string;
}

export interface Rewrite {
  id: string;
  question: string;
  /** The user's own typed answer. */
  said: string;
  /** An authored exemplar for this question — not a literal edit of `said`. */
  better: string;
  why: string;
}

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  effortMinutes: number;
  done: boolean;
  source: string;
}

export interface TranscriptTurn {
  id: string;
  who: "ai" | "user";
  text: string;
  questionId?: string;
}

export interface PrepSession {
  id: string;
  trackId: string;
  /** A session can drill more than one format in a single run. */
  formats: SessionFormat[];
  difficulty: Difficulty;
  lengthMinutes: SessionLength;
  /** ISO timestamp. */
  completedAt: string;
  transcript: TranscriptTurn[];
  /** 0-100 */
  overallScore: number;
  dimensions: DimensionScore[];
  languageStats: LanguageStat[];
  rewrites: Rewrite[];
  actionItems: ActionItem[];
  coachNote: string;
  tooShort: boolean;
}

export interface PrepTrack {
  id: string;
  company: string;
  companyMark: string;
  role: string;
  location: string;
  roundLabel: string;
  /** ISO timestamp, or null if nothing's scheduled yet. */
  roundDate: string | null;
  status: TrackStatus;
  panel: PanelMember[];
  questions: LikelyQuestion[];
  sessions: PrepSession[];
  actions: ActionItem[];
  outcome: RoundOutcome;
}

export interface QuestionBankEntry {
  id: string;
  text: string;
  sub: string;
  better: string;
  why: string;
}

// ---------------------------------------------------------------------------
// Question bank — drives both the Hub's "likely questions" list and what a
// live session actually asks. Six per format; a session needing more
// questions than a format has cycles back through the bank (see
// pickQuestionsForSession in prep-engine.ts) rather than requiring a huge
// upfront bank for the 25-minute tier.
// ---------------------------------------------------------------------------

export const QUESTION_BANK: Record<SessionFormat, QuestionBankEntry[]> = {
  behavioural: [
    {
      id: "beh-owned-outcome",
      text: "Walk me through a project where you owned the outcome end-to-end.",
      sub: "Standard opener — almost every panel leads with this",
      better:
        "I led the checkout redesign for eight weeks, end to end. I cut the flow from six steps to two, which took first-payment time from four minutes to ninety seconds, and support tickets on setup dropped 31% in the first month.",
      why: "A decision, a number, and an outcome — not just a description of the work.",
    },
    {
      id: "beh-disagree",
      text: "Tell me about a time you disagreed with a design decision.",
      sub: "Tests whether you can push back without stalling a team",
      better:
        "A PM wanted to ship without usability testing. I ran a three-day guerrilla test with six users on the existing flow, paired the findings with a lightweight redesign, and we shipped a week later with a 14% lift in completed checkouts.",
      why: "Names the disagreement plainly, then resolves it with evidence instead of just describing a feeling.",
    },
    {
      id: "beh-pushback-eng",
      text: "Tell me about a time you pushed back on an engineering constraint.",
      sub: "Wants to hear you reason out loud, not just present a finished call",
      better:
        "Engineering flagged the infinite-scroll list as expensive to paginate correctly. I looked at the actual usage data, saw nobody scrolled past page two anyway, and we shipped simple pagination a week early instead of the fancier version.",
      why: "Shows you changed your mind when the evidence said to — reads as senior, not stubborn.",
    },
    {
      id: "beh-conflict-teammate",
      text: "Describe a conflict with a teammate and how you resolved it.",
      sub: "Follow-up question in about a third of loops",
      better:
        "A senior engineer and I disagreed on how much of the settings redesign to ship at once. We agreed on a two-week trial of my version with a rollback plan if support volume rose — it didn't, and that became our default way of resolving scope disputes.",
      why: "Concrete resolution mechanism, not just \"we talked it out.\"",
    },
    {
      id: "beh-failure",
      text: "Tell me about a project that didn't go the way you planned.",
      sub: "Tests self-awareness more than the failure itself",
      better:
        "I shipped a dashboard redesign based on interviews with five power users, and adoption barely moved — turns out the bulk of usage was from a segment I hadn't talked to. I ran a proper usage-weighted study afterward and it's now how I scope every redesign.",
      why: "Owns the miss specifically and names what changed in the process afterward.",
    },
    {
      id: "beh-async",
      text: "How do you work across time zones with a distributed team?",
      sub: "Common for remote-first companies specifically",
      better:
        "I write decisions down before I make them, not after — a short doc with the options and my recommendation, open for 24 hours, then I move unless someone blocks it. It means nobody's blocked waiting for a call that has to fit six time zones.",
      why: "A concrete mechanism, not just \"I communicate well.\"",
    },
  ],
  portfolio: [
    {
      id: "port-walkthrough",
      text: "Walk me through one project from problem to shipped result.",
      sub: "The core portfolio question — expect 10-15 minutes on this alone",
      better:
        "The problem was a 60% drop-off at step three of a five-step form. I collapsed it to one screen, tested it with eight users first, and drop-off fell to 9% after we shipped — I can walk through the two versions side by side.",
      why: "States the before number, the change, and the after number — the shape a panel is listening for.",
    },
    {
      id: "port-cut",
      text: "What did you cut from that project, and why?",
      sub: "Tests judgment under constraint, not just execution",
      better:
        "We cut the bulk-edit feature from the first release. It tested well but only mattered to 8% of accounts, and shipping it would have pushed the release by three weeks — we shipped without it and added it two months later once the core flow had adoption data behind it.",
      why: "A real trade-off with a reason, not \"we ran out of time.\"",
    },
    {
      id: "port-metric",
      text: "How did you know the redesign actually worked?",
      sub: "Wants a real metric, not a vibe",
      better:
        "First-payment completion time went from four minutes to ninety seconds, and support tickets tagged 'checkout confusion' dropped by a third in the first month after launch.",
      why: "Two independent numbers, not one cherry-picked stat.",
    },
    {
      id: "port-handoff",
      text: "Walk me through how you handed this off to engineering.",
      sub: "Developer-tool companies ask this almost every time",
      better:
        "I paired with an engineer from the first prototype, not after the design was final, so feasibility shaped the design instead of trimming it later — the handoff doc was really just a shared history of decisions we'd already made together.",
      why: "Frames handoff as ongoing collaboration, which is what most eng-heavy teams are actually screening for.",
    },
    {
      id: "port-critique",
      text: "What would you change about this project if you did it again?",
      sub: "A self-critique question — vague answers stand out badly here",
      better:
        "I'd run the usability test before committing to the single-screen direction, not after — we got lucky that it tested well, and I'd rather not need the luck next time.",
      why: "Specific and slightly uncomfortable — that's what makes it credible.",
    },
    {
      id: "port-scale",
      text: "How would this design hold up at ten times the current scale?",
      sub: "Common at companies past Series B",
      better:
        "The single-screen checkout assumes a handful of fields; at ten times the SKU complexity we'd need progressive disclosure, which I already sketched as a v2 direction but didn't need to ship — happy to walk through it.",
      why: "Shows you'd already thought past the shipped version, not scrambling to invent an answer live.",
    },
  ],
  salary: [
    {
      id: "sal-expectations",
      text: "What are your salary expectations for this role?",
      sub: "Almost always the opening question in a comp conversation",
      better:
        "Based on the scope described, I'm looking at $140,000 to $165,000 base, with the specific number depending on equity and the level this lands at internally.",
      why: "Gives a real range anchored to the role, not a vague deflection.",
    },
    {
      id: "sal-current",
      text: "What's your current compensation?",
      sub: "You're not obligated to answer this directly in most locations",
      better:
        "I'd rather anchor on the value of this specific role than my current package, which reflects a different scope — what's the range budgeted for this position?",
      why: "Redirects to the role's value without being evasive or confrontational.",
    },
    {
      id: "sal-lowball",
      text: "The range we have budgeted is lower than what you mentioned. Is there flexibility on your end?",
      sub: "Tests whether you fold at the first sign of resistance",
      better:
        "I'm flexible on structure — base versus equity versus a signing bonus — but the total comp needs to reflect the seniority of what's being asked. Can you tell me more about how the range was set?",
      why: "Holds the number while staying collaborative, and asks a real question back instead of just conceding.",
    },
    {
      id: "sal-equity",
      text: "How do you think about equity versus base salary?",
      sub: "Common at earlier-stage companies",
      better:
        "I weight base more heavily at this stage of my career since equity outcomes are hard to predict, but I'd want to understand the vesting schedule and the last valuation before treating equity as a meaningful part of the offer.",
      why: "A real framework, not just a number.",
    },
    {
      id: "sal-timeline",
      text: "What's your timeline, and are you interviewing elsewhere?",
      sub: "Partly a comp-leverage question in disguise",
      better:
        "I'm a few weeks into a focused search and have two other conversations at a similar stage, so I'd like to keep this moving at a similar pace if the fit feels right on both sides.",
      why: "Honest without handing over unnecessary leverage.",
    },
    {
      id: "sal-close",
      text: "If we made you an offer at the number we discussed today, would you accept on the spot?",
      sub: "A pressure-close — expect this more in \"tough\" mode",
      better:
        "I'd want it in writing to review properly, but if the number and the role match what we've talked through today, I don't expect a long back-and-forth.",
      why: "Signals real interest without committing to something you haven't seen written down.",
    },
  ],
};

const questionText = (id: string): string => {
  for (const bank of Object.values(QUESTION_BANK)) {
    const hit = bank.find((q) => q.id === id);
    if (hit) return hit.text;
  }
  return id;
};

/** Builds a track's "likely questions" list from bank entries with a per-track readiness state. */
function likelyQuestions(picks: { id: string; format: SessionFormat; sub: string; status: ReadinessStatus }[]): LikelyQuestion[] {
  return picks.map((p) => ({ id: p.id, text: questionText(p.id), sub: p.sub, status: p.status, format: p.format }));
}

// ---------------------------------------------------------------------------
// Panel research bank — keyed by company. Populated tracks already carry
// their panel; empty tracks pull from here when the user hits "Research the
// panel" (see researchPanel() in prep-engine.ts).
// ---------------------------------------------------------------------------

export const PANEL_BANK: Record<string, PanelMember[]> = {
  Vercel: [
    {
      id: "panel-vercel-1",
      name: "Nadia Solis",
      role: "Design Lead",
      note: "Leads the round. Expect one project taken apart in detail — why that structure, what you cut, what broke.",
      inferred: true,
    },
    {
      id: "panel-vercel-2",
      name: "Ravi Deshmukh",
      role: "Staff Engineer",
      note: "Joins for the last stretch and probes handoff and edge cases more than craft.",
      inferred: true,
    },
  ],
  Paystack: [
    {
      id: "panel-paystack-1",
      name: "Tomiwa Balogun",
      role: "Head of Design",
      note: "Writes publicly about design ops — expect a question about how you'd scale a pattern across teams.",
      inferred: true,
    },
    {
      id: "panel-paystack-2",
      name: "Grace Afolabi",
      role: "Product Manager",
      note: "Cares most about prioritization judgment — what you cut and why, more than what you shipped.",
      inferred: true,
    },
  ],
  Linear: [
    {
      id: "panel-linear-1",
      name: "Elias Vance",
      role: "Design Manager",
      note: "The craft bar here is unusually high — bring interaction-level detail, not just information architecture.",
      inferred: true,
    },
  ],
  Deel: [
    {
      id: "panel-deel-1",
      name: "Priya Chandran",
      role: "Senior Recruiter",
      note: "Runs the screen before any design round — mostly comp and logistics, light on craft.",
      inferred: false,
    },
    {
      id: "panel-deel-2",
      name: "Marcus Lindqvist",
      role: "Design Director",
      note: "Asks about global/compliance-heavy design work specifically — has a background in payments himself.",
      inferred: true,
    },
  ],
  GitHub: [
    {
      id: "panel-github-1",
      name: "Sam Okonkwo",
      role: "Principal Designer",
      note: "Known for asking candidates to critique GitHub's own product live — have an opinion ready.",
      inferred: true,
    },
  ],
  Supabase: [
    {
      id: "panel-supabase-1",
      name: "Lena Fischer",
      role: "Design Engineer",
      note: "Half designer, half engineer — expect the conversation to get technical fast.",
      inferred: true,
    },
  ],
};

const GENERIC_PANEL: Omit<PanelMember, "id">[] = [
  { name: "Hiring Manager", role: "Design Lead", note: "Generic — we couldn't find enough public signal for this company yet.", inferred: true },
  { name: "Cross-functional partner", role: "Product or Engineering", note: "Most loops pair a designer with a PM or engineer for the second half.", inferred: true },
];

export function panelForCompany(company: string): PanelMember[] {
  const known = PANEL_BANK[company];
  if (known) return known;
  return GENERIC_PANEL.map((m, i) => ({ ...m, id: `panel-generic-${company}-${i}` }));
}

// ---------------------------------------------------------------------------
// Seed tracks
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS).toISOString();

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

function baseAction(title: string, detail: string, effortMinutes: number, done: boolean, source: string): ActionItem {
  return { id: nextId("act"), title, detail, effortMinutes, done, source };
}

export const PREP_TRACKS: PrepTrack[] = [
  {
    id: "track-vercel",
    company: "Vercel",
    companyMark: "V",
    role: "Senior Product Designer",
    location: "Remote, EU overlap",
    roundLabel: "Round 3 · Design craft",
    roundDate: inDays(2),
    status: "in-progress",
    panel: panelForCompany("Vercel"),
    questions: likelyQuestions([
      { id: "beh-owned-outcome", format: "behavioural", sub: "Asked in most Vercel design loops", status: "ready" },
      { id: "port-handoff", format: "portfolio", sub: "Developer-tool companies ask this almost every time", status: "ready" },
      { id: "beh-pushback-eng", format: "behavioural", sub: "Your last answer rambled at the end", status: "needs-work" },
      { id: "sal-lowball", format: "salary", sub: "Not practised yet", status: "new" },
    ]),
    sessions: [],
    actions: [
      baseAction("Read Nadia's design-system posts", "She quotes her own writing back at candidates.", 15, true, "From panel research"),
      baseAction("Tighten the engineering-pushback answer", "It trailed off last time — practise closing on a full stop.", 10, false, "From panel research"),
    ],
    outcome: null,
  },
  {
    id: "track-linear",
    company: "Linear",
    companyMark: "LI",
    role: "Product Designer, Growth",
    location: "Remote",
    roundLabel: "Round 1 · Portfolio review",
    roundDate: inDays(9),
    status: "in-progress",
    panel: panelForCompany("Linear"),
    questions: likelyQuestions([
      { id: "port-walkthrough", format: "portfolio", sub: "The craft bar here is unusually high", status: "needs-work" },
      { id: "port-critique", format: "portfolio", sub: "Not practised yet", status: "new" },
      { id: "beh-async", format: "behavioural", sub: "Common for remote-first companies specifically", status: "new" },
    ]),
    sessions: [],
    actions: [baseAction("Pick the sharpest portfolio piece for a craft-heavy panel", "Interaction detail over breadth.", 20, false, "From panel research")],
    outcome: null,
  },
  {
    id: "track-deel",
    company: "Deel",
    companyMark: "DE",
    role: "Senior Designer",
    location: "Remote, global",
    roundLabel: "Round 2 · Hiring manager",
    roundDate: inDays(6),
    status: "in-progress",
    panel: panelForCompany("Deel"),
    questions: likelyQuestions([
      { id: "beh-conflict-teammate", format: "behavioural", sub: "Follow-up question in about a third of loops", status: "ready" },
      { id: "sal-expectations", format: "salary", sub: "Almost always the opening question in a comp conversation", status: "ready" },
      { id: "port-scale", format: "portfolio", sub: "Common at companies past Series B", status: "new" },
    ]),
    sessions: [],
    actions: [baseAction("Prep a global-payroll compliance story", "Marcus has a payments background — lead with something regulatory.", 15, false, "From panel research")],
    outcome: null,
  },
  {
    id: "track-paystack",
    company: "Paystack",
    companyMark: "PA",
    role: "Design Lead",
    location: "Lagos or remote",
    roundLabel: "Final round",
    roundDate: inDays(-4),
    status: "awaiting-outcome",
    panel: panelForCompany("Paystack"),
    questions: likelyQuestions([
      { id: "beh-owned-outcome", format: "behavioural", sub: "Asked in 4 of 5 Paystack design loops", status: "ready" },
      { id: "port-cut", format: "portfolio", sub: "Grace asks project-specific follow-ups", status: "ready" },
      { id: "sal-close", format: "salary", sub: "Expect this in the final round specifically", status: "ready" },
    ]),
    sessions: [],
    actions: [
      baseAction("Put one number on each Paystack story", "Users, latency, weeks saved. Three stories, one figure each.", 20, true, "From panel research"),
      baseAction("Rewrite the disagreement answer with the pagination example", "Suggested wording saved to your library.", 10, true, "From panel research"),
    ],
    outcome: null,
  },
  {
    id: "track-github",
    company: "GitHub",
    companyMark: "GH",
    role: "Senior Product Designer",
    location: "Remote, US hours",
    roundLabel: "Round 1",
    roundDate: inDays(-18),
    status: "closed",
    panel: panelForCompany("GitHub"),
    questions: likelyQuestions([{ id: "port-metric", format: "portfolio", sub: "Sam pushes on real metrics, not vibes", status: "ready" }]),
    sessions: [],
    actions: [],
    outcome: "rejected",
  },
  {
    id: "track-supabase",
    company: "Supabase",
    companyMark: "SU",
    role: "Design Engineer",
    location: "Remote",
    roundLabel: "Not scheduled yet",
    roundDate: null,
    status: "not-started",
    panel: [],
    questions: [],
    sessions: [],
    actions: [],
    outcome: null,
  },
];

// ---------------------------------------------------------------------------
// Adding a track — the user-initiated counterpart to the seed data above.
// ---------------------------------------------------------------------------

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export interface NewTrackInput {
  company: string;
  role: string;
  location?: string;
}

/** Builds a fresh, empty track — same starting shape as the Supabase seed track above. */
export function createTrack(input: NewTrackInput): PrepTrack {
  const company = input.company.trim();
  return {
    id: nextId("track-custom"),
    company,
    companyMark: initials(company),
    role: input.role.trim(),
    location: input.location?.trim() || "Remote",
    roundLabel: "Not scheduled yet",
    roundDate: null,
    status: "not-started",
    panel: [],
    questions: [],
    sessions: [],
    actions: [],
    outcome: null,
  };
}

/** "Behavioural + Salary conversation" — one label for a session's format mix. */
export function formatsLabel(formats: SessionFormat[]): string {
  if (formats.length === 0) return "Mixed";
  return formats.map((f) => FORMAT_META[f].label).join(" + ");
}
