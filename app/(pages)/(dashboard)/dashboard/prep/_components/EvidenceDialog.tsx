"use client";

import { FC } from "react";
import { Lightbulb, Quote } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EvidenceItem } from "@/app/lib/dashboard/prep-data";

/**
 * The drill-down behind a score or a stat.
 *
 * A number on its own ("Specifics 6.1") is a verdict, not feedback — this is
 * where it gets broken into the actual lines that produced it, what to notice
 * about each, and how the same line could have been said. Everything quoted
 * here is the user's own words, pulled straight from the transcript.
 */
export interface EvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The score or stat value, shown alongside the title. */
  value?: string;
  summary: string;
  howToImprove: string;
  evidence: EvidenceItem[];
  /** Copy for when there's nothing to show, i.e. this one went well. */
  emptyNote?: string;
}

const EvidenceDialog: FC<EvidenceDialogProps> = ({ open, onOpenChange, title, value, summary, howToImprove, evidence, emptyNote }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="bg-white rounded-2xl border border-black/10 p-0 gap-0 max-w-[620px] max-h-[85vh] overflow-hidden flex flex-col">
      <div className="px-6 pt-6 pb-4 flex-none">
        <div className="flex items-baseline gap-3">
          <DialogTitle className="text-lg font-bold text-primary">{title}</DialogTitle>
          {value && <span className="text-lg font-bold text-primary tabular-nums">{value}</span>}
        </div>
        <DialogDescription className="mt-1.5 text-sm text-black/55 leading-relaxed">{summary}</DialogDescription>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
        {evidence.length === 0 ? (
          <p className="text-sm text-black/50 leading-relaxed border-t border-black/10 pt-4">
            {emptyNote ?? "Nothing flagged here — this one held up across your answers."}
          </p>
        ) : (
          <div className="flex flex-col gap-4 border-t border-black/10 pt-4">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/40">
              {evidence.length === 1 ? "1 place this showed up" : `${evidence.length} places this showed up`}
            </p>
            {evidence.map((e) => (
              <div key={e.id} className="rounded-xl border border-black/10 overflow-hidden">
                {e.question && <p className="px-3.5 pt-3 text-xs font-bold text-black/45">On: {e.question}</p>}
                <div className="px-3.5 py-3">
                  <p className="flex gap-2 text-sm text-black/70 leading-relaxed">
                    <Quote className="h-3.5 w-3.5 flex-none text-black/25 mt-1" />
                    <span className="italic">{e.quote}</span>
                  </p>
                  <p className="text-xs text-black/55 mt-2.5">{e.note}</p>
                </div>
                {e.fix && (
                  <div className="border-t border-black/10 bg-[#f6faea] px-3.5 py-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#55591f] mb-1.5">Try instead</p>
                    <p className="text-sm text-primary leading-relaxed">{e.fix}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={cn("flex-none m-6 mt-4 rounded-xl bg-[#222325] p-4 flex gap-3")}>
        <Lightbulb className="h-4 w-4 flex-none text-[#e1f073] mt-0.5" />
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#e1f073] mb-1">How to move this</p>
          <p className="text-sm text-white/80 leading-relaxed">{howToImprove}</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default EvidenceDialog;
