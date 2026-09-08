"use client";

// Client wrapper between the async `DashboardLayout` Server Component (auth
// gate) and the actual shell — needed so `SidebarCollapseProvider` (a client
// context) can wrap both `DashboardSidebar` and every screen's `children`.
//
// `ActivityProvider` sits inside it for the same reason: applications, the
// streak derived from them, goals and the audit trail are all read by the
// header pill, the Home cards, the tracker and the pod screen, and the
// milestone celebration has to be able to fire from any of them.

import type { FC, ReactNode } from "react";
import type { BillingOverview, Settings } from "@/app/lib/settings/types";
import { Toaster } from "@/components/ui/sonner";
import DashboardSidebar from "./DashboardSidebar";
import { SidebarCollapseProvider } from "./SidebarCollapseContext";
import { ActivityProvider } from "./activity/ActivityProvider";
import { AnswersProvider } from "./answers/AnswersProvider";
import { DocumentsProvider } from "./documents/DocumentsProvider";
import { NetworkProvider } from "./network/NetworkProvider";
import PodProvider from "./pod/PodProvider";
import WinProvider from "./win/WinProvider";
import { SettingsProvider } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { BillingProvider } from "@/app/(pages)/(dashboard)/dashboard/settings/BillingProvider";
import StreakMilestoneModal from "./streak/StreakMilestoneModal";
import LogApplicationDialog from "./log/LogApplicationDialog";
import GiftStore from "./gifts/GiftStore";
import { TrackerProvider } from "./tracker/TrackerProvider";
import RepairStreakPanel from "./streak/RepairStreakPanel";

const DashboardShell: FC<{ settings: Settings; billing: BillingOverview; children: ReactNode }> = ({ settings, billing, children }) => (
  <SidebarCollapseProvider>
    <ActivityProvider>
      {/* SettingsProvider is app-wide, not settings-scoped: your preferences
          are what the recommendation fit scores are computed from, so the
          recommend screen has to read them too. NetworkProvider sits inside
          ActivityProvider because asking for a referral is a logged action. */}
      <SettingsProvider initial={settings}>
      <BillingProvider initial={billing}>
      <NetworkProvider>
      <AnswersProvider>
      <DocumentsProvider>
      {/* PodProvider before WinProvider: logging a win pushes onto the pod
          feed and its goals, so the win flow reads pod context. */}
      <PodProvider>
      <WinProvider>
      {/* TrackerProvider is innermost: every board move is a logged action
          (ActivityProvider) and landing in Offer offers the win log
          (WinProvider), so it has to sit inside both. It lives here rather
          than in the tracker screen because Home reads the same board to
          decide which applications are owed a follow-up. */}
      <TrackerProvider>
      <div className="w-full flex">
        <DashboardSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      <LogApplicationDialog />
      <GiftStore />
      <RepairStreakPanel />
      <StreakMilestoneModal />
      <Toaster />
      </TrackerProvider>
      </WinProvider>
      </PodProvider>
      </DocumentsProvider>
      </AnswersProvider>
      </NetworkProvider>
      </BillingProvider>
      </SettingsProvider>
    </ActivityProvider>
  </SidebarCollapseProvider>
);

export default DashboardShell;
