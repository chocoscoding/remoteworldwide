"use client";
import { FC } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FilePen,
  FileText,
  FolderOpen,
  Gift,
  HelpCircle,
  Home,
  Kanban,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  ScanSearch,
  Send,
  Settings,
  Sparkles,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LogoFull from "@/app/components/svg/LogoFull";
import LogoMini from "@/app/components/svg/LogoMini";
import { useSidebarCollapse } from "./SidebarCollapseContext";
import { useSettings } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import ScoreRing from "@/app/components/dashboard/ui/ScoreRing";
import { useBilling } from "@/app/(pages)/(dashboard)/dashboard/settings/BillingProvider";
import { useInviteSummary } from "@/hooks/queries/useInviteSummary";
import type { InviteSummary } from "@/app/lib/invites/types";

type NavItem = { id: string; label: string; href: string; icon: LucideIcon; tag?: NavTag };
type NavGroup = { label?: string; items: NavItem[] };

/**
 * A static tag on a nav row: what powers the screen, not a count. "Ext", not
 * "Extension": at the rail's 252px the full word beside "Application drafts"
 * runs past the row in Manrope bold, so the whole phrase rides the hover title
 * and the screen-reader text instead.
 */
interface NavTag {
  label: string;
  description: string;
}

interface InviteMeter {
  label: string;
  /** The whole sentence: hover title and screen-reader text. */
  description: string;
  earned: boolean;
}

/**
 * The invite row's meter. It rides the "Invite friends" item rather than the
 * avatar because the avatar ring is PLAN credits, and two numbers on one face
 * would read as one balance. Silent until the link has done something: a "0"
 * on a nav row is noise, not motivation.
 */
function inviteMeterOf(summary: InviteSummary | undefined): InviteMeter | null {
  if (!summary) return null;
  const { creditsEarned, creditsPending, joined } = summary;
  if (creditsEarned === 0 && creditsPending === 0) return null;
  const pending =
    joined > 0
      ? ` · ${creditsPending} pending from ${joined} ${joined === 1 ? "person who joined but hasn't" : "people who joined but haven't"} subscribed yet`
      : "";
  return {
    label: creditsEarned > 0 ? `+${creditsEarned}` : `${creditsPending} pending`,
    description: `Referral credits from your invite link: ${creditsEarned} earned${pending}. Separate from your plan credits.`,
    earned: creditsEarned > 0,
  };
}

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
      { id: "saved", label: "Saved jobs", href: "/dashboard/saved", icon: Bookmark },
      {
        id: "drafts",
        label: "Application drafts",
        href: "/dashboard/drafts",
        icon: FilePen,
        tag: { label: "Ext", description: "Saved by the RemoteWorldwide extension" },
      },
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

/** The share of the plan's allowance left at which the credit ring turns red. */
const LOW_CREDITS_SHARE = 0.1;

const DashboardSidebar: FC = () => {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebarCollapse();
  // Plan credits, from the same source the billing screen reads, so the two
  // meters cannot disagree. Not the invite meter on the "Invite friends" row,
  // which counts referral credits earned through invites.
  const { subscription } = useBilling();
  // The real account, not a mock lookup: whatever OAuth stored or the user
  // uploaded, already resolved to a URL by the settings serializer.
  const { profile } = useSettings();
  const displayName = profile.fullName || "Your account";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const credits = subscription.creditBalance;
  const allowance = subscription.monthlyCredits || credits;
  // Low at a tenth of the plan's allowance or less. With no plan the allowance
  // is the wallet itself, so only an empty one is low.
  const lowCredits = credits <= allowance * LOW_CREDITS_SHARE;
  // Referral credits — the other currency — from the backend's counts-only
  // summary, the same numbers the invites page shows.
  const inviteMeter = inviteMeterOf(useInviteSummary().data);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside
      className={cn(
        "scrollbar-hover-root flex-none bg-white border-r border-black/10 h-screen sticky top-0 flex flex-col transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[252px]",
      )}>
      {/* Header — the notification bell lives at the right end of each page header, not here. */}
      <div
        className={cn("h-16 flex-none border-b border-black/8 flex items-center", collapsed ? "justify-center px-2" : "justify-between px-[18px]")}>
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
        <div className="mt-2 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="grid h-7 w-7 flex-none place-content-center rounded-lg text-black/40 hover:bg-[#f3f3ef] hover:text-black/70 transition-colors cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Nav body */}
      <nav className={cn("scrollbar-hover flex-1 overflow-y-auto py-3.5 flex flex-col gap-4", collapsed ? "px-2" : "px-3")}>
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.label ?? `group-${groupIdx}`}>
            {group.label && !collapsed && (
              <p className="text-[10.5px] font-bold tracking-[0.09em] uppercase text-black/40 px-3 pb-1.5">{group.label}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const meter = item.id === "invites" ? inviteMeter : null;
                const note = meter?.description ?? item.tag?.description;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={note ? (collapsed ? `${item.label} — ${note}` : note) : collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm cursor-pointer transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5",
                      active ? "font-bold bg-[#222325] text-white" : "font-medium text-black/70 hover:bg-[#f3f3ef]",
                    )}>
                    <item.icon className="h-[17px] w-[17px] flex-none" />
                    {!collapsed && <span>{item.label}</span>}
                    {meter && !collapsed && (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            "ml-auto flex-none rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none tabular-nums",
                            active
                              ? "bg-white/15 text-[#e1f073]"
                              : meter.earned
                                ? "bg-[#e1f073] text-[#222325]"
                                : "border border-dashed border-black/25 text-black/55",
                          )}>
                          {meter.label}
                        </span>
                        <span className="sr-only">{meter.description}</span>
                      </>
                    )}
                    {item.tag && !collapsed && (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            "ml-auto flex-none rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none",
                            active ? "bg-white/15 text-white/85" : "bg-[#f0f0ea] text-black/60",
                          )}>
                          {item.tag.label}
                        </span>
                        <span className="sr-only">{item.tag.description}</span>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn("flex-none border-t border-black/8", collapsed ? "p-2" : "p-3")}>
        {/* The profile block is the way into settings — clicking your own name
            is where people look for it first. The credit meter rides the avatar
            rather than a panel of its own: it is a standing fact about the
            account, like the face is, and it survives the collapsed rail where a
            panel could not. The ring fills with the credits LEFT against the
            plan allowance, lime while there are plenty and red once they run
            low. */}
        <Link
          href="/dashboard/settings/profile"
          title={
            allowance > 0
              ? `${credits} credits left${lowCredits ? ", running low" : ""} · ${Math.max(0, allowance - credits)} of ${allowance} used`
              : "No credits yet"
          }
          className={cn(
            "flex min-w-0 items-center rounded-lg py-1.5 transition-colors cursor-pointer",
            collapsed ? "justify-center px-1" : "gap-2.5 px-1",
            isActive("/dashboard/settings") ? "bg-[#f0f0ea]" : "hover:bg-[#f3f3ef]",
          )}>
          <ScoreRing
            value={allowance > 0 ? Math.min(100, Math.round((credits / allowance) * 100)) : 0}
            size={40}
            // Red, and a red track too, so an empty ring still reads as "out".
            fillColor={lowCredits ? "#b23c26" : undefined}
            trackColor={lowCredits ? "#f2d3cc" : undefined}
            label={
              <span className="grid h-full w-full place-content-center overflow-hidden rounded-full bg-[#222325] text-xs font-extrabold text-[#e1f073]">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
            }
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-primary truncate">{displayName}</p>
              <p className={cn("text-[11px] truncate", lowCredits ? "font-semibold text-[#b23c26]" : "text-black/50")}>{credits} credits left</p>
            </div>
          )}
          {!collapsed && <Settings className="h-3.5 w-3.5 flex-none text-black/35" />}
        </Link>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
