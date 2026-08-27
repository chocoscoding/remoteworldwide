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
import { Toaster } from "@/components/ui/sonner";
import DashboardSidebar from "./DashboardSidebar";
import { SidebarCollapseProvider } from "./SidebarCollapseContext";
import { ActivityProvider } from "./activity/ActivityProvider";
import { AnswersProvider } from "./answers/AnswersProvider";
import { DocumentsProvider } from "./documents/DocumentsProvider";
import { NetworkProvider } from "./network/NetworkProvider";
import { SettingsProvider } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import StreakMilestoneModal from "./streak/StreakMilestoneModal";
import LogApplicationDialog from "./log/LogApplicationDialog";
import CreditStore from "./credits/CreditStore";
import RepairStreakPanel from "./streak/RepairStreakPanel";

const DashboardShell: FC<{ children: ReactNode }> = ({ children }) => (
  <SidebarCollapseProvider>
    <ActivityProvider>
      {/* SettingsProvider is app-wide, not settings-scoped: your preferences
          are what the recommendation fit scores are computed from, so the
          recommend screen has to read them too. NetworkProvider sits inside
          ActivityProvider because asking for a referral is a logged action. */}
      <SettingsProvider>
      <NetworkProvider>
      <AnswersProvider>
      <DocumentsProvider>
      <div className="w-full flex">
        <DashboardSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      <LogApplicationDialog />
      <CreditStore />
      <RepairStreakPanel />
      <StreakMilestoneModal />
      <Toaster />
      </DocumentsProvider>
      </AnswersProvider>
      </NetworkProvider>
      </SettingsProvider>
    </ActivityProvider>
  </SidebarCollapseProvider>
);

export default DashboardShell;
