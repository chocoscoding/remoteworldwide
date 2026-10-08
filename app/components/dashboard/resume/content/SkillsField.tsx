"use client";

// The Content tab's Skills: the Skills entries editor (`SkillEntriesEditor`, also
// onboarding's) over the resume's content. The rules that keep the entries and
// the flat list in step live in `app/lib/resume/skills.ts`.

import type { Dispatch, FC, SetStateAction } from "react";
import type { ResumeContent } from "@/app/lib/dashboard/types";
import { entriesOf, withEntries } from "@/app/lib/resume/skills";
import SkillEntriesEditor from "./SkillEntriesEditor";

export interface SkillsFieldProps {
  content: ResumeContent;
  setContent: Dispatch<SetStateAction<ResumeContent>>;
}

const SkillsField: FC<SkillsFieldProps> = ({ content, setContent }) => (
  <SkillEntriesEditor entries={entriesOf(content)} onChange={(entries) => setContent((prev) => withEntries(prev, entries))} />
);

export default SkillsField;
