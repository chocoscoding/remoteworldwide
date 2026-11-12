import type { FC } from "react";
import { cn } from "@/lib/utils";
import { MAIL_LEVEL_HINTS, MAIL_LEVEL_LABELS, MAIL_LEVEL_STYLE, type MailLevel } from "@/app/lib/mail/userMail";

/** A person's mail engagement level (Engaged, Reading, Quiet, Unreachable, Never mailed), its rule in the title. */
const MailLevelBadge: FC<{ level: MailLevel; className?: string }> = ({ level, className }) => (
  <span
    title={MAIL_LEVEL_HINTS[level]}
    className={cn("inline-flex flex-none items-center rounded-full border px-2 py-0.5 text-[11px] font-bold leading-4", MAIL_LEVEL_STYLE[level] ?? MAIL_LEVEL_STYLE.none, className)}>
    {MAIL_LEVEL_LABELS[level] ?? level}
  </span>
);

export default MailLevelBadge;
