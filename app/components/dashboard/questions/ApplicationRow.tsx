"use client";

import { FC, useState } from "react";
import { BookmarkCheck, BookmarkPlus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import { useAnswers } from "@/app/components/dashboard/answers/AnswersProvider";
import type { AnswerUseItem } from "@/app/lib/answers/types";
import AnswerText from "./AnswerText";

const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/50 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary disabled:cursor-default disabled:opacity-60";

/**
 * One application in the "By application" tab: the answer history for it,
 * joined to the tracker row it belongs to. Built by the Questions screen.
 */
export interface ApplicationAnswers {
  /** The application id the answers were filed under. */
  id: string;
  title: string;
  /** Null when the id matches nothing on the tracker, so `{company}` stays a placeholder. */
  company: string | null;
  meta: string;
  /** Applied through Remote Worldwide. */
  rww: boolean;
  /** In the order the form asked them, each as it went out at the time. */
  uses: AnswerUseItem[];
}

export interface ApplicationRowProps {
  app: ApplicationAnswers;
  open: boolean;
  onToggle: () => void;
}

/**
 * "Save to library" is offered only where it adds something: a use whose
 * question the library no longer holds (deleted since, or never saved). Where
 * the library has it, the row says so instead of offering a save that could
 * only answer "already saved".
 */
const UseRow: FC<{ use: AnswerUseItem; company: string | null }> = ({ use, company }) => {
  const { addAnswer } = useAnswers();
  const [saving, setSaving] = useState(false);

  async function saveToLibrary() {
    setSaving(true);
    const result = await addAnswer({ q: use.question, a: use.answer, cat: use.cat });
    setSaving(false);
    if (!result) return;
    if (result.added) toast.success("Saved to your library", { description: "Reused whenever we draft answers from now on." });
    else toast("Already in your library", { description: result.existing.q });
  }

  return (
    <div className="rounded-xl border border-black/8 bg-[#fbfbf7] p-4">
      <p className="mb-1.5 text-xs font-bold text-primary">{use.question}</p>
      {/* The company is known here, so any {company} token resolves. */}
      <AnswerText text={use.answer} company={company ?? undefined} className="text-black/70" />
      {use.answerId ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-black/45">
          <BookmarkCheck className="h-3.5 w-3.5" />
          In your library
        </p>
      ) : (
        <button type="button" className={cn(GHOST_BTN, "mt-2 -ml-2")} onClick={saveToLibrary} disabled={saving}>
          <BookmarkPlus className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save to library"}
        </button>
      )}
    </div>
  );
};

const ApplicationRow: FC<ApplicationRowProps> = ({ app, open, onToggle }) => (
  <DashCard className="overflow-hidden p-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#fafaf7]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-primary">{app.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {app.rww && <LogoMini className="h-3 w-3 flex-none" />}
          <p className="truncate text-xs text-black/45">{app.meta}</p>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">
        <Pill variant="neutral">
          {app.uses.length} question{app.uses.length === 1 ? "" : "s"}
        </Pill>
        <ChevronDown className={cn("h-4 w-4 flex-none text-black/35 transition-transform", open && "rotate-180")} />
      </div>
    </button>

    {open && (
      <div className="flex flex-col gap-3.5 border-t border-black/8 px-5 pb-5 pt-4">
        {app.uses.map((use) => (
          <UseRow key={`${use.question}-${use.usedAt}`} use={use} company={app.company} />
        ))}
      </div>
    )}
  </DashCard>
);

export default ApplicationRow;
