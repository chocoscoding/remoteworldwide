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
import type { Checkout, Subscription } from "@/app/lib/settings/types";

const PENDING_NOTE = "Payments are not connected yet — we will be in touch to finish it.";

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
  return useBillingMutation<Checkout, string>(
    (planKey) => apiPost<Checkout>("/api/billing/checkout/plan", { planKey }),
    (checkout) => {
      onCheckout(checkout);
      toast.success("Plan reserved", { description: PENDING_NOTE });
    },
  );
}

export function useBuyCredits(onCheckout: (checkout: Checkout) => void) {
  return useBillingMutation<Checkout, string>(
    (packKey) => apiPost<Checkout>("/api/billing/checkout/credits", { packKey }),
    (checkout) => {
      onCheckout(checkout);
      toast.success("Credits reserved", { description: PENDING_NOTE });
    },
  );
}

export function useCancelPlan() {
  return useBillingMutation<Subscription, void>(
    () => apiPost<Subscription>("/api/billing/subscription/cancel"),
    () => toast.success("Your plan will end at the close of this period"),
  );
}
