// Static mock content for the Job Seeker Dashboard feature.
// Persona throughout: Amara Okafor, product designer in Lagos, Nigeria (GMT+1)
// job-hunting for remote roles. Every dashboard screen renders against these
// typed constants — there is no backend for this feature, so "Save"/"Submit"
// style actions in the UI should only ever mutate local component state.

import type {
  Application,
  AtsFixItem,
  AtsKeyword,
  AtsMetric,
  AtsResumeRow,
  BoardRow,
  ChainRow,
  ChecklistItem,
  CoachMessage,
  CoachPlanItem,
  CoachSession,
  CoverLetterContent,
  FeedItem,
  HomeStat,
  JdContent,
  JdQaAnswer,
  JdQuickQuestion,
  PodGoal,
  QaItem,
  RecommendationCard,
  ReferralContact,
  ResumeContent,
  TrackerColumn,
  ApplyStepConfig,
  WeeklyGoal,
} from "./types";

// ---------------------------------------------------------------------------
// QA — saved application-answer library (Questions screen)
// ---------------------------------------------------------------------------

export const QA: QaItem[] = [
  {
    id: "qa-1",
    q: "What are your salary expectations?",
    a: "$70,000–95,000 USD, negotiable based on scope and equity.",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-2",
    q: "Are you authorized to work in this location?",
    a: "I am a Nigerian citizen; I would work as an independent contractor / require sponsorship depending on entity.",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-3",
    q: "Describe a time you disagreed with a design decision.",
    a: "STAR-format: Situation — a PM wanted to ship a checkout flow without usability testing. Task — I needed to protect conversion without blowing the deadline. Action — I ran a 3-day guerrilla test with 6 users on the existing flow and paired the findings with a lightweight redesign. Result — we shipped one week later with a 14% lift in completed checkouts, and usability testing became a standing step before launch.",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-4",
    q: "Portfolio link",
    a: "https://portfolio.dev",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-5",
    q: "Notice period",
    a: "2 weeks",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-6",
    q: "Do you require visa sponsorship?",
    a: "No — I work as a remote contractor, no relocation needed.",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-7",
    q: "Gender",
    a: "Prefer not to say",
    kind: "saved",
    cat: "demographics",
  },
  {
    id: "qa-8",
    q: "Ethnicity",
    a: "Prefer not to say",
    kind: "saved",
    cat: "demographics",
  },
  {
    id: "qa-9",
    q: "Disability status",
    a: "Prefer not to say",
    kind: "saved",
    cat: "demographics",
  },
  {
    id: "qa-10",
    q: "Veteran status",
    a: "Prefer not to say",
    kind: "saved",
    cat: "demographics",
  },
  {
    id: "qa-11",
    q: "Describe a product you shipped end-to-end.",
    a: "Led the Paystack checkout redesign from discovery through rollout: ran merchant interviews, mapped the failure points in the old multi-step flow, designed and tested a single-page alternative, then partnered with three engineers to ship it behind a flag to 100% of traffic over four weeks. Failed-payment support tickets dropped 31% in the first month.",
    draft: "I worked on a checkout project.",
    kind: "review",
    cat: "screening",
  },
  {
    id: "qa-12",
    q: "Walk me through your design process.",
    a: "I start by getting the problem in writing with whoever owns it, then go straight to the riskiest assumption — usually with a scrappy prototype, not a deck. I loop in engineering early so feasibility shapes the design instead of trimming it later, test with 5-6 users before committing to a direction, and treat the handoff as the start of a conversation, not the end of one.",
    draft: "I follow a design process.",
    kind: "review",
    cat: "screening",
  },
  {
    id: "qa-13",
    q: "Years of experience",
    a: "6 years",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-14",
    q: "When are you available to start?",
    a: "Immediately, subject to my 2-week notice period.",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-15",
    q: "Why are you looking for a remote role?",
    a: "I do my best work with focus blocks and async documentation rather than back-to-back meetings, and remote lets me work with strong product teams outside Lagos without relocating away from my family and my design community here.",
    kind: "saved",
    cat: "screening",
  },
  {
    id: "qa-16",
    q: "What's your greatest strength as a designer?",
    a: "Turning ambiguous, cross-functional problems into a shared, testable direction quickly — I'm usually the person in the room who gets a team from disagreement to a prototype.",
    kind: "ai",
    cat: "screening",
  },
  {
    id: "qa-17",
    q: "Which design and prototyping tools are you proficient in?",
    a: "Figma (daily, including variables and advanced prototyping), FigJam, Framer, and enough front-end HTML/CSS/React to prototype and pair with engineers directly.",
    kind: "ai",
    cat: "screening",
  },
  {
    id: "qa-18",
    q: "How did you hear about us?",
    a: "Referred by a Remote Worldwide pod member; also follow the team's product updates.",
    kind: "saved",
    cat: "screening",
  },
];

// ---------------------------------------------------------------------------
// APPS — applications, each with the Q&A pairs that application asked
// (Application answers → "By application" tab)
// ---------------------------------------------------------------------------

export const APPS: Application[] = [
  {
    id: "app-vercel",
    title: "Senior Product Designer",
    meta: "Vercel · Applied 3 days ago",
    rww: true,
    qs: [
      { q: "Why Vercel?", a: "I ship on Vercel for every side project I run, and I want to design the tools I already rely on daily." },
      { q: "Describe a developer-facing product you've designed.", a: "Built the internal design-system documentation site at Paystack, used by 40+ engineers weekly." },
    ],
  },
  {
    id: "app-deel",
    title: "Senior Designer",
    meta: "Deel · Applied 6 days ago",
    rww: true,
    qs: [
      { q: "Salary expectations", a: "$70,000–95,000 USD, negotiable based on scope and equity." },
      { q: "Are you comfortable designing for global payroll compliance flows?", a: "Yes — I designed Paystack's cross-border settlement flow, which involved similar regulatory constraints." },
    ],
  },
  {
    id: "app-supabase",
    title: "Senior Product Designer",
    meta: "Supabase · Applied 5 days ago",
    qs: [
      { q: "Have you worked with open-source developer tools before?", a: "I contributed design and docs to two open-source component libraries and maintain my own design-tokens plugin." },
    ],
  },
  {
    id: "app-linear",
    title: "Senior Product Designer",
    meta: "Linear · Applied 9 days ago",
    qs: [
      { q: "What draws you to Linear specifically?", a: "The craft bar — Linear is the rare tool where the interaction details are as considered as the information architecture." },
      { q: "Portfolio link", a: "https://portfolio.dev" },
    ],
  },
  {
    id: "app-calcom",
    title: "Product Designer",
    meta: "Cal.com · Applied 12 days ago",
    qs: [
      { q: "Notice period", a: "2 weeks" },
    ],
  },
  {
    id: "app-paystack",
    title: "Staff Designer",
    meta: "Paystack · Applied 2 days ago",
    qs: [
      { q: "Why leave your current role at Paystack?", a: "I'm looking to grow into a fully remote, distributed-team context after 3 years building for one region." },
    ],
  },
  {
    id: "app-ramp",
    title: "Senior Product Designer",
    meta: "Ramp · Applied 4 days ago",
    qs: [
      { q: "Do you require visa sponsorship?", a: "No — I work as a remote contractor, no relocation needed." },
      { q: "Describe a time you used data to change a design direction.", a: "Usage data showed 60% of users abandoned a multi-step form at step 3; I collapsed it to a single screen and drop-off fell to 9%." },
    ],
  },
];

// ---------------------------------------------------------------------------
// FEED — pod activity feed
// ---------------------------------------------------------------------------

export const FEED: FeedItem[] = [
  { id: "1", text: "Someone in your pod landed an interview", time: "2h ago", n: 3, hot: true },
  { id: "2", text: "Chidi applied to 3 new roles today", time: "4h ago", n: 3 },
  { id: "3", text: "Funmi hit a 20-day application streak", time: "yesterday", n: 20 },
  { id: "4", text: "Priya got a referral into a Series B startup", time: "2 days ago", n: 1 },
];

// ---------------------------------------------------------------------------
// BOARD — pod leaderboard (7 rows, Amara is rank 2)
// ---------------------------------------------------------------------------

export const BOARD: BoardRow[] = [
  { rank: 1, name: "Priya Sharma", streak: 15, apps: 14 },
  { rank: 2, name: "You", streak: 12, apps: 11, me: true },
  { rank: 3, name: "Chidi Nwosu", streak: 9, apps: 10 },
  { rank: 4, name: "Funmi Adeyemi", streak: 20, apps: 8 },
  { rank: 5, name: "Marcus Lee", streak: 6, apps: 7 },
  { rank: 6, name: "Ines Costa", streak: 4, apps: 6 },
  { rank: 7, name: "Daniel Osei", streak: 2, apps: 4 },
];

// ---------------------------------------------------------------------------
// POD_GOALS — pod-wide goals with member voting (Your pod screen)
// ---------------------------------------------------------------------------

export const POD_GOALS: PodGoal[] = [
  {
    id: "goal-land-job",
    label: "Someone in the pod lands a job",
    detail: "Every pod carries this by default — it can't be voted out.",
    target: 1,
    current: 0,
    unit: "offer this quarter",
    protected: true,
    votes: [],
    status: "active",
  },
  {
    id: "goal-daily-apps",
    label: "10 applications a day, together",
    target: 10,
    current: 6,
    unit: "applications today",
    protected: false,
    votes: [],
    status: "active",
  },
  {
    id: "goal-warm-referrals",
    label: "Land 3 warm referrals this week",
    target: 3,
    current: 0,
    unit: "referrals this week",
    protected: false,
    proposedBy: "Funmi Adeyemi",
    votes: [
      { memberName: "Priya Sharma", choice: "for" },
      { memberName: "Chidi Nwosu", choice: "for" },
      { memberName: "Ines Costa", choice: "for" },
    ],
    status: "voting-add",
    proposedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ---------------------------------------------------------------------------
// CHAIN — invite/referral chain (5 rows, 2 levels deep)
// ---------------------------------------------------------------------------

export const CHAIN: ChainRow[] = [
  { name: "Chidi Nwosu", meta: "Joined 3 weeks ago", tag: "+5 credits", depth: 1 },
  { name: "Funmi Adeyemi", meta: "Joined 2 weeks ago", tag: "+5 credits", depth: 1 },
  { name: "Tolu Bakare", meta: "Invited by Chidi", tag: "Pending", depth: 2, pending: true },
  { name: "Grace Mensah", meta: "Invited by Funmi", tag: "Not yet", depth: 2 },
  { name: "Ines Costa", meta: "Joined 5 days ago", tag: "Pending", depth: 1, pending: true },
];

// ---------------------------------------------------------------------------
// Resume content
// ---------------------------------------------------------------------------

export const RESUME: ResumeContent = {
  name: "Amara Okafor",
  title: "Product Designer",
  location: "Lagos, Nigeria (GMT+1)",
  email: "amara@mail.com",
  phone: "+234 803 555 0142",
  portfolio: "portfolio.dev",
  links: [
    { label: "Portfolio", url: "amaraokafor.design" },
    { label: "LinkedIn", url: "linkedin.com/in/amaraokafor" },
  ],
  summary:
    "Product designer with 6 years shipping design systems and B2B workflow tools for distributed teams across four time zones.",
  experience: [
    {
      id: "exp-paystack",
      role: "Senior Product Designer",
      company: "Paystack",
      dates: "2022–now",
      bullets: [
        "Led the checkout redesign end-to-end, cutting failed-payment support tickets by 31% within the first month of rollout.",
        "Built and maintain Paystack's design-system documentation site, used by 40+ engineers across 6 product teams weekly.",
      ],
    },
    {
      id: "exp-andela",
      role: "Product Designer",
      company: "Andela",
      dates: "2019–2022",
      bullets: [
        "Designed the talent-matching dashboard used by 200+ enterprise clients to review and shortlist distributed engineering talent.",
      ],
    },
  ],
  education: [
    {
      id: "edu-unilag",
      school: "University of Lagos",
      degree: "B.Sc. Computer Science",
      dates: "2013–2017",
      location: "Lagos, Nigeria",
      detail: "Second Class Upper. Final-year project: an offline-first attendance app for lecture halls.",
    },
    {
      id: "edu-ccs",
      school: "Co-Creation Hub",
      degree: "Product Design Fellowship",
      dates: "2018",
      location: "Yaba, Lagos",
    },
  ],
  projects: [
    {
      id: "proj-kobo",
      name: "Kobo Kit",
      detail:
        "An open-source Figma library of Naira-aware form and currency components, forked by 300+ designers building for West African markets.",
      link: "github.com/amaraokafor/kobo-kit",
    },
    {
      id: "proj-async",
      name: "The Async Handbook",
      detail:
        "A short guide on running design critique across time zones, written after two years of fully remote practice. Read ~12k times.",
      link: "amaraokafor.design/async",
    },
  ],
  certifications: [
    {
      id: "cert-nng",
      name: "NN/g UX Certification",
      issuer: "Nielsen Norman Group",
      year: "2023",
    },
    {
      id: "cert-a11y",
      name: "Web Accessibility Specialist (WAS)",
      issuer: "IAAP",
      year: "2021",
    },
  ],
  skills: [
    "Design systems",
    "Figma",
    "Prototyping",
    "Usability testing",
    "Async collaboration",
    "Design tokens",
    "Front-end (HTML/CSS/React)",
    "Cross-functional facilitation",
  ],
};

// ---------------------------------------------------------------------------
// Cover letter content
// ---------------------------------------------------------------------------

export const COVER_LETTER: CoverLetterContent = {
  company: "Deel",
  role: "Senior Designer",
  draftLabel: "Draft 2",
  greeting: "Hi Deel team,",
  paragraphs: [
    "I've spent the last three years designing payment and compliance flows for merchants across 30+ countries at Paystack — work that only exists because someone has to make cross-border money movement feel simple, which is exactly the problem Deel is solving for global teams.",
    "Most recently I led a checkout redesign that cut failed-payment support tickets by 31%, and I built the internal design-system documentation that 40+ engineers now rely on weekly. Both projects meant translating regulatory and technical constraints into interfaces regular people trust with their money — the same tension I imagine shows up constantly in global payroll.",
    "I work async by default, across a four-hour overlap with most US teams, and I'd love to bring that discipline to Deel's design team.",
  ],
  signOff: "Amara Okafor",
  wordCount: 218,
};

// ---------------------------------------------------------------------------
// Application tracker — Kanban columns
// ---------------------------------------------------------------------------

export const TRACKER_COLUMNS: TrackerColumn[] = [
  {
    id: "saved",
    label: "Saved",
    count: 11,
    cards: [
      { id: "trk-ramp", title: "Senior Product Designer", company: "Ramp", daysAgo: 4 },
      { id: "trk-calcom", title: "Product Designer", company: "Cal.com", daysAgo: 7 },
      { id: "trk-notion", title: "Staff Product Designer", company: "Notion", daysAgo: 9 },
      { id: "trk-stripe", title: "Senior Product Designer", company: "Stripe", daysAgo: 1 },
      { id: "trk-figma", title: "Product Designer", company: "Figma", daysAgo: 3 },
      { id: "trk-retool", title: "Senior Product Designer", company: "Retool", daysAgo: 6 },
      { id: "trk-webflow", title: "Staff Product Designer", company: "Webflow", daysAgo: 8 },
      { id: "trk-airtable", title: "Product Designer", company: "Airtable", daysAgo: 12 },
      { id: "trk-loom", title: "Senior Product Designer", company: "Loom", daysAgo: 15 },
      { id: "trk-miro", title: "Product Design Lead", company: "Miro", daysAgo: 18 },
      { id: "trk-gitlab", title: "Senior Product Designer", company: "GitLab", daysAgo: 23 },
    ],
  },
  {
    id: "applied",
    label: "Applied",
    count: 34,
    cards: [
      { id: "trk-paystack", title: "Staff Designer", company: "Paystack", daysAgo: 2, statusChip: "Closes in 2 days" },
      { id: "trk-supabase", title: "Senior Product Designer", company: "Supabase", daysAgo: 5, statusChip: "Referral available" },
      { id: "trk-linear", title: "Senior Product Designer", company: "Linear", daysAgo: 9, statusChip: "Follow up" },
      { id: "trk-zapier", title: "Senior Product Designer", company: "Zapier", daysAgo: 3 },
      { id: "trk-coinbase", title: "Product Designer", company: "Coinbase", daysAgo: 6, statusChip: "Closes in 5 days" },
      { id: "trk-mercury", title: "Senior Product Designer", company: "Mercury", daysAgo: 4 },
      { id: "trk-segment", title: "Product Designer", company: "Segment", daysAgo: 10, statusChip: "Follow up" },
      { id: "trk-postman", title: "Senior Product Designer", company: "Postman", daysAgo: 14 },
      { id: "trk-sentry", title: "Staff Product Designer", company: "Sentry", daysAgo: 1, statusChip: "Closes in 3 days" },
      { id: "trk-typeform", title: "Product Designer", company: "Typeform", daysAgo: 12, statusChip: "Referral available" },
      { id: "trk-attio", title: "Senior Product Designer", company: "Attio", daysAgo: 18 },
      { id: "trk-flyio", title: "Product Designer", company: "Fly.io", daysAgo: 21 },
    ],
  },
  {
    id: "conversation",
    label: "In conversation",
    count: 7,
    cards: [
      {
        id: "trk-deel",
        title: "Senior Designer",
        company: "Deel",
        daysAgo: 6,
        statusChip: "Recruiter opened your resume · 2h ago",
        rww: true,
      },
      { id: "trk-posthog", title: "Product Designer", company: "PostHog", daysAgo: 5, statusChip: "Follow up" },
      {
        id: "trk-amplitude",
        title: "Senior Product Designer",
        company: "Amplitude",
        daysAgo: 4,
        statusChip: "Recruiter opened your resume · 1d ago",
      },
      { id: "trk-intercom", title: "Senior Product Designer", company: "Intercom", daysAgo: 8, statusChip: "Follow up" },
      { id: "trk-twilio", title: "Product Designer", company: "Twilio", daysAgo: 11 },
      { id: "trk-zendesk", title: "Senior Product Designer", company: "Zendesk", daysAgo: 14 },
      {
        id: "trk-front",
        title: "Product Designer",
        company: "Front",
        daysAgo: 9,
        statusChip: "Recruiter opened your resume · 3d ago",
      },
    ],
  },
  {
    id: "interviewing",
    label: "Interviewing",
    count: 3,
    cards: [
      {
        id: "trk-vercel",
        title: "Senior Product Designer",
        company: "Vercel",
        daysAgo: 3,
        statusChip: "Round 2 of 4 · Thu 14:00 GMT+1",
        rww: true,
        highlighted: true,
      },
      {
        id: "trk-github",
        title: "Senior Product Designer",
        company: "GitHub",
        daysAgo: 5,
        statusChip: "Round 1 of 3 · Tue 10:30 GMT+1",
      },
      {
        id: "trk-shopify",
        title: "Staff Product Designer",
        company: "Shopify",
        daysAgo: 2,
        statusChip: "Final round · Mon 16:00 GMT+1",
      },
    ],
  },
  {
    id: "offer",
    label: "Offer",
    count: 0,
    cards: [],
  },
];

// ---------------------------------------------------------------------------
// Apply wizard — 5-step config
// ---------------------------------------------------------------------------

export const APPLY_STEPS: ApplyStepConfig[] = [
  { n: 1, label: "The role" },
  { n: 2, label: "Resume" },
  { n: 3, label: "Cover letter" },
  { n: 4, label: "Warm intro" },
  { n: 5, label: "Questions & submit" },
];

// ---------------------------------------------------------------------------
// ATS scorer
// ---------------------------------------------------------------------------

export const ATS_SCORE = 79;

export const ATS_METRICS: AtsMetric[] = [
  { id: "keyword-match", label: "Keyword match", value: 71 },
  { id: "parseability", label: "Parseability", value: 96 },
  { id: "impact-language", label: "Impact language", value: 64 },
  { id: "length-format", label: "Length & format", value: 88 },
];

export const ATS_KEYWORDS: AtsKeyword[] = [
  { id: "kw-design-systems", label: "Design systems", present: true },
  { id: "kw-async", label: "Async", present: true },
  { id: "kw-figma", label: "Figma", present: true },
  { id: "kw-remote-first", label: "Remote-first", present: true },
  { id: "kw-component-libraries", label: "Component libraries", present: true },
  { id: "kw-developer-experience", label: "Developer experience", present: false },
  { id: "kw-design-ops", label: "Design ops", present: false },
  { id: "kw-figma-variables", label: "Figma variables", present: false },
];

export const ATS_FIX_ITEMS: AtsFixItem[] = [
  {
    id: "fix-keyword",
    label: "Missing keyword: \"developer experience\"",
    detail: "This job description mentions it 3 times — your resume doesn't use the phrase once.",
    action: "Add it",
  },
  {
    id: "fix-bullets",
    label: "2 bullets have no measurable outcome",
    detail: "\"Led the Paystack checkout redesign\" and one Andela bullet read as tasks, not results.",
    action: "Quantify",
  },
  {
    id: "fix-skills",
    label: "Skills section is buried on page 2",
    detail: "ATS parsers weight the first page more heavily — move skills above Experience.",
    action: "Move it",
  },
];

export const ATS_RESUMES: AtsResumeRow[] = [
  { id: "res-master", name: "Master resume", generalScore: 74, jdScore: null, action: "Improve" },
  { id: "res-linear", name: "Linear — Senior PD", generalScore: 81, jdScore: 89, action: "Open" },
  { id: "res-deel", name: "Deel — Senior Designer", generalScore: 72, jdScore: 76, action: "Open" },
  { id: "res-2023", name: "2023 resume (imported)", generalScore: 58, jdScore: null, action: "Archive", archived: true },
];

// ---------------------------------------------------------------------------
// Career coach
// ---------------------------------------------------------------------------

export const COACH_MESSAGES: CoachMessage[] = [
  {
    id: "coach-1",
    from: "coach",
    text: "Morning, Amara. I looked at this week's applications — your reply rate is up 6 points, mostly from Series-A companies. Enterprise roles are staying quiet.",
  },
  {
    id: "coach-2",
    from: "user",
    text: "Should I stop applying to the bigger companies then?",
  },
  {
    id: "coach-3",
    from: "coach",
    text: "Not stop — just don't lead with them. Enterprise ATS filters weight keyword match heavily, and your resume is optimized for a more conversational read. I also found some warmer paths in for a few of the enterprise roles on your list.",
    card: {
      title: "6 warm paths found across your saved companies",
      cta: "Open referrals",
      href: "/dashboard/referrals",
    },
  },
];

export const COACH_PLAN: CoachPlanItem[] = [
  { id: "plan-1", text: "Tailor resume to 3 open roles", done: true },
  { id: "plan-2", text: "Send 2 referral requests", done: true },
  { id: "plan-3", text: "Run a mock interview for Vercel", done: false },
  { id: "plan-4", text: "Raise reply rate above 25%", done: false },
];

export const COACH_SESSIONS: CoachSession[] = [
  { id: "session-1", title: "Negotiating in USD from Nigeria" },
  { id: "session-2", title: "Should I take the contract role?" },
  { id: "session-3", title: "Explaining my career gap" },
];

// ---------------------------------------------------------------------------
// JD Q&A ("Ask about a job")
// ---------------------------------------------------------------------------

export const JD_CONTENT: JdContent = {
  company: "Vercel",
  role: "Senior Product Designer",
  salary: "$140,000–$180,000 USD + equity",
  jdText:
    "Vercel is looking for a Senior Product Designer to shape the developer experience of our deployment platform, used by millions of front-end teams. You'll partner closely with engineering and DX to design workflows for build configuration, previews, and observability. We're looking for someone with 5+ years designing developer tools, strong systems thinking, and the ability to work async across time zones. You should be comfortable prototyping in code when it speeds up a decision.",
  highlight: "5+ years designing developer tools",
};

export const JD_QUICK_QUESTIONS: JdQuickQuestion[] = [
  { id: "fit", label: "Am I a fit?" },
  { id: "really-asking", label: "What are they really asking for?" },
  { id: "salary", label: "Salary sanity check" },
  { id: "questions-to-ask", label: "Questions to ask them" },
];

export const JD_QA_EXCHANGES: JdQaAnswer[] = [
  {
    id: "fit",
    question: "Am I a fit for this role?",
    verdict: "Strong fit. Your Paystack and Andela experience covers developer-facing tools and cross-timezone async work directly.",
    missing: "You don't yet have a bullet that names \"developer experience\" explicitly, which this JD repeats three times.",
    tips: [
      "Reframe the design-system documentation work as a developer-experience win, with the 40-engineer adoption number front and center.",
      "Mention that you already prototype in code — the JD calls this out as a plus.",
    ],
  },
  {
    id: "really-asking",
    question: "What are they really asking for?",
    verdict: "Beyond the listed skills, this reads like a team that got burned by a designer who couldn't work independently across time zones.",
    missing: "There's no explicit mention of portfolio depth — they're weighting collaboration signals over pure craft in the copy.",
    tips: [
      "Lead your intro with how you work async, not just what you've shipped.",
      "In the interview, ask how design and engineering currently hand off work — it tells you whether the async claim is real.",
    ],
  },
  {
    id: "salary",
    question: "Is $140,000–$180,000 + equity reasonable for this role?",
    verdict: "It's in range for a Senior IC design role at a Series-D+ developer tools company, and above your stated minimum of $70,000.",
    missing: "The range doesn't specify equity refresh cadence — worth clarifying before final offer stage.",
    tips: [
      "Anchor any negotiation near the top third of the range given your systems + DX experience.",
      "Ask whether the range is fixed globally or adjusted by location.",
    ],
  },
  {
    id: "questions-to-ask",
    question: "What should I ask them in the screen?",
    verdict: "Good screens for this role usually cover team structure, how design debt gets prioritized, and what \"senior\" actually means day to day.",
    missing: "The JD doesn't say who this role reports to — worth asking directly.",
    tips: [
      "\"How is design headcount split across the deployment platform vs. the rest of the product?\"",
      "\"What would make this hire feel like a clear win a year from now?\"",
    ],
  },
];

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export const REFERRAL_CONTACTS: ReferralContact[] = [
  {
    id: "ref-tunde",
    name: "Tunde Adebayo",
    tie: "Strong tie",
    role: "Staff Engineer",
    company: "Vercel",
    targetRole: "Senior Product Designer",
    status: "Available to refer",
    bio: "Worked with Amara at Andela for 2 years; now on the platform team at Vercel.",
  },
  {
    id: "ref-maria",
    name: "Maria Kowalski",
    tie: "2nd degree",
    role: "Design Manager",
    company: "Linear",
    targetRole: "Senior Product Designer",
    status: "Reachable via Chidi Nwosu",
    via: "Chidi Nwosu",
  },
  {
    id: "ref-sam",
    name: "Sam Reyes",
    tie: "Alumni",
    role: "Recruiter",
    company: "Deel",
    targetRole: "Senior Designer",
    status: "Shared program (Andela alumni)",
  },
];

// ---------------------------------------------------------------------------
// Landed — first-90-days checklist (9 items, 3 done)
// ---------------------------------------------------------------------------

export const LANDED_CHECKLIST: ChecklistItem[] = [
  { id: "landed-1", text: "Set up your workspace and tooling access", done: true },
  { id: "landed-2", text: "Meet your immediate squad", done: true },
  { id: "landed-3", text: "Set up payout and invoicing details", done: true },
  { id: "landed-4", text: "Agree your first 30-day expectations with your manager", done: false },
  { id: "landed-5", text: "Ship one visible thing", done: false },
  { id: "landed-6", text: "Find your two go-to people for unblocking work", done: false },
  { id: "landed-7", text: "Book a 60-day check-in on the calendar", done: false },
  { id: "landed-8", text: "Write down what \"good\" looks like at 90 days", done: false },
  { id: "landed-9", text: "Share your onboarding notes back with your pod", done: false },
];

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export const RECOMMENDATION_CARDS: RecommendationCard[] = [
  {
    id: "rec-supabase",
    company: "Supabase",
    fitLabel: "Strong fit",
    fitPct: 88,
    action: "Ask for an intro",
  },
  {
    id: "rec-raycast",
    company: "Raycast",
    fitLabel: "Worth a look",
    fitPct: 64,
    action: "Add front-end work",
  },
  {
    id: "rec-posthog",
    company: "PostHog",
    fitLabel: "Good fit",
    fitPct: 76,
    action: "Already in conversation",
    status: "On hold",
  },
];

// ---------------------------------------------------------------------------
// Home screen stats + weekly goal
// ---------------------------------------------------------------------------

export const HOME_STATS: HomeStat[] = [
  { id: "stat-applications", label: "Applications", value: "34", delta: "+5 this week", positive: true },
  { id: "stat-reply-rate", label: "Reply rate", value: "21%", delta: "+6 pts", positive: true },
  { id: "stat-interviews", label: "Interviews", value: "3", delta: "1 upcoming" },
  { id: "stat-ats-score", label: "Avg ATS score", value: "78", delta: "out of 100" },
];

export const WEEKLY_GOAL: WeeklyGoal = {
  current: 5,
  target: 8,
  doneDays: ["M", "T", "Th"],
  allDays: ["M", "T", "W", "Th", "F", "S", "S"],
};
