"use client";

// Step 4 — a warm path in, when there is one to find.
//
// The referral screen's own web search (WebReferrals): the people at this
// company a search of LinkedIn and the web turned up, with an intro drafted for
// whoever the user picks. It is keyed on the saved job, so a job that could not
// be saved has nothing to search under and the step says so. It is optional
// either way — plenty of good applications go in cold — and nothing is searched
// (or charged) until the user asks.
//
// The contact card that used to sit here was a mock person at a mock company.
// The user's own contacts now live on the referral screen (All contacts, and
// "People you know at …" on its For a job tab); this step stays the web search.

import { useRef, useState, type FC } from "react";
import { Users } from "lucide-react";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import DraftPanel from "@/app/components/dashboard/referrals/DraftPanel";
import WebReferrals from "@/app/components/dashboard/referrals/WebReferrals";
import { useNetwork } from "@/app/components/dashboard/network/NetworkProvider";
import type { ReferralContact } from "@/app/lib/dashboard/types";
import type { ReferralPerson } from "@/app/lib/referrals/types";
import { foundContact } from "@/app/lib/contacts/people";
import type { StartedJob } from "../job";

export interface IntroStepProps {
  job: StartedJob;
  onSkip: () => void;
}

const IntroStep: FC<IntroStepProps> = ({ job, onSkip }) => {
  const { askedContactIds } = useNetwork();
  const [drafting, setDrafting] = useState<ReferralContact | null>(null);
  const draftRef = useRef<HTMLDivElement | null>(null);

  if (!job.savedJobId) {
    return (
      <DashEmptyState
        icon={Users}
        title="No warm-intro search for this one"
        body="The people search runs against a saved job, and this one couldn't be saved. Skip ahead — you can search for it later from Referrals once it's in your jobs."
        ctaLabel="Skip this step"
        onCta={onSkip}
      />
    );
  }

  const savedJobId = job.savedJobId;

  function openDraft(person: ReferralPerson) {
    setDrafting(foundContact(person, job));
    requestAnimationFrame(() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const draft = drafting ? (
    <div ref={draftRef} className="scroll-mt-40">
      <DraftPanel key={`${drafting.id}:${savedJobId}`} contact={drafting} job={{ company: job.company, role: job.role, savedJobId }} />
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-black/55">
        Optional. A referral or a note to the hiring manager is worth more than any keyword — but if nobody fits,{" "}
        <button type="button" onClick={onSkip} className="cursor-pointer font-semibold text-primary underline decoration-dotted underline-offset-2">
          skip ahead
        </button>
        .
      </p>
      <WebReferrals
        key={savedJobId}
        savedJobId={savedJobId}
        company={job.company}
        role={job.role}
        askedIds={askedContactIds}
        draftingId={drafting?.id ?? null}
        onDraft={openDraft}
        draft={draft}
      />
    </div>
  );
};

export default IntroStep;
