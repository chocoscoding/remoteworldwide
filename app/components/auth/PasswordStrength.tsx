"use client";

// The strength hint under the password field.
//
// Deliberately quiet: no panel, no border, no fill. It is guidance while you
// type, not a form section — giving it a frame of its own made it compete with
// the fields on either side, which is the opposite of what a hint should do.
// One hairline bar, a small word, and the rules in plain muted text.
//
// Hidden until the field is focused, per the ask, and then it stays visible
// while there's something typed — collapsing it the instant focus moves to
// "confirm password" would hide the checklist exactly when the user is
// checking their work against it.
//
// All five rules are always listed, met ones marked. Revealing them one at a
// time as they're satisfied is a common pattern and a bad one: it hides the
// finish line, so the user can't tell whether they're one rule from done or
// four, and every keystroke is a surprise.

import { useEffect, useMemo, useState, type FC } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PASSWORD_RULES,
  STRENGTH_LABEL,
  evaluatePassword,
  isStrengthModelReady,
  loadStrengthModel,
  type StrengthLevel,
} from "@/app/lib/auth/password-strength";

export interface PasswordStrengthProps {
  password: string;
  /** The field is focused, or was and still holds a value. */
  open: boolean;
  id?: string;
}

/** Literal classes per level — a closed union the Tailwind scan can see. */
const METER: Record<Exclude<StrengthLevel, "empty">, { fill: string; text: string; width: string }> = {
  weak: { fill: "bg-[#c2553f]", text: "text-[#b23c26]", width: "w-1/4" },
  fair: { fill: "bg-amber-400", text: "text-amber-700", width: "w-2/4" },
  good: { fill: "bg-[#cddd54]", text: "text-[#6c7a1e]", width: "w-3/4" },
  strong: { fill: "bg-[#6c7a1e]", text: "text-[#6c7a1e]", width: "w-full" },
};

const PasswordStrength: FC<PasswordStrengthProps> = ({ password, open, id }) => {
  // The entropy model is fetched rather than bundled, so this mount is what
  // pulls it in. Flipping `ready` is the only reason to re-render for it.
  const [ready, setReady] = useState(isStrengthModelReady);
  useEffect(() => {
    if (ready) return;
    let live = true;
    loadStrengthModel().then(() => {
      if (live) setReady(isStrengthModelReady());
    });
    return () => {
      live = false;
    };
  }, [ready]);

  const strength = useMemo(() => evaluatePassword(password), [password, ready]);
  if (!open) return null;

  const meter = strength.level === "empty" ? null : METER[strength.level];

  return (
    <div
      id={id}
      data-password-strength={strength.level}
      // Not aria-live: it would announce on every keystroke. The rules are a
      // list the user can read on demand, and the submit button carries the
      // blocking message when it matters.
      className="pt-1">
      <div className="flex items-center gap-2.5">
        <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-black/10">
          <span
            className={cn("block h-full rounded-full transition-[width,background-color] duration-300", meter?.fill, meter?.width)}
          />
        </span>
        <span className={cn("flex-none text-[11px] font-semibold", meter ? meter.text : "text-black/30")}>
          {STRENGTH_LABEL[strength.level] || "—"}
        </span>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const met = strength.passed.includes(rule.id);
          return (
            <li
              key={rule.id}
              data-rule={rule.id}
              data-met={met}
              className={cn("inline-flex items-center gap-1 text-[11px] leading-tight", met ? "text-[#6c7a1e]" : "text-gray-500")}>
              {met ? (
                <Check className="h-3 w-3 flex-none" strokeWidth={3} aria-hidden />
              ) : (
                <span className="h-1 w-1 flex-none rounded-full bg-black/25" aria-hidden />
              )}
              {rule.label}
              {!rule.required && <span className="text-black/30">(optional)</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordStrength;
