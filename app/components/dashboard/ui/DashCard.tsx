import { FC, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Base white card shell used by nearly every panel across the Job Seeker
 * Dashboard. White bg, rounded-2xl, hairline border. Default padding is
 * `p-5` — override it (or add more classes) via `className`, which is
 * merged last so it always wins over the default padding.
 */
export interface DashCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

const DashCard: FC<DashCardProps> = ({ className, children, ...rest }) => {
  return (
    <div className={cn("bg-white rounded-2xl border border-black/10 p-5", className)} {...rest}>
      {children}
    </div>
  );
};

export default DashCard;
