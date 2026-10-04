"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-2",
      className
    )}
    {...props}
  >
    {/* The editor's slider (owner, 2026-10-04): a slim rounded track filled in ink up to a round ink thumb. */}
    <SliderPrimitive.Track className="relative h-[7px] w-full grow overflow-hidden rounded-full border border-black/15 bg-[#f0f0ea]">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-[#222325]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-[18px] w-[18px] flex-none cursor-grab rounded-full bg-[#222325] transition-transform duration-100 hover:scale-110 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1f073] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
