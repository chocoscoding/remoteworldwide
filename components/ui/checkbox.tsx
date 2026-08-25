"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

// Neobrutalist by default, matching `app/components/dashboard/ui/NeoCheckbox`:
// hard 2px ink border, flat offset shadow rather than a blur, near-square
// corners, lime fill when checked, and a press into the shadow on check.
// `authStyles.brutalistCheckbox` still layers over this via `className` —
// `cn()` de-duplicates the conflicting utilities so the auth override wins.
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid place-content-center peer h-5 w-5 shrink-0 rounded-[3px] border-2 border-[#222325] bg-white transition-all",
      "shadow-[2px_2px_0_0_#222325] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_#222325]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0_0_#222325]",
      "data-[state=checked]:bg-secondary data-[state=checked]:text-[#222325]",
      "data-[state=checked]:translate-x-px data-[state=checked]:translate-y-px data-[state=checked]:shadow-[1px_1px_0_0_#222325]",
      "data-[state=checked]:hover:translate-x-px data-[state=checked]:hover:translate-y-px data-[state=checked]:hover:shadow-[1px_1px_0_0_#222325]",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("grid place-content-center text-current")}
    >
      <Check className="h-3.5 w-3.5 stroke-[3.5]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
