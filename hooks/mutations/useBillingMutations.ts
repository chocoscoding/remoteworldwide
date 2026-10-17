"use client";

// Checkout and cancellation.
//
// Deliberately NOT optimistic. An optimistic update is right when the client
// can predict the result; none of these can — a checkout returns a reference
// only the server can mint, and a cancellation returns the real period-end
// date. Writing a guess and correcting it would flash wrong money at someone.
// They invalidate and refetch instead.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { qk } from "@/app/lib/query/keys";
import type { BillingInterval, Checkout, Subscription } from "@/app/lib/settings/types";

const PENDING_NOTE = "Payments are not connected yet. We will be in touch to finish it.";

/**
 * With payments on, a checkout answers with Stripe's page (Checkout, or the portal for a plan
 * change) and the browser goes there. The webhook grants the plan; the billing screen picks it up
 * on the way back (`?checkout=success`).
 */
const goToStripe = (checkout: Checkout): boolean => {
  if (!checkout.url) return false;
  toast.loading("Opening secure checkout…");
  window.location.assign(checkout.url);
  return true;
};

function useBillingMutation<TData, TVars>(run: (vars: TVars) => Promise<TData>, onDone: (data: TData) => void) {
  const queryClient = useQueryClient();
  return useMutation<TData, unknown, TVars>({
    mutationFn: run,
    onError: (error) => toast.error(apiMessage(error)),
    onSuccess: onDone,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.billing.overview() });
    },
  });
}

export function useBuyPlan(onCheckout: (checkout: Checkout) => void) {
  return useBillingMutation<Checkout, { planKey: string; interval: BillingInterval }>(
    ({ planKey, interval }) => apiPost<Checkout>("/api/billing/checkout/plan", { planKey, interval }),
    (checkout) => {
      // An upgrade of a card subscription: the difference was charged and the plan has moved.
      if (checkout.upgraded) {
        toast.success("Plan upgraded", { description: "The difference for this period was charged to your card, and the extra credits are in." });
        return;
      }
      if (goToStripe(checkout)) return;
      onCheckout(checkout);
      toast.success(checkout.interval === "year" ? "Plan reserved, billed yearly" : "Plan reserved", { description: PENDING_NOTE });
    },
  );
}

export function useBuyCredits(onCheckout: (checkout: Checkout) => void) {
  return useBillingMutation<Checkout, string>(
    (packKey) => apiPost<Checkout>("/api/billing/checkout/credits", { packKey }),
    (checkout) => {
      if (goToStripe(checkout)) return;
      onCheckout(checkout);
      toast.success("Credits reserved", { description: PENDING_NOTE });
    },
  );
}

/** Stripe's billing portal: change plan, card, invoices, cancel. */
export function useOpenPortal() {
  return useBillingMutation<{ url: string }, void>(
    () => apiPost<{ url: string }>("/api/billing/portal"),
    ({ url }) => {
      toast.loading("Opening billing…");
      window.location.assign(url);
    },
  );
}

export function useCancelPlan() {
  return useBillingMutation<Subscription, void>(
    () => apiPost<Subscription>("/api/billing/subscription/cancel"),
    () => toast.success("Your plan will end at the close of this period"),
  );
}
