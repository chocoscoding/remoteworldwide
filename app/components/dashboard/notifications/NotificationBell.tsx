"use client";

// The bell, at the extreme right of the page header.
//
// Each dashboard screen draws its own header, so each one renders this as the
// LAST item of that header — whatever actions a screen adds sit to its left.
// A header with nothing on the right passes `className="ml-auto"`.
//
// Micro-interactions: the bell swings once when a new unread arrives (not on
// first paint, which would ring on every navigation), and the badge counts up.

import { useEffect, useRef, useState, type FC } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EmptyStateLottie from "@/app/components/dashboard/ui/EmptyStateLottie";
import { useNotificationsQuery } from "@/hooks/queries/useNotificationsQuery";
import { useMarkAllRead, useMarkRead } from "@/hooks/mutations/useNotificationMutations";
import type { NotificationItem } from "@/app/lib/notifications/types";

export interface NotificationBellProps {
  className?: string;
}

const NotificationBell: FC<NotificationBellProps> = ({ className }) => {
  const { data } = useNotificationsQuery();
  const markAllRead = useMarkAllRead();
  const markRead = useMarkRead();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  // Ring on arrival, not on mount: `seen` starts at whatever the first response says, so a fresh
  // page load with nine unread is silent and the tenth is what swings the bell.
  const seen = useRef<number | null>(null);
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    const previous = seen.current;
    seen.current = unread;
    if (previous === null || unread <= previous) return;

    setRinging(true);
    const timer = setTimeout(() => setRinging(false), 900);
    return () => clearTimeout(timer);
  }, [unread]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    // Opening it is reading it. Marking on close instead would leave the badge sitting there while
    // someone reads, which is the state the badge is supposed to mean something else.
    if (next && unread > 0) markAllRead.mutate();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
          className={cn(
            "relative grid h-9 w-9 flex-none place-content-center rounded-lg text-black/55 transition-colors cursor-pointer",
            "hover:bg-[#f3f3ef] hover:text-black/80",
            open && "bg-[#f0f0ea] text-black/80",
            className,
          )}>
          <motion.span
            aria-hidden
            animate={ringing && !reduceMotion ? { rotate: [0, -14, 11, -8, 5, 0] } : { rotate: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            style={{ originY: 0.1 }}
            className="inline-flex">
            <Bell className="h-[18px] w-[18px]" />
          </motion.span>

          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-content-center rounded-full bg-[#222325] px-1 text-[10px] font-extrabold text-[#e1f073] ring-2 ring-white tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      {/* Hangs down from the header, right-aligned so it never runs off the edge. */}
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        className="w-[340px] rounded-xl border-[1.5px] border-black/12 bg-white p-0 shadow-[4px_4px_0_0_rgba(34,35,37,0.12)]">
        <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
          <p className="text-[13px] font-bold text-primary">Notifications</p>
          {items.some((item) => !item.read) && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-black/40 hover:text-black/70 transition-colors cursor-pointer">
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-7">
            <EmptyStateLottie src="/Lottie/neobrutalism/Alert_Bell_lottie.json" size={96} />
            <p className="text-[13px] font-bold text-primary">Nothing yet</p>
            <p className="text-center text-xs leading-relaxed text-black/45">
              Your pod&apos;s comings and goings land here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[380px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.li
                  key={item.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}>
                  <Row item={item} onRead={() => markRead.mutate(item.id)} onNavigate={() => setOpen(false)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

const Row: FC<{ item: NotificationItem; onRead: () => void; onNavigate: () => void }> = ({ item, onRead, onNavigate }) => {
  const body = (
    <>
      <div className="flex items-start gap-2">
        {!item.read && <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[#222325]" />}
        <div className={cn("min-w-0 flex-1", item.read && "pl-3.5")}>
          <p className="text-[13px] font-bold leading-snug text-primary">{item.title}</p>
          {item.body && <p className="mt-0.5 text-xs leading-relaxed text-black/50">{item.body}</p>}
          <p className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-black/30">{item.time}</p>
        </div>
      </div>
    </>
  );

  const className = "block w-full border-b border-black/6 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#f6f6f6]";

  // A notification whose target is gone is still worth reading, so it stays a button rather than
  // becoming a dead link.
  if (!item.href) {
    return (
      <button type="button" onClick={onRead} className={cn(className, "cursor-pointer")}>
        {body}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={() => {
        onRead();
        onNavigate();
      }}
      className={cn(className, "cursor-pointer")}>
      {body}
    </Link>
  );
};

export default NotificationBell;
