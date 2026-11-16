"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = "/heroshima/outreach";

/** The everyday screens. Content is the templates library; offers are reached from it, so it stays lit there too. */
const TABS = [
  { label: "Overview", href: BASE, exact: true },
  { label: "Campaigns", href: `${BASE}/campaigns` },
  { label: "Playbooks", href: `${BASE}/playbooks` },
  { label: "Content", href: `${BASE}/templates`, also: [`${BASE}/offers`] },
  { label: "Inbox", href: `${BASE}/inbox` },
] as const;

/** The screens set up once and rarely opened: behind the gear. */
const MENU = [
  { label: "Audience", href: `${BASE}/audience` },
  { label: "Settings", href: `${BASE}/settings` },
] as const;

/** The Outreach section's tab bar, with the gear menu (audience and settings) at its end. */
const MailTabs = () => {
  const pathname = usePathname() ?? "";
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const active = (tab: (typeof TABS)[number]) => ("exact" in tab ? pathname === tab.href : under(tab.href) || ("also" in tab && tab.also.some(under)));
  const here = MENU.find((m) => under(m.href)) ?? null;

  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Close on a press outside or Escape (focus goes back to the gear).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="mb-6 flex items-end border-b border-gray-300">
      <nav aria-label="Outreach" className="flex min-w-0 flex-1 -mb-px items-end gap-1 overflow-x-auto overflow-y-hidden pb-px">
        {TABS.map((tab) => {
          const on = active(tab);
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
      </nav>

      <div ref={box} className="relative flex-none">
        <button
          ref={button}
          type="button"
          aria-label={here ? `Outreach setup: ${here.label}` : "Outreach setup"}
          title="Audience and settings"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold",
            here ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black",
          )}>
          <Settings className="h-4 w-4" aria-hidden />
          {here ? <span>{here.label}</span> : null}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open ? (
          <ul id={menuId} className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-md bg-white py-1 br-shadow">
            {MENU.map((item) => {
              const on = under(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn("block px-3 py-2 text-sm font-semibold hover:bg-gray-50", on ? "text-black" : "text-gray-600 hover:text-black")}>
                    {item.label}
                    {on ? <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-black align-middle" aria-hidden /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export default MailTabs;
