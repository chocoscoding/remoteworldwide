import { FC } from "react";
import { cn } from "@/lib/utils";
import { renderAnswerParts } from "@/app/components/dashboard/answers/AnswersProvider";

/**
 * Renders an answer, drawing `{company}` tokens as the one accent moment in
 * the row — a lime chip in the library (where the company is unknown), the
 * real company name highlighted inline once there is one.
 */
export interface AnswerTextProps {
  text: string;
  /** Substitutes the token. Omit in the library view. */
  company?: string;
  className?: string;
}

const AnswerText: FC<AnswerTextProps> = ({ text, company, className }) => (
  <p className={cn("text-sm leading-relaxed text-black/75", className)}>
    {renderAnswerParts(text, company).map((part, i) =>
      part.type === "company" ? (
        <span
          key={i}
          title={company ? `Filled in for ${company}` : "Swapped for the company you're applying to"}
          className="mx-px inline-flex items-center rounded-md bg-[#e1f073] px-1.5 py-0.5 text-[13px] font-bold text-[#222325]">
          {part.text}
        </span>
      ) : (
        <span key={i}>{part.text}</span>
      )
    )}
  </p>
);

export default AnswerText;
