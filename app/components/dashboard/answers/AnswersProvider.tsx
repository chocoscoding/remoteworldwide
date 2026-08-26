"use client";

// Application answers — app-wide state.
//
// Mounted once in DashboardShell, beside ActivityProvider, because two
// unrelated route trees read the same library: the answers screen edits it,
// and the apply wizard's step 5 fills forms from it. Route-scoped state was
// the old design's core failure — resolving a review on one screen left the
// other still showing it unresolved.
//
// Mock-only: in-memory, resets on reload. Every mutation here is the seam a
// real sync backend fills.

import { createContext, useContext, useRef, useState, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { QA } from "@/app/lib/dashboard/mock-data";
import type { QaItem } from "@/app/lib/dashboard/types";

export interface ExtensionSettings {
  connected: boolean;
  /** Fill known questions on external application forms automatically. */
  autoFill: boolean;
  /** Draft an answer for questions it has never seen, flagged for review. */
  draftNewQuestions: boolean;
  /** Demographics stay untouched unless explicitly allowed. */
  fillDemographics: boolean;
}

export interface AddAnswerInput {
  q: string;
  a: string;
  cat: QaItem["cat"];
}

export type AddAnswerResult = { added: true; item: QaItem } | { added: false; existing: QaItem };

interface AnswersContextValue {
  items: QaItem[];
  reviewCount: number;
  extension: ExtensionSettings;
  setExtension: (patch: Partial<ExtensionSettings>) => void;
  /** Review -> saved, keeping either the user's wording or the draft. Toasts with Undo. */
  resolveReview: (id: string, choice: "mine" | "draft") => void;
  saveEdit: (id: string, text: string) => void;
  /** Dedupes on the normalized question — a duplicate returns the existing entry untouched. */
  addAnswer: (input: AddAnswerInput) => AddAnswerResult;
  /** Delete with a real Undo (restores at the original position). */
  removeAnswer: (id: string) => void;
}

const AnswersContext = createContext<AnswersContextValue | null>(null);

const normalize = (q: string) => q.trim().toLowerCase().replace(/[?.!]+$/, "");

export const AnswersProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<QaItem[]>(QA);
  const [extension, setExtensionState] = useState<ExtensionSettings>({
    connected: true,
    autoFill: true,
    draftNewQuestions: true,
    fillDemographics: false,
  });

  // Ref, not a local: a plain counter would reset on every render.
  const addSeq = useRef(0);

  function setExtension(patch: Partial<ExtensionSettings>) {
    setExtensionState((prev) => ({ ...prev, ...patch }));
  }

  function resolveReview(id: string, choice: "mine" | "draft") {
    const prior = items.find((i) => i.id === id);
    if (!prior || prior.kind !== "review") return;

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, kind: "saved", a: choice === "draft" ? (i.draft ?? i.a) : i.a, draft: undefined } : i))
    );
    toast.success(choice === "mine" ? "Kept your wording" : "Kept the draft", {
      description: "This answer goes out on every future application.",
      action: {
        label: "Undo",
        onClick: () => setItems((prev) => prev.map((i) => (i.id === id ? prior : i))),
      },
    });
  }

  function saveEdit(id: string, text: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, a: text, kind: i.kind === "ai" ? "saved" : i.kind } : i)));
    toast.success("Answer saved", { description: "Used everywhere from now on." });
  }

  function addAnswer(input: AddAnswerInput): AddAnswerResult {
    const key = normalize(input.q);
    const existing = items.find((i) => normalize(i.q) === key);
    if (existing) return { added: false, existing };

    const item: QaItem = {
      id: `qa-custom-${Date.now().toString(36)}-${++addSeq.current}`,
      q: input.q.trim(),
      a: input.a.trim(),
      kind: "saved",
      cat: input.cat,
    };
    setItems((prev) => [item, ...prev]);
    return { added: true, item };
  }

  function removeAnswer(id: string) {
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return;
    const removed = items[index];

    setItems((prev) => prev.filter((i) => i.id !== id));
    toast("Answer deleted", {
      description: removed.q,
      action: {
        label: "Undo",
        onClick: () =>
          setItems((prev) => {
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          }),
      },
    });
  }

  const reviewCount = items.filter((i) => i.kind === "review").length;

  return (
    <AnswersContext.Provider value={{ items, reviewCount, extension, setExtension, resolveReview, saveEdit, addAnswer, removeAnswer }}>
      {children}
    </AnswersContext.Provider>
  );
};

export function useAnswers(): AnswersContextValue {
  const ctx = useContext(AnswersContext);
  if (!ctx) throw new Error("useAnswers must be used within AnswersProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// {company} token — "company names get swapped in automatically", made real.
// ---------------------------------------------------------------------------

export type AnswerPart = { type: "text"; text: string } | { type: "company"; text: string };

/**
 * Splits an answer around `{company}` tokens. With a company given, the token
 * carries that name (the by-application view); without one it stays the
 * literal placeholder (the library view renders it as a chip).
 */
export function renderAnswerParts(text: string, company?: string): AnswerPart[] {
  return text
    .split(/(\{company\})/g)
    .filter((seg) => seg.length > 0)
    .map((seg) => (seg === "{company}" ? { type: "company", text: company ?? "Company" } : { type: "text", text: seg }));
}
