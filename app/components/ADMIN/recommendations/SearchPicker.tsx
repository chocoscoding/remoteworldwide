"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "../blog/OfferTargeting";

/**
 * A search box over a server action, for the recommendation form's two
 * pickers (candidate by email, Remote Worldwide listing). Debounced, and the
 * results shown are always the ones for the text in the box — a slow answer to
 * an older query can't overwrite a newer one, and nothing is set synchronously
 * inside the effect.
 */
export interface SearchPickerProps<T> {
  label: string;
  placeholder: string;
  hint?: string;
  /** Below this many characters nothing is searched. */
  minChars?: number;
  search: (q: string) => Promise<T[]>;
  keyOf: (row: T) => string;
  render: (row: T) => ReactNode;
  onPick: (row: T) => void;
}

const DEBOUNCE_MS = 300;

export default function SearchPicker<T>({ label, placeholder, hint, minChars = 2, search, keyOf, render, onPick }: SearchPickerProps<T>) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<{ q: string; rows: T[]; failed: boolean } | null>(null);
  const q = term.trim();
  const active = q.length >= minChars;

  useEffect(() => {
    if (q.length < minChars) return;
    let live = true;
    const handle = window.setTimeout(() => {
      search(q)
        .then((rows) => live && setResults({ q, rows, failed: false }))
        .catch(() => live && setResults({ q, rows: [], failed: true }));
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [q, minChars, search]);

  const current = active && results?.q === q ? results : null;

  return (
    <div>
      <label className={ADMIN_LABEL}>{label}</label>
      <input value={term} onChange={(e) => setTerm(e.target.value)} className={ADMIN_INPUT} placeholder={placeholder} />
      {hint && <p className={ADMIN_HINT}>{hint}</p>}
      {active && (
        <div className="mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white">
          {!current ? (
            <p className="p-2 text-xs text-gray-500">Searching…</p>
          ) : current.failed ? (
            <p className="p-2 text-xs text-red-600">The search failed. Try again.</p>
          ) : current.rows.length === 0 ? (
            <p className="p-2 text-xs text-gray-500">No matches.</p>
          ) : (
            current.rows.map((row) => (
              <button
                key={keyOf(row)}
                type="button"
                onClick={() => {
                  onPick(row);
                  setTerm("");
                }}
                className="block w-full border-b border-gray-100 p-2 text-left text-sm last:border-b-0 hover:bg-gray-50">
                {render(row)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
