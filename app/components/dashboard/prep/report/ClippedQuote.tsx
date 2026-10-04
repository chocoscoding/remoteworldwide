"use client";

import { useState, type FC } from "react";
import { cn } from "@/lib/utils";

/**
 * An answer quoted in the candidate's own words, in quotes and italic. A long
 * one is cut at a word and opens in place, so one long answer doesn't push
 * the rest of the card away.
 */
export interface ClippedQuoteProps {
  text: string;
  /** Past this many characters the quote is cut. */
  clip?: number;
  className?: string;
}

const ClippedQuote: FC<ClippedQuoteProps> = ({ text, clip = 320, className }) => {
  const [whole, setWhole] = useState(false);
  const clean = text.trim();
  const long = clean.length > clip;
  const shown = long && !whole ? `${clean.slice(0, clip).replace(/\s+\S*$/, "")}…` : clean;
  return (
    <div className={cn("min-w-0", className)}>
      <p className="italic leading-relaxed">“{shown}”</p>
      {long && (
        <button
          type="button"
          onClick={() => setWhole((v) => !v)}
          className="mt-1 cursor-pointer rounded text-xs font-bold not-italic text-[#222325] underline decoration-black/30 underline-offset-2 hover:decoration-[#222325] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073]">
          {whole ? "Show less" : "Show the whole answer"}
        </button>
      )}
    </div>
  );
};

export default ClippedQuote;
