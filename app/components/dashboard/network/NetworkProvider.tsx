"use client";

// Your network — app-wide state.
//
// Mounted in DashboardShell inside ActivityProvider, because asking for a
// referral and answering a company's questions are both qualifying actions:
// the mutation and the `recordAction` call live together here, so the three
// surfaces that touch this state (referrals, recommend, apply step 4) can't
// drift the way the old per-screen `useState` Sets did.
//
// Deliberately no messaging model. A recommendation is: reviewers put you in
// front of a company, the company asks a question or two, you answer, you're
// connected. There is no thread to store.
//
// Mock-only: in-memory, resets on reload. Every mutation is a backend seam.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { INTRO_PIPELINE_SEED, RECOMMENDATION_TARGETS, REFERRAL_CONTACTS, TIE_META } from "@/app/lib/dashboard/mock-data";
import type { IntroPipelineEntry, RecommendationTarget, ReferralContact } from "@/app/lib/dashboard/types";
import { useActivity } from "../activity/ActivityProvider";

/** Index into INTRO_STAGES — answering questions lands you here. */
const STAGE_INTERVIEW = 2;

export interface JobPaths {
  /** People who actually work at the company — warmth-sorted. */
  direct: ReferralContact[];
  /** Recruiters and alumni elsewhere who might know someone. */
  adjacent: ReferralContact[];
}

interface NetworkContextValue {
  contacts: ReferralContact[];
  targets: RecommendationTarget[];
  pipeline: IntroPipelineEntry[];
  askedContactIds: Set<string>;
  askReferral: (contactId: string, message: string) => void;
  /** The entire interaction with a company — answers, then you're connected. */
  answerIntroQuestions: (entryId: string, answers: Record<string, string>) => void;
  /** Best single warm path at a company, for the recommend cards. */
  contactAtCompany: (company: string) => ReferralContact | undefined;
  contactsForJob: (company: string) => JobPaths;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

const sameCompany = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const byWarmth = (a: ReferralContact, b: ReferralContact) => TIE_META[a.tie].rank - TIE_META[b.tie].rank;

export const NetworkProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { recordAction, awardStrongEvent } = useActivity();

  const [contacts] = useState<ReferralContact[]>(REFERRAL_CONTACTS);
  const [targets] = useState<RecommendationTarget[]>(RECOMMENDATION_TARGETS);
  const [pipeline, setPipeline] = useState<IntroPipelineEntry[]>(INTRO_PIPELINE_SEED);
  const [askedContactIds, setAskedContactIds] = useState<Set<string>>(new Set());

  function askReferral(contactId: string, message: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact || askedContactIds.has(contactId)) return;

    setAskedContactIds((prev) => new Set(prev).add(contactId));
    // No success toast here: recordAction already fires the streak toast, and
    // the card flipping to "Asked" is the confirmation.
    recordAction("message", contactId, `Asked ${contact.name} about ${contact.company}`);
    void message; // the draft itself isn't stored in this build — the seam is here
  }

  function answerIntroQuestions(entryId: string, answers: Record<string, string>) {
    const entry = pipeline.find((e) => e.id === entryId);
    if (!entry?.questions) return;

    // A company's questions answered is a rare, high-signal event — pays a
    // credit drop exactly once per recommendation (deduped on the ledger).
    awardStrongEvent("answered-questions", entryId, `Answered ${entry.company}'s questions`);

    setPipeline((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              stageIndex: STAGE_INTERVIEW,
              questions: e.questions?.map((q) => ({ ...q, answer: answers[q.id]?.trim() || q.answer })),
            }
          : e
      )
    );
    recordAction("message", entryId, `Answered ${entry.company}'s questions`);
  }

  function contactAtCompany(company: string): ReferralContact | undefined {
    return contacts.filter((c) => sameCompany(c.company, company)).sort(byWarmth)[0];
  }

  function contactsForJob(company: string): JobPaths {
    const direct = contacts.filter((c) => sameCompany(c.company, company)).sort(byWarmth);
    // Recruiters and alumni are the people who plausibly know someone
    // elsewhere — offered when the direct list is thin, never instead of it.
    const adjacent = contacts
      .filter((c) => !sameCompany(c.company, company))
      .filter((c) => c.tie === "alumni" || /recruit|talent|head of|manager|lead/i.test(c.role))
      .sort(byWarmth)
      .slice(0, 4);
    return { direct, adjacent };
  }

  return (
    <NetworkContext.Provider
      value={{ contacts, targets, pipeline, askedContactIds, askReferral, answerIntroQuestions, contactAtCompany, contactsForJob }}>
      {children}
    </NetworkContext.Provider>
  );
};

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
