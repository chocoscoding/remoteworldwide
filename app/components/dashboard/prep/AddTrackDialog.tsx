"use client";

import { useMemo, useState, type FC } from "react";
import { Search, SearchX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TRACKER_COLUMNS } from "@/app/lib/dashboard/mock-data";
import type { NewTrackInput, PrepTrack } from "@/app/lib/dashboard/prep-data";

export interface AddTrackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: NewTrackInput) => void;
  existingTracks: PrepTrack[];
}

/**
 * The one on-ramp for prepping a job that isn't in the seed data — but
 * always by picking it, never by typing it in freehand. A prep track has to
 * trace back to a real application, same as everything else this feature
 * builds context from (panel research, likely questions) — so this searches
 * the tracker's "Interviewing" column rather than taking a free-text company
 * and role.
 */
const AddTrackDialog: FC<AddTrackDialogProps> = ({ open, onOpenChange, onAdd, existingTracks }) => {
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    const interviewing = TRACKER_COLUMNS.find((c) => c.id === "interviewing")?.cards ?? [];
    const already = new Set(existingTracks.map((t) => t.company.toLowerCase()));
    const q = query.trim().toLowerCase();
    return interviewing.filter((card) => {
      if (already.has(card.company.toLowerCase())) return false;
      if (q && !`${card.company} ${card.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, existingTracks]);

  function handleSelect(company: string, role: string) {
    onAdd({ company, role });
    setQuery("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white rounded-[20px] border-2 border-[#222325] p-0 gap-0 max-w-[440px] overflow-hidden">
        <div className="p-6 pb-4">
          <DialogTitle className="text-lg font-bold text-primary">Prep for a new job</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-black/50">
            Pulled from your tracker&apos;s Interviewing column — pick the one you want to prep for.
          </DialogDescription>
          <div className="mt-4 flex items-center gap-2 rounded-lg border-[1.5px] border-black/14 bg-[#fbfbf7] px-3 py-2.5">
            <Search className="h-3.5 w-3.5 text-black/40 flex-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Role or company"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold text-primary placeholder:text-black/35 placeholder:font-medium"
            />
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto border-t border-black/8">
          {candidates.length === 0 ? (
            <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
              <span className="h-11 w-11 rounded-full bg-[#f0f0ea] flex items-center justify-center">
                <SearchX className="h-4.5 w-4.5 text-black/35" />
              </span>
              <p className="text-sm text-black/50 leading-relaxed max-w-[280px]">
                {query
                  ? "No interviewing-stage jobs match that search."
                  : "Every job in your tracker's Interviewing column already has a prep track."}
              </p>
            </div>
          ) : (
            candidates.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelect(card.company, card.title)}
                className="w-full flex items-center gap-3 px-6 py-3.5 border-b border-black/6 last:border-b-0 text-left cursor-pointer hover:bg-[#fbfbf7] transition-colors">
                <span className="h-9 w-9 flex-none rounded-lg bg-[#f0f0ea] flex items-center justify-center text-xs font-extrabold text-black/60">
                  {card.company.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-primary truncate">
                    {card.company} — {card.title}
                  </span>
                  {card.statusChip && <span className="block text-xs text-black/45 truncate">{card.statusChip}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddTrackDialog;
