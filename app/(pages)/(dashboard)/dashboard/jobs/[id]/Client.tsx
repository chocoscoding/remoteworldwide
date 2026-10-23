"use client";
import type { JobAndCompany } from "@/types/main";
import { AuthModalProvider } from "@/app/components/auth/AuthModalProvider";
import JobPage from "@/app/components/main/job/JobPage";
export default function OneJobClient({ Job, hasUserBookmarked }: { Job: JobAndCompany; hasUserBookmarked: boolean | undefined }) {
  return <AuthModalProvider><JobPage job={Job} hasUserBookmarked={hasUserBookmarked} /></AuthModalProvider>;
}
