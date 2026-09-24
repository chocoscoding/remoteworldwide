"use client";

// The next steps on an Ask-about-a-job answer that do something rather than
// link somewhere: putting the job on the tracker, and opening its interview
// prep.
//
// Opening prep is one request: the server finds the job's application (or its
// hand-logged twin, or makes one), moves it forward to Interviewing, links the
// track — or answers with the track the job already has. It used to do that
// here, with its own rule for a closed application (a new card), which
// disagreed with the prep screen's add dialog (link the closed one, never
// reopen it). One rule, on the server, means both entry points behave alike.
//
// Tracking the job is still decided here: it reuses an open application for the
// same saved job, or the backend's duplicate match on company and role. A
// closed application is not reused — tracking a job again after a rejection is
// a new attempt.

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import {
  applicationInput,
  createApplication,
  findDuplicateApplication,
  isClosedApplicationStatus,
  isObjectId,
  newClientId,
} from "@/app/lib/applications/api";
import type { ApplicationItem, ApplicationStage } from "@/app/lib/applications/types";
import type { PrepTrackCreated } from "@/app/lib/prep/types";
import { qk } from "@/app/lib/query/keys";
import { announceTrackerChange } from "@/app/components/dashboard/prep/announceTrackerChange";
import { applicationsQuery } from "@/hooks/queries/useApplicationsQuery";
import { useCreatePrepTrack } from "@/hooks/mutations/usePrepTrackMutations";

export const TRACKER_HREF = "/dashboard/tracker";

/** The job an answer was about, as these steps need it. */
export interface NextStepJob {
  savedJobId: string;
  company: string;
  role: string;
  /** A Remote Worldwide listing rather than a job found elsewhere, which is what the tracker calls internal. */
  platform: boolean;
}

interface Tracked {
  application: ApplicationItem;
  created: boolean;
}

const isOpen = (row: ApplicationItem) => !isClosedApplicationStatus(row.status);

/** The job's open application, made in `status` when there is none. */
async function trackedApplication(queryClient: QueryClient, job: NextStepJob, status: ApplicationStage): Promise<Tracked> {
  const rows = await queryClient.fetchQuery(applicationsQuery());
  // Rows still saving carry a client id, which nothing can be linked to yet.
  const linked = rows.find((row) => isObjectId(row.id) && row.savedJobId === job.savedJobId && isOpen(row));
  if (linked) return { application: linked, created: false };

  const duplicate = await findDuplicateApplication({ company: job.company, role: job.role });
  if (duplicate && isOpen(duplicate)) return { application: duplicate, created: false };

  const application = await createApplication(
    applicationInput({
      company: job.company,
      role: job.role,
      savedJobId: job.savedJobId,
      source: job.platform ? "internal" : "external",
      status,
      idempotencyKey: newClientId("jdqa"),
    }),
  );
  // The board, the weekly count and the streak all read the activity domain.
  void queryClient.invalidateQueries({ queryKey: qk.activity.all });
  return { application, created: true };
}

/**
 * Opens the job's interview prep, through the same create the prep screen's
 * add dialog uses — so the track is cached, and the board, summary, plan and
 * streak are refreshed, exactly as they are there. A job that already has a
 * track gets that one back (a 200, nothing written), which a second click or
 * another tab can no longer turn into a failure.
 */
export function useOpenInterviewPrep() {
  const router = useRouter();
  const create = useCreatePrepTrack();
  return useMutation<PrepTrackCreated, unknown, NextStepJob>({
    mutationFn: (job) => create.mutateAsync({ company: job.company, role: job.role, savedJobId: job.savedJobId }),
    onSuccess: (created) => {
      router.push(`/dashboard/prep/${created.id}`);
      announceTrackerChange(created, () => router.push(TRACKER_HREF), { quietWhenTracked: true });
    },
    onError: (error) => toast.error("Couldn't open interview prep", { description: apiMessage(error) }),
  });
}

/** Puts the job on the tracker in Saved, or says it is already there. */
export function useTrackJob() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation<Tracked, unknown, NextStepJob>({
    mutationFn: (job) => trackedApplication(queryClient, job, "saved"),
    onSuccess: ({ created }) =>
      toast.success(created ? "Added to your tracker" : "Already in your tracker", {
        action: { label: "Open tracker", onClick: () => router.push(TRACKER_HREF) },
      }),
    onError: (error) => toast.error("Couldn't add this job to your tracker", { description: apiMessage(error) }),
  });
}
