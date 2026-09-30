"use client";

// Your network — app-wide state.
//
// Mounted in DashboardShell inside ActivityProvider, because asking for a
// referral and answering a company's questions are both qualifying actions:
// the mutation and the `recordAction` call live together here, so the three
// surfaces that touch this state (referrals, recommend, apply step 4) can't
// drift the way the old per-screen `useState` Sets did.
//
// Referral asks are real: each "Mark as asked" is a row in the backend's
// referral_requests (who, which job, the message, how it went out), and
// "Asked" everywhere is read back from those rows — by person id, contact id
// or LinkedIn profile, so someone asked from a search result still shows as
// asked once saved to contacts (app/lib/contacts/people.ts). The contact list
// itself is paged server-side and read where it is shown (the referrals screen).
//
// Recommendations are real too (backend `recommendations`). Only the WRITE
// lives here — answering a company's questions, beside its `recordAction` —
// because it is a qualifying action like an ask. The reads (the pipeline, the
// "worth watching" listings, the warm paths at those companies) are the
// recommend screen's own queries (hooks/queries/useRecommendationsQuery.ts):
// holding them here fetched them on every dashboard screen for cards only one
// screen shows.
//
// Deliberately no messaging model. A recommendation is: reviewers put you in
// front of a company, the company asks a question or two, you answer, you're
// connected. There is no thread to store.

import { createContext, useContext, useMemo, type FC, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import { createReferralRequest } from "@/app/lib/contacts/api";
import { askedKeysOf, hasAsked } from "@/app/lib/contacts/people";
import type { ReferralChannel, ReferralRequestItem } from "@/app/lib/contacts/types";
import type { ReferralContact } from "@/app/lib/dashboard/types";
import { qk } from "@/app/lib/query/keys";
import type { AnswerRecommendationResult } from "@/app/lib/recommendations/types";
import { useReferralRequests } from "@/hooks/queries/useContactsQuery";
import { useAnswerRecommendation } from "@/hooks/mutations/useRecommendationMutations";
import { useActivity } from "../activity/ActivityProvider";

/** The job an ask was about, as the draft panel knows it. */
export interface AskJob {
  company: string;
  role: string;
  savedJobId?: string;
}

export interface AskOptions {
  job?: AskJob;
  /** The last way out the user clicked in the draft panel before marking it asked. */
  channel?: ReferralChannel;
}

/** Enough of a person to tell whether they've been asked. */
type AskedPerson = Pick<ReferralContact, "id" | "contactId" | "linkedinUrl" | "profileUrl">;

/** The recommendation being answered, as the card knows it. */
export interface AnsweringRecommendation {
  id: string;
  company: string;
}

interface NetworkContextValue {
  /** Every key an ask is known by. Test people with `isAsked`, not `.has(id)`. */
  askedContactIds: ReadonlySet<string>;
  isAsked: (person: AskedPerson) => boolean;
  /** The person whose ask is being recorded right now, if any. */
  askingId: string | null;
  /**
   * Records that the user sent this person a referral ask, and counts it toward
   * the streak once it is stored. Works for saved contacts and for people a
   * referral search found online alike.
   */
  askReferral: (contact: ReferralContact, message: string, options?: AskOptions) => Promise<void>;
  /**
   * The entire interaction with a company — answers, then you're connected.
   * Sends every answer (keyed by question id) to the server, which stores them,
   * moves the stage to Interview and pays the credits once. Resolves true once
   * they are stored; false when they were refused (the error is toasted).
   */
  answerIntroQuestions: (entry: AnsweringRecommendation, answers: Record<string, string>) => Promise<boolean>;
  /** The recommendation whose answers are being sent right now, if any. */
  answeringId: string | null;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export const NetworkProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { recordAction } = useActivity();
  const queryClient = useQueryClient();

  const requests = useReferralRequests();
  const askedContactIds = useMemo(() => askedKeysOf(requests.data ?? []), [requests.data]);

  const recordAsk = useMutation({
    mutationFn: createReferralRequest,
    onSuccess: (row) => {
      // Straight into the list "Asked" reads, so the button flips without waiting on a refetch.
      queryClient.setQueryData<ReferralRequestItem[]>(qk.contacts.requests(), (prev) =>
        prev?.some((r) => r.id === row.id) ? prev : [row, ...(prev ?? [])],
      );
    },
  });

  const isAsked = (person: AskedPerson) => hasAsked(askedContactIds, person);

  async function askReferral(contact: ReferralContact, message: string, { job, channel }: AskOptions = {}) {
    if (isAsked(contact) || recordAsk.isPending) return;
    try {
      await recordAsk.mutateAsync({
        personKey: contact.id,
        contactId: contact.contactId ?? null,
        contact: {
          name: contact.name,
          company: contact.company,
          title: contact.role,
          linkedinUrl: contact.linkedinUrl || null,
          email: contact.email || null,
        },
        job: job ? { savedJobId: job.savedJobId ?? null, company: job.company, role: job.role } : null,
        message,
        channel: channel ?? "other",
      });
    } catch (error) {
      toast.error(apiMessage(error));
      return;
    }
    // Only once it is stored: a streak day must stand on a real record. No
    // success toast here — recordAction already fires the streak toast, and the
    // card flipping to "Asked" is the confirmation.
    recordAction("message", contact.id, `Asked ${contact.name} about ${job?.company || contact.company || "a referral"}`);
  }

  const answer = useAnswerRecommendation();

  async function answerIntroQuestions(entry: AnsweringRecommendation, answers: Record<string, string>): Promise<boolean> {
    if (answer.isPending) return false;
    let result: AnswerRecommendationResult;
    try {
      result = await answer.mutateAsync({
        id: entry.id,
        answers: Object.entries(answers).map(([questionId, text]) => ({ questionId, answer: text.trim() })),
      });
    } catch (error) {
      toast.error(apiMessage(error));
      return false;
    }
    // The credits, the answered-questions gift and the server's streak row
    // were all written server-side, once per recommendation (credit_ledger
    // `rec-answers:{id}`) — nothing is awarded from here any more, so a second
    // tab or a retry can't pay twice. `alreadySent` is exactly that case: the
    // answers were stored before, so it is not a new action either.
    if (result.alreadySent) return true;
    if (result.credited > 0) toast.success(`+${result.credited} credits`, { description: `For answering ${entry.company}'s questions.` });
    recordAction("message", entry.id, `Answered ${entry.company}'s questions`);
    return true;
  }

  const askingId = recordAsk.isPending ? (recordAsk.variables?.personKey ?? null) : null;
  const answeringId = answer.isPending ? (answer.variables?.id ?? null) : null;

  return (
    <NetworkContext.Provider value={{ askedContactIds, isAsked, askingId, askReferral, answerIntroQuestions, answeringId }}>
      {children}
    </NetworkContext.Provider>
  );
};

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}
