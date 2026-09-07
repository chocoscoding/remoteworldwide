"use client";

import { useState, useTransition, type FC } from "react";
import { toast } from "react-toastify";
import { setOfferActive } from "@/libs/blog-admin";
import type { OfferKind } from "@/app/lib/blog/offers";

export const OfferSwitch: FC<{ checked: boolean; onChange: (next: boolean) => void; label?: string; disabled?: boolean; size?: "sm" | "md" }> = ({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
}) => {
  const track = size === "sm" ? "h-6 w-11" : "h-7 w-[52px]";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const travel = size === "sm" ? "translate-x-5" : "translate-x-6";
  return (
    <label className={`inline-flex items-center gap-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex ${track} flex-none items-center rounded-full border-2 border-[#222325] transition-colors duration-150 ${checked ? "bg-[#e1f073]" : "bg-white"}`}>
        <span
          aria-hidden
          className={`absolute left-[3px] ${knob} rounded-full border-2 border-[#222325] bg-[#222325] transition-transform duration-150 ${checked ? travel : "translate-x-0"}`}
        />
      </button>
      {label && <span className="text-sm font-semibold text-[#222325]">{label}</span>}
    </label>
  );
};

export const ActiveToggle: FC<{ kind: OfferKind; id: string; initial: boolean; name: string }> = ({ kind, id, initial, name }) => {
  const [active, setActive] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <OfferSwitch
      checked={active}
      disabled={pending}
      size="sm"
      label={active ? "On" : "Off"}
      onChange={(next) => {
        const before = active;
        setActive(next);
        start(async () => {
          try {
            await setOfferActive(kind, id, next);
            toast.success(`${name} is now ${next ? "on" : "off"}`);
          } catch (err: unknown) {
            setActive(before);
            toast.error(err instanceof Error ? err.message : "Could not update");
          }
        });
      }}
    />
  );
};

export default OfferSwitch;
