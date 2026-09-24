// Application drafts — the frontend's copy of the contract.
//
// The AI service owns it: remoteworldwideai/src/types/drafts.ts (the shapes in
// rwwextension/docs/drafts.md §6). The block below is mirrored verbatim, and
// the AI service's tests/contracts/answers-types.test.ts compares the two field
// for field, so edit the service's copy first and paste it here unchanged.
//
// One thing the declared types say that the shared client would not keep true
// on its own: `revive` (app/lib/api/core.ts) turns every `createdAt` and
// `updatedAt` it meets into a Date. `app/lib/drafts/api.ts` turns them back
// into ISO strings, so every caller can trust the types as written.

export type DraftAnswerKind = "question" | "profile" | "cover-letter";
export type ApplicationDraftStatus = "draft" | "applied";

export interface ApplicationDraftAnswer {
  question: string;
  answer: string;
  kind: DraftAnswerKind;
  updatedAt: string; // ISO
}

export interface ApplicationDraftItem {
  id: string;
  url: string;
  pageUrl: string | null;
  /** "jobs.lever.co" — for display. */
  host: string;
  company: string | null;
  role: string | null;
  location: string | null;
  savedJobId: string | null;
  status: ApplicationDraftStatus;
  applicationId: string | null;
  appliedAt: string | null;
  answers: ApplicationDraftAnswer[];
  answerCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface SaveDraftInput {
  url: string;
  pageUrl?: string | null;
  company?: string | null;
  role?: string | null;
  location?: string | null;
  savedJobId?: string | null;
  /** answer "" removes that question. Matched by prepareQuestion(question).key. */
  answers: Array<{ question: string; answer: string; kind?: DraftAnswerKind }>;
}

export interface FuseDraftInput {
  applicationId: string;       // Mongo id
  draftId?: string;            // one of draftId / url / savedJobId
  url?: string;
  savedJobId?: string | null;
}

export interface FuseDraftResult {
  fused: boolean;
  /** Answer-log rows newly written (0 when they were all there already). */
  recorded: number;
  draft: ApplicationDraftItem | null;
}
