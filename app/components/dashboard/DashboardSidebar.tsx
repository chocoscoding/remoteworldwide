"use client";
import { FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Send,
  FileText,
  Mail,
  ScanSearch,
  Settings,
  MessageCircle,
  HelpCircle,
  Mic,
  Kanban,
  Sparkles,
  Users,
  MessageSquare,
  FolderOpen,
  UsersRound,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LogoFull from "@/app/components/svg/LogoFull";
import LogoMini from "@/app/components/svg/LogoMini";
import { useSidebarCollapse } from "./SidebarCollapseContext";
import { photoOf } from "@/app/lib/dashboard/people-photos";
import { useActivity } from "./activity/ActivityProvider";

type NavItem = { id: string; label: string; href: string; icon: LucideIcon };
type NavGroup = { label?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ id: "home", label: "Home", href: "/dashboard", icon: Home }],
  },
  {
    label: "Build",
    items: [
      { id: "apply", label: "Apply to a job", href: "/dashboard/apply", icon: Send },
      { id: "resume", label: "Resume creator", href: "/dashboard/resume", icon: FileText },
      { id: "cover", label: "Cover letters", href: "/dashboard/cover", icon: Mail },
      { id: "ats", label: "ATS scorer", href: "/dashboard/ats", icon: ScanSearch },
    ],
  },
  {
    label: "Prepare",
    items: [
      { id: "coach", label: "Career coach", href: "/dashboard/coach", icon: MessageCircle },
      { id: "jdqa", label: "Ask about a job", href: "/dashboard/jdqa", icon: HelpCircle },
      { id: "prep", label: "Interview prep", href: "/dashboard/prep", icon: Mic },
    ],
  },
  {
    label: "Apply & after",
    items: [
      { id: "tracker", label: "Application tracker", href: "/dashboard/tracker", icon: Kanban },
      { id: "recommend", label: "Recommendations", href: "/dashboard/recommend", icon: Sparkles },
      { id: "referrals", label: "Referral search", href: "/dashboard/referrals", icon: Users },
      { id: "questions", label: "Application answers", href: "/dashboard/questions", icon: MessageSquare },
      { id: "vault", label: "My documents", href: "/dashboard/vault", icon: FolderOpen },
    ],
  },
  {
    label: "Together",
    items: [
      { id: "pod", label: "Your pod", href: "/dashboard/pod", icon: UsersRound },
      { id: "invites", label: "Invite friends", href: "/dashboard/invites", icon: Gift },
    ],
  },
];

const DashboardSidebar: FC = () => {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebarCollapse();
  // Reads the derived ledger balance. This used to be a hardcoded 18 that
  // silently disagreed with the streak panel the moment anything was earned.
  const { credits, openCredits } = useActivity();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "flex-none bg-white border-r border-black/10 h-screen sticky top-0 flex flex-col transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[252px]"
      )}>
      {/* Header */}
      <div className={cn("h-16 flex-none border-b border-black/8 flex items-center", collapsed ? "justify-center px-2" : "justify-between px-[18px]")}>
        {collapsed ? <LogoMini className="h-[22px] w-auto" /> : <LogoFull className="h-[19px] w-auto" />}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="grid h-7 w-7 flex-none place-content-center rounded-lg text-black/40 hover:bg-[#f3f3ef] hover:text-black/70 transition-colors cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="mx-auto mt-2 grid h-7 w-7 flex-none place-content-center rounded-lg text-black/40 hover:bg-[#f3f3ef] hover:text-black/70 transition-colors cursor-pointer">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Nav body */}
      <nav className={cn("flex-1 overflow-y-auto py-3.5 flex flex-col gap-4", collapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.label ?? `group-${groupIdx}`}>
            {group.label && !collapsed && (
              <p className="text-[10.5px] font-bold tracking-[0.09em] uppercase text-black/40 px-3 pb-1.5">{group.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm cursor-pointer transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5",
                      active ? "font-bold bg-[#222325] text-white" : "font-medium text-black/70 hover:bg-[#f3f3ef]"
                    )}>
                    <item.icon className="h-[17px] w-[17px] flex-none" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn("flex-none border-t border-black/8", collapsed ? "p-2" : "p-3")}>
        {!collapsed && (
          <div className="rounded-2xl border border-black/10 bg-[#fbfbf7] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-primary">Free plan</span>
              <button
                type="button"
                onClick={openCredits}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-primary transition-colors hover:bg-secondary2 cursor-pointer">
                {credits} credits
              </button>
            </div>
            <p className="text-xs text-black/60 mb-3">Spend them on freezes, rewrites or a day of Pro.</p>
            <button
              type="button"
              onClick={openCredits}
              className="w-full border border-black text-xs font-bold rounded-lg py-1.5 text-center cursor-pointer hover:shadow-[3px_3px_0_0_#e1f073] hover:-translate-x-px hover:-translate-y-px transition-all">
              Spend credits
            </button>
          </div>
        )}

        {/* The profile block is the way into settings — clicking your own
            name is where people look for it first. */}
        <Link
          href="/dashboard/settings/profile"
          title={collapsed ? "Amara Okafor · Settings" : "Profile and settings"}
          className={cn(
            "flex items-center mt-3 rounded-lg py-1.5 transition-colors cursor-pointer",
            collapsed ? "justify-center px-1" : "gap-2.5 px-1",
            isActive("/dashboard/settings") ? "bg-[#f0f0ea]" : "hover:bg-[#f3f3ef]"
          )}>
          <div className="h-8 w-8 flex-none overflow-hidden rounded-full bg-[#222325] text-[#e1f073] font-extrabold text-xs flex items-center justify-center">
            {photoOf("Amara Okafor") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoOf("Amara Okafor")!} alt="" className="h-full w-full object-cover" />
            ) : (
              "AO"
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-primary truncate">Amara Okafor</p>
              <p className="text-[11px] text-black/50 truncate">Lagos · GMT+1</p>
            </div>
          )}
          {!collapsed && <Settings className="h-3.5 w-3.5 flex-none text-black/35" />}
        </Link>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
