"use client";

// Application answers — app-wide state, backed by the AI service.
//
// Mounted once in DashboardShell, beside ActivityProvider, because two
// unrelated route trees read the same library: the answers screen edits it,
// and the apply wizard's step 5 fills forms from it. Route-scoped state was
// the old design's core failure — resolving a review on one screen left the
// other still showing it unresolved.
//
// An ADAPTER over React Query, the way SettingsProvider is: `items`,
// `reviewCount`, `resolveReview`, `saveEdit` and `removeAnswer` read and behave
// as they did over the mock, so the apply wizard did not move. Two things
// changed shape, both additive or unavoidable: `addAnswer` is async (the server
// decides what counts as the same question — there is no client-side normalize
// any more), and `loading` / `loadError` / `retry` / `extensionSaving` are new.
//
// The library is `ai_answers`, the same store autofill reads first and files
// its drafts into, so what this list shows is what the next form gets. The
// extension settings are the account's (`settings.extension`, backend
// `user_settings`); `extension.connected` is not one of them — it is this
// browser, answered live by the extension itself (`app/lib/extension/presence`),
// so a screen may say "connected" only about an extension that just said so.

import { createContext, useContext, useMemo, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import type { AddAnswerResult } from "@/app/lib/answers/types";
import type { QaItem } from "@/app/lib/dashboard/types";
import { useExtensionPresence, type ExtensionStatus } from "@/app/lib/extension/presence";
import type { ExtensionSettings as SavedExtensionSettings } from "@/app/lib/settings/types";
import { useAnswersQuery } from "@/hooks/queries/useAnswersQuery";
import { useProfileSettings } from "@/hooks/queries/useSettingsQuery";
import { useCreateAnswer, useDeleteAnswer, useResolveAnswer, useUpdateAnswer } from "@/hooks/mutations/useAnswerMutations";
import { DEFAULT_EXTENSION_SETTINGS, useSaveExtensionSettings } from "@/hooks/mutations/useSaveExtensionSettings";

export type { AddAnswerResult, SavedExtensionSettings };

export interface ExtensionSettings extends SavedExtensionSettings {
  /**
   * Whether the extension answered this browser's ping. Not a saved setting and
   * not an account fact — it is about the browser on screen right now.
   */
  connected: boolean;
  /**
   * The handshake itself, for a reader that must not claim "not installed"
   * during the moment before an answer arrives. Optional: `connected` is the
   * field every existing consumer reads.
   */
  status?: ExtensionStatus;
  /** The installed extension's version, when one answered. */
  version?: string | null;
}

export interface AddAnswerInput {
  q: string;
  a: string;
  cat: QaItem["cat"];
}

interface AnswersContextValue {
  items: QaItem[];
  reviewCount: number;
  /** True until the library's first load settles. An empty `items` before then is not an empty library. */
  loading: boolean;
  /** Why the library could not be loaded, when it could not. */
  loadError: string | null;
  retry: () => void;
  extension: ExtensionSettings;
  /** A switch is saving to the account. */
  extensionSaving: boolean;
  /** Saves to the account as it flips. */
  setExtension: (patch: Partial<SavedExtensionSettings>) => void;
  /** Review -> saved, keeping either the user's wording or the draft. Toasts with Undo. */
  resolveReview: (id: string, choice: "mine" | "draft") => void;
  saveEdit: (id: string, text: string) => void;
  /**
   * Saves a new answer. A question the library already holds (by the server's
   * key) comes back as `{ added: false, existing }` untouched; null means the
   * save failed and the reason was already shown.
   */
  addAnswer: (input: AddAnswerInput) => Promise<AddAnswerResult | null>;
  /** Delete with Undo (re-saves the same question and answer). */
  removeAnswer: (id: string) => void;
}

const AnswersContext = createContext<AnswersContextValue | null>(null);

const NO_ITEMS: QaItem[] = [];

export const AnswersProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { data, isPending, error, refetch } = useAnswersQuery();
  // Same cache entry SettingsProvider seeds from the layout's fetch, so this is
  // warm from the first render and never a second request.
  const { data: settings } = useProfileSettings();

  const create = useCreateAnswer();
  const update = useUpdateAnswer();
  const resolve = useResolveAnswer();
  const remove = useDeleteAnswer();
  const saveExtension = useSaveExtensionSettings();

  const items = data ?? NO_ITEMS;

  // Asked once, here, rather than by each screen that shows the answer: the
  // handshake is per-browser, so one ping for the whole dashboard is enough.
  const presence = useExtensionPresence();

  // A backend older than the `extension` section answers without it; the
  // defaults (demographics off) stand in rather than a crash.
  const saved = settings?.extension;
  const extension = useMemo<ExtensionSettings>(
    () => ({
      ...DEFAULT_EXTENSION_SETTINGS,
      ...saved,
      connected: presence.status === "installed",
      status: presence.status,
      version: presence.version,
    }),
    [saved, presence.status, presence.version],
  );

  // Success toasts hang off each call's own promise rather than `mutate`'s
  // callbacks: those fire for the LATEST call only, so resolving two reviews in
  // quick succession would toast (and offer Undo for) just the second. Failures
  // were already toasted by the mutation hooks, so a rejection is swallowed here.
  const quietly = () => undefined;

  function resolveReview(id: string, choice: "mine" | "draft") {
    const prior = items.find((i) => i.id === id);
    if (!prior || prior.kind !== "review") return;

    resolve.mutateAsync({ id, choice }).then(
      () =>
        toast.success(choice === "mine" ? "Kept your wording" : "Kept the draft", {
          description: "This answer goes out on every future application.",
          action: {
            label: "Undo",
            // Puts the saved wording and the waiting draft back exactly as they were.
            onClick: () => void update.mutateAsync({ id, patch: { a: prior.a, draft: prior.draft ?? null } }).catch(quietly),
          },
        }),
      quietly,
    );
  }

  function saveEdit(id: string, text: string) {
    update.mutateAsync({ id, patch: { a: text } }).then(
      () => toast.success("Answer saved", { description: "Used everywhere from now on." }),
      quietly,
    );
  }

  async function addAnswer(input: AddAnswerInput): Promise<AddAnswerResult | null> {
    try {
      return await create.mutateAsync({ q: input.q.trim(), a: input.a.trim(), cat: input.cat });
    } catch {
      // useCreateAnswer already toasted the reason.
      return null;
    }
  }

  function removeAnswer(id: string) {
    const removed = items.find((i) => i.id === id);
    if (!removed) return;

    remove.mutateAsync(id).then(
      () =>
        toast("Answer deleted", {
          description: removed.q,
          action: {
            label: "Undo",
            // A re-save of the same question and answer. It comes back as the
            // user's own ("saved") and at the top of the list — the row is new
            // to the server — which is what keeping it on purpose means.
            onClick: () =>
              void create.mutateAsync({ q: removed.q, a: removed.a, cat: removed.cat }).then((result) => {
                if (!result.added) toast("Already in your library", { description: result.existing.q });
              }, quietly),
          },
        }),
      quietly,
    );
  }

  const reviewCount = items.filter((i) => i.kind === "review").length;

  return (
    <AnswersContext.Provider
      value={{
        items,
        reviewCount,
        loading: isPending,
        // Only when there is nothing to show: a failed background refetch keeps
        // the answers already on screen rather than replacing them with an error.
        loadError: error && !data ? apiMessage(error) : null,
        retry: () => void refetch(),
        extension,
        extensionSaving: saveExtension.isPending,
        setExtension: (patch) => saveExtension.mutate(patch),
        resolveReview,
        saveEdit,
        addAnswer,
        removeAnswer,
      }}>
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
