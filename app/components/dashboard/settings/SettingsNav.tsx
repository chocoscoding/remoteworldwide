"use client";

import { FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CreditCard, Lock, MonitorSmartphone, SlidersHorizontal, User, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

export const SETTINGS_NAV: NavItem[] = [
  { href: "/dashboard/settings/profile", label: "Profile", hint: "Name, headline, links", icon: User },
  { href: "/dashboard/settings/preferences", label: "Job preferences", hint: "Roles, salary, availability", icon: SlidersHorizontal },
  { href: "/dashboard/settings/notifications", label: "Notifications", hint: "Email and reminders", icon: Bell },
  { href: "/dashboard/settings/billing", label: "Plan & billing", hint: "Credits, invoices, Pro", icon: CreditCard },
  { href: "/dashboard/settings/privacy", label: "Privacy", hint: "Who can find you", icon: Lock },
  { href: "/dashboard/settings/account", label: "Account", hint: "Email, password, sign-in", icon: UserCog },
  { href: "/dashboard/settings/sessions", label: "Sessions", hint: "Devices signed in", icon: MonitorSmartphone },
];

const SettingsNav: FC = () => {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-2">
      {SETTINGS_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-start gap-2.5 rounded-lg border-[1px] px-3 py-2.5 transition-[transform,box-shadow,border-color,background-color] duration-100 ease-out",
              "active:translate-x-0 active:translate-y-0 active:shadow-none",
              active
                ? "-translate-x-[2px] -translate-y-[2px] border-[#222325] bg-[#222325] text-white shadow-[4px_4px_0_0_#e1f073]"
                : "border-[rgba(34,35,37,.16)] bg-white text-black/70 hover:-translate-x-px hover:-translate-y-px hover:border-[#222325] hover:shadow-[3px_3px_0_0_#222325]",
            )}>
            <item.icon
              className={cn(
                "mt-0.5 h-4 w-4 flex-none transition-colors",
                active ? "text-[#e1f073]" : "text-black/40 group-hover:text-[#222325]",
              )}
            />
            <span className="min-w-0">
              <span className={cn("block text-sm truncate", active ? "font-bold" : "font-semibold")}>{item.label}</span>
              <span className={cn("block text-xs truncate", active ? "text-white/50" : "text-black/40")}>{item.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default SettingsNav;
