"use client";

// Plan, credit balance and checkout state — now backed by React Query.
//
// App-wide because the sidebar credit meter and the billing screen must never
// disagree. Distinct from ActivityProvider.credits, which counts referral
// credits earned through invites — a different currency.
//
// Like SettingsProvider, this is an adapter: the context value is unchanged,
// so every screen reading `useBilling()` was untouched. What changed
// underneath is that a checkout or cancellation now invalidates the overview
// and refetches it, instead of the provider hand-patching its own local copy
// and hoping that guess matched what the server did.
//
// Note this domain is NOT persisted to localStorage (see PERSISTED_DOMAINS in
// query/keys.ts) — the payload carries plan and payment identifiers.

import { createContext, useContext, useState, type FC, type ReactNode } from "react";
import { useBillingQuery } from "@/hooks/queries/useBillingQuery";
import { useBuyCredits, useBuyPlan, useCancelPlan } from "@/hooks/mutations/useBillingMutations";
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
  const { data } = useBillingQuery(initial);
  const overview = data ?? initial;

  // Genuinely session-local: which checkout this tab just opened. It is not
  // server state and does not belong in the cache.
  const [lastCheckout, setLastCheckout] = useState<Checkout | null>(null);

  const buyPlan = useBuyPlan(setLastCheckout);
  const buyCredits = useBuyCredits(setLastCheckout);
  const cancelPlan = useCancelPlan();
  const busy = buyPlan.isPending || buyCredits.isPending || cancelPlan.isPending;

  return (
    <BillingContext.Provider
      value={{
        ...overview,
        busy,
        lastCheckout,
        buyPlan: (planKey) => buyPlan.mutate(planKey),
        buyCredits: (packKey) => buyCredits.mutate(packKey),
        cancelPlan: () => cancelPlan.mutate(),
      }}>
      {children}
    </BillingContext.Provider>
  );
};

export function useBilling(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within BillingProvider");
  return ctx;
}
