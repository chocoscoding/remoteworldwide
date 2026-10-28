"use client";
import type { FC } from "react";
import type { JobAndCompany } from "@/types/main";
import JobPage from "@/app/components/main/job/JobPage";

// The redesigned job page, the dashboard's (owner, 2026-10-28): the apply bar, "Before you apply"
// (apply with AI, ATS score, cover letter, referrals, a resume, the tracker), copy link and bookmark.
// Signed out, a tool opens the sign-in popup from the (general) layout's AuthModalProvider.
const OneJobClient: FC<{ Job: JobAndCompany; hasUserBookmarked: boolean | undefined }> = ({ Job, hasUserBookmarked }) => (
  <JobPage job={Job} hasUserBookmarked={hasUserBookmarked} />
);

export default OneJobClient;
