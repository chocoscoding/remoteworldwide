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
import WinProvider from "./win/WinProvider";
import { SettingsProvider } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { BillingProvider } from "@/app/(pages)/(dashboard)/dashboard/settings/BillingProvider";
import StreakMilestoneModal from "./streak/StreakMilestoneModal";
import WeekCardModal from "./streak/WeekCardModal";
import LogApplicationDialog from "./log/LogApplicationDialog";
import GiftStore from "./gifts/GiftStore";
import { TrackerProvider } from "./tracker/TrackerProvider";
import RepairStreakPanel from "./streak/RepairStreakPanel";
import { JobPickerProvider } from "./jobs/JobPickerProvider";
import BoardImporter from "./applications/BoardImporter";
import OnboardingBanner from "./onboarding/OnboardingBanner";
import { PlanGateProvider } from "./billing/UpgradeModal";
import SmallScreenGate, { DesktopOnly } from "./SmallScreenGate";

const DashboardShell: FC<{ settings: Settings; billing: BillingOverview; children: ReactNode }> = ({ settings, billing, children }) => (
  <SidebarCollapseProvider>
    <ActivityProvider>
      {/* SettingsProvider is app-wide, not settings-scoped: your preferences
          are what the recommendation fit scores are computed from, so the
          recommend screen has to read them too. NetworkProvider sits inside
          ActivityProvider because asking for a referral is a logged action. */}
      <SettingsProvider initial={settings}>
      <BillingProvider initial={billing}>
      {/* Right inside billing, which it reads: the one upgrade popup, opened by any call refused
          for the plan (402 / 403 plan_required) or by a locked control. */}
      <PlanGateProvider>
      <NetworkProvider>
      <AnswersProvider>
      <DocumentsProvider>
      {/* No pod provider here: the pod's context is LivePodProvider, mounted by
          /dashboard/pod alone. A landed job or a tracker step posts to the pod
          API directly. */}
      {/* JobPickerProvider wraps WinProvider and TrackerProvider because both
          open the picker from inside themselves: the win log asks which job
          won, the tracker's add flow asks which job to add. Any lower and
          their pickJob would have no provider to reach. */}
      <JobPickerProvider>
      <WinProvider>
      {/* TrackerProvider is innermost: every board move is a logged action
          (ActivityProvider) and landing in Offer offers the win log
          (WinProvider), so it has to sit inside both. It lives here rather
          than in the tracker screen because Home reads the same board to
          decide which applications are owed a follow-up. */}
      <TrackerProvider>
      {/* Desktop-only workspace: below md the gate covers the screen and the shell is display:none
          (still mounted, so nothing remounts on rotate or resize). Pure CSS, no flash. */}
      <SmallScreenGate />
      <div className="w-full hidden md:flex">
        <DashboardSidebar />
        <div className="flex-1 min-w-0">
          {/* Above every screen, never instead of one: setup is guidance, not
              a lock — the banner counts what's done and points at
              /dashboard/onboarding, the one screen it stays off. */}
          <OnboardingBanner />
          {children}
        </div>
      </div>
      {/* These portal to <body>, past the hidden shell, and some open by themselves (the Monday
          week card, a streak celebration). Below md they wait unmounted, state kept in their providers. */}
      <DesktopOnly>
        <LogApplicationDialog />
        <GiftStore />
        <RepairStreakPanel />
        <StreakMilestoneModal />
        <WeekCardModal />
      </DesktopOnly>
      {/* Moves a tracker board kept in this browser into the applications
          table, once. Inside the providers for the query client and toasts. */}
      <BoardImporter />
      <Toaster />
      </TrackerProvider>
      </WinProvider>
      </JobPickerProvider>
      </DocumentsProvider>
      </AnswersProvider>
      </NetworkProvider>
      </PlanGateProvider>
      </BillingProvider>
      </SettingsProvider>
    </ActivityProvider>
  </SidebarCollapseProvider>
);

export default DashboardShell;
