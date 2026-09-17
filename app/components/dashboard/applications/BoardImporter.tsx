"use client";

// Moves a browser's stored tracker board into the applications table, once.
//
// Until Part 2 Phase B the board lived in localStorage. On a dashboard load
// where the server says this user's board was never imported, this reads the
// stored copy, drops the seed cards and anything malformed
// (app/lib/applications/boardImport.ts), and posts what is left. Only once the
// server has the cards is the stored copy forgotten. A failed POST leaves it
// where it was, to try again on the next load.
//
// When nothing is left, because every stored card was a seed, nothing is
// posted: the POST is what marks the import done for the whole account, and a
// browser holding none of the user's cards must not use it up before another
// browser holding their real board has loaded. The stored copy is forgotten
// here instead, so this browser does not try again.
//
// Renders nothing. Mounted once in DashboardShell, inside the providers.

import { useEffect, type FC } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import { importBoard } from "@/app/lib/applications/api";
import { STORED_BOARD_KEYS, boardImportCards, readStoredBoard } from "@/app/lib/applications/boardImport";
import type { BoardImportResult, GoalsItem } from "@/app/lib/applications/types";
import { clearPersisted } from "@/app/lib/persist/usePersistedState";
import { qk } from "@/app/lib/query/keys";
import { useGoals } from "@/hooks/queries/useApplicationsQuery";

const IMPORT_FAILED_TOAST = "board-import-failed";

/**
 * The import in flight, shared by every mount. StrictMode runs effects twice
 * and a remount runs them again; each must join the running import, never
 * start a second POST beside it.
 */
let inFlight: Promise<void> | null = null;

function importStoredBoard(queryClient: QueryClient): Promise<void> {
  inFlight ??= runImport(queryClient).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** localStorage, or null where touching it throws (Safari private mode, storage blocked by policy). */
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function runImport(queryClient: QueryClient): Promise<void> {
  const stored = readStoredBoard(browserStorage());
  // A browser that never kept a board has nothing to move, and posting an empty
  // import from it would mark this user's import done: a board kept in another
  // browser could then never come over.
  if (!stored.found) return;

  const cards = boardImportCards(stored.board, stored.closed);
  if (cards.length === 0) {
    clearPersisted(STORED_BOARD_KEYS.board);
    clearPersisted(STORED_BOARD_KEYS.closed);
    return;
  }

  let result: BoardImportResult;
  try {
    result = await importBoard({ cards });
  } catch (error) {
    toast.error("Your tracker board hasn't moved to your account yet", {
      id: IMPORT_FAILED_TOAST,
      description: `${apiMessage(error)} It's still in this browser, and we'll try again next time you open the dashboard.`,
      action: { label: "Try again", onClick: () => void importStoredBoard(queryClient) },
    });
    return;
  }

  // Marked in the cache as well as on the server, so nothing that renders
  // before the refetch lands can start the import again.
  queryClient.setQueryData<GoalsItem>(qk.activity.goals(), (goals) =>
    goals && goals.boardImportedAt === null ? { ...goals, boardImportedAt: new Date().toISOString() } : goals,
  );
  // Every activity read, goals among them: the imported rows change the list
  // and the summary, and goals now carry the import's date.
  void queryClient.invalidateQueries({ queryKey: qk.activity.all });
  // Forgotten only now that the server has the cards.
  clearPersisted(STORED_BOARD_KEYS.board);
  clearPersisted(STORED_BOARD_KEYS.closed);

  if (result.imported > 0) {
    toast.success("Your tracker board is saved to your account", {
      description: `${result.imported} ${result.imported === 1 ? "application" : "applications"} moved over from this browser.`,
    });
  }
}

const BoardImporter: FC = () => {
  const queryClient = useQueryClient();
  const goals = useGoals();
  // Goals read during THIS load only. A copy restored from the disk cache can
  // predate an import another tab already finished, and would still say never.
  const due = goals.isFetchedAfterMount && goals.data?.boardImportedAt === null;

  useEffect(() => {
    if (due) void importStoredBoard(queryClient);
  }, [due, queryClient]);

  return null;
};

export default BoardImporter;
