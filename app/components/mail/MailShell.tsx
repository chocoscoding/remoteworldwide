import type { FC, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MailTabs from "./MailTabs";

/** Every Outreach screen: the section heading, the tab bar, then the screen's own title, actions and body. */
const MailShell: FC<{
  title: string;
  description?: string;
  actions?: ReactNode;
  back?: { href: string; label: string };
  children: ReactNode;
}> = ({ title, description, actions, back, children }) => (
  <div className="w-full min-h-screen min-w-0 p-4">
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Outreach</p>
    <MailTabs />
    {back ? (
      <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-black">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {back.label}
      </Link>
    ) : null}
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? <p className="text-sm text-gray-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    {children}
  </div>
);

export default MailShell;
