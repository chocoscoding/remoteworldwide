import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "rounded-md bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "rounded-md bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "rounded-md border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "rounded-md bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "rounded-md border border-0 hover:border-1 hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brutalist:
          "rounded-md border-2 border-black  text-primary shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all",
        "brutalist-accent":
          "rounded-none border-2 border-black bg-primary text-primary-foreground shadow-[5px_5px_0px_0px_#e1f073] hover:shadow-[2px_2px_0px_0px_#e1f073] hover:translate-x-[3px] hover:translate-y-[3px] transition-all",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
