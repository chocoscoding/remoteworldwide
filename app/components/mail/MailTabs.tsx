"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/heroshima/outreach";

const TABS = [
  { label: "Analytics", href: BASE, exact: true },
  { label: "Campaigns", href: `${BASE}/campaigns` },
  { label: "Playbooks", href: `${BASE}/playbooks` },
  { label: "Offers", href: `${BASE}/offers` },
  { label: "Templates", href: `${BASE}/templates` },
  { label: "Audience", href: `${BASE}/audience` },
  { label: "Inbox", href: `${BASE}/inbox` },
] as const;

/** The Outreach section's tab bar, with the settings gear at its end. */
const MailTabs = () => {
  const pathname = usePathname() ?? "";
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const settings = active(`${BASE}/settings`);

  return (
    <nav aria-label="Outreach" className="mb-6 flex items-end gap-1 overflow-x-auto border-b border-gray-300">
      {TABS.map((tab) => {
        const on = active(tab.href, "exact" in tab ? tab.exact : false);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold",
              on ? "border-black text-black" : "border-transparent text-gray-500 hover:border-gray-400 hover:text-black",
            )}>
            {tab.label}
          </Link>
        );
      })}
      <Link
        href={`${BASE}/settings`}
        aria-label="Outreach settings"
        title="Outreach settings"
        aria-current={settings ? "page" : undefined}
        className={cn("-mb-px ml-auto border-b-2 px-3 py-2", settings ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black")}>
        <Settings className="h-4 w-4" aria-hidden />
      </Link>
    </nav>
  );
};

export default MailTabs;
