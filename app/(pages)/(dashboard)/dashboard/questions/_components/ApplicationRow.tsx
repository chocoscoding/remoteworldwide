"use client";

import { FC } from "react";
import { BookmarkPlus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import Pill from "@/app/components/dashboard/ui/Pill";
import LogoMini from "@/app/components/svg/LogoMini";
import { useAnswers } from "@/app/components/dashboard/answers/AnswersProvider";
import type { Application } from "@/app/lib/dashboard/types";
import AnswerText from "./AnswerText";

const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-black/50 cursor-pointer transition-colors hover:bg-black/[0.05] hover:text-primary";

export interface ApplicationRowProps {
  app: Application;
  open: boolean;
  onToggle: () => void;
}

/** "Deel · Applied 6 days ago" -> "Deel". */
const companyOf = (meta: string) => meta.split("·")[0].trim();

const ApplicationRow: FC<ApplicationRowProps> = ({ app, open, onToggle }) => {
  const { addAnswer } = useAnswers();
  const company = companyOf(app.meta);

  function saveToLibrary(q: string, a: string) {
    const result = addAnswer({ q, a, cat: "screening" });
    if (result.added) {
      toast.success("Saved to your library", { description: "The extension can fill this from now on." });
    } else {
      toast("Already in your library", { description: result.existing.q });
    }
  }

  return (
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
            {app.qs.length} question{app.qs.length === 1 ? "" : "s"}
          </Pill>
          <ChevronDown className={cn("h-4 w-4 flex-none text-black/35 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-3.5 border-t border-black/8 px-5 pb-5 pt-4">
          {app.qs.map((pair, i) => (
            <div key={i} className="rounded-xl border border-black/8 bg-[#fbfbf7] p-4">
              <p className="mb-1.5 text-xs font-bold text-primary">{pair.q}</p>
              {/* The company is known here, so any {company} token resolves. */}
              <AnswerText text={pair.a} company={company} className="text-black/70" />
              <button type="button" className={cn(GHOST_BTN, "mt-2 -ml-2")} onClick={() => saveToLibrary(pair.q, pair.a)}>
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save to library
              </button>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
};

export default ApplicationRow;
