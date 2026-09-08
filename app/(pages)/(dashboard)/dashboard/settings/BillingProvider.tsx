"use client";

// Plan, credit balance and checkout state, hydrated in the dashboard layout.
// App-wide because the sidebar credit meter and the billing screen must never
// disagree. Distinct from ActivityProvider.credits, which counts referral
// credits earned through invites — a different currency.

import { createContext, useContext, useState, useTransition, type FC, type ReactNode } from "react";
import { toast } from "sonner";
import { cancelSubscription, startCreditCheckout, startPlanCheckout } from "@/libs/billing";
import type { BillingOverview, Checkout } from "@/app/lib/settings/types";

interface BillingContextValue extends BillingOverview {
  busy: boolean;
  /** The checkout this session just opened, so the screen can show what is pending. */
  lastCheckout: Checkout | null;
  buyPlan: (planKey: string) => void;
  buyCredits: (packKey: string) => void;
  cancelPlan: () => void;
}

const BillingContext = createContext<BillingContextValue | null>(null);

export const BillingProvider: FC<{ initial: BillingOverview; children: ReactNode }> = ({ initial, children }) => {
  const [overview, setOverview] = useState<BillingOverview>(initial);
  const [lastCheckout, setLastCheckout] = useState<Checkout | null>(null);
  const [busy, startBusy] = useTransition();

  function buyPlan(planKey: string) {
    startBusy(async () => {
      const result = await startPlanCheckout(planKey);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      setLastCheckout(result.data);
      setOverview((prev) => ({ ...prev, subscription: { ...prev.subscription, pendingPlanKey: planKey, status: "pending" } }));
      toast.success("Plan reserved", { description: "Payments are not connected yet — we will be in touch to finish it." });
    });
  }

  function buyCredits(packKey: string) {
    startBusy(async () => {
      const result = await startCreditCheckout(packKey);
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      setLastCheckout(result.data);
      toast.success("Credits reserved", { description: "Payments are not connected yet — we will be in touch to finish it." });
    });
  }

  function cancelPlan() {
    startBusy(async () => {
      const result = await cancelSubscription();
      if (result.error !== null) {
        toast.error(result.error);
        return;
      }
      setOverview((prev) => ({ ...prev, subscription: result.data }));
      toast.success("Your plan will end at the close of this period");
    });
  }

  return <BillingContext.Provider value={{ ...overview, busy, lastCheckout, buyPlan, buyCredits, cancelPlan }}>{children}</BillingContext.Provider>;
};

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within BillingProvider");
  return ctx;
}
