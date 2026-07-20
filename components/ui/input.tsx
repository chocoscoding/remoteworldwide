import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      data-slot="input"
      spellCheck="false"
      type={type}
      className={cn("flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base ", className)}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
