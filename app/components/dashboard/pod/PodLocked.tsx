"use client";

// The pod screen below Basic. The backend refused the overview (403
// plan_required: the pod is on Basic and up), so this says what a pod is and
// how to get one. A seat taken before the account moved to Free is kept, not
// taken away, so leaving stays possible here: it is the one pod route Free can
// still use, and it answers "You are not in a pod" for anyone who has none.

import { useState, type FC } from "react";
import { toast } from "sonner";
import DashCard from "@/app/components/dashboard/ui/DashCard";
import EmptyStateLottie from "@/app/components/dashboard/ui/EmptyStateLottie";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import NotificationBell from "@/app/components/dashboard/notifications/NotificationBell";
import { PlanChip } from "@/app/components/dashboard/billing/UpgradeModal";
import { usePlanLock } from "@/app/components/dashboard/billing/PlanLock";
import { apiPost } from "@/app/lib/api/client";
import { apiMessage } from "@/app/lib/api/core";
import { BASIC_GATES } from "@/app/lib/settings/planGates";

const LOTTIE = "/Lottie/neobrutalism/Video_Online_Meetings_lottie.json";

const PodLocked: FC = () => {
  const { upgrade } = usePlanLock(BASIC_GATES.pod);
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
    <div className="min-h-screen bg-[#f6f6f6]">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="whitespace-nowrap text-[17px] font-bold text-primary">Your pod</h1>
          <PlanChip plan="basic" />
        </div>
        <NotificationBell />
      </header>

      <main className="mx-auto max-w-[1180px] px-8 py-7 pb-14">
        <DashCard className="mx-auto mt-12 max-w-md px-10 pb-10 pt-4 text-center" data-pod-locked>
          <EmptyStateLottie src={LOTTIE} size={180} />
          <p className="text-lg font-bold text-primary">Pods come with Basic</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-black/50">
            A small group at your level, in your timezone, with weekly goals and wins to keep each other going. Your streak stays free either way.
          </p>
          <StickerButton variant="primary" size="md" className="mt-6" onClick={upgrade}>
            Upgrade to Basic
          </StickerButton>

          {leave !== "done" && (
            <p className="mt-5 text-xs text-black/50">
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
          )}
        </DashCard>
      </main>
    </div>
  );
};

export default PodLocked;
