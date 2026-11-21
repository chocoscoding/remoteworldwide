import type { FC, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MailTabs from "../MailTabs";
import { AUDIENCE_HREF } from "./filterText";

/** MailShell's frame without its title: on an audience the name is the title, edited in place by the editor. */
const AudienceShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="w-full min-h-screen min-w-0 p-4">
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Outreach</p>
    <MailTabs />
    <Link href={AUDIENCE_HREF} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-black">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Audience
    </Link>
    {children}
  </div>
);

export default AudienceShell;
