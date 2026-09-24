"use client";

// Application drafts — applications started and not sent yet.
//
// The browser extension writes them (rwwextension/docs/drafts.md): while a form
// on a company's site is being filled, what the user answers is kept, first in
// the browser and then on the account. Leave without applying and it is listed
// here; open that posting again and the extension's button on the form can fill
// it back in — only when the user presses it and picks the draft, never on its
// own. Applying by any route — the extension, the apply wizard, the tracker, or
// "Mark as applied" here — fuses the draft into the application's answers, and
// it moves to the Applied tab until it expires 30 days later.
//
// This screen writes no drafts of its own. It reads one list (`status=all`,
// split here into the two tabs so both counts come from one read), refetched
// whenever the window regains focus, because the tab that changes it is the
// application the user just came back from.

import { FC, useId, useState } from "react";
import Link from "next/link";
import { FilePen, Send } from "lucide-react";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import DashEmptyState from "@/app/components/dashboard/ui/DashEmptyState";
import SlidingTabs, { slidingTabId, slidingTabPanelId } from "@/app/components/dashboard/ui/SlidingTabs";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import DraftRow from "@/app/components/dashboard/drafts/DraftRow";
import ExtensionStrip from "@/app/components/dashboard/drafts/ExtensionStrip";
import type { ApplicationDraftItem } from "@/app/lib/drafts/types";
import { useExtensionPresence } from "@/app/lib/extension/presence";
import { useDraftsQuery } from "@/hooks/queries/useDraftsQuery";

type DraftsTab = "draft" | "applied";

/** Latest application first; the list arrives in `updatedAt` order, which a later save to a fused draft can disturb. */
const byAppliedAt = (a: ApplicationDraftItem, b: ApplicationDraftItem) => (b.appliedAt ?? "").localeCompare(a.appliedAt ?? "");

/** Flat pulse rows in the list's own layout, while it loads. */
const ListSkeleton: FC = () => (
  <DashCard className="overflow-hidden p-0" aria-busy="true" aria-label="Loading your drafts">
    <div className="flex flex-col divide-y divide-black/8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-5">
          <span className="h-11 w-11 flex-none animate-pulse rounded-full bg-black/[0.07]" />
          <div className="min-w-0 flex-1">
            <span className="block h-4 w-44 animate-pulse rounded bg-black/[0.07]" />
            <span className="mt-2 block h-3 w-64 animate-pulse rounded bg-black/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  </DashCard>
);

const DraftsClient: FC = () => {
  const drafts = useDraftsQuery("all");
  const presence = useExtensionPresence();
  const [tab, setTab] = useState<DraftsTab>("draft");
  const tabsId = useId();

  const all = drafts.data ?? [];
  // A form whose every touched answer was cleared again leaves a draft with
  // nothing in it; there is nothing to pick up, so it is not listed.
  const inProgress = all.filter((draft) => draft.status === "draft" && draft.answerCount > 0);
  const applied = all.filter((draft) => draft.status === "applied").sort(byAppliedAt);
  const list = tab === "draft" ? inProgress : applied;
  const loaded = drafts.data !== undefined;

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Application drafts</h1>
          <span className="hidden truncate text-sm text-black/45 sm:inline">Applications you started and haven&apos;t sent yet</span>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
        {presence.status === "absent" && <ExtensionStrip />}

        <SlidingTabs
          className="mb-5"
          value={tab}
          onChange={setTab}
          tablist={{ id: tabsId, label: "Drafts" }}
          options={[
            { id: "draft", label: "In progress", count: loaded ? inProgress.length : undefined },
            { id: "applied", label: "Applied", count: loaded ? applied.length : undefined },
          ]}
        />

        <div role="tabpanel" id={slidingTabPanelId(tabsId, tab)} aria-labelledby={slidingTabId(tabsId, tab)}>
          {drafts.isPending ? (
            <ListSkeleton />
          ) : drafts.isError && all.length === 0 ? (
            <DashCard className="flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm font-semibold text-primary">We couldn&apos;t load your drafts.</p>
              <StickerButton variant="outline" size="sm" onClick={() => void drafts.refetch()}>
                Try again
              </StickerButton>
            </DashCard>
          ) : list.length === 0 ? (
            tab === "draft" ? (
              <DashEmptyState
                icon={FilePen}
                title="No drafts in progress"
                body="Fill in a job application with the browser extension and your answers are saved here automatically as you go. Leave before you apply, and when you open that job again, press the RemoteWorldwide button on the form and choose your draft to fill it back in."
              />
            ) : (
              <DashEmptyState
                icon={Send}
                title="Nothing applied from a draft yet"
                body="When you apply — through the extension, the apply wizard, the tracker or Mark as applied here — a draft's answers join your application answers, and it's listed here for 30 days."
              />
            )
          ) : (
            <>
              <p className="mb-3 text-xs text-black/55">
                {tab === "draft" ? (
                  `${list.length} draft${list.length === 1 ? "" : "s"}, most recently saved first. Continue one, then press the RemoteWorldwide button on the form to fill it from your draft.`
                ) : (
                  <>
                    Applied in the last 30 days. Their answers are in{" "}
                    <Link href="/dashboard/questions" className="font-semibold text-primary underline decoration-black/25 underline-offset-2 hover:decoration-[#222325]">
                      Application answers
                    </Link>
                    .
                  </>
                )}
              </p>
              <DashCard className="overflow-hidden p-0">
                <div className="flex flex-col divide-y divide-black/8">
                  {list.map((draft) => (
                    <DraftRow key={draft.id} draft={draft} />
                  ))}
                </div>
              </DashCard>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DraftsClient;
