"use client";

// The pod screen below Basic. The backend refused the overview (403
// plan_required: the pod is on Basic and up), so the page is the plan card over
// a faded stand-in (PlanPageLock): what a pod is and how to get one. A seat taken before the account moved to Free is kept, not
// taken away, so leaving stays possible here: it is the one pod route Free can
// still use, and it answers "You are not in a pod" for anyone who has none.

import { useState, type FC } from "react";
import { toast } from "sonner";
import PlanPageLock from "@/app/components/dashboard/billing/PlanPageLock";
import { apiPost } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { BASIC_GATES } from "@/app/lib/settings/planGates";

const PodLocked: FC = () => {
  const [leave, setLeave] = useState<"idle" | "confirm" | "busy" | "done">("idle");

  const confirmLeave = async () => {
    setLeave("busy");
    try {
      await apiPost("/api/pod/leave");
      toast.success("You left your pod");
      setLeave("done");
    } catch (error) {
      toast.error(apiMessage(error));
      setLeave("idle");
    }
  };

  return (
    <PlanPageLock
      gate={BASIC_GATES.pod}
      title="Your pod"
      heading="Pods come with Basic"
      body="A small group at your level, in your timezone, with weekly goals and wins to keep each other going. Your streak stays free either way."
      footer={
        leave !== "done" ? (
        <p>
          {leave === "idle" ? (
            <>
              Still in a pod from before?{" "}
              <button
                type="button"
                onClick={() => setLeave("confirm")}
                className="cursor-pointer font-bold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
                Leave it
              </button>
            </>
          ) : (
            <>
              Leave your pod? If you&apos;re the last one in it, it ends.{" "}
              <button
                type="button"
                onClick={() => void confirmLeave()}
                disabled={leave === "busy"}
                className="cursor-pointer font-bold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid disabled:cursor-default disabled:opacity-60">
                {leave === "busy" ? "Leaving…" : "Yes, leave"}
              </button>{" "}
              <button
                type="button"
                onClick={() => setLeave("idle")}
                disabled={leave === "busy"}
                className="cursor-pointer font-semibold text-black/50 hover:text-primary disabled:cursor-default disabled:opacity-60">
                Cancel
              </button>
            </>
          )}
        </p>
        ) : null
      }
    />
  );
};

export default PodLocked;
