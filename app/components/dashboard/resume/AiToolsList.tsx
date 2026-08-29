"use client";

// AI Tools tab's left-sidebar action list. Unchanged in spirit from the old
// screen — purely a mocked run/done state, no real generation happening.

import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { Hash, PenLine, Scissors, SpellCheck2, Tag, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiToolAction {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  doneCaption: string;
}

const AI_TOOLS_ACTIONS: AiToolAction[] = [
  {
    id: "tailor",
    icon: Target,
    label: "Tailor to a job",
    description: "Rewrite key phrases to match a specific job description.",
    doneCaption: "Tailored to this document's target role.",
  },
  {
    id: "rewrite",
    icon: PenLine,
    label: "Rewrite a section",
    description: "Pick a section and get 3 fresh phrasings to choose from.",
    doneCaption: "3 new phrasings ready for your Summary.",
  },
  {
    id: "keywords",
    icon: Tag,
    label: "Add missing keywords",
    description: "Insert keywords the JD wants that your resume is missing.",
    doneCaption: "Added \"developer experience\" to your Summary.",
  },
  {
    id: "quantify",
    icon: Hash,
    label: "Quantify my bullets",
    description: "Turn task-shaped bullets into ones with a measurable result.",
    doneCaption: "Suggested numbers for 2 bullets.",
  },
  {
    id: "shorten",
    icon: Scissors,
    label: "Shorten to one page",
    description: "Tighten wording and trim lower-impact lines to fit one page.",
    doneCaption: "Trimmed roughly 40 words across your document.",
  },
  {
    id: "tone",
    icon: SpellCheck2,
    label: "Fix tone & grammar",
    description: "Catch typos, awkward phrasing, and inconsistent tense.",
    doneCaption: "No issues found — your resume reads clean.",
  },
];

export interface AiToolsListProps {
  aiRunning: string | null;
  aiDone: Set<string>;
  onRun: (id: string) => void;
}

const AiToolsList: FC<AiToolsListProps> = ({ aiRunning, aiDone, onRun }) => (
  <div className="flex flex-col gap-2.5">
    {AI_TOOLS_ACTIONS.map((action) => {
      const running = aiRunning === action.id;
      const done = aiDone.has(action.id);
      return (
        <div key={action.id} className="rounded-xl border border-black/8 p-3">
          <div className="flex items-start gap-2.5">
            <div className="h-8 w-8 flex-none rounded-lg bg-[#f0f0ea] flex items-center justify-center">
              <action.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-primary leading-tight">{action.label}</p>
              <p className="text-[11px] text-black/45 leading-snug mt-0.5">{action.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onRun(action.id)}
            disabled={running}
            className={cn(
              "mt-2.5 w-full rounded-lg py-1.5 text-xs font-semibold cursor-pointer transition-colors disabled:cursor-default",
              done ? "bg-[#f0f0ea] text-black/45" : "bg-primary text-white hover:bg-black"
            )}>
            {running ? "Running…" : done ? "Run again" : "Run"}
          </button>
          {done && !running && <p className="mt-1.5 text-[11px] font-medium text-[#6c7a1e]">{action.doneCaption}</p>}
        </div>
      );
    })}
  </div>
);

export default AiToolsList;
