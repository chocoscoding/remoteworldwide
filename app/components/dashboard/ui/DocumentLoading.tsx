import type { FC } from "react";
import { Loader2 } from "lucide-react";

/**
 * What the resume creator and the cover letter screen show while a document named in the address
 * (?doc=, ?from=, ?letter=) is on its way (owner, 2026-10-08): a spinner and one line, centred on
 * the screen, rather than the landing the person did not ask for.
 */
const DocumentLoading: FC<{ kind: "resume" | "cover letter" }> = ({ kind }) => (
  <div role="status" aria-live="polite" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f6f6f6]">
    <Loader2 aria-hidden className="h-7 w-7 animate-spin text-black/35" />
    <p className="text-sm font-semibold text-black/55">Loading {kind}</p>
  </div>
);

export default DocumentLoading;
